import {FeatureError,repoName,filePath} from './library-service';
import {prepareLink} from './ready-service';
import {prepareSky130Record,preparePublicSpice,type PreparedCircuit} from './shared/ready-library';
import {fileKind} from './shared/library';
import {type CatalogSelection,type CatalogItem,type CatalogResult} from './shared/catalog';
import {sourceSetupWarnings} from './shared/source-checks';

type Fetcher=typeof fetch;
const SKY='pphilip/analog-circuits-sky130',VIEWER='https://datasets-server.huggingface.co/';
const hosts=new Set(['api.github.com','huggingface.co','datasets-server.huggingface.co']);
// Public responses only. Bounds prevent a large repository or arbitrary query stream
// from retaining unbounded data in a long-lived Worker isolate.
const cache=new Map<string,{expires:number;data:unknown;bytes:number}>();let cacheBytes=0;
const fingerprint=async(value:unknown)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(b=>b.toString(16).padStart(2,'0')).join('');
function text(value:unknown,max=200){return typeof value==='string'?value.slice(0,max):'';}
function integer(value:unknown,fallback:number,max:number){const n=value===undefined||value===null||value===''?fallback:Number(value);if(!Number.isSafeInteger(n)||n<0||n>max)throw new FeatureError(400,'Invalid catalog page or row.');return n;}
function segment(value:unknown,fallback:string){const s=value===undefined?fallback:String(value);if(!s||s.length>120||/[\x00-\x1f]/.test(s))throw new FeatureError(400,'Invalid dataset configuration or split.');return s;}
function revision(value:unknown){const ref=String(value||'HEAD');if(!/^[\w.\/-]{1,100}$/.test(ref)||ref.includes('..'))throw new FeatureError(400,'Invalid repository revision.');return ref;}
function selection(value:unknown):CatalogSelection {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new FeatureError(400,'Select a public circuit record.');
 const v=value as Record<string,unknown>;if(v.provider!=='github'&&v.provider!=='huggingface')throw new FeatureError(400,'Unsupported catalog provider.');
 const s:CatalogSelection={provider:v.provider,repo:repoName(String(v.repo||''))};
 if(v.fingerprint!==undefined){if(!/^[a-f0-9]{64}$/.test(String(v.fingerprint)))throw new FeatureError(400,'Invalid record fingerprint.');s.fingerprint=String(v.fingerprint);}
 if(s.provider==='github'){s.ref=revision(v.ref);s.path=String(v.path||'');if(!filePath(s.path))throw new FeatureError(400,'Choose a circuit file.');}
 else {s.config=segment(v.config,s.repo===SKY?'with_testbench':'default');s.split=segment(v.split,'train');if(v.row===undefined)throw new FeatureError(400,'Choose a circuit record.');s.row=integer(v.row,0,10000000);}
 return s;
}
async function remote(url:string,fetcher:Fetcher,maxBytes=2500000):Promise<any>{
 const u=new URL(url);if(u.protocol!=='https:'||!hosts.has(u.hostname)||u.username||u.password)throw new FeatureError(400,'Unsupported public provider.');
 const hit=fetcher===fetch?cache.get(url):undefined;if(hit&&hit.expires>Date.now())return hit.data;
 if(hit){cache.delete(url);cacheBytes-=hit.bytes;}
 let r:Response,target=url;
 for(let hop=0;;hop++){
  try{r=await fetcher.call(globalThis,target,{headers:{'User-Agent':'Gnimula-Public-Circuit-Library','Accept':'application/json'},redirect:'manual',signal:AbortSignal.timeout(18000),cf:{cacheTtlByStatus:{'200-299':300,'400-599':-1},cacheEverything:true}});}
  catch(error){console.error('Catalog provider fetch failed',{provider:new URL(target).hostname,message:error instanceof Error?error.message.slice(0,300):'unknown'});throw new FeatureError(502,'The public provider is temporarily unavailable. Retry this source shortly.');}
  if(r.status>=300&&r.status<400){
   const location=r.headers.get('Location');await r.body?.cancel();
   let next:URL;try{next=new URL(location||'',target);}catch{throw new FeatureError(502,'The public provider returned an invalid redirect.');}
   if(!location||hop>=3||next.protocol!=='https:'||!hosts.has(next.hostname)||next.username||next.password)throw new FeatureError(422,'This source redirects outside the supported public catalog services.');
   target=next.href;continue;
  }
  break;
 }
 if(!r.ok){
  const reader=r.body?.getReader();let detail='';if(reader){const part=await reader.read();detail=new TextDecoder().decode(part.value?.slice(0,2000));await reader.cancel();}
  if(/index.{0,40}loading/i.test(detail))throw new FeatureError(503,'Hugging Face is building this search index. Clear the search to browse records, or retry shortly.');
  if(r.status===429||r.status===403)throw new FeatureError(429,'This public provider is rate-limited or access-restricted. Other sources and prepared examples remain available.');
  throw new FeatureError(r.status===404?404:502,`Public provider returned ${r.status}. This source or split may be unavailable.`);
 }
 if(Number(r.headers.get('Content-Length')||0)>maxBytes){await r.body?.cancel();throw new FeatureError(413,'Provider response is too large. Narrow the source or use a smaller page.');}
 const reader=r.body?.getReader();if(!reader)throw new FeatureError(502,'The provider returned an empty response.');
 const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>maxBytes){await reader.cancel();throw new FeatureError(413,'Provider response exceeded the catalog size limit. Narrow the source.');}chunks.push(part.value);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 let data:any;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new FeatureError(502,'The provider returned invalid catalog data.');}
 if(fetcher===fetch){while(cache.size>=32||cacheBytes+size>16000000){const key=cache.keys().next().value;if(!key)break;cacheBytes-=cache.get(key)!.bytes;cache.delete(key);}cache.set(url,{expires:Date.now()+300000,data,bytes:size});cacheBytes+=size;}
 return data;
}
function base(provider:'github'|'huggingface',repo:string,scope:CatalogResult['scope'],offset:number):CatalogResult{return {items:[],scope,total:null,totalLabel:scope==='records'?'dataset records':scope==='files'?'matching source files':'sources (not circuit counts)',offset,nextOffset:null,warnings:[],source:{provider,repo,url:repo?(provider==='github'?'https://github.com/':'https://huggingface.co/datasets/')+repo:''},fetchedAt:new Date().toISOString()};}
function errorText(error:unknown){return error instanceof Error?error.message:'Provider request failed.';}
function pageTotal(value:unknown):number|null{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;}
function rowUrl(s:CatalogSelection){return `https://huggingface.co/datasets/${s.repo}/viewer/${encodeURIComponent(s.config!)}/${encodeURIComponent(s.split!)}?row=${s.row}`;}
function rowName(row:Record<string,unknown>,index:number){return text(row.circuit_id||row.name||row.title,100)||`Circuit record ${index+1}`;}
function rowPrepared(row:Record<string,unknown>,s:CatalogSelection):PreparedCircuit{
 let p:PreparedCircuit;
 if(row.pdk==='sky130'&&typeof row.testbench_spice==='string')p=prepareSky130Record(row,s.row!);
 else {
  const content=[row.testbench_spice,row.spice_netlist,row.netlist,row.spice].find(v=>typeof v==='string'&&v.trim()) as string|undefined;
  if(!content)throw new Error('This record has no supported flat SPICE testbench. It is available as a source reference.');
  if(content.length>120000)throw new Error('The source circuit exceeds the preparation size limit.');
  // Dataset fields often omit SPICE's title. Supply one so the parser cannot
  // discard the first device; a source title is removed only when unambiguous.
  const lines=content.replace(/\r/g,'').split('\n'),first=lines.findIndex(l=>l.trim()&&!l.trim().startsWith('*'));
  if(first>=0&&!/^(?:\.|[RCLVIDQMXBEFGHKSWTZ]\S*\s)/i.test(lines[first].trim()))lines.splice(first,1);
  const result=preparePublicSpice('public-record.cir','Gnimula public dataset record\n'+lines.join('\n'));
  p={...result,item:{id:'public-row',name:rowName(row,s.row!),description:'Prepared public circuit. Run a fresh simulation to measure its behavior.',kind:'circuit',pdk:'generic',provider:'Hugging Face',goal:'Explore this public circuit and verify behavior with fresh simulation.'},reference:{name:rowName(row,s.row!)+'.json',content:JSON.stringify(row,null,2),url:rowUrl(s),provider:'huggingface',metadata:{}}};
 }
 const license=s.repo===SKY?'Apache-2.0; upstream MIT/BSD licenses in dataset LICENSES/':'See dataset card and source licenses';
 const setupWarnings=sourceSetupWarnings(row.topology,p.document);p.notes.push(...setupWarnings);
 p.item={...p.item,id:`hf:${s.repo}:${s.config}:${s.split}:${s.row}`,name:rowName(row,s.row!),sourceUrl:rowUrl(s),license};p.document.name=p.item.name;
 p.reference={...p.reference,url:rowUrl(s),metadata:{...p.reference.metadata,repo:s.repo,config:s.config,split:s.split,row:s.row,rowFingerprint:s.fingerprint,license,publisherTopology:row.topology,setupWarnings,preparation:p.notes}};
 return p;
}
export async function catalogRowItem(row:Record<string,unknown>,s:CatalogSelection,truncated=false):Promise<CatalogItem>{
 const token={...s,fingerprint:await fingerprint(row)},item:CatalogItem={id:`hf:${s.repo}:${s.config}:${s.split}:${s.row}`,name:rowName(row,s.row!),description:text(row.description||row.topology||row.source_dataset,250).replaceAll('_',' '),kind:'circuit',pdk:text(row.pdk,40)||'unspecified',provider:'huggingface',sourceUrl:rowUrl(s),selection:token,availability:'reference',metadata:{row:s.row,upstreamConverged:row.converged,topology:row.topology,baseCircuitId:row.base_circuit_id,license:s.repo===SKY?'Apache-2.0 + upstream licenses':'See dataset card'}};
 if(truncated){item.reason='The provider truncated this record. A complete source is required to prepare it.';return item;}
 try {const p=rowPrepared(row,token);item.availability='ready';item.reason='Circuit and testbench prepared; topology is not verified and electrical performance needs a fresh simulation.';item.pdk=p.item.pdk;item.description=p.item.description;item.metadata.componentCount=p.document.components.filter(c=>c.kind!=='ground').length;item.metadata.setupWarnings=p.reference.metadata.setupWarnings;}
 catch(error){item.reason=errorText(error).slice(0,320);}
 return item;
}
async function sources(provider:'github'|'huggingface',q:string,offset:number,length:number,fetcher:Fetcher){
 const result=base(provider,'','sources',offset);
 if(provider==='github'){
  const page=Math.floor(offset/length)+1;if(page>50)throw new FeatureError(400,'Narrow the repository search to browse more results.');
  const data=await remote('https://api.github.com/search/repositories?'+new URLSearchParams({q:q||'ngspice circuit',per_page:String(length),page:String(page),sort:'stars'}),fetcher);
  result.total=pageTotal(data.total_count);result.warnings=data.incomplete_results?['GitHub reports an incomplete result set.']:[];
  result.items=(Array.isArray(data.items)?data.items:[]).map((r:any):CatalogItem=>({id:`github:${r.full_name}`,name:text(r.full_name,150),description:text(r.description,250),kind:'repository',pdk:'unspecified',provider,sourceUrl:`https://github.com/${r.full_name}`,availability:'browse',reason:'Search the circuit files in this repository.',selection:{provider,repo:r.full_name,ref:r.default_branch},metadata:{license:r.license?.spdx_id||'See source licenses',stars:r.stargazers_count}}));
  result.nextOffset=result.items.length===length&&offset+length<Math.min(result.total||0,1000)?offset+length:null;
 }else{
  const data=await remote('https://huggingface.co/api/datasets?'+new URLSearchParams({search:q||'circuit',limit:'40',full:'true',sort:'downloads',direction:'-1'}),fetcher);
  const matches=Array.isArray(data)?data:[];result.items=matches.slice(offset,offset+length).map((r:any):CatalogItem=>({id:`hf:${r.id}`,name:text(r.id,150),description:text(r.description,250)||text(Array.isArray(r.tags)?r.tags.join(', '):'',250),kind:'dataset',pdk:/sky130/i.test(r.id)?'sky130':'unspecified',provider,sourceUrl:`https://huggingface.co/datasets/${r.id}`,availability:'browse',reason:'Browse dataset records; supported circuits are prepared individually.',selection:{provider,repo:r.id},metadata:{license:r.cardData?.license||'See dataset card',downloads:r.downloads}}));
  result.total=matches.length;result.totalLabel='dataset sources in this search (up to 40; not circuit counts)';result.nextOffset=offset+length<matches.length?offset+length:null;
 }
 return result;
}
async function githubFiles(u:URL,repo:string,q:string,offset:number,length:number,fetcher:Fetcher){
 const result=base('github',repo,'files',offset),ref=revision(u.searchParams.get('ref')),kind=u.searchParams.get('kind')||'';result.source.ref=ref;
 const data=await remote(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,fetcher,7500000);
 if(!Array.isArray(data.tree))throw new FeatureError(502,'The repository tree is unavailable.');
 const eligible=data.tree.filter((f:any)=>f.type==='blob'&&f.mode!=='120000'&&typeof f.path==='string'&&/\.(cir|sp|spice|spi|net|sch|kicad_sch|gds|gdsii|oas|mag|lay|json|vec|csv|lib|model)$/i.test(f.path)&&(!q||q.toLowerCase().split(/\s+/).every(t=>f.path.toLowerCase().includes(t)))&&(!kind||fileKind(f.path)===kind));
 result.total=eligible.length;if(data.truncated)result.warnings.push('GitHub truncated this large repository tree. This count covers only the files returned.');
 result.items=eligible.slice(offset,offset+length).map((f:any):CatalogItem=>{const k=fileKind(f.path),candidate=(k==='netlist'||/\.json$/i.test(f.path))&&f.size<=150000;return {id:`gh:${repo}:${data.sha}:${f.path}`,name:f.path.split('/').at(-1),description:f.path,kind:k,pdk:/sky130/i.test(repo+' '+f.path)?'sky130':'unspecified',provider:'github',sourceUrl:`https://github.com/${repo}/blob/${encodeURIComponent(ref)}/${filePath(f.path)}`,availability:candidate?'prepare':'reference',reason:candidate?'Gnimula will check models, connections and the testbench before opening.':f.size>150000?'This source exceeds the automatic preparation size limit.':'This native format is available as reference; its editor/model adapter is not installed.',selection:{provider:'github',repo,ref:data.sha||ref,path:f.path},metadata:{bytes:f.size,blobSha:f.sha,treeSha:data.sha,license:'See repository and source-file licenses'}};});
 result.nextOffset=offset+length<eligible.length?offset+length:null;return result;
}
/** Independently fetch provider metadata and rows so an unavailable search index
 * does not remove source/configuration controls or masquerade as zero circuits. */
