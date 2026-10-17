import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOperations,parseAgentResult} from '../backend/shared/agent';
import {applyOperations,checkCircuit,netMap,spice,starter} from '../backend/shared/circuit';
import {importDesign,rcExample,spiceNumber} from '../backend/shared/imports';
import {repoName,filePath,publicFile} from '../backend/library-service';

test('explicit parameter edits preserve connectivity; deletions remove attached wires',()=>{
 const d=starter();const ops=normalizeOperations(d,[{type:'update_component',id:'rd',changes:{value:22000}}]);const changed=applyOperations(d,ops);
 assert.equal(changed.components.find(c=>c.id==='rd')!.value,22000);assert.deepEqual(changed.wires,d.wires);
 const removed=applyOperations(d,normalizeOperations(d,[{type:'delete_component',id:'cl'}]));assert.ok(!removed.wires.some(w=>w.from.component==='cl'||w.to.component==='cl'));
});
test('abstention and Ask mode cannot produce edits; unchanged edits collapse to abstention',()=>{
 const d=starter();assert.deepEqual(parseAgentResult(d,{response:{message:'No edit is needed.',operations:[]}},'autocomplete').operations,[]);
 assert.deepEqual(parseAgentResult(d,{response:{message:'Explanation only.',operations:[{type:'delete_component',id:'m1'}]}},'ask').operations,[]);
 assert.deepEqual(normalizeOperations(d,[{type:'update_component',id:'rd',changes:{value:10000}}]),[]);
});
test('model output cannot change IDs or inject unsupported values or terminal references',()=>{
 for(const op of [{type:'update_component',id:'m1',changes:{id:'oops'}},{type:'update_component',id:'rd',changes:{value:-5}},{type:'add_wire',wire:{from:{component:'m1',pin:'body'},to:{component:'gnd',pin:'0'}}},{type:'run_shell',command:'anything'}])assert.throws(()=>normalizeOperations(starter(),[op]));
});
test('SPICE import keeps values and nets; rejects unsafe or lossy model conversion',()=>{
 const d=importDesign('filter.cir',rcExample).document;assert.deepEqual(checkCircuit(d).filter(x=>x.level==='error'),[]);
 assert.equal(d.components.find(c=>c.ref==='R1')!.value,1000);assert.equal(d.components.find(c=>c.ref==='C1')!.value,1e-8);
 const n=netMap(d),r=d.components.find(c=>c.ref==='R1')!,c=d.components.find(c=>c.ref==='C1')!;assert.equal(n.get(r.id+'.n'),n.get(c.id+'.p'));
 for(const line of ['.include sky130.lib','.control','.model custom NMOS (level=54)','X1 in out 0 sky130_nfet','R2 in out {res}'])assert.throws(()=>importDesign('bad.cir',rcExample.replace('.end',line+'\n.end')));
 assert.equal(spiceNumber('1M'),.001);assert.equal(spiceNumber('1meg'),1e6);
});
test('generated generic MOS netlists round trip without replacing models',()=>{
 const imported=importDesign('amp.cir',spice(starter())).document;assert.equal(imported.components.filter(c=>c.kind==='nmos').length,1);assert.deepEqual(checkCircuit(imported).filter(x=>x.level==='error'),[]);
});
test('provider paths cannot escape approved repository requests',()=>{
 assert.equal(repoName('owner/repo'),'owner/repo');assert.equal(filePath('examples/a b.cir'),'examples/a%20b.cir');
 for(const s of ['https://github.com/o/r','o/r/extra','../repo'])assert.throws(()=>repoName(s));
 for(const s of ['a/../b','a\\b','a\u0000b'])assert.throws(()=>filePath(s));
});
test('public file redirects stay inside the approved text providers',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});};
  await assert.rejects(()=>publicFile('huggingface','owner/repo','README.md','main'),/redirects outside/);assert.equal(calls,1);
  globalThis.fetch=async()=>{calls++;return calls===2?new Response(null,{status:307,headers:{Location:'https://huggingface.co/api/resolve-cache/datasets/owner/repo/pinned/README.md'}}):new Response('public text');};
  assert.equal((await publicFile('huggingface','owner/repo','README.md','main')).content,'public text');
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'the dataset index is loading, this can take a minute'}),{status:500});
  await assert.rejects(()=>publicFile('huggingface','owner/repo','README.md','main'),/loading this dataset search index/);
 }finally{globalThis.fetch=original;}
});
