import {circuitFromTool,normalizeTools,physicalCapability,physicalDevices,simulationPayload,toolLabels,type ToolCall} from './shared/engineering';
import {uid,validateCircuit,spice,type Circuit} from './shared/circuit';
import {FeatureError} from './library-service';
type Env={DB:D1Database;ARTIFACTS:R2Bucket};
const fingerprint=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');
const electrical=(d:Circuit)=>({netlist:spice(d),analysis:d.analysis});
export async function engineeringState(e:Env,id:string,doc:Circuit){
 const row=await e.DB.prepare('SELECT data FROM engineering_workflows WHERE project_id=?').bind(id).first<{data:string}>();
 const old=row?JSON.parse(row.data):null;let state:any=old?.version===2?old:{version:2,revision:doc.revision,timeline:[]};
 if(state.revision!==doc.revision){
  if(state.electricalSignature===await fingerprint(electrical(doc))){state={...state,revision:doc.revision};if(state.geometrySignature!==await fingerprint({shapes:doc.shapes,physical:doc.physical})){delete state.extraction;delete state.post;delete state.extractedTestbench;state.notice='Layout changed. Rerun extraction before using post-layout results.';}}
  else state={version:2,revision:doc.revision,timeline:state.timeline||[],notice:'Circuit or analysis changed. Run new measurements for this revision.'};
 }
 return {...state,capability:physicalCapability(doc)};
}
export async function runEngineeringTool(e:Env,sid:string,id:string,doc:Circuit,tool:ToolCall,physical:(payload:unknown)=>Promise<any>,actor='human',reason=''){
 try{normalizeTools(doc,[tool]);}catch(error){throw new FeatureError(422,(error as Error).message);}
 const now=Date.now(),lock=uid('lease');await e.DB.prepare('INSERT OR IGNORE INTO engineering_workflows(project_id,updated_at) VALUES(?,?)').bind(id,now).run();
 const acquired=await e.DB.prepare('UPDATE engineering_workflows SET lock_id=?,lock_until=? WHERE project_id=? AND lock_until<? RETURNING project_id').bind(lock,now+180000,id,now).first();
 if(!acquired)throw new FeatureError(409,'An engineering operation is already running for this project.');
 try{
  let state=await engineeringState(e,id,doc),updated=structuredClone(doc),measurement:any,summary='',view='schematic';const action=tool.action;
  if(action==='create_circuit'){
   updated=circuitFromTool(tool);state={version:2,revision:doc.revision,timeline:state.timeline||[]};summary=`Created ${updated.name} with ${updated.components.filter(c=>c.kind!=='ground').length} devices from the proposed netlist. Electrical behavior is not yet verified.`;
  }else{
   let payload:any;try{payload=action==='simulate'||action==='simulate_extracted'?simulationPayload(doc):{};if(action!=='simulate')payload.devices=physicalDevices(doc);}catch(error){throw new FeatureError(422,(error as Error).message);}
   const result=await physical({...payload,action,layout:doc.physical?{...doc.physical,shapes:doc.shapes}:undefined});
   if(result.layout){const {shapes,...metadata}=result.layout;updated.shapes=shapes;updated.physical={process:metadata.process,gridUm:metadata.gridUm,labels:metadata.labels,generator:metadata.generator};delete state.extraction;delete state.post;delete state.extractedTestbench;view='layout';summary=`Generated ${shapes.length} physical rectangles from current MOS connectivity and dimensions. Run layout verification to check the result.`;}
   if(result.extraction){const extraction=result.extraction,prefix=`${sid}/projects/${id}/physical/${doc.revision}/${uid('artifact')}/`;
    await e.ARTIFACTS.put(prefix+'layout.mag',extraction.magic);await e.ARTIFACTS.put(prefix+'extracted.spice',extraction.rawNetlist);if(extraction.gdsBase64)await e.ARTIFACTS.put(prefix+'layout.gds',Uint8Array.from(atob(extraction.gdsBase64),(c)=>c.charCodeAt(0)));
    const {gdsBase64,magic,...small}=extraction;state.extraction={...small,artifactPrefix:prefix};view='layout';summary=`Magic extracted ${extraction.devices} MOS devices and ${extraction.parasiticCapacitors} capacitances. Connectivity and dimensions ${extraction.connectivityMatches?'match':'do not match'} the schematic. DRC: ${extraction.drcErrors??'unavailable'} violations.`;
   }
   if(result.measurement){measurement=result.measurement;view='simulation';if(action==='simulate'){state.pre=measurement;delete state.post;}else{state.post=measurement;state.extractedTestbench=result.extractedTestbench;}
    summary=`${action==='simulate'?'Schematic':'Extracted-layout'} ${measurement.mode} simulation completed: ${measurement.totalSamples||measurement.rows.length} measured points.`;
    if(measurement.worstDelayPs!==null&&measurement.worstDelayPs!==undefined)summary+=` Largest matched input/output midpoint-crossing delay: ${measurement.worstDelayPs.toFixed(1)} ps.`;
   }
  }
  const changed=JSON.stringify(updated)!==JSON.stringify(doc);updated.revision=doc.revision+(changed?1:0);validateCircuit(updated);
  const current=await e.DB.prepare('SELECT revision FROM projects WHERE id=? AND session_id=?').bind(id,sid).first<{revision:number}>();if(current?.revision!==doc.revision)throw new FeatureError(409,'The project changed while the tool ran. Results were not applied; retry on the current revision.');
  if(changed){const saved=await e.DB.prepare('UPDATE projects SET document=?,revision=?,name=?,updated_at=? WHERE id=? AND session_id=? AND revision=? RETURNING id').bind(JSON.stringify(updated),updated.revision,updated.name,Date.now(),id,sid,doc.revision).first();if(!saved)throw new FeatureError(409,'Another edit arrived. Retry the tool.');await e.DB.prepare('INSERT OR IGNORE INTO revisions(project_id,revision,document,created_at) VALUES(?,?,?,?)').bind(id,updated.revision,JSON.stringify(updated),Date.now()).run();await e.ARTIFACTS.put(`${sid}/projects/${id}/revisions/${updated.revision}.json`,JSON.stringify({document:updated,savedAt:Date.now()}));}
  state.electricalSignature=await fingerprint(electrical(updated));state.geometrySignature=await fingerprint({shapes:updated.shapes,physical:updated.physical});state.revision=updated.revision;state.capability=physicalCapability(updated);state.timeline=[...(state.timeline||[]),{id:uid('tool'),action,reason,summary,at:Date.now(),revision:updated.revision,actor}].slice(-30);delete state.notice;
  await e.DB.prepare('UPDATE engineering_workflows SET data=?,updated_at=? WHERE project_id=? AND lock_id=?').bind(JSON.stringify(state),Date.now(),id,lock).run();
  await e.DB.prepare('INSERT INTO chat_messages(id,project_id,role,content,revision,created_at) VALUES(?,?,?,?,?,?)').bind(uid('msg'),id,'assistant',toolLabels[action]+'\n'+summary,updated.revision,Date.now()).run();
  await e.DB.prepare('INSERT INTO events(id,session_id,project_id,seq,event_type,actor,client_at,received_at,revision,payload) VALUES(?,?,?,0,?,?,?,?,?,?)').bind(uid('evt'),sid,id,'engineering.tool.completed',actor,now,Date.now(),updated.revision,JSON.stringify({action,summary,baseRevision:doc.revision})).run();
  if(measurement){const runId=uid('run'),record={...measurement,id:runId,revision:updated.revision,createdAt:Date.now(),stage:action};await e.DB.prepare('INSERT INTO runs(id,session_id,project_id,revision,mode,data,created_at) VALUES(?,?,?,?,?,?,?)').bind(runId,sid,id,updated.revision,measurement.mode,JSON.stringify(record),Date.now()).run();}
  return {workflow:state,document:updated,action,summary,view};
 }finally{await e.DB.prepare('UPDATE engineering_workflows SET lock_id=NULL,lock_until=0 WHERE project_id=? AND lock_id=?').bind(id,lock).run();}
}
export async function runProposedTool(e:Env,sid:string,id:string,doc:Circuit,proposalId:string,contextVersion:number,physical:(payload:unknown)=>Promise<any>){
 const row=await e.DB.prepare('SELECT data FROM proposals WHERE id=? AND project_id=? AND session_id=?').bind(proposalId,id,sid).first<{data:string}>();if(!row)throw new FeatureError(404,'Tool proposal not found.');
 const p=JSON.parse(row.data),plan=p.toolPlan;if(!plan||plan.cancelled||plan.next>=plan.calls.length)throw new FeatureError(409,'This tool plan has finished.');
 if(p.contextVersion!==contextVersion||plan.expectedRevision!==doc.revision)throw new FeatureError(409,'The project or goal changed. Ask for a new tool plan.');
 if(plan.lockUntil>Date.now())throw new FeatureError(409,'This tool is already running.');
 const locked=JSON.stringify({...p,toolPlan:{...plan,lockUntil:Date.now()+180000}});
 const claimed=await e.DB.prepare('UPDATE proposals SET data=? WHERE id=? AND data=? RETURNING id').bind(locked,proposalId,row.data).first();if(!claimed)throw new FeatureError(409,'Another request has claimed this tool.');
 try{
  const result=await runEngineeringTool(e,sid,id,doc,plan.calls[plan.next],physical,'model',p.reason);plan.next++;plan.expectedRevision=result.document.revision;plan.lockUntil=0;p.revision=result.document.revision;
  const failedCheck=result.action==='verify_layout'&&(!result.workflow.extraction?.connectivityMatches||result.workflow.extraction?.drcErrors!==0);
  await e.DB.prepare('UPDATE proposals SET data=? WHERE id=? AND data=?').bind(JSON.stringify(p),proposalId,locked).run();
  return {...result,proposal:plan.next<plan.calls.length?p:null,stop:failedCheck};
 }catch(error){await e.DB.prepare('UPDATE proposals SET data=? WHERE id=? AND data=?').bind(row.data,proposalId,locked).run();throw error;}
}
