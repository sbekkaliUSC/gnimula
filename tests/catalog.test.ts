import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverCatalog,prepareCatalogSelection,catalogRowItem,metadataSearchTerms} from '../backend/catalog-service';
import {assertReady} from '../backend/shared/ready-library';
import rows from '../backend/data/sky130-circuits.json';
import {sourceSetupWarnings} from '../backend/shared/source-checks';
import {starter} from '../backend/shared/circuit';

const SKY='pphilip/analog-circuits-sky130';
function fixture(options:{row?:Record<string,unknown>;searchStatus?:number;truncated?:boolean}={}){
 const calls:string[]=[];
 const fetcher=(async (input:RequestInfo|URL)=>{
  const u=new URL(String(input));calls.push(u.href);
  if(u.pathname==='/splits')return Response.json({splits:[{config:'default',split:'train'},{config:'with_testbench',split:'train'},{config:'with_testbench',split:'validation'}]});
  if(u.pathname==='/size')return Response.json({size:{dataset:{num_rows:260818},configs:[{config:'default',num_rows:130409},{config:'with_testbench',num_rows:130409}],splits:[{config:'with_testbench',split:'train',num_rows:89708}]}});
  if(u.pathname==='/search'&&options.searchStatus)return Response.json({error:'Search index is loading'}, {status:options.searchStatus});
  if(u.pathname==='/rows'||u.pathname==='/search')return Response.json({rows:[{row_idx:u.pathname==='/search'?321:Number(u.searchParams.get('offset')),row:options.row||rows[0].row,truncated_cells:options.truncated?['testbench_spice']:[]}],num_rows_total:89708,partial:false});
  throw new Error('Unexpected request '+u);
 }) as typeof fetch;
 return {calls,fetcher};
}
const url=(query='')=>new URL('https://gnimula.test/api/library/discover?'+query);

