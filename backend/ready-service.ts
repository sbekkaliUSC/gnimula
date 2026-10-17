import publicRows from './data/sky130-circuits.json';
import bandpass from './data/ngspice-bandpass.json';
import {readyItems,builtinCircuit,prepareSky130Record,preparePublicSpice,type PreparedCircuit,type ReadyItem} from './shared/ready-library';
import {publicFile,FeatureError} from './library-service';

const publicItems:ReadyItem[]=publicRows.map((r,i)=>({id:`sky130-row-${r.offset}`,name:`SKY130 op amp · variant ${i+1}`,description:`${r.verification.lowFrequencyGainDb.toFixed(1)} dB at ${r.verification.lowFrequencyHz} Hz in our prepared testbench. Editable public circuit with models installed.`,kind:'circuit',pdk:'sky130',provider:'Hugging Face',sourceUrl:'https://huggingface.co/datasets/pphilip/analog-circuits-sky130',goal:'Improve this public SKY130 amplifier and verify gain and bias with the installed transistor models.',license:'Apache-2.0 (dataset card)',details:[`Source circuit: ${r.row.circuit_id}`,`A fresh simulation is needed after edits. Reference check: ${r.verification.samples} samples; output bias ${r.verification.operatingOutput.toFixed(3)} V.`]}));
const githubItem:ReadyItem={id:'ngspice-bandpass',name:'ngspice RC band-pass filter',description:'Open the official ngspice example as a wired, editable circuit with its AC sweep already set up.',kind:'circuit',pdk:'generic',provider:'GitHub',sourceUrl:bandpass.url,license:bandpass.license,goal:'Explore this public RC band-pass filter; measure its passband and tune component values.'};
export const catalog=[...readyItems.filter(x=>x.kind==='circuit'),githubItem,...publicItems,...readyItems.filter(x=>x.kind!=='circuit')];
export function prepareItem(id:string):PreparedCircuit {
 if(id===githubItem.id){const p=preparePublicSpice('bandpass.sp',bandpass.content);p.document.name=githubItem.name;return {item:githubItem,...p,reference:{name:'rc-meas-ac.sp',content:bandpass.content,url:bandpass.url,provider:'github',metadata:{repo:bandpass.repo,path:bandpass.path,revision:bandpass.revision,sha256:bandpass.sha256,license:bandpass.license,preparation:p.notes}}};}
 const row=publicRows.find(r=>id===`sky130-row-${r.offset}`);
 if(row){const p=prepareSky130Record(row.row,row.offset),item=publicItems.find(x=>x.id===id)!;p.item=item;p.document.name=item.name;p.reference.metadata={...p.reference.metadata,datasetRevisionAtRetrieval:row.datasetRevisionAtRetrieval,retrievedAt:row.retrievedAt,sourceSha256:row.sourceSha256,verification:row.verification};return p;}
 try{return builtinCircuit(id);}catch(error){throw new FeatureError(404,(error as Error).message);}
}
export async function prepareLink(value:string):Promise<PreparedCircuit>{
 let u:URL;try{u=new URL(value);}catch{throw new FeatureError(400,'Paste the public circuit’s GitHub or Hugging Face link.');}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw new FeatureError(400,'Use a public HTTPS circuit link without credentials or query parameters.');
 const parts=u.pathname.split('/').filter(Boolean);let provider='',repo='',ref='',path='';
 if(u.hostname==='github.com'&&parts.length>=5&&parts[2]==='blob'){provider='github';repo=parts.slice(0,2).join('/');ref=parts[3];path=parts.slice(4).join('/');}
 if(u.hostname==='huggingface.co'&&parts[0]==='datasets'&&parts.length>=6&&['blob','resolve'].includes(parts[3])){provider='huggingface';repo=parts.slice(1,3).join('/');ref=parts[4];path=parts.slice(5).join('/');}
 if(!provider)throw new FeatureError(422,'Gnimula needs a circuit page for this source. Repository home pages are not circuits yet. You can open a prepared design below.');
 const source=await publicFile(provider,repo,decodeURIComponent(path),ref);
 try{
  // The pinned official example is prepared with its documented adapter.
  if(repo===bandpass.repo&&path===bandpass.path){const p=preparePublicSpice(source.name,source.content);return {item:{...githubItem,sourceUrl:source.url},...p,reference:{...source,metadata:{...source.metadata,preparation:p.notes}}};}
  let p:{document:PreparedCircuit['document'];notes:string[]};
  if(/\.json$/i.test(source.name)){
   const value=JSON.parse(source.content);
   if(value.testbench_spice&&value.pdk==='sky130'){const prepared=prepareSky130Record(value,0);return {...prepared,reference:{...source,metadata:{...source.metadata,preparation:prepared.notes}}};}
   const {importDesign}=await import('./shared/imports');p=importDesign(source.name,source.content);
   const {assertReady}=await import('./shared/ready-library');assertReady(p.document);
  }else p=preparePublicSpice(source.name,source.content);
  return {...p,item:{id:'public-link',name:p.document.name,description:'Prepared from your public source.',kind:'circuit',pdk:p.document.components.some(c=>c.deviceModel)?'sky130':'generic',provider,goal:'Explore this public circuit and verify changes with simulation.',sourceUrl:source.url},reference:{...source,metadata:{...source.metadata,preparation:p.notes}}};
 }catch(error){throw new FeatureError(422,`Gnimula cannot prepare this circuit yet: ${(error as Error).message} Your current project is unchanged.`);}
}
