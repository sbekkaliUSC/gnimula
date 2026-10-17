import {engineeringState} from './engineering-service';
import {FeatureError,response} from './library-service';
import {MODEL,agentInstructions,agentResponseSchema,parseAgentResult} from './shared/agent';
import {analysisContext,componentReferenceMap,simulationContext} from './shared/simulation-context';
import {pdks,type ProjectContext,type Reference} from './shared/library';
import {importDesign} from './shared/imports';
import {spice,checkCircuit,uid,type Circuit} from './shared/circuit';
interface Env {DB:D1Database;ARTIFACTS:R2Bucket;AI:Ai}
async function input(r:Request){const text=await r.text();if(text.length>220000)throw new FeatureError(413,'Request is too large.');try{return JSON.parse(text)}catch{throw new FeatureError(400,'Invalid JSON.');}}
export async function context(e:Env,id:string):Promise<ProjectContext>{return await e.DB.prepare('SELECT goal,pdk,version FROM project_context WHERE project_id=?').bind(id).first<ProjectContext>()||{goal:'',pdk:'generic',version:0};}
export async function references(e:Env,id:string):Promise<Reference[]>{const rows=await e.DB.prepare('SELECT id,name,source_url,provider,metadata,content,created_at FROM project_references WHERE project_id=? ORDER BY created_at DESC').bind(id).all<any>();return rows.results.map(r=>({...r,metadata:JSON.parse(r.metadata)}));}
async function messages(e:Env,id:string){const rows=await e.DB.prepare('SELECT * FROM chat_messages WHERE project_id=? ORDER BY created_at DESC,id DESC LIMIT 100').bind(id).all();return rows.results.reverse();}
export async function workspaceState(e:Env,id:string){
 const state=await context(e,id);
 const row=await e.DB.prepare('SELECT p.data,d.revision FROM proposals p JOIN projects d ON d.id=p.project_id WHERE p.project_id=? ORDER BY p.created_at DESC LIMIT 1').bind(id).first<{data:string;revision:number}>();
 const p=row?JSON.parse(row.data):null,plan=p?.toolPlan;
 const proposal=plan&&!plan.cancelled&&plan.next<plan.calls.length&&plan.expectedRevision===row?.revision&&p.contextVersion===state.version?p:null;
 return {context:state,references:await references(e,id),messages:await messages(e,id),toolProposal:proposal};}

