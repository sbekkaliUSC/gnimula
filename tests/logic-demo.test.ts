import {test} from 'node:test';
import assert from 'node:assert/strict';
import {logicCircuit,logicPayload} from '../backend/shared/logic-demo';
import {checkCircuit,spice} from '../backend/shared/circuit';
for(const kind of ['xor','inverter'] as const)test(kind+' opens as connected SKY130 MOS logic',()=>{
 const d=logicCircuit(kind),p=logicPayload(d);assert.deepEqual(checkCircuit(d),[]);assert.equal(p.devices.length,kind==='xor'?12:2);assert.ok(p.devices.every(x=>x.b===(x.kind==='pmos'?'vdd':'0')));assert.match(spice(d),/PWL\(/);assert.doesNotMatch(spice(d),/XXAN/);
});
test('logic measurements reject incompatible testbench edits but accept sizing/load changes',()=>{
 const d=logicCircuit('xor');d.components.find(c=>c.ref==='CL')!.value=80e-15;d.components.find(c=>c.ref==='XAN')!.w=2;assert.doesNotThrow(()=>logicPayload(d));
 for(const alter of [(x:typeof d)=>x.analysis.stop=1e-9,(x:typeof d)=>x.components.find(c=>c.ref==='VDD')!.dc=3.3,(x:typeof d)=>x.components.find(c=>c.ref==='VA')!.waveform='PULSE(0 1.8 0 1n 1n 5n 10n)']){const changed=structuredClone(d);alter(changed);assert.throws(()=>logicPayload(changed),/testbench|input vectors/);}
});
