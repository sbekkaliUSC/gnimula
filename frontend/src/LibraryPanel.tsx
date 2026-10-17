import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,BookOpen,Check,ChevronDown,ExternalLink,Layers,Link,Play,Search,Waves,Zap} from 'lucide-react';
import {type ReadyItem} from '../../backend/shared/ready-library';
import OnlineCatalog from './OnlineCatalog';
import {api,type useWorkbench} from './useWorkbench';
type Workbench=ReturnType<typeof useWorkbench>;
export default function LibraryPanel({w,onImported,onChat}:{w:Workbench;onChat:(text?:string)=>void;onImported:(view?:string)=>void}){
 const [tab,setTab]=useState('online');
 const [items,setItems]=useState<ReadyItem[]>([]),[q,setQ]=useState(''),[kind,setKind]=useState(''),[pdk,setPdk]=useState(''),[provider,setProvider]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[sourceUrl,setSourceUrl]=useState('');
 useEffect(()=>{let live=true;api('/library/ready').then(r=>{if(live)setItems(r.items);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
 const filtered=useMemo(()=>items.filter(x=>(tab==='starters'?x.kind==='circuit':x.kind!=='circuit')&&(!q||`${x.name} ${x.description} ${x.provider} ${x.pdk}`.toLowerCase().includes(q.toLowerCase()))&&(!kind||x.kind===kind)&&(!pdk||x.pdk===pdk||x.pdk==='any')&&(!provider||x.provider===provider)),[items,q,kind,pdk,provider,tab]);
 const perform=async(id:string,fn:()=>Promise<void>)=>{if(busy||w.busy)return;setBusy(id);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy('');}};
 const open=(item:ReadyItem,run=false)=>perform(item.id,async()=>{
  if(item.kind==='circuit'){await w.openLibrary(item.id);onImported(run?'simulation':'schematic');if(run)await w.simulate();}
  else{const result=await w.useLibraryTool(item.id);onImported(result.view);if(run&&result.view==='simulation')await w.simulate();}
 });
 const link=()=>perform('link',async()=>{await w.openLibrary('',sourceUrl.trim());onImported('schematic');});
 const locked=!!busy||!!w.busy;
 return <div className="library ready-library">
  <header className="library-heading"><div><small>CIRCUIT LIBRARY</small><h2>Find your next circuit.</h2><p>Search public circuit datasets and repositories. Open supported designs directly with connections, models and a testbench, or start with a prepared example.</p></div></header>
  <div className="library-tabs" role="tablist" aria-label="Library sections">{[['online','Online circuits'],['starters','Starter circuits'],['tools','Circuit tools']].map(([id,title])=><button role="tab" aria-selected={tab===id} key={id} onClick={()=>{setTab(id);setQ('');setKind('');setPdk('');setProvider('');}}>{title}</button>)}</div>
  {tab==='online'?<OnlineCatalog w={w} onImported={onImported} onChat={onChat}/>:<>
  <div className="library-search"><Search size={17}/><input aria-label="Search design library" placeholder="Amplifiers, filters, SKY130…" value={q} onChange={e=>setQ(e.target.value)}/></div>
  <div className="library-filters"><select aria-label="Artifact type" value={kind} onChange={e=>setKind(e.target.value)}><option value="">Everything ready to use</option><option value="circuit">Complete circuits</option><option value="testbench">Testbenches</option><option value="stimulus">Input signals</option><option value="layout">Layout building blocks</option></select><select aria-label="Library PDK filter" value={pdk} onChange={e=>setPdk(e.target.value)}><option value="">All models</option><option value="generic">Generic / passive</option><option value="sky130">SKY130 1.8 V</option></select><select aria-label="Library provider" value={provider} onChange={e=>setProvider(e.target.value)}><option value="">All sources</option>{['Gnimula','GitHub','Hugging Face'].map(x=><option key={x}>{x}</option>)}</select><span>{filtered.length} available · existing projects stay saved</span></div>
  {error&&<div className="library-notice error" role="alert">{error}</div>}
  {busy&&<div className="library-notice" role="status">{busy==='link'?'Fetching and preparing your public circuit…':'Preparing circuit, connections and simulation…'}</div>}
  <div className="ready-grid">{filtered.map(item=><article className="source-card ready-card" key={item.id}>
   <div className="source-tags"><span>{item.kind==='circuit'?<Zap size={12}/>:item.kind==='layout'?<Layers size={12}/>:<Waves size={12}/>} {item.kind==='circuit'?'Circuit':item.kind==='stimulus'?'Input signal':item.kind}</span><span>{item.pdk==='any'?'Your circuit':item.pdk==='sky130'?'SKY130 · TT':'Generic / passive'}</span></div>
   <h3>{item.name}</h3><p>{item.description}</p><small>{item.provider}{item.kind==='circuit'?' · editable schematic + testbench':''}</small>
   {item.details&&<details className="ready-details"><summary>About this design <ChevronDown size={12}/></summary>{item.details.map((t,i)=><p key={i}>{t}</p>)}</details>}
   {item.sourceUrl&&<a className="source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">Source &amp; attribution <ExternalLink size={11}/></a>}
   <div className="ready-actions"><button disabled={locked} className="primary" onClick={()=>open(item)}>{item.kind==='circuit'?'Open circuit':item.kind==='layout'?'Add to layout':'Use in this circuit'}<ArrowRight size={13}/></button>{item.kind!=='layout'&&<button disabled={locked} onClick={()=>open(item,true)} title={item.kind==='circuit'?'Open the circuit and run its testbench':'Set up and run this measurement'}><Play size={12}/>{item.kind==='circuit'?'Open & run':'Use & run'}</button>}</div>
  </article>)}</div>
  {!filtered.length&&<div className="library-empty"><BookOpen size={26}/><h3>No prepared designs match.</h3><p>Clear a filter to see the circuits and tools available now.</p><button onClick={()=>{setQ('');setKind('');setPdk('');setProvider('');}}>Show all</button></div>}
  </>}
  <details className="public-link"><summary><Link size={14}/> Have a public circuit link?</summary><p>Paste a GitHub circuit file or a Hugging Face circuit record. Gnimula fetches it, prepares the schematic and testbench, and keeps the original source with your project.</p><form onSubmit={e=>{e.preventDefault();void link();}}><input type="url" aria-label="Public circuit link" placeholder="https://github.com/…/blob/…/circuit.cir" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} required/><button disabled={locked||!sourceUrl.trim()}>Open circuit <ArrowRight size={13}/></button></form><small>Supported flat SPICE and circuit JSON are prepared automatically. Other native formats and full PDKs are still being connected; they are not presented as ready-to-use designs.</small></details>
 </div>;
}