type IndexSnapshot={record_count:number;splits_json:string;retrieved_at:string;source_revision:string};
/** Quotes prevent FTS operators from becoming a second query language. Public
 * search is a conjunction of literal metadata terms, with prefix completion. */
export function metadataSearchTerms(q:string){return (q.match(/[\p{L}\p{N}_-]+/gu)||[]).map(term=>'"'+term.replaceAll('"','""')+'"*').join(' AND ');}
async function indexedRows(u:URL,repo:string,q:string,offset:number,length:number,fetcher:Fetcher,index:D1Database):Promise<CatalogResult|null>{
 const config=segment(u.searchParams.get('config')??undefined,'with_testbench');
 let snapshot:IndexSnapshot|null;
 try{snapshot=await index.prepare('SELECT record_count,splits_json,retrieved_at,source_revision FROM catalog_index_snapshots WHERE repo=? AND config=?').bind(repo,config).first<IndexSnapshot>();}
 catch(error){console.error('Catalog metadata index unavailable',{message:errorText(error).slice(0,200)});return null;}
 if(!snapshot)return null;
 const result=base('huggingface',repo,'records',offset),split=segment(u.searchParams.get('split')??undefined,'train');
 const rawSplits=JSON.parse(snapshot.splits_json),splits=Array.isArray(rawSplits)?rawSplits:Object.entries(rawSplits).map(([name,count])=>({split:name,num_rows:count}));
 result.splits=splits.map((s:any)=>({config,split:String(s.split),numRows:pageTotal(s.num_rows??s.numRows)??undefined}));
 if(!result.splits.some(s=>s.split===split))throw new FeatureError(400,'That split does not exist in the indexed dataset.');
 result.source={...result.source,config,split};result.configTotal=snapshot.record_count;
 result.totalLabel='matching circuit metadata records in this split';
 result.warnings.push(`Search matches circuit identifiers, topology, upstream source and PDK metadata, not full netlist text. Index snapshot: ${snapshot.retrieved_at}; circuit records are fetched from Hugging Face before use.`);
 result.warnings.push('Records include parameter variants; matching records are not all unique topologies. Only successfully prepared records can be opened.');
 const query=metadataSearchTerms(q);if(!query){result.total=0;return result;}
 const where=' FROM public_circuit_search WHERE public_circuit_search MATCH ? AND repo=? AND config=? AND split=?';
 const size=Math.min(12,length);
 const count=await index.prepare('SELECT count(*) AS n'+where).bind(query,repo,config,split).first<{n:number}>();result.total=Number(count?.n||0);
 const records=await index.prepare('SELECT row_idx,circuit_id'+where+' ORDER BY CAST(row_idx AS INTEGER) LIMIT ? OFFSET ?').bind(query,repo,config,split,size,offset).all<{row_idx:number;circuit_id:string}>();
 const selected=records.results;result.nextOffset=selected.length&&offset+selected.length<result.total?offset+selected.length:null;
 // Keep concurrency bounded: one sparse metadata match may require a separate
 // upstream row read. Never mass-fetch a split to service a search request.
 const outcomes=new Array<PromiseSettledResult<CatalogItem>>(selected.length);let next=0;
 const worker=async()=>{while(next<selected.length){const position=next++,entry=selected[position];
  try {
   const rowIndex=integer(entry.row_idx,0,10000000),data=await remote(VIEWER+'rows?'+new URLSearchParams({dataset:repo,config,split,offset:String(rowIndex),length:'1'}),fetcher);
   const record=data.rows?.find((r:any)=>r.row_idx===rowIndex);
   if(!record||record.row?.circuit_id!==entry.circuit_id)throw new FeatureError(409,'A matching source row changed since indexing and was omitted. Refreshing the metadata index is required.');
   const item=await catalogRowItem(record.row,{provider:'huggingface',repo,config,split,row:rowIndex},!!record.truncated_cells?.length);
   item.metadata={...item.metadata,searchIndexRevision:snapshot.source_revision,searchIndexRetrievedAt:snapshot.retrieved_at};outcomes[position]={status:'fulfilled',value:item};
  }catch(reason){outcomes[position]={status:'rejected',reason};}
 }};
 await Promise.all(Array.from({length:Math.min(4,selected.length)},worker));
 for(const outcome of outcomes){if(outcome.status==='fulfilled')result.items.push(outcome.value);else{const message=errorText(outcome.reason);if(!result.warnings.includes(message))result.warnings.push(message);}}
 if(result.items.length<selected.length)result.warnings.push(`${selected.length-result.items.length} matching records could not be loaded. Result totals include those metadata matches.`);
 return result;
}
async function hfRows(u:URL,repo:string,q:string,offset:number,length:number,fetcher:Fetcher,index?:D1Database){
 if(q&&repo===SKY&&index){const indexed=await indexedRows(u,repo,q,offset,length,fetcher,index);if(indexed)return indexed;}
 const result=base('huggingface',repo,'records',offset),warnings=result.warnings;
 const meta=await Promise.allSettled([remote(VIEWER+'splits?'+new URLSearchParams({dataset:repo}),fetcher),remote(VIEWER+'size?'+new URLSearchParams({dataset:repo}),fetcher)]);
 const splits=meta[0].status==='fulfilled'&&Array.isArray(meta[0].value.splits)?meta[0].value.splits:[];
 const size=meta[1].status==='fulfilled'?meta[1].value.size:undefined;
 result.splits=splits.map((s:any)=>({config:s.config,split:s.split,numRows:size?.splits?.find((x:any)=>x.config===s.config&&x.split===s.split)?.num_rows}));
 if(meta[0].status==='rejected')warnings.push(errorText(meta[0].reason));
 if(meta[1].status==='rejected')warnings.push('Total dataset size is temporarily unavailable.');
 const defaultConfig=repo===SKY?'with_testbench':result.splits?.find(s=>s.config==='default')?.config||result.splits?.[0]?.config||'default';
 const config=segment(u.searchParams.get('config')??undefined,defaultConfig),defaultSplit=result.splits?.find(s=>s.config===config&&s.split==='train')?.split||result.splits?.find(s=>s.config===config)?.split||'train',split=segment(u.searchParams.get('split')??undefined,defaultSplit);
 result.source={...result.source,config,split};result.configTotal=size?.configs?.find((x:any)=>x.config===config)?.num_rows;
 if(splits.length&&!splits.some((s:any)=>s.config===config&&s.split===split))throw new FeatureError(400,'That configuration/split does not exist in this dataset.');
 const params=new URLSearchParams({dataset:repo,config,split,offset:String(offset),length:String(length)});if(q)params.set('query',q);
 try {
  const data=await remote(VIEWER+(q?'search':'rows')+'?'+params,fetcher);
  if(!Array.isArray(data.rows))throw new FeatureError(502,'The provider did not return dataset records.');
  result.total=pageTotal(data.num_rows_total);result.totalLabel=q?'matching records in this split':'records in this split';
  result.items=await Promise.all(data.rows.map((r:any)=>catalogRowItem(r.row,{provider:'huggingface',repo,config,split,row:integer(r.row_idx,0,10000000)},!!r.truncated_cells?.length)));
  result.nextOffset=result.items.length===length&&(result.total===null||offset+length<result.total)?offset+length:null;
  if(data.partial)warnings.push('Hugging Face reports partial results for this dataset.');
 }catch(error){warnings.push(errorText(error));}
 if(repo===SKY)warnings.push('Records include parameter variants. Alternate configurations contain the same circuit identities; these are not all unique topologies. Only successfully prepared records can be opened.');
 return result;
}
export async function discoverCatalog(u:URL,fetcher:Fetcher=fetch,index?:D1Database):Promise<CatalogResult>{
 const provider=u.searchParams.get('provider')||'huggingface';if(provider!=='github'&&provider!=='huggingface')throw new FeatureError(400,'Choose GitHub or Hugging Face.');
 const q=(u.searchParams.get('q')||'').trim();if(q.length>150||/[\x00-\x1f]/.test(q))throw new FeatureError(400,'Use a search query under 150 characters.');
 const offset=integer(u.searchParams.get('offset'),0,10000000),length=integer(u.searchParams.get('length'),12,24);if(length<1)throw new FeatureError(400,'Catalog pages need at least one record.');
 const raw=u.searchParams.has('repo')?u.searchParams.get('repo')!:(provider==='huggingface'?SKY:'');
 if(!raw)return sources(provider,q,offset,length,fetcher);
 const repo=repoName(raw);return provider==='github'?githubFiles(u,repo,q,offset,length,fetcher):hfRows(u,repo,q,offset,length,fetcher,index);
}
export async function prepareCatalogSelection(value:unknown,fetcher:Fetcher=fetch):Promise<PreparedCircuit>{
 const s=selection(value);
 if(s.provider==='github'){
  // prepareLink independently fetches the public source and applies strict
  // parsers. A locator is not permission to execute publisher SPICE scripts.
  return prepareLink(`https://github.com/${s.repo}/blob/${encodeURIComponent(s.ref!)}/${filePath(s.path!)}`);
 }
 const data=await remote(VIEWER+'rows?'+new URLSearchParams({dataset:s.repo,config:s.config!,split:s.split!,offset:String(s.row),length:'1'}),fetcher);
 const row=data.rows?.find((r:any)=>r.row_idx===s.row);if(!row)throw new FeatureError(404,'This circuit record no longer exists. Search the source again.');
 if(row.truncated_cells?.length)throw new FeatureError(422,'The provider returned a truncated record; it cannot safely be prepared.');
 const current=await fingerprint(row.row);if(s.fingerprint&&s.fingerprint!==current)throw new FeatureError(409,'The source record changed after your search. Refresh the results before opening it.');
 try {const prepared=rowPrepared(row.row,{...s,fingerprint:current});prepared.reference.metadata.retrievedAt=new Date().toISOString();return prepared;}
 catch(error){throw new FeatureError(422,`This source needs another circuit adapter: ${errorText(error)} Your current design is unchanged.`);}
}
