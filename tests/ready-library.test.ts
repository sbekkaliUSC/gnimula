import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,prepareItem,prepareLink} from '../backend/ready-service';
import {applyLibraryTool,assertReady,prepareSky130Record} from '../backend/shared/ready-library';
import {netMap,spice,starter,validateCircuit} from '../backend/shared/circuit';
import publicRows from '../backend/data/sky130-circuits.json';

test('every advertised circuit is connected and has an input, output, testbench and source',()=>{
 for(const item of catalog.filter(x=>x.kind==='circuit')){const b=prepareItem(item.id);assertReady(b.document);assert.ok(b.reference.content);assert.ok(b.item.goal);assert.equal(b.item.id,item.id);}
});
test('SKY130 preparation preserves testbench parameters and distinct body connections, not conflicting graph values',()=>{
 const row=publicRows[0];const b=prepareSky130Record(row.row,row.offset),doc=b.document,n=netMap(doc);
 for(const line of row.row.testbench_spice.split('\n').filter(l=>/^X\S+\s/.test(l))){const t=line.split(/\s+/),c=doc.components.find(x=>x.ref===t[0])!;assert.ok(c);assert.equal(c.deviceModel,t[5]);assert.equal(c.w,Number(t[6].slice(2)));assert.equal(c.l,Number(t[7].slice(2)));assert.equal(c.bulk,true);if(t[3]!==t[4])assert.notEqual(n.get(c.id+'.s'),n.get(c.id+'.b'));}
 assert.ok(doc.components.some(c=>c.kind==='current'));assert.ok(spice(doc).includes('sky130_fd_pr__'));assert.equal(doc.components.filter(c=>c.kind==='voltage'&&c.ac!==0).length,1);
 assert.ok(b.notes.some(x=>x.includes('not its separate graph')));assert.ok(b.reference.content.includes('testbench_spice'));
 const bad=structuredClone(doc);bad.components.find(c=>c.deviceModel)!.deviceModel='external' as any;assert.throws(()=>validateCircuit(bad));
});
test('source controls cannot add executable directives or unsupported dependencies',()=>{
 const row=publicRows[0];for(const bad of ['.include /secret','.param gain=1','Xevil out in 0 0 arbitrary_model W=1 L=1'])assert.throws(()=>prepareSky130Record({...row.row,testbench_spice:row.row.testbench_spice+'\n'+bad},0));
 const b=prepareSky130Record({...row.row,testbench_spice:row.row.testbench_spice.replace('.control','.control\nshell touch /tmp/unsafe')},0);assert.ok(!spice(b.document).includes('shell'));
});
test('measurement tools preserve circuit wiring, device values and the original document',()=>{
 const original=starter(),before=structuredClone(original);
 for(const id of ['ac','dc','sine']){const {document:d,view}=applyLibraryTool(original,id);assert.equal(view,'simulation');assert.deepEqual(d.wires,original.wires);assert.equal(d.components.length,original.components.length);assert.deepEqual(d.components.filter(c=>c.kind!=='voltage'),original.components.filter(c=>c.kind!=='voltage'));assertReady(d);}
 assert.deepEqual(original,before);
 const a=applyLibraryTool(original,'contact').document,b=applyLibraryTool(a,'via').document;validateCircuit(b);assert.equal(b.shapes.length,original.shapes.length+6);assert.deepEqual(b.components,original.components);
 assert.throws(()=>applyLibraryTool(starter('blank'),'ac'),/ground|voltage|input/i);
});
test('public links reject arbitrary hosts, credentials and repository pages before fetching',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('unexpected');};
 try{for(const link of ['http://github.com/a/b/blob/main/test.cir','https://localhost/private','https://user:pass@github.com/a/b/blob/main/test.cir','https://github.com/a/b','https://github.com/a/b/blob/main/test.cir?token=secret'])await assert.rejects(()=>prepareLink(link));assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
