import {engineeringState,runEngineeringTool,runProposedTool} from './engineering-service';
import {prepareModels} from './source-service';
import {Preparation,jobView,type PreparationRow} from './preparation';
export {Preparation};
import {catalog,prepareItem,prepareLink} from './ready-service';
import {discoverCatalog,prepareCatalogSelection} from './catalog-service';
import {FeatureError,libraryRequest} from './library-service';
import {workspaceRoute,workspaceState,context} from './workspace-service';
import { Container, getContainer } from '@cloudflare/containers';
import { applyOperations, candidates, checkCircuit, netMap,spiceReference, spice, starter, uid, validateCircuit, type Circuit, type Memory, type ActionEvent } from './shared/circuit';

interface Env { DB:D1Database; ARTIFACTS:R2Bucket; ASSETS:Fetcher; AI:Ai; PREPARATION:DurableObjectNamespace; SIMULATOR:DurableObjectNamespace<Simulator>; LOCAL_SIMULATOR?:string }
interface Session {id:string; training_opt_in:number; expires_at:number}
interface ProjectRow {id:string; session_id:string; name:string; revision:number; document:string; updated_at:number; created_at:number}
export class Simulator extends Container { defaultPort=8080; sleepAfter='1m'; enableInternet=false; }
class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const hash=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const cookie=(r:Request)=>r.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('gnimula_session='))?.slice(16)||'';
const memoryRow=(r:Record<string,unknown>):Memory=>({id:String(r.id),key:String(r.memory_key),value:JSON.parse(String(r.value)),description:String(r.description),sourceEventId:r.source_event_id?String(r.source_event_id):undefined,createdAt:Number(r.created_at)});
async function body<T=Record<string,unknown>>(r:Request):Promise<T>{const t=await r.text();if(t.length>220000)throw new HttpError(413,'Request is too large.');try{return JSON.parse(t)}catch{throw new HttpError(400,'Invalid JSON.')}}
async function session(r:Request,e:Env):Promise<Session>{const token=cookie(r);if(!token||token.length>100)throw new HttpError(401,'Your guest session has expired. Reload to start a new one.');const row=await e.DB.prepare('SELECT id,training_opt_in,expires_at FROM sessions WHERE token_hash=? AND expires_at>?').bind(await hash(token),Date.now()).first<Session>();if(!row)throw new HttpError(401,'Your guest session has expired. Reload to start a new one.');return row}
async function quota(e:Env,key:string,max:number,period=3600000){const now=Date.now(),bucket=key+':'+Math.floor(now/period);const r=await e.DB.prepare('INSERT INTO quotas(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now+period*2).first<{count:number}>();if(!r||r.count>max)throw new HttpError(429,'Request limit reached. Please try again later.');}
async function project(e:Env,s:Session,id:string){const row=await e.DB.prepare('SELECT * FROM projects WHERE id=? AND session_id=?').bind(id,s.id).first<ProjectRow>();if(!row)throw new HttpError(404,'Project not found.');return row}
async function memories(e:Env,id:string){const r=await e.DB.prepare('SELECT * FROM memories WHERE project_id=? ORDER BY created_at DESC').bind(id).all<Record<string,unknown>>();return r.results.map(memoryRow)}
async function serverEvent(e:Env,s:Session,p:string,type:string,revision:number,payload:unknown,actor='system'){await e.DB.prepare('INSERT INTO events(id,session_id,project_id,seq,event_type,actor,client_at,received_at,revision,payload) VALUES(?,?,?,0,?,?,?,?,?,?)').bind(uid('evt'),s.id,p,type,actor,Date.now(),Date.now(),revision,JSON.stringify(payload)).run()}
async function archive(e:Env,s:Session,p:ProjectRow){await e.ARTIFACTS.put(`${s.id}/projects/${p.id}/revisions/${p.revision}.json`,JSON.stringify({projectId:p.id,revision:p.revision,document:JSON.parse(p.document),savedAt:p.updated_at}),{httpMetadata:{contentType:'application/json'}})}
function safeOrigin(r:Request){if(['GET','HEAD','OPTIONS'].includes(r.method))return;const origin=r.headers.get('Origin'),u=new URL(r.url);if(!origin)throw new HttpError(403,'Same-origin requests only.');let o:URL;try{o=new URL(origin)}catch{throw new HttpError(403,'Invalid origin.');}const local=['localhost','127.0.0.1'];if(o.origin!==u.origin&&!(local.includes(o.hostname)&&local.includes(u.hostname)))throw new HttpError(403,'Same-origin requests only.');}
function cleanPayload(value:unknown,depth=0):unknown{if(depth>8)return null;if(Array.isArray(value))return value.slice(0,200).map(x=>cleanPayload(x,depth+1));if(value&&typeof value==='object'){return Object.fromEntries(Object.entries(value as object).filter(([k])=>!/(password|secret|token|cookie|authorization|api.?key)/i.test(k)).slice(0,100).map(([k,v])=>[k,cleanPayload(v,depth+1)]));}return typeof value==='string'?value.slice(0,3000):value}

async function api(r:Request,e:Env,ctx:ExecutionContext):Promise<Response>{
 const u=new URL(r.url),path=u.pathname; safeOrigin(r);
 if(path==='/api/health')return json({ok:true,app:'Gnimula',version:'0.1.0',storage:'D1 + private R2',simulation:'ngspice',ai:'Workers AI'});
 if(path==='/api/session'&&r.method==='POST'){
  try {const s=await session(r,e);return json({id:s.id,trainingOptIn:!!s.training_opt_in,expiresAt:s.expires_at});}catch(error){if(!(error instanceof HttpError&&error.status===401))throw error;}
  const ip=await hash(r.headers.get('CF-Connecting-IP')||'local');await quota(e,'new-session:'+ip.slice(0,20),600,60000);
  const id=uid('guest'),token=crypto.randomUUID()+crypto.randomUUID(),now=Date.now(),expires=now+30*86400000;
  await e.DB.prepare('INSERT INTO sessions(id,token_hash,created_at,expires_at,training_opt_in) VALUES(?,?,?,?,1)').bind(id,await hash(token),now,expires).run();
  return json({id,trainingOptIn:true,expiresAt:expires},201,{'Set-Cookie':`gnimula_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${u.protocol==='https:'?'; Secure':''}`});
 }
 const s=await session(r,e);
 if(path==='/api/preparations'&&r.method==='GET'){
  const jobs=await e.DB.prepare('SELECT * FROM preparation_jobs WHERE session_id=? ORDER BY updated_at DESC LIMIT 12').bind(s.id).all<PreparationRow>();return json({jobs:jobs.results.map(jobView)});
 }
 if(path==='/api/preparations'&&r.method==='POST'){
  await quota(e,'preparation:'+s.id,20,60000);const b=await body(r),id=String(b.requestId||'');
  if(!/^prep_[a-f0-9]{32}$/.test(id)||(!b.sourceUrl&&!b.catalogSelection))throw new HttpError(400,'Select a source to prepare.');
  const now=Date.now();await e.DB.prepare('INSERT OR IGNORE INTO preparation_jobs(id,session_id,input,created_at,updated_at) VALUES(?,?,?,?,?)').bind(id,s.id,JSON.stringify({sourceUrl:b.sourceUrl,catalogSelection:b.catalogSelection}),now,now).run();
  const job=await e.DB.prepare('SELECT * FROM preparation_jobs WHERE id=? AND session_id=?').bind(id,s.id).first<PreparationRow>();if(!job)throw new HttpError(404,'Preparation not found.');
  await e.PREPARATION.get(e.PREPARATION.idFromName(id)).fetch(new Request('https://preparation/start',{method:'POST',body:JSON.stringify({id})}));return json(jobView(job),202);
 }
 const preparationMatch=path.match(/^\/api\/preparations\/(prep_[a-f0-9]{32})(?:\/(retry))?$/);
 if(preparationMatch){
  const id=preparationMatch[1],job=await e.DB.prepare('SELECT * FROM preparation_jobs WHERE id=? AND session_id=?').bind(id,s.id).first<PreparationRow>();if(!job)throw new HttpError(404,'Preparation not found.');
  if(r.method==='GET')return json(jobView(job));
  if(r.method==='POST'&&preparationMatch[2]==='retry'){
   await quota(e,'preparation:'+s.id,20,60000);if(!['failed','needs_input'].includes(job.stage))throw new HttpError(409,'This preparation is already running or complete.');
   const b=await body(r);let input=job.input;
   if(b.sourceUrl){const choices=JSON.parse(job.detail).choices||[],url=String(b.sourceUrl);if(!choices.some((c:any)=>c.url===url))throw new HttpError(400,'Select a source from this preparation, or start a new preparation with your public link.');
    const original=await e.ARTIFACTS.get(`${s.id}/preparations/${id}/source.json`);if(original)await e.ARTIFACTS.put(`${s.id}/preparations/${id}/original.json`,original.body);input=JSON.stringify({sourceUrl:url});}
   await e.DB.prepare("UPDATE preparation_jobs SET input=?,stage='queued',detail='{}',updated_at=? WHERE id=? AND session_id=?").bind(input,Date.now(),id,s.id).run();
   await e.PREPARATION.get(e.PREPARATION.idFromName(id)).fetch(new Request('https://preparation/start',{method:'POST',body:JSON.stringify({id})}));return json({id,stage:'queued'},202);
  }throw new HttpError(405,'Unsupported preparation operation.');
 }
 if(path==='/api/library/ready'&&r.method==='GET')return json({items:catalog});
 if(path.startsWith('/api/library/')&&r.method==='GET'){
  await quota(e,'library:'+s.id,60,60000);
  if(path==='/api/library/models')return json(await prepareModels(u.searchParams.get('url')||''));
  if(path==='/api/library/discover')return json(await discoverCatalog(u,fetch,e.DB));
  if(path==='/api/library/prepare'){const selection:Record<string,unknown>=Object.fromEntries(u.searchParams);if(u.searchParams.has('row'))selection.row=Number(u.searchParams.get('row'));return json(await prepareCatalogSelection(selection));}
  return libraryRequest(u);
 }
 if(path==='/api/session'&&r.method==='PATCH'){const b=await body(r);if(typeof b.trainingOptIn!=='boolean')throw new HttpError(400,'Invalid preference.');await e.DB.prepare('UPDATE sessions SET training_opt_in=? WHERE id=?').bind(b.trainingOptIn?1:0,s.id).run();return json({trainingOptIn:b.trainingOptIn});}
 if(path==='/api/session'&&r.method==='DELETE'){
  let cursor:string|undefined;do{const listed=await e.ARTIFACTS.list({prefix:s.id+'/',cursor});if(listed.objects.length)await e.ARTIFACTS.delete(listed.objects.map(o=>o.key));cursor=listed.truncated?listed.cursor:undefined}while(cursor);
  await e.DB.prepare('DELETE FROM sessions WHERE id=?').bind(s.id).run();return json({deleted:true},200,{'Set-Cookie':'gnimula_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});
 }
 if(path==='/api/projects'&&r.method==='GET'){const list=await e.DB.prepare('SELECT id,name,revision,created_at,updated_at FROM projects WHERE session_id=? ORDER BY updated_at DESC').bind(s.id).all();return json({projects:list.results});}
 if(path==='/api/projects'&&r.method==='POST'){
  const b=await body(r);let prepared;if(b.libraryId)prepared=prepareItem(String(b.libraryId));else if(b.catalogSelection){await quota(e,'library:'+s.id,60,60000);prepared=await prepareCatalogSelection(b.catalogSelection);}else if(b.sourceUrl){await quota(e,'library:'+s.id,60,60000);prepared=await prepareLink(String(b.sourceUrl));}const d=prepared?.document||(b.document?b.document:starter(String(b.template||'amplifier')));validateCircuit(d);d.revision=0;
  const id=uid('project'),now=Date.now(),text=JSON.stringify(d);
  const statements=[e.DB.prepare('INSERT INTO projects(id,session_id,name,revision,document,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,s.id,d.name,0,text,now,now),e.DB.prepare('INSERT INTO revisions(project_id,revision,document,created_at) VALUES(?,?,?,?)').bind(id,0,text,now)];

  if(prepared){const ref=prepared.reference,rid=uid('ref'),metadata=JSON.stringify({...ref.metadata,contentSha256:await hash(ref.content),attachedAt:now});
   statements.push(e.DB.prepare('INSERT INTO project_context(project_id,goal,pdk,version,updated_at) VALUES(?,?,?,1,?)').bind(id,prepared.item.goal,prepared.item.pdk,now));
   statements.push(e.DB.prepare('INSERT INTO project_references(id,project_id,name,source_url,provider,metadata,content,artifact_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(rid,id,ref.name,ref.url,ref.provider,metadata,ref.content,'',now));
  }
  await e.DB.batch(statements);
  const p=await project(e,s,id);ctx.waitUntil(archive(e,s,p));await serverEvent(e,s,id,'project.created',0,{template:b.template||'import',libraryId:prepared?.item.id,preparation:prepared?.notes});return json({id,document:d,memories:[]},201);
 }
 const match=path.match(/^\/api\/projects\/([a-zA-Z0-9_-]+)(?:\/(events|memories|suggest|apply|simulate|runs|export|revisions|context|chat|references|import-preview|engineering|artifact|tools))?(?:\/([a-zA-Z0-9_-]+))?$/);
 if(!match)throw new HttpError(404,'Not found.');
 const [,id,route,itemId]=match,p=await project(e,s,id),doc: Circuit=JSON.parse(p.document);
 const physical=async(payload:unknown)=>{
  const target=e.LOCAL_SIMULATOR?new URL('/physical',e.LOCAL_SIMULATOR).href:'http://simulator/physical';
  const request=new Request(target,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  let result:Response;try{result=e.LOCAL_SIMULATOR?await fetch(request):await getContainer(e.SIMULATOR,s.id).fetch(request);}catch{throw new HttpError(503,'The engineering service is starting. Retry shortly.');}
  const protocol=Number(result.headers.get('X-Gnimula-Simulator-Protocol'));
  if(protocol<4){
   // Repeated retries otherwise keep an old guest container awake indefinitely.
   // The response has completed; restart only that obsolete guest service.
   if(protocol>0&&!e.LOCAL_SIMULATOR)await getContainer(e.SIMULATOR,s.id).stop().catch(()=>{});
   throw new HttpError(503,'The engineering tools are updating. Retry shortly.');
  }
  const value:any=await result.json();if(!result.ok)throw new HttpError(422,value.error||'Engineering tool failed.');return value;
 };
 if(route==='engineering'){
  if(r.method==='GET')return json({workflow:await engineeringState(e,id,doc)});
  if(r.method!=='POST')throw new HttpError(405,'Unsupported engineering operation.');
  await quota(e,'engineering:'+s.id,30,60000);const b=await body<any>(r);if(b.revision!==doc.revision)throw new HttpError(409,'Save the current revision before running tools.');
  if(!b.tool||!['simulate','generate_layout','verify_layout','simulate_extracted'].includes(b.tool.action))throw new HttpError(400,'Choose a supported engineering tool.');
  return json(await runEngineeringTool(e,s.id,id,doc,b.tool,physical));
 }
 if(route==='tools'&&r.method==='DELETE'){
  const b=await body<any>(r),row=await e.DB.prepare('SELECT data FROM proposals WHERE id=? AND project_id=? AND session_id=?').bind(String(b.proposalId),id,s.id).first<{data:string}>();if(!row)throw new HttpError(404,'Proposal not found.');
  const proposal=JSON.parse(row.data);if(proposal.toolPlan){proposal.toolPlan.cancelled=true;await e.DB.prepare('UPDATE proposals SET data=? WHERE id=? AND data=?').bind(JSON.stringify(proposal),String(b.proposalId),row.data).run();}return json({dismissed:true});
 }
 if(route==='tools'&&r.method==='POST'){
  await quota(e,'engineering:'+s.id,30,60000);const b=await body<any>(r);if(b.revision!==doc.revision)throw new HttpError(409,'Save the current revision before running tools.');
  return json(await runProposedTool(e,s.id,id,doc,String(b.proposalId),(await context(e,id)).version,physical));
 }
 if(route==='artifact'&&r.method==='GET'){
  const state=await engineeringState(e,id,doc),file=({gds:'layout.gds',magic:'layout.mag',spice:'extracted.spice'} as Record<string,string>)[itemId];
  if(!file||!state.extraction?.artifactPrefix?.startsWith(s.id+'/projects/'+id+'/'))throw new HttpError(404,'Run layout extraction for the current revision first.');
  const object=await e.ARTIFACTS.get(state.extraction.artifactPrefix+file);if(!object)throw new HttpError(404,'Artifact unavailable.');return new Response(object.body,{headers:{'Content-Type':itemId==='gds'?'application/octet-stream':'text/plain','Content-Disposition':`attachment; filename="${file}"`}});
 }

 if(['context','chat','references','import-preview','suggest'].includes(route)){if((route==='chat'||route==='suggest')&&r.method==='POST')await quota(e,'suggest-burst:'+s.id,12,60000);const handled=await workspaceRoute(r,e,s.id,id,doc,route,itemId);if(handled)return handled;}
 if(!route&&r.method==='GET')return json({id,document:doc,memories:await memories(e,id)});
 if(!route&&r.method==='PUT'){
  const b=await body<{document:Circuit;baseRevision:number}>(r);validateCircuit(b.document);if(b.baseRevision!==p.revision||b.document.revision<=p.revision)throw new HttpError(409,'This project changed in another tab. Reload before saving.');
  if(b.document.revision>p.revision+10000)throw new HttpError(400,'Invalid revision range.');
  const text=JSON.stringify(b.document),now=Date.now();
  const updated=await e.DB.prepare('UPDATE projects SET document=?,name=?,revision=?,updated_at=? WHERE id=? AND session_id=? AND revision=? RETURNING id').bind(text,b.document.name,b.document.revision,now,id,s.id,p.revision).first();
  if(!updated)throw new HttpError(409,'A newer edit arrived. Reload before saving.');
  await e.DB.prepare('INSERT OR IGNORE INTO revisions(project_id,revision,document,created_at) VALUES(?,?,?,?)').bind(id,b.document.revision,text,now).run();ctx.waitUntil(archive(e,s,{...p,document:text,revision:b.document.revision,updated_at:now}));return json({saved:true,revision:b.document.revision});
 }
 if(route==='events'&&r.method==='POST'){
  const b=await body<{events:ActionEvent[]}>(r);if(!Array.isArray(b.events)||b.events.length>100)throw new HttpError(400,'Invalid event batch.');
  const batch=[];for(const event of b.events){if(!event||typeof event.id!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(event.id)||!Number.isInteger(event.seq)||event.seq<0||!Number.isInteger(event.revision)||event.revision<0||!['human','model','system'].includes(event.actor)||typeof event.type!=='string'||event.type.length>80||!Number.isFinite(event.at))throw new HttpError(400,'Invalid action event.');const payload=JSON.stringify(cleanPayload(event.payload));if(payload.length>12000)throw new HttpError(400,'Event payload too large.');batch.push(e.DB.prepare('INSERT OR IGNORE INTO events(id,session_id,project_id,seq,event_type,actor,client_at,received_at,revision,payload) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(event.id,s.id,id,event.seq,event.type,event.actor,event.at,Date.now(),event.revision,payload));}
  if(batch.length)await e.DB.batch(batch);return json({acknowledged:b.events.map(x=>x.id)});
 }
 if(route==='events'&&r.method==='GET'){const events=await e.DB.prepare('SELECT id,seq,event_type,actor,client_at,received_at,revision,payload FROM events WHERE project_id=? AND session_id=? ORDER BY received_at DESC LIMIT 200').bind(id,s.id).all();return json({events:events.results.map(x=>({...x,payload:JSON.parse(String(x.payload))}))});}
 if(route==='revisions'&&r.method==='GET'&&itemId){const row=await e.DB.prepare('SELECT document FROM revisions WHERE project_id=? AND revision=?').bind(id,Number(itemId)).first<{document:string}>();if(!row)throw new HttpError(404,'Revision not found.');return json({document:JSON.parse(row.document)});}
 if(route==='revisions'&&r.method==='GET'){const revisions=await e.DB.prepare('SELECT revision,created_at FROM revisions WHERE project_id=? ORDER BY revision DESC LIMIT 50').bind(id).all();return json({revisions:revisions.results});}
 if(route==='memories'&&r.method==='GET')return json({memories:await memories(e,id)});
 if(route==='memories'&&r.method==='POST'){
  const b=await body<{key:string;value:number;sourceEventId?:string}>(r);const bounds:Record<string,[number,number,string]>={spacing:[20,1000,'Repeated placement spacing'],mosWidth:[0.1,10000,'Preferred MOS width (µm)']};const rule=bounds[b.key];if(!rule||!Number.isFinite(b.value)||b.value<rule[0]||b.value>rule[1])throw new HttpError(400,'Invalid correction value.');
  let source:string|null=null;if(b.sourceEventId){const ev=await e.DB.prepare('SELECT id FROM events WHERE id=? AND project_id=? AND session_id=?').bind(b.sourceEventId,id,s.id).first<{id:string}>();source=ev?.id||null;}
  const mid=uid('memory');await e.DB.prepare('INSERT INTO memories(id,session_id,project_id,memory_key,value,description,source_event_id,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(project_id,memory_key) DO UPDATE SET value=excluded.value,description=excluded.description,source_event_id=excluded.source_event_id,created_at=excluded.created_at').bind(mid,s.id,id,b.key,JSON.stringify(b.value),rule[2],source,Date.now()).run();await serverEvent(e,s,id,'memory.saved',doc.revision,{key:b.key,value:b.value},'human');return json({memories:await memories(e,id)});
 }
 if(route==='memories'&&r.method==='DELETE'&&itemId){await e.DB.prepare('DELETE FROM memories WHERE id=? AND project_id=? AND session_id=?').bind(itemId,id,s.id).run();await serverEvent(e,s,id,'memory.deleted',doc.revision,{id:itemId},'human');return json({memories:await memories(e,id)});}
 if(route==='apply'&&r.method==='POST'){
  const b=await body<{proposalId:string}>(r),row=await e.DB.prepare('SELECT data,revision FROM proposals WHERE id=? AND project_id=? AND session_id=?').bind(b.proposalId,id,s.id).first<{data:string;revision:number}>();if(!row)throw new HttpError(404,'Completion not found.');if(row.revision!==doc.revision)throw new HttpError(409,'The design changed. Ask for a fresh completion.');const proposal=JSON.parse(row.data);if(proposal.toolPlan)throw new HttpError(400,'Run the proposed tools using the tools endpoint.');if(proposal.contextVersion!==undefined&&proposal.contextVersion!==(await context(e,id)).version)throw new HttpError(409,'The goal or references changed. Request a fresh edit.');const next=applyOperations(doc,proposal.operations),text=JSON.stringify(next),now=Date.now();
  const updated=await e.DB.prepare('UPDATE projects SET document=?,revision=?,updated_at=? WHERE id=? AND session_id=? AND revision=? RETURNING id').bind(text,next.revision,now,id,s.id,doc.revision).first();if(!updated)throw new HttpError(409,'Another edit arrived before this completion.');
  await e.DB.prepare('INSERT OR IGNORE INTO revisions(project_id,revision,document,created_at) VALUES(?,?,?,?)').bind(id,next.revision,text,now).run();await serverEvent(e,s,id,'suggestion.accepted',next.revision,{proposalId:b.proposalId,operations:proposal.operations},'human');ctx.waitUntil(archive(e,s,{...p,revision:next.revision,document:text,updated_at:now}));return json({document:next});
 }
 if(route==='simulate'&&r.method==='POST'){
  const b=await body<{revision:number}>(r);if(b.revision!==doc.revision)throw new HttpError(409,'Save the latest circuit before simulating.');const errors=checkCircuit(doc).filter(x=>x.level==='error');if(errors.length)throw new HttpError(422,errors.map(x=>x.message).join(' '));
  const map=netMap(doc),inputComponent=doc.components.find(c=>c.kind==='voltage'&&`${c.id}.p`===doc.analysis.input);if(!inputComponent)throw new HttpError(422,'Choose the positive terminal of a voltage source as the input.');
  const payload={netlist:spice(doc),analysis:doc.analysis,output:map.get(doc.analysis.output),input:map.get(doc.analysis.input),source:spiceReference(inputComponent,doc)};
  await serverEvent(e,s,id,'simulation.requested',doc.revision,{analysis:doc.analysis});
  const request=new Request('http://simulator/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  let response:Response;
  try{response=e.LOCAL_SIMULATOR?await fetch(e.LOCAL_SIMULATOR,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}):await getContainer(e.SIMULATOR,s.id).fetch(request);}catch{await serverEvent(e,s,id,'simulation.failed',doc.revision,{reason:'worker_unavailable'});throw new HttpError(503,'The simulator is starting or temporarily unavailable. Try again shortly.');}
  if(doc.nodeNames&&Number(response.headers.get('X-Gnimula-Simulator-Protocol'))<2)throw new HttpError(503,'The simulator update is still rolling out. Your prepared circuit is saved; retry simulation shortly.');
  const result=await response.json() as Record<string,unknown>;
  if(!response.ok){await serverEvent(e,s,id,'simulation.failed',doc.revision,{error:result.error});throw new HttpError(422,String(result.error||'Simulation failed.'));}
  const runId=uid('run'),record={...result,id:runId,revision:doc.revision,createdAt:Date.now()};await e.DB.prepare('INSERT INTO runs(id,session_id,project_id,revision,mode,data,created_at) VALUES(?,?,?,?,?,?,?)').bind(runId,s.id,id,doc.revision,doc.analysis.mode,JSON.stringify(record),Date.now()).run();
  ctx.waitUntil(e.ARTIFACTS.put(`${s.id}/runs/${runId}.json`,JSON.stringify({projectId:id,...record,netlist:payload.netlist}),{httpMetadata:{contentType:'application/json'}}));await serverEvent(e,s,id,'simulation.completed',doc.revision,{runId,mode:doc.analysis.mode,elapsedMs:result.elapsedMs});return json({run:record});
 }
 if(route==='runs'&&r.method==='GET'){const list=await e.DB.prepare('SELECT data FROM runs WHERE project_id=? AND session_id=? ORDER BY created_at DESC LIMIT 8').bind(id,s.id).all<{data:string}>();return json({runs:list.results.map(x=>JSON.parse(x.data))});}
 if(route==='export'&&r.method==='GET'){const events=await e.DB.prepare('SELECT id,seq,event_type,actor,client_at,received_at,revision,payload FROM events WHERE project_id=? AND session_id=? ORDER BY received_at LIMIT 20000').bind(id,s.id).all();return json({exportedAt:Date.now(),eventsLimit:20000,eventsMayBeTruncated:events.results.length===20000,document:doc,memories:await memories(e,id),...await workspaceState(e,id),events:events.results.map(x=>({...x,payload:JSON.parse(String(x.payload))})),trainingOptIn:!!s.training_opt_in},200,{'Content-Disposition':`attachment; filename="gnimula-project.json"`});}
 throw new HttpError(405,'Operation not supported.');
}
export default {
 async fetch(r:Request,e:Env,ctx:ExecutionContext):Promise<Response>{
  const url=new URL(r.url);
  if(url.hostname==='www.gnimula.stream')return Response.redirect('https://gnimula.stream'+url.pathname+url.search,308);
  let response:Response;
  try{response=url.pathname.startsWith('/api/')?await api(r,e,ctx):await e.ASSETS.fetch(r);}catch(error){if((error instanceof HttpError||error instanceof FeatureError))response=json({error:error.message},error.status);else{console.error('Request failed',error instanceof Error?{name:error.name,message:error.message,stack:error.stack?.split('\n').slice(0,4)}:'unknown');response=json({error:'The request could not be completed. Please retry.'},500);}}
  const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('X-Frame-Options','DENY');headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  return new Response(response.body,{status:response.status,headers});
 },
 async scheduled(_event:ScheduledController,e:Env,ctx:ExecutionContext){
  ctx.waitUntil((async()=>{const expired=await e.DB.prepare('SELECT id FROM sessions WHERE expires_at<? LIMIT 100').bind(Date.now()).all<{id:string}>();for(const s of expired.results){let cursor:string|undefined;do{const list=await e.ARTIFACTS.list({prefix:s.id+'/',cursor});if(list.objects.length)await e.ARTIFACTS.delete(list.objects.map(o=>o.key));cursor=list.truncated?list.cursor:undefined}while(cursor);await e.DB.prepare('DELETE FROM sessions WHERE id=?').bind(s.id).run();}await e.DB.prepare('DELETE FROM quotas WHERE expires_at<?').bind(Date.now()).run();})());
 }
} satisfies ExportedHandler<Env>;
