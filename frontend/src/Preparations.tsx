import {useState} from 'react';
import {ArrowRight,Check,LoaderCircle,RefreshCw} from 'lucide-react';
import type {useWorkbench} from './useWorkbench';
const stageNames:Record<string,string>={queued:'Fetching source',dependencies:'Resolving dependencies',adapting:'Preparing circuit',publishing:'Saving project',ready:'Prepared',needs_input:'Choose a source',failed:'Preparation interrupted'};
export default function Preparations({w,onOpen}:{w:ReturnType<typeof useWorkbench>;onOpen:()=>void}){
 const [error,setError]=useState(''),[working,setWorking]=useState('');
 if(!w.preparations.length)return null;
 const action=async(id:string,fn:()=>Promise<void>)=>{setWorking(id);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setWorking('');}};
 return <section className="preparation-list" aria-label="Source preparations"><details open><summary>Recent source preparations <span>{Math.min(3,w.preparations.length)}</span></summary>
 {error&&<p role="alert">{error}</p>}
 {w.preparations.slice(0,3).map(job=><article key={job.id} className="preparation-job" data-stage={job.stage}>
  <div className="preparation-title">{job.stage==='ready'?<Check size={15}/>:['failed','needs_input'].includes(job.stage)?<RefreshCw size={15}/>:<LoaderCircle size={15} className="spinning"/>}<b>{stageNames[job.stage]||job.stage}</b><small>{new Date(job.updatedAt).toLocaleTimeString()}</small></div>
  <p role={['ready','failed','needs_input'].includes(job.stage)?undefined:'status'}>{job.detail.message||'Starting preparation…'}</p>
  {job.stage==='ready'?<button className="primary" disabled={!!working||!!w.busy} onClick={()=>action(job.id,async()=>{await w.openPrepared(job);onOpen();})}>Open prepared project <ArrowRight size={13}/></button>:['failed','needs_input'].includes(job.stage)?<><p>{job.detail.recovery}</p>{job.detail.choices?.map(choice=><button className="preparation-choice" disabled={!!working||!!w.busy} key={choice.url} title={choice.reason} onClick={()=>action(job.id,()=>w.retryPreparation(job,choice.url))}><span>{choice.recommended?'Suggested · ':''}{choice.path}</span><ArrowRight size={13}/></button>)}<button disabled={!!working||!!w.busy} onClick={()=>action(job.id,()=>w.retryPreparation(job))}>Retry preparation</button></>:<small>You can leave this page. Preparation continues and survives a reload.</small>}
  {job.detail.issues?.length?<details><summary>{job.detail.issues.length} simulation setup items</summary><ul>{job.detail.issues.map((s,i)=><li key={i}>{s}</li>)}</ul></details>:null}
  {job.detail.notes?.length?<details><summary>Preparation record{job.detail.cacheHit?' · reused validated conversion':''}</summary><ul>{job.detail.notes.map((s,i)=><li key={i}>{s}</li>)}</ul></details>:null}
 </article>)}
 </details></section>;
}