test('HF search preserves upstream row indices, counts one config, and refetches the selected source',async()=>{
 const f=fixture(),result=await discoverCatalog(url('q=operational_amplifier&offset=24&length=1'),f.fetcher);
 assert.equal(result.total,89708);assert.equal(result.configTotal,130409);assert.equal(result.nextOffset,25);
 assert.equal(result.items[0].selection.row,321);assert.equal(result.items[0].availability,'ready');
 assert.match(result.items[0].selection.fingerprint!,/^[a-f0-9]{64}$/);assert.equal(result.splits?.[1].numRows,89708);
 const p=await prepareCatalogSelection(result.items[0].selection,f.fetcher);assertReady(p.document);
 assert.ok(f.calls.at(-1)?.includes('offset=321'));assert.equal(p.reference.metadata.row,321);
 assert.equal(p.reference.metadata.repo,SKY);assert.ok(p.reference.metadata.rowFingerprint);
});
test('search-index outages preserve configurations and distinguish unavailability from zero matches',async()=>{
 const f=fixture({searchStatus:503}),result=await discoverCatalog(url('q=amplifier'),f.fetcher);
 assert.equal(result.items.length,0);assert.equal(result.total,null);assert.equal(result.nextOffset,null);
 assert.equal(result.splits?.length,3);assert.equal(result.configTotal,130409);assert.match(result.warnings.join(' '),/index.*browse/);
});
test('changed or truncated records cannot silently replace the selected circuit',async()=>{
 const f=fixture(),result=await discoverCatalog(url('length=1'),f.fetcher),s=result.items[0].selection;
 await assert.rejects(()=>prepareCatalogSelection(s,fixture({row:{...rows[0].row,circuit_id:'changed'}}).fetcher),/changed after your search/);
 await assert.rejects(()=>prepareCatalogSelection(s,fixture({truncated:true}).fetcher),/truncated/);
 const item=await catalogRowItem(rows[0].row,s,true);assert.equal(item.availability,'reference');
});
test('only circuits that strict preparation can preserve are offered as ready',async()=>{
 const s={provider:'huggingface' as const,repo:'public/circuits',config:'default',split:'train',row:7};
 const row={name:'Title-free RC',netlist:'VIN in 0 DC 0 AC 1\nR1 in out 1k\nC1 out 0 10n\n.ac dec 40 10 1meg\n.print ac v(out)\n.end'};
 const item=await catalogRowItem(row,s);assert.equal(item.availability,'ready');assert.equal(item.metadata.componentCount,3);
 const prepared=await prepareCatalogSelection({...s,fingerprint:item.selection.fingerprint},fixture({row}).fetcher);
 assert.equal(prepared.document.components.filter(c=>c.kind==='voltage').length,1);assert.equal(prepared.reference.metadata.repo,'public/circuits');
 for(const netlist of [row.netlist+'\n.include /private/model',row.netlist+'\nB1 out 0 V=secret',row.netlist.replace('R1 in out 1k','D1 in out unknown')]){
  const unsupported=await catalogRowItem({netlist},s);assert.equal(unsupported.availability,'prepare');assert.ok(unsupported.reason);
 }
});
test('GitHub lists nested circuit files, excludes symlinks and marks native artifacts honestly',async()=>{
 const fetcher=(async()=>Response.json({sha:'abc123',truncated:true,tree:[
  {type:'blob',mode:'100644',path:'examples/deep/filter.cir',sha:'a',size:800},
  {type:'blob',mode:'100644',path:'examples/deep/layout.gds',sha:'b',size:5000},
  {type:'blob',mode:'120000',path:'linked.cir',sha:'c',size:20},
  {type:'blob',mode:'100644',path:'README.md',sha:'d',size:800},
  {type:'tree',mode:'040000',path:'circuits',sha:'e'}]})) as typeof fetch;
 const result=await discoverCatalog(url('provider=github&repo=public/circuits&length=1'),fetcher);
 assert.equal(result.scope,'files');assert.equal(result.total,2);assert.equal(result.nextOffset,1);assert.equal(result.items[0].availability,'prepare');assert.equal(result.items[0].selection.ref,'abc123');assert.ok(result.warnings.length);
 const page2=await discoverCatalog(url('provider=github&repo=public/circuits&offset=1&length=1'),fetcher);assert.equal(page2.items[0].availability,'reference');
});
test('repository discovery labels its totals as source counts rather than circuit counts',async()=>{
 const fetcher=(async()=>Response.json({total_count:1024,incomplete_results:false,items:[{full_name:'public/spice',default_branch:'main',description:'Examples',license:{spdx_id:'MIT'}}]})) as typeof fetch;
 const r=await discoverCatalog(url('provider=github&q=spice'),fetcher);assert.equal(r.scope,'sources');assert.equal(r.total,1024);assert.match(r.totalLabel,/not circuit counts/);assert.equal(r.items[0].availability,'browse');
});
test('untrusted locators and unbounded pages fail before any provider request',async()=>{
 let called=0;const fetcher=(async()=>{called++;throw new Error('unexpected');}) as typeof fetch;
 for(const query of ['provider=localhost','repo=../secret','repo=private%2F..','offset=-1','length=25','offset=1.5','q='+('a'.repeat(151))])await assert.rejects(()=>discoverCatalog(url(query),fetcher));
 for(const s of [{provider:'github',repo:'a/b',path:'../file.cir'},{provider:'huggingface',repo:'a/b',row:-2},{provider:'huggingface',repo:'a/b',row:0,fingerprint:'bad'},{provider:'huggingface',repo:'a/b'}])await assert.rejects(()=>prepareCatalogSelection(s,fetcher));
 assert.equal(called,0);
});
test('catalog follows bounded public-provider redirects without forwarding access to other hosts',async()=>{
 const calls:string[]=[];
 const redirected=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  calls.push(String(input));assert.equal(init?.redirect,'manual');
  return calls.length===1?new Response(null,{status:301,headers:{Location:'https://api.github.com/search/repositories?q=renamed'}}):Response.json({items:[],total_count:0});
 }) as typeof fetch;
 await discoverCatalog(url('provider=github&q=renamed'),redirected);assert.equal(calls.length,2);
 for(const target of ['https://localhost/private','http://api.github.com/private','https://name:secret@api.github.com/private']){
  let requests=0;const disallowed=(async()=>{requests++;return new Response(null,{status:302,headers:{Location:target}});}) as typeof fetch;
  await assert.rejects(()=>discoverCatalog(url('provider=github&q=rename'),disallowed),/redirects outside/);assert.equal(requests,1);
 }
 let requests=0;const looping=(async()=>{requests++;return new Response(null,{status:302,headers:{Location:'https://api.github.com/loop'}});}) as typeof fetch;
 await assert.rejects(()=>discoverCatalog(url('provider=github&q=loop'),looping),/redirects outside/);assert.equal(requests,4);
});
test('catalog preserves the Worker global receiver when calling fetch',async()=>{
 const fetcher=(async function(this:unknown){assert.equal(this,globalThis);return Response.json({items:[],total_count:0});}) as typeof fetch;
 await discoverCatalog(url('provider=github&q=receiver'),fetcher);
});