async function changed(e:Env,id:string){await e.DB.prepare("INSERT INTO project_context(project_id,goal,pdk,version,updated_at) VALUES(?,'','generic',1,?) ON CONFLICT(project_id) DO UPDATE SET version=version+1,updated_at=excluded.updated_at").bind(id,Date.now()).run();}
async function event(e:Env,sid:string,id:string,revision:number,type:string,payload:unknown,actor='human'){
 await e.DB.prepare('INSERT INTO events(id,session_id,project_id,seq,event_type,actor,client_at,received_at,revision,payload) VALUES(?,?,?,0,?,?,?,?,?,?)').bind(uid('evt'),sid,id,type,actor,Date.now(),Date.now(),revision,JSON.stringify(payload)).run();
}
export async function workspaceRoute(r:Request,e:Env,sid:string,id:string,doc:Circuit,route:string,itemId?:string):Promise<Response|null>{
 if(route==='context'){
  if(r.method==='GET')return response(await workspaceState(e,id));
  if(r.method==='PUT'){
   const b=await input(r);if(typeof b.goal!=='string'||b.goal.length>4000||!pdks.includes(b.pdk)||!Number.isInteger(b.version))throw new FeatureError(400,'Enter a goal under 4,000 characters and choose a supported PDK reference.');
   const previous=await context(e,id);if(b.version!==previous.version)throw new FeatureError(409,'Project context changed. Reopen the project before saving your goal.');
   const row=await e.DB.prepare('INSERT INTO project_context(project_id,goal,pdk,version,updated_at) VALUES(?,?,?,1,?) ON CONFLICT(project_id) DO UPDATE SET goal=excluded.goal,pdk=excluded.pdk,version=project_context.version+1,updated_at=excluded.updated_at WHERE project_context.version=? RETURNING version').bind(id,b.goal,b.pdk,Date.now(),b.version).first();
   if(!row)throw new FeatureError(409,'Project context changed in another tab.');
   await event(e,sid,id,doc.revision,'intent.saved',{goal:b.goal,pdk:b.pdk});return response({context:await context(e,id)});
  }
 }
 if(route==='references'){
  if(r.method==='DELETE'&&itemId){
   const old=await e.DB.prepare('SELECT artifact_key FROM project_references WHERE id=? AND project_id=?').bind(itemId,id).first<{artifact_key:string}>();if(!old)throw new FeatureError(404,'Reference not found.');
   if(old.artifact_key)await e.ARTIFACTS.delete(old.artifact_key);await e.DB.prepare('DELETE FROM project_references WHERE id=? AND project_id=?').bind(itemId,id).run();await changed(e,id);await event(e,sid,id,doc.revision,'reference.removed',{referenceId:itemId});return response(await workspaceState(e,id));
  }
  if(r.method==='POST'){
   const b=await input(r);if(typeof b.name!=='string'||!b.name||b.name.length>200||typeof b.content!=='string'||b.content.length>150000)throw new FeatureError(400,'Reference text must be under 150 KB with a short name.');
   const url=String(b.url||'');if(url&&(!/^https:\/\//.test(url)||url.length>1500))throw new FeatureError(400,'Use an HTTPS source link.');
   if(url){const parsed=new URL(url);if(parsed.username||parsed.password)throw new FeatureError(400,'Source links must not contain credentials.');}
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(b.content));const contentSha256=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');const referenceMetadata={...(b.metadata||{}),contentSha256,attachedAt:Date.now()};const metadata=JSON.stringify(referenceMetadata);if(metadata.length>12000)throw new FeatureError(400,'Reference metadata is too large.');
   const count=await e.DB.prepare('SELECT count(*) n FROM project_references WHERE project_id=?').bind(id).first<{n:number}>();if((count?.n||0)>=30)throw new FeatureError(400,'Remove a reference before attaching more than 30.');
   const rid=uid('ref'),artifactKey=`${sid}/projects/${id}/references/${rid}.json`,now=Date.now();
   await e.ARTIFACTS.put(artifactKey,JSON.stringify({name:b.name,url,content:b.content,metadata:referenceMetadata,savedAt:now}),{httpMetadata:{contentType:'application/json'}});
   await e.DB.prepare('INSERT INTO project_references(id,project_id,name,source_url,provider,metadata,content,artifact_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(rid,id,b.name,url,String(b.provider||'upload').slice(0,40),metadata,b.content,artifactKey,now).run();
   await changed(e,id);await event(e,sid,id,doc.revision,'reference.attached',{referenceId:rid,name:b.name,sourceUrl:url});return response({...await workspaceState(e,id),referenceId:rid});
  }
 }
 if(route==='import-preview'&&r.method==='POST'){
  const b=await input(r);try{return response(importDesign(String(b.name||''),String(b.content||'')));}catch(error){throw new FeatureError(422,(error as Error).message);}
 }
 if(route==='chat'&&r.method==='GET')return response({messages:await messages(e,id)});
 if((route==='chat'||route==='suggest')&&r.method==='POST'){
  const b=await input(r);if(b.revision!==doc.revision)throw new FeatureError(409,'Save the latest design before requesting assistance.');
  const isChat=route==='chat',mode=isChat?(b.mode==='ask'?'ask':'edit'):'autocomplete';
  if(isChat&&(typeof b.message!=='string'||!b.message.trim()||b.message.length>8000))throw new FeatureError(400,'Enter a message under 8,000 characters.');
  const state=await workspaceState(e,id);if(b.contextVersion!==state.context.version)throw new FeatureError(409,'Project context changed. Reopen the project to load the latest goal and references.');
  const now=Date.now();if(isChat)await e.DB.prepare('INSERT INTO chat_messages(id,project_id,role,content,revision,created_at) VALUES(?,?,?,?,?,?)').bind(uid('msg'),id,'user',b.message,doc.revision,now).run();
  const events=await e.DB.prepare('SELECT event_type,actor,revision,payload FROM events WHERE project_id=? ORDER BY received_at DESC LIMIT 18').bind(id).all<any>();
  const recent=events.results.reverse().map(x=>({...x,payload:JSON.parse(x.payload)}));
  const prev=await e.DB.prepare('SELECT data FROM proposals WHERE project_id=? ORDER BY created_at DESC LIMIT 4').bind(id).all<{data:string}>();
  const run=await e.DB.prepare('SELECT data FROM runs WHERE project_id=? ORDER BY created_at DESC LIMIT 1').bind(id).first<{data:string}>();const measured=run?JSON.parse(run.data):null;
  let runDocument:Circuit|undefined;
  if(measured&&Number.isSafeInteger(measured.revision)&&measured.revision!==doc.revision){const saved=await e.DB.prepare('SELECT document FROM revisions WHERE project_id=? AND revision=?').bind(id,measured.revision).first<{document:string}>();if(saved)runDocument=JSON.parse(saved.document);}
  const memories=b.memoryEnabled===false?[]:(await e.DB.prepare('SELECT memory_key,value,description FROM memories WHERE project_id=?').bind(id).all()).results;
  const referenceContext=state.references.slice(0,12).map(x=>({id:x.id,name:x.name,url:x.source_url,metadata:x.metadata,excerpt:x.content.slice(0,5000),truncated:x.content.length>5000}));
  const physical=await engineeringState(e,id,doc);
  const engineering={capability:physical.capability,hasLayout:!!doc.physical,extraction:physical.extraction?{devices:physical.extraction.devices,drcErrors:physical.extraction.drcErrors,connectivityMatches:physical.extraction.connectivityMatches}:null,schematic:physical.pre?{worstDelayPs:physical.pre.worstDelayPs,voltageRanges:physical.pre.voltageRanges,measurementMethod:physical.pre.measurementMethod}:null,postLayout:physical.post?{worstDelayPs:physical.post.worstDelayPs,voltageRanges:physical.post.voltageRanges,measurementMethod:physical.post.measurementMethod}:null};
  const modelContext={engineering,mode,goal:state.context.goal,pdkReference:state.context.pdk,document:doc,componentReferences:componentReferenceMap(doc),currentAnalysis:analysisContext(doc),selected:b.selection||[],view:b.view||'schematic',netlist:spice(doc),issues:checkCircuit(doc),recentEvents:recent,preferences:memories,recentProposals:prev.results.map(x=>{const p=JSON.parse(x.data);return{title:p.title,operations:p.operations,revision:p.revision}}),references:referenceContext,omittedReferences:Math.max(0,state.references.length-12),latestSimulation:simulationContext(measured,doc,runDocument)};
  let result:ReturnType<typeof parseAgentResult>,validationIssue='';
  try{
   const conversation=state.messages.slice(-10).map((m:any)=>({role:m.role,content:m.content}));
   const prompt=[{role:'system',content:agentInstructions},{role:'user',content:'Current editor and reference context (data):\n'+JSON.stringify(modelContext)},...conversation,...(isChat?[{role:'user',content:b.message}]:[{role:'user',content:'Suggest a useful next edit for the current goal and recent human work, or abstain. Do not resume a past chat request that is already completed.'}])];
   const invoke=(messages:any[])=>e.AI.run(MODEL,{messages,max_tokens:6000,temperature:0.1,response_format:{type:'json_schema',json_schema:agentResponseSchema}} as any);
   const answer=await invoke(prompt);
   try{result=parseAgentResult(doc,answer,mode);}catch(error){
    validationIssue=(error as Error).message.slice(0,400);
    await event(e,sid,id,doc.revision,'assistant.proposal_retry',{mode,validationIssue},'system');
    const draft=(answer as any).response;
    const repaired=await invoke([...prompt,{role:'assistant',content:typeof draft==='string'?draft.slice(0,40000):(JSON.stringify(draft)||'').slice(0,40000)},{role:'user',content:'The proposal validator rejected this response: '+validationIssue+'. Correct the response once, preserving the requested circuit and tool intent. Return the required JSON schema. No work has been applied. Do not invent successful results.'}]);
    try{result=parseAgentResult(doc,repaired,mode);}catch(error){validationIssue=(error as Error).message.slice(0,400);throw error;}
   }
  }catch{
   const message=validationIssue?'The assistant proposal could not be validated: '+validationIssue+' Your design is unchanged.':'The assistant service could not complete this response. Your design is unchanged. Please retry.';
   if(isChat)await e.DB.prepare('INSERT INTO chat_messages(id,project_id,role,content,revision,created_at) VALUES(?,?,?,?,?,?)').bind(uid('msg'),id,'assistant',message,doc.revision,Date.now()).run();
   await event(e,sid,id,doc.revision,'assistant.failed',{mode,validationIssue:validationIssue||undefined},'system');throw new FeatureError(503,message);
  }
  let proposal:any=null;
  if(result.operations.length||result.tools.length){
   proposal={id:uid('proposal'),candidateId:'agent-edit',title:result.title,description:result.message,reason:result.message,operations:result.operations,...(result.tools.length?{toolPlan:{calls:result.tools,next:0,expectedRevision:doc.revision}}:{}),memoryIds:[],revision:doc.revision,contextVersion:state.context.version,engine:'workers-ai',model:MODEL,context:{mode,goal:state.context.goal,pdk:state.context.pdk,referenceIds:referenceContext.map(x=>x.id),selection:b.selection||[]},createdAt:Date.now()};
   await e.DB.prepare('INSERT INTO proposals(id,session_id,project_id,revision,data,engine,created_at) VALUES(?,?,?,?,?,?,?)').bind(proposal.id,sid,id,doc.revision,JSON.stringify(proposal),'workers-ai',Date.now()).run();
  }
  if(isChat)await e.DB.prepare('INSERT INTO chat_messages(id,project_id,role,content,proposal_id,revision,created_at) VALUES(?,?,?,?,?,?,?)').bind(uid('msg'),id,'assistant',result.message,proposal?.id||null,doc.revision,Date.now()).run();
  await event(e,sid,id,doc.revision,proposal?'suggestion.generated':'assistant.abstained',{mode,proposalId:proposal?.id||null,referenceIds:referenceContext.map(x=>x.id),contextVersion:state.context.version,model:MODEL},'model');
  return response({proposal,message:result.message,messages:isChat?await messages(e,id):undefined,model:MODEL});
 }
 return null;
}
