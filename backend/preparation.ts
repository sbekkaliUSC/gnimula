import {resolveSource,resolveDependencies,prepareBundle,cacheKey,validatePrepared,companionSources,digest,type PreparationInput,type SourceFile,type SourceBundle} from './source-service';
import {checkCircuit,uid} from './shared/circuit';
import {FeatureError} from './library-service';
import type {PreparedCircuit} from './shared/ready-library';

export interface PreparationEnv {DB:D1Database;ARTIFACTS:R2Bucket;AI:Ai}
export interface PreparationRow {id:string;session_id:string;input:string;stage:string;detail:string;project_id:string|null;created_at:number;updated_at:number}
export const jobView=(job:PreparationRow)=>({id:job.id,stage:job.stage,detail:JSON.parse(job.detail),projectId:job.project_id,updatedAt:job.updated_at});

/** One durable alarm per stage. An alarm failure resumes the last committed
 * stage; immutable source snapshots and idempotent publication prevent duplicates. */
export class Preparation {
 constructor(private state:DurableObjectState,private env:PreparationEnv){}
 async fetch(request:Request){const {id}=await request.json() as {id:string};if(!/^prep_[a-f0-9]{32}$/.test(id))return new Response('Invalid job',{status:400});await this.state.storage.put('id',id);await this.state.storage.setAlarm(Date.now()+50);return new Response('{}',{headers:{'Content-Type':'application/json'}});}
 async alarm(){
  const id=await this.state.storage.get<string>('id');if(!id)return;
  const job=await this.env.DB.prepare('SELECT j.* FROM preparation_jobs j JOIN sessions s ON j.session_id=s.id WHERE j.id=? AND s.expires_at>?').bind(id,Date.now()).first<PreparationRow>();
  if(!job||['ready','needs_input','failed'].includes(job.stage))return;
  const prefix=`${job.session_id}/preparations/${id}/`,read=async<T>(name:string):Promise<T>=>{const object=await this.env.ARTIFACTS.get(prefix+name);if(!object)throw new Error('The preparation snapshot is unavailable. Retry this source.');return object.json<T>();},write=(name:string,value:unknown)=>this.env.ARTIFACTS.put(prefix+name,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
  const update=async(stage:string,detail:Record<string,unknown>)=>{await this.env.DB.prepare('UPDATE preparation_jobs SET stage=?,detail=?,updated_at=? WHERE id=? AND stage=?').bind(stage,JSON.stringify(detail),Date.now(),id,job.stage).run();};
  try{
   if(job.stage==='queued'){
    const source=await resolveSource(JSON.parse(job.input) as PreparationInput);await write('source.json',source);
    await update('dependencies',{message:'Source saved. Resolving model and subcircuit dependencies.',source:source.url});
   }else if(job.stage==='dependencies'){
    const bundle=await resolveDependencies(await read<SourceFile>('source.json'));await write('bundle.json',bundle);
    await update('adapting',{message:'Dependencies checked. Building the editable circuit.',files:bundle.files.length+1,unresolved:bundle.unresolved});
   }else if(job.stage==='adapting'){
    const bundle=await read<SourceBundle>('bundle.json'),key=await cacheKey(bundle);let prepared:PreparedCircuit,cacheHit=false;
    try{
     const cached=await this.env.ARTIFACTS.get(`public-prepared/${key}.json`);
     if(cached){prepared=validatePrepared(await cached.json<PreparedCircuit>());cacheHit=true;}else prepared=await prepareBundle(bundle);
    }catch(error){
     const choices=await companionSources(bundle.source,this.env.AI);
     await update('needs_input',{message:error instanceof Error?error.message:'The source needs additional setup.',choices,source:bundle.source.url,recovery:choices.length?'Choose the electrical source to prepare. The original native file stays attached.':'Supply the missing public model or electrical-source link below, or choose another design. No replacement circuit has been invented.'});return;
    }
    await write('prepared.json',prepared);
    if(!cacheHit)await this.env.ARTIFACTS.put(`public-prepared/${key}.json`,JSON.stringify(prepared),{httpMetadata:{contentType:'application/json'}});
    await update('publishing',{message:'Circuit validated. Saving the project and original sources.',cacheHit,files:bundle.files.length+1});
   }else if(job.stage==='publishing'){
    const prepared=validatePrepared(await read<PreparedCircuit>('prepared.json')),idProject='project_'+id.slice(5),now=Date.now(),d=prepared.document;d.revision=0;
    const text=JSON.stringify(d),ref=prepared.reference,original=await this.env.ARTIFACTS.get(prefix+'original.json'),additional=original?await original.json<SourceFile>():null,issues=checkCircuit(d).filter(i=>i.level==='error').map(i=>i.message),detail={...JSON.parse(job.detail),message:issues.length?'Circuit opened for editing. Simulation has setup items to resolve.':'Circuit and testbench prepared. Run simulation to measure behavior.',notes:prepared.notes,issues,source:ref.url};
    const statements=[
     this.env.DB.prepare('INSERT OR IGNORE INTO projects(id,session_id,name,revision,document,created_at,updated_at) VALUES(?,?,?,0,?,?,?)').bind(idProject,job.session_id,d.name,text,now,now),
     this.env.DB.prepare('INSERT OR IGNORE INTO revisions(project_id,revision,document,created_at) VALUES(?,0,?,?)').bind(idProject,text,now),
     this.env.DB.prepare('INSERT OR IGNORE INTO project_context(project_id,goal,pdk,version,updated_at) VALUES(?,?,?,1,?)').bind(idProject,prepared.item.goal,prepared.item.pdk,now),
     this.env.DB.prepare('INSERT OR IGNORE INTO project_references(id,project_id,name,source_url,provider,metadata,content,artifact_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('ref_'+id.slice(5),idProject,ref.name,ref.url,ref.provider,JSON.stringify({...ref.metadata,contentSha256:await digest(ref.content),attachedAt:now}),ref.content,prefix+'source.json',now),
     this.env.DB.prepare('INSERT OR IGNORE INTO events(id,session_id,project_id,seq,event_type,actor,client_at,received_at,revision,payload) VALUES(?,?,?,0,?,?,?, ?,0,?)').bind('evt_'+id.slice(5),job.session_id,idProject,'project.prepared','system',now,now,JSON.stringify({jobId:id,source:ref.url,notes:prepared.notes,issues,cacheHit:detail.cacheHit})),
     this.env.DB.prepare('UPDATE preparation_jobs SET stage=?,detail=?,project_id=?,updated_at=? WHERE id=?').bind('ready',JSON.stringify(detail),idProject,now,id)
    ];
    if(additional)statements.push(this.env.DB.prepare('INSERT OR IGNORE INTO project_references(id,project_id,name,source_url,provider,metadata,content,artifact_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind('native_'+id.slice(5),idProject,additional.name,additional.url,additional.provider,JSON.stringify({...additional.metadata,relationship:'User selected an associated electrical source; equivalence is not certified.'}),additional.content,prefix+'original.json',now));
    await this.env.DB.batch(statements);
    await this.env.ARTIFACTS.put(`${job.session_id}/projects/${idProject}/revisions/0.json`,JSON.stringify({document:d,savedAt:now}),{httpMetadata:{contentType:'application/json'}});return;
   }
   await this.state.storage.setAlarm(Date.now()+100);
  }catch(error){
   const detail=JSON.parse(job.detail),retries=Number(detail.retries||0),transient=error instanceof FeatureError&&[429,502,503,504].includes(error.status);
   if(transient&&retries<3){await update(job.stage,{...detail,message:'The public source is temporarily unavailable. Preparation will retry automatically.',retries:retries+1});await this.state.storage.setAlarm(Date.now()+15000*(retries+1));}
   else await update('failed',{message:error instanceof Error?error.message:'Preparation failed. Retry the source.',recovery:'Your previous project is saved. Retry preparation or choose another source.'});
  }
 }
}
