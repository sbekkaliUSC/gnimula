import {sources,fileKind} from './shared/library';
export class FeatureError extends Error {constructor(public status:number,message:string){super(message)}}
export const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function repoName(value:string){if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(value)||value.includes('..'))throw new FeatureError(400,'Enter owner/repository, without a URL or credentials.');return value;}
export function filePath(value:string){if(value.length>500||value.split('/').some(x=>x==='.'||x==='..')||/[\\\x00-\x1f]/.test(value))throw new FeatureError(400,'Invalid file path.');return value.split('/').filter(Boolean).map(encodeURIComponent).join('/');}
async function remote(url:string,raw=false,maxBytes=2000000):Promise<any>{
 let r:Response;let target=url;
 for(let hop=0;;hop++){
  try{r=await fetch(target,{headers:{'User-Agent':'Gnimula-Public-Library','Accept':raw?'application/vnd.github.raw+json':'application/json'},signal:AbortSignal.timeout(18000),redirect:'manual',cf:{cacheTtlByStatus:{'200-299':300,'400-599':-1},cacheEverything:true}});}catch(error){console.error('Public provider fetch failed',error instanceof Error?error.message:'unknown');throw new FeatureError(502,'The public provider could not be reached. Please retry.');}
  if(r.status>=300&&r.status<400){const next=new URL(r.headers.get('Location')||'',target);await r.body?.cancel();if(hop>=3||next.protocol!=='https:'||!['huggingface.co','api.github.com'].includes(next.hostname)||next.username||next.password)throw new FeatureError(422,'This artifact redirects outside the supported public text service. Open it at its source.');target=next.href;continue;}
  break;
 }
 if(!r.ok){
  const reader=r.body?.getReader();let detail='';if(reader){const first=await reader.read();detail=new TextDecoder().decode(first.value?.slice(0,2000));await reader.cancel();}
  if(/index.{0,30}loading/i.test(detail))throw new FeatureError(503,'Hugging Face is loading this dataset search index. Retry in about a minute, or clear the search to browse records now.');
  throw new FeatureError(r.status===403||r.status===429?429:502,`Public provider returned ${r.status}. It may be rate-limited, private, or unavailable. Try again later or attach a local export.`);
 }
 if(Number(r.headers.get('Content-Length')||0)>maxBytes){await r.body?.cancel();throw new FeatureError(413,'This file is too large to preview. Open it at the source or attach a smaller extracted record.');}
 const reader=r.body!.getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw new FeatureError(413,'Preview exceeds the size limit. Select a smaller file or dataset row.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}const text=new TextDecoder().decode(bytes);
 return raw?text:JSON.parse(text);
}
export async function publicFile(provider:string,repo:string,path:string,ref:string){
 repoName(repo);const pathEncoded=filePath(path);if(!pathEncoded)throw new FeatureError(400,'Select a file.');
 if(!/^[\w.\/-]{1,100}$/.test(ref)||ref.includes('..'))throw new FeatureError(400,'Invalid source revision.');
 let content:string,url:string,resolvedRef=ref;
 if(provider==='github'){
  const meta=await remote(`https://api.github.com/repos/${repo}/contents/${pathEncoded}?ref=${encodeURIComponent(ref)}`);
  if(meta.type!=='file'||meta.size>150000)throw new FeatureError(413,'Select a text file under 150 KB. Large or binary artifacts can be linked as references.');
  if(meta.encoding!=='base64')throw new FeatureError(422,'This provider did not return an inline text file.');
  const bytes=Uint8Array.from(atob(meta.content.replace(/\s/g,'')),x=>x.charCodeAt(0));content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  resolvedRef=meta.sha;url=meta.html_url;
 }else if(provider==='huggingface'){
  content=await remote(`https://huggingface.co/datasets/${repo}/resolve/${encodeURIComponent(ref)}/${pathEncoded}`,true,150000);
  url=`https://huggingface.co/datasets/${repo}/blob/${encodeURIComponent(ref)}/${pathEncoded}`;
 }else throw new FeatureError(400,'Unsupported provider.');
 if(content.includes('\u0000')||content.includes('\uFFFD'))throw new FeatureError(422,'Binary files cannot be used as text context. Attach their source link instead.');
 return {name:path.split('/').at(-1)!,content,url,provider,metadata:{repo,path,revision:resolvedRef,requestedRef:ref,kind:fileKind(path),license:'See upstream file and repository'}};
}
export async function libraryRequest(u:URL):Promise<Response>{
 const route=u.pathname.split('/').at(-1),q=(u.searchParams.get('q')||'').slice(0,150),provider=u.searchParams.get('provider')||'catalog';
 if(route==='search'){
  const kind=u.searchParams.get('kind')||'',pdk=u.searchParams.get('pdk')||'';
  if(provider==='catalog')return response({items:sources.filter(s=>(!kind||s.kinds.includes(kind))&&(!pdk||s.pdk===pdk)&&(!q||`${s.name} ${s.description} ${s.repo||''} ${s.kinds.join(' ')}`.toLowerCase().includes(q.toLowerCase())))});
  if(!q)return response({items:[]});
  if(provider==='github'){
   const data=await remote('https://api.github.com/search/repositories?'+new URLSearchParams({q:q+' '+(pdk&&pdk!=='generic'?pdk:''),per_page:'20'}));
   return response({items:data.items.map((x:any)=>({id:x.full_name,name:x.full_name,provider,repo:x.full_name,url:x.html_url,description:x.description||'',kinds:['repository'],pdk:'unspecified',license:x.license?.spdx_id||'Not declared',revision:x.default_branch}))});
  }
  if(provider==='huggingface'){
   const data=await remote('https://huggingface.co/api/datasets?'+new URLSearchParams({search:q,limit:'20',full:'true'}));
   return response({items:data.map((x:any)=>({id:x.id,name:x.id,provider,repo:x.id,url:`https://huggingface.co/datasets/${x.id}`,description:x.description?.slice(0,300)||x.tags?.slice(0,8).join(', ')||'',kinds:['dataset'],pdk:'unspecified',license:x.cardData?.license||x.tags?.find((t:string)=>t.startsWith('license:'))||'See dataset card'}))});
  }
 }
 const repo=repoName(u.searchParams.get('repo')||''),path=u.searchParams.get('path')||'',ref=u.searchParams.get('ref')||'main';filePath(path);
 if(route==='file')return response(await publicFile(provider,repo,path,ref));
 if(route==='browse'){
  if(provider==='github'){
   const data=await remote(`https://api.github.com/repos/${repo}/contents/${filePath(path)}?ref=${encodeURIComponent(ref)}`);
   if(!Array.isArray(data))throw new FeatureError(400,'Choose a directory to browse.');
   return response({items:data.map((x:any)=>({name:x.name,path:x.path,type:x.type,size:x.size,url:x.html_url,kind:fileKind(x.name),revision:x.sha})),truncated:data.length>=1000});
  }
  if(provider==='huggingface'){
   const data=await remote(`https://huggingface.co/api/datasets/${repo}/tree/${encodeURIComponent(ref)}${path?'/'+filePath(path):''}?limit=100`);
   return response({items:data.map((x:any)=>({name:x.path.split('/').at(-1),path:x.path,type:x.type==='directory'?'dir':'file',size:x.size,url:`https://huggingface.co/datasets/${repo}/blob/${encodeURIComponent(ref)}/${filePath(x.path)}`,kind:fileKind(x.path)})),truncated:data.length>=100});
  }
 }
 if(provider==='huggingface'&&route==='splits')return response(await remote('https://datasets-server.huggingface.co/splits?'+new URLSearchParams({dataset:repo})));
 if(provider==='huggingface'&&route==='rows'){
  const params=new URLSearchParams({dataset:repo,config:(u.searchParams.get('config')||'default').slice(0,100),split:(u.searchParams.get('split')||'train').slice(0,100),offset:String(Math.max(0,Math.min(10000000,Number(u.searchParams.get('offset'))||0))),length:'5'});
  if(q)params.set('query',q);return response(await remote(`https://datasets-server.huggingface.co/${q?'search':'rows'}?${params}`));
 }
 throw new FeatureError(400,'Unsupported library request.');
}
