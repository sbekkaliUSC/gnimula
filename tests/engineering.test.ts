import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {logicCircuit} from '../examples/mos-logic';
import {circuitFromTool,normalizeTools,simulationPayload,physicalDevices} from '../backend/shared/engineering';
import {parseAgentResult} from '../backend/shared/agent';
import {checkCircuit,starter} from '../backend/shared/circuit';
const nand=readFileSync(new URL('./fixtures/engineering/nand.cir',import.meta.url),'utf8');
for(const kind of ['xor','inverter'] as const)test(kind+' is ordinary editable circuit data',()=>{
 const d=logicCircuit(kind);assert.deepEqual(checkCircuit(d),[]);assert.equal(physicalDevices(d).length,kind==='xor'?12:2);assert.ok(!('logicKind' in d));
 d.analysis.stop=240e-9;d.components.find(c=>c.ref==='VA')!.waveform='PULSE(0 1.8 0 1n 1n 20n 40n)';assert.equal(simulationPayload(d).analysis.stop,240e-9);
});
test('general tools support independent NAND, arbitrary nets and analysis settings',()=>{
 const d=circuitFromTool({action:'create_circuit',netlist:nand});assert.equal(physicalDevices(d).length,4);assert.equal(simulationPayload(d).output,'z');assert.equal(simulationPayload(d).input,'u');assert.equal(d.analysis.stop,80e-9);assert.equal(d.components.filter(c=>c.kind==='device').length,0);
 assert.deepEqual(normalizeTools(d,[{action:'simulate'},{action:'generate_layout'},{action:'verify_layout'},{action:'simulate_extracted'}]).map(x=>x.action),['simulate','generate_layout','verify_layout','simulate_extracted']);
});
test('tool plans require explicit replacement, supported geometry and existing layout',()=>{
 assert.throws(()=>normalizeTools(starter(),[{action:'create_circuit',netlist:nand}]),/replacement/);
 assert.throws(()=>normalizeTools(logicCircuit(),[{action:'simulate_extracted'}]),/Generate/);
 assert.throws(()=>normalizeTools(starter(),[{action:'generate_layout'}]),/Physical|SKY130/);
 assert.throws(()=>normalizeTools(starter('blank'),[{action:'create_circuit',netlist:nand+'\n.control\nshell evil'}]),/control/);
 assert.equal(normalizeTools(starter('blank'),[{action:'create_circuit',netlist:nand},{action:'generate_layout'}]).length,2);
});
test('Ask and autocomplete cannot produce tools; Edit validates and previews tools',()=>{
 const r={response:{message:'Run a measurement.',operations:[],tools:[{action:'simulate'}]}};
 for(const mode of ['ask','autocomplete'])assert.deepEqual(parseAgentResult(starter(),r,mode).tools,[]);
 assert.equal(parseAgentResult(starter(),r,'edit').tools.length,1);
 assert.throws(()=>parseAgentResult(starter(),{response:{...r.response,operations:[{type:'update_component',id:'rd',changes:{value:22000}}]}},'edit'),/either edits or tools/);
});
