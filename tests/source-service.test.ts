import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSourceUrl,relativeDependency,resolveDependencies,cacheKey,prepareBundle,type SourceFile} from '../backend/source-service';
const source:SourceFile={name:'filter.cir',content:'Filter\n.include "../models/filter.lib"\nVIN in 0 AC 1\nX1 in out 0 filter\n.ac dec 40 10 1meg\n.print ac v(out)',url:'https://github.com/owner/repo/blob/pinned/examples/filter.cir',provider:'github',metadata:{repo:'owner/repo',path:'examples/filter.cir',requestedRef:'pinned'}};
test('dependency resolution stays at the pinned revision and preserves package provenance',async()=>{
 const read=async(provider:string,repo:string,path:string,ref:string)=>{assert.deepEqual([provider,repo,path,ref],['github','owner/repo','models/filter.lib','pinned']);return {name:'filter.lib',content:'.subckt filter a b g\nR1 a b 1k\nC1 b g 1n\n.ends filter',url:'https://github.com/owner/repo/blob/pinned/models/filter.lib',provider,metadata:{repo,path,requestedRef:ref}};};
 const bundle=await resolveDependencies(source,read),p=await prepareBundle(bundle);assert.equal(bundle.files.length,1);assert.equal(bundle.unresolved.length,0);assert.equal(p.document.components.find(c=>c.ref==='X1')?.device?.model,'filter');assert.equal((p.reference.metadata.manifest as any[]).length,2);
 const key=await cacheKey(bundle);assert.notEqual(key,await cacheKey({...bundle,deck:bundle.deck.replace('1k','2k')}));assert.notEqual(key,await cacheKey({...bundle,files:[{...bundle.files[0],content:bundle.files[0].content+'\n* new version'}]}));
});
test('missing dependencies preserve the editable circuit and a concrete simulation issue',async()=>{
 const bundle=await resolveDependencies(source,async()=>{throw new Error('Public model unavailable');});assert.match(bundle.unresolved[0],/filter.lib.*unavailable/);
 const prepared=await prepareBundle(bundle);assert.equal(prepared.document.components.find(c=>c.ref==='X1')?.device?.model,'filter');assert.equal(prepared.reference.metadata.simulationReady,false);
});
test('source URL and dependency paths cannot access credentials or local files',()=>{
 assert.deepEqual(parseSourceUrl(source.url),{provider:'github',repo:'owner/repo',ref:'pinned',path:'examples/filter.cir'});
 assert.equal(relativeDependency('examples/a.cir','../models/a.lib'),'models/a.lib');
 for(const path of ['../../secret','/etc/passwd','http://localhost/x','C:\\Users\\name','a\u0000b'])assert.throws(()=>relativeDependency('examples/a.cir',path));
 for(const url of ['file:///etc/passwd','http://github.com/o/r/blob/main/a.cir','https://user:secret@github.com/o/r/blob/main/a.cir','https://localhost/private'])assert.throws(()=>parseSourceUrl(url));
});
test('dependency cycles terminate with a diagnostic rather than recursive fetching',async()=>{
 let calls=0;const read=async()=>{calls++;return {name:'filter.lib',content:'.include "filter.lib"',url:'https://github.com/owner/repo/blob/pinned/models/filter.lib',provider:'github',metadata:{}};};
 const bundle=await resolveDependencies(source,read);assert.equal(calls,1);assert.match(bundle.unresolved.join(' '),/Cyclic include/);
});
