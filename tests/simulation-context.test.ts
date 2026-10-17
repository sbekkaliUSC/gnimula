import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisContext,componentReferenceMap,parameterChanges,parameterDisplay,simulationContext} from '../backend/shared/simulation-context';
import {starter} from '../backend/shared/circuit';

test('AC summary separates points per decade, total stored samples and the bounded excerpt',()=>{
 const doc=starter();doc.analysis={...doc.analysis,points:100,start:1,stop:1e10};
 const rows=Array.from({length:1001},(_,i)=>[10**(i/100),31.47-i*.1,0]);
 const summary=simulationContext({revision:doc.revision,mode:'ac',rows},doc)!;
 assert.equal(summary.totalSamples,1001);assert.equal(summary.analysisAtRun?.pointsSetting,100);
 assert.match(summary.analysisAtRun!.pointsMeaning,/per decade/);assert.equal(summary.sampledRows.length,12);
 assert.deepEqual(summary.sampledRows[0],rows[0]);assert.deepEqual(summary.sampledRows.at(-1),rows.at(-1));
 assert.equal(summary.sweep?.first,1);assert.equal(summary.sweep?.last,1e10);
 assert.equal(summary.gainDb?.first,31.47);assert.equal(summary.gainDb?.max,31.47);
 assert.equal(summary.gainDb?.last,-68.53);assert.equal(summary.gainDb?.min,-68.53);
 assert.equal(summary.gainDb?.minimumAtHz,1e10);assert.equal(summary.matchesCurrentRevision,true);
});
test('summary extrema inspect the entire result rather than only the sampled excerpt',()=>{
 const doc=starter(),rows=Array.from({length:120},(_,i)=>[i+1,0]);rows[37][1]=12;rows[53][1]=-91;
 const summary=simulationContext({revision:0,mode:'ac',rows},doc)!;
 assert.equal(summary.gainDb?.max,12);assert.equal(summary.gainDb?.maximumAtHz,38);
 assert.equal(summary.gainDb?.min,-91);assert.equal(summary.gainDb?.minimumAtHz,54);
});
test('old measurements retain their old sweep and quantify changes using visible component references',()=>{
 const prior=starter();prior.analysis={...prior.analysis,start:1,stop:1e10,points:100};
 const oldCap=prior.components.find(c=>c.kind==='capacitor')!;oldCap.id='internal_cap_id';oldCap.ref='CL';oldCap.value=100e-12;
 const current=structuredClone(prior);current.revision=2;current.analysis={...current.analysis,start:10,stop:1e6,points:40};
 current.components.find(c=>c.id==='internal_cap_id')!.value=3e-9;
 const summary=simulationContext({revision:0,mode:'ac',rows:[[1,31.47],[1e10,-30]]},current,prior)!;
 assert.equal(summary.matchesCurrentRevision,false);assert.match(summary.status,/stale/);
 assert.equal(summary.analysisAtRun?.start,1);assert.equal(summary.analysisAtRun?.pointsSetting,100);
 const change=summary.changesSinceRun!.changes[0];assert.equal(change.ref,'CL');assert.equal(change.id,'internal_cap_id');
 assert.equal(change.from,100e-12);assert.equal(change.to,3e-9);assert.equal(change.unit,'F');assert.equal(change.ratio,30);assert.equal(change.percentChange,2900);
 assert.equal(componentReferenceMap(current).internal_cap_id.ref,'CL');
 assert.equal(simulationContext({revision:0,mode:'ac',rows:[]},current)?.analysisAtRun,null);
});
test('unknown revisions and invalid rows do not imply a current measurement or invented sweep',()=>{
 const doc=starter();
 assert.equal(simulationContext(null,doc),null);
 const summary=simulationContext({mode:'ac',rows:[[1,2],[2,Infinity],[3,4]]},doc)!;
 assert.equal(summary.matchesCurrentRevision,false);assert.equal(summary.status,'unknown revision');
 assert.equal(summary.analysisAtRun,null);assert.equal(summary.totalSamples,3);assert.equal(summary.validSamples,2);
 assert.equal(summary.sampledRowsCount,2);assert.equal(summary.gainDb?.last,4);
 const empty=simulationContext({revision:0,mode:'ac',rows:[]},doc)!;assert.equal(empty.gainDb,null);assert.equal(empty.sweep,null);
});
test('DC and transient summaries use voltage output and their actual points semantics',()=>{
 const doc=starter('mirror');
 const dc=simulationContext({revision:0,mode:'dc',rows:[[0,1],[1,2]]},doc)!;
 assert.equal(dc.gainDb,null);assert.equal(dc.outputVoltageV?.max,2);assert.match(analysisContext(doc).pointsMeaning,/intervals/);
 doc.analysis.mode='tran';assert.match(analysisContext(doc).pointsMeaning,/not used/);
 const current=structuredClone(doc);current.components.find(c=>c.kind==='voltage')!.dc=0;
 const next=structuredClone(current);next.components.find(c=>c.kind==='voltage')!.dc=2;
 assert.equal(parameterChanges(current,next).changes[0].ratio,null);
});
test('visible component context grounds small capacitor values in both farads and picofarads',()=>{
 const doc=starter(),cap=doc.components.find(c=>c.kind==='capacitor')!;cap.value=4e-14;cap.ref='CL';
 const context=componentReferenceMap(doc)[cap.id];assert.equal(context.ref,'CL');
 assert.equal(context.displayValues.value.display,'0.04 pF');assert.equal(context.displayValues.value.farads,4e-14);
 assert.equal(context.displayValues.value.picofarads,0.04);assert.equal(context.displayValues.value.siValue,4e-14);
 assert.equal(parameterDisplay(47000,'ohm').display,'47 kΩ');assert.equal(parameterDisplay(4,'µm').siValue,4e-6);
 const changed=structuredClone(doc);changed.components.find(c=>c.id===cap.id)!.value=4e-13;
 const delta=parameterChanges(doc,changed).changes[0];assert.equal(delta.fromDisplay.display,'0.04 pF');assert.equal(delta.toDisplay.display,'0.4 pF');assert.equal(delta.ratio,10);
});
