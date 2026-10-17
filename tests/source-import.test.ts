import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importSource} from '../backend/shared/source-import';
import {spice,checkCircuit,netMap,validateCircuit,applyOperations,nextReference} from '../backend/shared/circuit';
import {validateDefinitions} from '../backend/shared/spice-data';

const deck=`Hierarchical RC with a pulse input
.subckt filter a z g params: r=1k
R1 a z {r}
C1 z g 1u
.ends filter
VIN signal 0 PULSE(0 1 0 1u 1u 2m 4m)
X1 signal result 0 filter r=2k
.tran 10u 8m
.print tran v(result)
.end`;
test('hierarchy retains terminals, model parameters, waveform, connectivity and sweep',()=>{
 const {document:d}=importSource('hierarchy.sp',deck);validateCircuit(d);
 assert.deepEqual(d.components.find(c=>c.ref==='X1')?.device,{prefix:'X',terminals:['a','z','g'],parameters:'filter r=2k',model:'filter'});
 assert.equal(d.components.find(c=>c.ref==='VIN')?.waveform,'PULSE(0 1 0 1u 1u 2m 4m)');
 assert.equal(d.analysis.mode,'tran');assert.equal(d.analysis.stop,.008);assert.equal(netMap(d).get(d.analysis.output),'result');assert.deepEqual(checkCircuit(d).filter(i=>i.level==='error'),[]);
 const generated=spice(d);assert.match(generated,/X1 signal result 0 filter r=2k/);assert.match(generated,/R1 a z \{r\}/);assert.match(generated,/PULSE\(0 1/);
});
test('missing models open as editable devices and block simulation with a specific issue',()=>{
 const {document:d}=importSource('bjt.cir','NPN cell\nVCC supply 0 3.3\nR1 supply out 1k\nQ1 out supply 0 real_npn\n.print ac v(out)');
 assert.equal(d.components.find(c=>c.ref==='Q1')?.device?.model,'real_npn');assert.ok(checkCircuit(d).some(i=>i.message.includes('real_npn is missing')));assert.match(spice(d),/Q1 out supply 0 real_npn/);
});
test('source control scripts are retained only by caller as provenance, never executable',()=>{
 const {document:d}=importSource('safe.cir',deck+'\n.control\nshell touch /tmp/not-allowed\n.endc');assert.doesNotMatch(spice(d),/shell|touch/);
 for(const directive of ['.include /etc/passwd','.control','shell echo nope','.lib secret tt','.option spiceinit=1'])assert.throws(()=>validateDefinitions([directive]));
 assert.throws(()=>importSource('unsafe.cir',deck.replace('filter r=2k','filter r=`id`')));
});
test('cell-only hierarchy opens without inventing supplies or a simulation result',()=>{
 const {document:d}=importSource('cell.lib','.subckt stage input output ground\nR1 input output 1k\nC1 output ground 1n\n.ends stage');
 assert.equal(d.components.length,1);assert.equal(d.components[0].device?.model,'stage');assert.ok(checkCircuit(d).some(i=>i.message==='Add a voltage source.'));
});
test('source pins survive edits; disconnected nets do not silently reconnect by alias',()=>{
 const {document:d}=importSource('hierarchy.cir',deck),w=d.wires.find(w=>w.from.pin==='p')!;
 const changed=applyOperations(d,[{type:'delete_wire',id:w.id}]),map=netMap(changed);
 assert.notEqual(map.get(`${w.from.component}.${w.from.pin}`),map.get(`${w.to.component}.${w.to.pin}`));validateCircuit(changed);
});
test('four-terminal BJTs preserve substrate and model identity even when the model is absent',()=>{
 for(const model of ['.model local_npn NPN (IS=1e-14 BF=100)','']){
  const {document:d}=importSource('substrate.cir',`Substrate test\nVDD rail 0 3.3\nR1 rail out 1k\nQ1 out rail 0 0 local_npn\n${model}\n.print ac v(out)`);
  const q=d.components.find(c=>c.ref==='Q1')!;assert.deepEqual(q.device?.terminals,['c','b','e','s']);assert.equal(q.device?.model,'local_npn');assert.match(spice(d),/Q1 out rail 0 0 local_npn/);
 }
});
test('BJT OFF flag does not become a model or substrate terminal',()=>{
 const {document:d}=importSource('bjt.cir','BJT test\nQ1 out base 0 local_npn off');
 const q=d.components[0];assert.deepEqual(q.device?.terminals,['c','b','e']);assert.equal(q.device?.model,'local_npn');assert.match(spice(d),/Q1 out base 0 local_npn off/);
});
test('duplicating imported devices preserves their SPICE type and avoids case-insensitive reference collisions',()=>{
 const {document:d}=importSource('bjt.cir','BJT test\nq1 out base 0 local_npn');
 const q=d.components[0],copy={...q,id:'copy',ref:nextReference(q.device!.prefix,d.components)};d.components.push(copy);
 assert.equal(copy.ref,'Q2');validateCircuit(d);assert.match(spice(d),/Q2 \S+ \S+ \S+ local_npn/);
});
test('cell-only import selects the hierarchy root regardless of definition order',()=>{
 const parent='.subckt amplifier in out\nXbuf in out buffer\n.ends amplifier',child='.subckt buffer a b\nR1 a b 1k\n.ends buffer';
 for(const text of [parent+'\n'+child,child+'\n'+parent]){
  const {document:d}=importSource('amplifier.sp',text);assert.equal(d.components[0].device?.model,'amplifier');assert.deepEqual(d.components[0].device?.terminals,['in','out']);
 }
 assert.throws(()=>importSource('library.sp',child+'\n.subckt unrelated a b\nC1 a b 1n\n.ends unrelated'),/multiple independent cells/);
});
