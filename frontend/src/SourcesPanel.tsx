import {useState} from 'react';
import {Check,ExternalLink,Link,MessageSquare} from 'lucide-react';
import {api,type useWorkbench} from './useWorkbench';
import {checkCircuit,validateCircuit} from '../../backend/shared/circuit';
export default function SourcesPanel({w,onChat}:{w:ReturnType<typeof useWorkbench>;onChat:(text:string)=>void}){
 const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const issues=checkCircuit(w.doc!).filter(i=>i.level==='error');
 const attach=async()=>{setBusy(true);setError('');const revision=w.doc!.revision,project=w.projectId;try{
  await w.save();const result=await api('/library/models?'+new URLSearchParams({url}));
  if(!w.isCurrent(project,revision))throw new Error('The circuit changed while models loaded. Retry on the current design.');
  const next=structuredClone(w.doc!);next.definitions=[...(next.definitions||[]),...result.definitions];validateCircuit(next);
  await w.attachReference(result.source);if(!w.isCurrent(project,revision))throw new Error('The design changed. The model source was attached; retry applying it to the current revision.');w.commit(next,'source.models.attached',{url,definitions:result.definitions.length});await w.save();setUrl('');
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <section className="source-workspace"><div className="content-heading"><div><small>PROJECT SOURCES</small><h2>Circuit setup &amp; original files</h2></div></div>
 <div className="source-readiness"><h3>{issues.length?'Ready to edit · simulation needs setup':'Circuit checks passed'}</h3><p>{issues.length?'The imported devices and connections are editable. Resolve these items before running a simulation.':'Run the testbench to measure behavior. Passing setup checks is not a measured result.'}</p>{issues.length?<ul>{issues.map((issue,i)=><li key={i}>{issue.message}</li>)}</ul>:<Check size={17}/>}<button onClick={()=>onChat('Help resolve the current circuit setup issues using its source files. Preserve the original topology and model identities. Explain any decision that needs my input before proposing edits.')}><MessageSquare size={14}/> Help with circuit setup</button></div>
 <form className="model-link" onSubmit={e=>{e.preventDefault();void attach();}}><label htmlFor="model-source-link">Add missing models from a public file</label><div><Link size={15}/><input id="model-source-link" type="url" value={url} placeholder="GitHub or Hugging Face model / subcircuit link" onChange={e=>setUrl(e.target.value)} required/><button disabled={busy||!!w.busy}>{busy?'Resolving models…':'Resolve & attach'}</button></div></form>
 {error&&<p className="library-notice error" role="alert">{error}</p>}
 {!!w.doc!.definitions?.length&&<details className="source-file"><summary>Model cards &amp; subcircuits · {w.doc!.definitions.length} lines</summary><pre>{w.doc!.definitions.join('\n')}</pre></details>}
 {w.references.map(ref=><details key={ref.id} className="source-file"><summary>{ref.name} <small>{ref.provider}</small></summary>{ref.source_url&&<a href={ref.source_url} target="_blank" rel="noreferrer">Original source <ExternalLink size={12}/></a>}{Array.isArray(ref.metadata.preparation)&&<ul>{ref.metadata.preparation.map((note:any,i:number)=><li key={i}>{String(note)}</li>)}</ul>}<pre>{ref.content}</pre>{Array.isArray(ref.metadata.dependencies)&&ref.metadata.dependencies.map((f:any,i:number)=><details key={i}><summary>{String(f.name)}</summary><pre>{String(f.content||'Source link: '+f.url)}</pre></details>)}</details>)}
 {!w.references.length&&<p>No external source files are attached to this project.</p>}
 </section>;
}
