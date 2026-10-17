// Uses environment credentials only. Never writes tokens into config or output.
import fs from 'node:fs/promises';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.');
async function api(path,method='GET',body){const r=await fetch('https://api.cloudflare.com/client/v4'+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();if(!j.success)throw new Error(`${method} ${path.replace(account,'ACCOUNT')}: ${JSON.stringify(j.errors)}`);return j.result;}
const base=`/accounts/${account}`;
const dbs=await api(base+'/d1/database');let db=dbs.find(x=>x.name==='gnimula-main');if(!db)db=await api(base+'/d1/database','POST',{name:'gnimula-main'});
const buckets=await api(base+'/r2/buckets');if(!(buckets.buckets||buckets).some(x=>x.name==='gnimula-artifacts'))await api(base+'/r2/buckets','POST',{name:'gnimula-artifacts',locationHint:'wnam'});
const config={name:'gnimula',main:'backend/worker.ts',compatibility_date:'2026-10-16',compatibility_flags:['nodejs_compat'],workers_dev:true,assets:{directory:'./dist',binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:true},d1_databases:[{binding:'DB',database_name:'gnimula-main',database_id:db.uuid,migrations_dir:'backend/migrations'}],r2_buckets:[{binding:'ARTIFACTS',bucket_name:'gnimula-artifacts'}],ai:{binding:'AI'},containers:[{class_name:'Simulator',image:'./backend/simulator/Dockerfile',image_build_context:'.',max_instances:6000,instance_type:'basic'}],durable_objects:{bindings:[{name:'SIMULATOR',class_name:'Simulator'}]},exports:{Simulator:{type:'durable-object',storage:'sqlite'}},routes:[{pattern:'gnimula.stream',custom_domain:true},{pattern:'www.gnimula.stream',custom_domain:true}],triggers:{crons:['17 7 * * *']},observability:{enabled:true,head_sampling_rate:0.1}};
await fs.writeFile('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
await api(base+'/d1/database/'+db.uuid+'/query','POST',{sql:await fs.readFile('backend/migrations/0001_initial.sql','utf8')});
console.log('D1 and private R2 provisioned; schema applied; wrangler.jsonc written.');
