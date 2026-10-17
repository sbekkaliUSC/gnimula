"""Build a reproducible public SKY130 metadata search index, never user data.

Needs pyarrow + requests. Writes SQL and a provenance manifest under ignored
runtime by default; does not deploy automatically. Downloaded parquet files are
resumable by completed-file reuse and verified byte size. The manifest row is
inserted LAST, so interrupted imports cannot advertise a complete snapshot.
Run schema migration first, then wrangler d1 execute gnimula-main --remote
--file runtime/catalog-index.sql. Rerunning replaces only this public source.
"""
import argparse,hashlib,json,sqlite3
from datetime import datetime,timezone
from pathlib import Path
import pyarrow.parquet as pq
import requests

REPO='pphilip/analog-circuits-sky130'
CONFIG='with_testbench'
FIELDS=['circuit_id','topology','source_dataset','pdk']

def literal(value):
 return "'"+str(value).replace("'","''")+"'"

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--directory',default='runtime');args=parser.parse_args()
 directory=Path(args.directory);directory.mkdir(parents=True,exist_ok=True)
 response=requests.get('https://datasets-server.huggingface.co/parquet',params={'dataset':REPO},timeout=60);response.raise_for_status()
 files=[f for f in response.json()['parquet_files'] if f['config']==CONFIG]
 if not files:raise RuntimeError('No parquet source files returned')
 manifest={'provider':'huggingface','repo':REPO,'config':CONFIG,'retrievedAt':datetime.now(timezone.utc).isoformat(),'files':[],'splits':[],'indexedFields':FIELDS,'contains':'public source metadata only, no netlists or user records'}
 split_rows={};all_rows=[]
 for item in sorted(files,key=lambda f:(f['split'],f['filename'])):
  # Viewer may shard a split later: preserve its filename ordering and cumulative row index.
  split=item['split'];parts=[f for f in files if f['split']==split]
  local=directory/(f'catalog-{split}.parquet' if len(parts)==1 else f'catalog-{split}-{item["filename"].split("/")[-1]}')
  if not local.exists() or local.stat().st_size!=item['size']:
   download=requests.get(item['url'],timeout=180);download.raise_for_status();tmp=local.with_suffix('.part');tmp.write_bytes(download.content)
   if tmp.stat().st_size!=item['size']:raise RuntimeError('Source size changed; retry metadata discovery')
   tmp.replace(local)
  checksum=hashlib.sha256(local.read_bytes()).hexdigest();table=pq.read_table(local,columns=FIELDS)
  start=split_rows.get(split,0)
  for i,row in enumerate(table.to_pylist()):all_rows.append((REPO,CONFIG,split,start+i,*[str(row.get(k) or '') for k in FIELDS]))
  split_rows[split]=start+table.num_rows
  manifest['files'].append({'url':item['url'],'split':split,'filename':item['filename'],'bytes':local.stat().st_size,'sha256':checksum,'rows':table.num_rows})
 manifest['splits']=[{'split':s,'num_rows':n} for s,n in sorted(split_rows.items())];manifest['recordCount']=len(all_rows)
 manifest['sourceRevision']='parquet-sha256:'+hashlib.sha256(json.dumps(manifest['files'],sort_keys=True).encode()).hexdigest()
 sql=[f'DELETE FROM catalog_index_snapshots WHERE repo={literal(REPO)} AND config={literal(CONFIG)};',f'DELETE FROM public_circuit_search WHERE repo={literal(REPO)} AND config={literal(CONFIG)};']
 for start in range(0,len(all_rows),200):
  values=','.join('('+','.join(str(v) if isinstance(v,int) else literal(v) for v in row)+')' for row in all_rows[start:start+200])
  statement='INSERT INTO public_circuit_search(repo,config,split,row_idx,circuit_id,topology,source_dataset,pdk) VALUES '+values+';'
  if len(statement.encode())>95000:raise RuntimeError('SQL statement exceeds the bounded import size')
  sql.append(statement)
 sql.append('INSERT INTO catalog_index_snapshots(repo,config,record_count,splits_json,retrieved_at,source_revision) VALUES ('+','.join(map(literal,[REPO,CONFIG,str(len(all_rows)),json.dumps(manifest['splits']),manifest['retrievedAt'],manifest['sourceRevision']]))+');')
 sqltext='\n'.join(sql)+'\n'
 # Verify the actual generated SQL and search semantics in local SQLite first.
 conn=sqlite3.connect(':memory:');conn.executescript(Path('backend/migrations/0003_public_catalog.sql').read_text());conn.executescript(sqltext)
 assert conn.execute('SELECT count(*) FROM public_circuit_search').fetchone()[0]==len(all_rows)
 manifest['validation']={q:conn.execute('SELECT count(*) FROM public_circuit_search WHERE public_circuit_search MATCH ? AND split=?',(q,'train')).fetchone()[0] for q in ['"amplifier"','"current" AND "mirror"','"differential"']}
 conn.close();(directory/'catalog-index.sql').write_text(sqltext);(directory/'catalog-index-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(json.dumps({'records':manifest['recordCount'],'splits':manifest['splits'],'searchMatches':manifest['validation'],'sqlBytes':len(sqltext.encode())}),flush=True)

if __name__=='__main__':main()