function indexFixture(entries:{row_idx:number;circuit_id:string}[],total=entries.length){
 const queries:{sql:string;values:unknown[]}[]=[];
 const db={prepare(sql:string){return {bind(...values:unknown[]){queries.push({sql,values});return {
  async first(){return sql.includes('catalog_index_snapshots')?{record_count:130409,splits_json:JSON.stringify([{split:'train',num_rows:89708},{split:'test',num_rows:19402}]),retrieved_at:'2026-10-17T00:00:00Z',source_revision:'public-snapshot'}:{n:total};},
  async all(){return {results:entries.slice(0,Number(values[4]))};}
 };}};}} as unknown as D1Database;
 return {db,queries};
}
test('metadata search binds quoted terms, preserves sparse source row positions and verifies source identity',async()=>{
 const entries=[{row_idx:317,circuit_id:'circuit-one'},{row_idx:1009,circuit_id:'circuit-two'}],index=indexFixture(entries,25),calls:string[]=[];
 const fetcher=(async(input:RequestInfo|URL)=>{const u=new URL(String(input));calls.push(u.href);assert.equal(u.pathname,'/rows');
  const row_idx=Number(u.searchParams.get('offset')),entry=entries.find(x=>x.row_idx===row_idx)!;
  return Response.json({rows:[{row_idx,row:{...rows[0].row,circuit_id:entry.circuit_id},truncated_cells:[]}],num_rows_total:89708});
 }) as typeof fetch;
 const result=await discoverCatalog(url('q=amplifier%20OR%20sky130&offset=12&length=2'),fetcher,index.db);
 assert.equal(result.total,25);assert.equal(result.configTotal,130409);assert.equal(result.nextOffset,14);
 assert.deepEqual(result.items.map(x=>x.selection.row),[317,1009]);assert.equal(result.items[1].name,'circuit-two');
 assert.equal(result.items[0].metadata.searchIndexRevision,'public-snapshot');assert.ok(result.items.every(x=>x.availability==='ready'));
 assert.match(result.totalLabel,/metadata/);assert.match(result.warnings[0],/not full netlist/);
 assert.equal(calls.length,2);assert.equal(index.queries[1].values[0],'"amplifier"* AND "OR"* AND "sky130"*');
 assert.ok(!index.queries[1].sql.includes('amplifier'));assert.equal(index.queries[2].values[5],12);
 assert.equal(metadataSearchTerms('" OR * (sky130)'), '"OR"* AND "sky130"*');
});
test('metadata matches are not opened when an upstream row changed; other results survive',async()=>{
 const entries=[{row_idx:31,circuit_id:'indexed-31'},{row_idx:46,circuit_id:'indexed-46'}],index=indexFixture(entries);
 const fetcher=(async(input:RequestInfo|URL)=>{const n=Number(new URL(String(input)).searchParams.get('offset'));return Response.json({rows:[{row_idx:n,row:{...rows[0].row,circuit_id:n===31?'different-record':'indexed-46'}}]});}) as typeof fetch;
 const result=await discoverCatalog(url('q=amplifier'),fetcher,index.db);
 assert.equal(result.total,2);assert.equal(result.items.length,1);assert.equal(result.items[0].selection.row,46);
 assert.match(result.warnings.join(' '),/changed since indexing/);assert.match(result.warnings.join(' '),/1 matching records could not be loaded/);
});
test('metadata search bounds page fanout and avoids all index work for empty browsing',async()=>{
 const entries=Array.from({length:24},(_,i)=>({row_idx:100+i*11,circuit_id:'row-'+i})),index=indexFixture(entries,80);
 let concurrent=0,peak=0,calls=0;
 const fetcher=(async(input:RequestInfo|URL)=>{calls++;concurrent++;peak=Math.max(peak,concurrent);await new Promise(resolve=>setTimeout(resolve,2));concurrent--;const n=Number(new URL(String(input)).searchParams.get('offset'));return Response.json({rows:[{row_idx:n,row:{...rows[0].row,circuit_id:entries.find(x=>x.row_idx===n)!.circuit_id}}]});}) as typeof fetch;
 const result=await discoverCatalog(url('q=amplifier&length=24'),fetcher,index.db);
 assert.equal(result.items.length,12);assert.equal(result.nextOffset,12);assert.equal(calls,12);assert.ok(peak<=4);
 const emptyIndex=indexFixture([]),upstream=fixture();await discoverCatalog(url(),upstream.fetcher,emptyIndex.db);assert.equal(emptyIndex.queries.length,0);
});
test('publisher mirror labels with one MOS carry a warning without changing the circuit or source label',async()=>{
 const row={pdk:'sky130',circuit_id:'publisher-mirror',topology:'current_mirror_bias',testbench_spice:'* Source circuit\n.lib "{{SKY130_LIB}}" tt\nVDD vdd 0 DC 1.8\nVSIG in 0 DC 0.8 AC 1\nR1 vdd out 10k\nXM1 out in 0 0 sky130_fd_pr__nfet_01v8 W=4 L=0.5\nCL out 0 4e-14\n.control\nop\nprint v(out)\nac dec 40 10 100meg\n.endc\n.end'};
 const s={provider:'huggingface' as const,repo:SKY,config:'with_testbench',split:'train',row:0};
 const item=await catalogRowItem(row,s);assert.equal(item.availability,'ready');assert.equal(item.metadata.topology,'current_mirror_bias');
 const warnings=item.metadata.setupWarnings as string[];assert.equal(warnings.length,1);assert.match(warnings[0],/contains 1 MOS device/);
 assert.match(item.reason!,/topology is not verified/);
 const prepared=await prepareCatalogSelection(item.selection,fixture({row}).fetcher);
 assert.ok(prepared.notes.includes(warnings[0]));assert.deepEqual(prepared.reference.metadata.setupWarnings,warnings);
 assert.equal(prepared.reference.metadata.publisherTopology,'current_mirror_bias');
 assert.equal(prepared.document.components.filter(c=>c.kind==='nmos'||c.kind==='pmos').length,1);
 assert.equal(JSON.parse(prepared.reference.content).testbench_spice,row.testbench_spice);
 assert.deepEqual(sourceSetupWarnings('common_source_amplifier',prepared.document),[]);
 assert.deepEqual(sourceSetupWarnings('current_mirror',starter('mirror')),[]);
});
