"""Publish the committed source tree with history separate from development.

Default: prepare a local public commit. --push also uploads to the public remote.
Only Git-tracked files in HEAD are exported; credentials/runtime files stay local.
"""
import argparse
import io
import os
from pathlib import Path
import re
import subprocess
import tarfile

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--push',action='store_true')
parser.add_argument('--message',default='Update Gnimula source')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
checkout=root/'runtime'/'public-source'
remote='https://github.com/sbekkaliUSC/gnimula.git'

def git(*args,cwd=root):
 return subprocess.check_output(['git',*args],cwd=cwd)

if git('status','--porcelain').strip():
 raise SystemExit('Commit or preserve pending development changes before publishing.')
configured=subprocess.run(['git','config','--get','gnimula.privateTerms'],cwd=root,capture_output=True,text=True).stdout.strip()
private_terms=[t.strip().lower().encode() for t in os.environ.get('GNIMULA_PUBLIC_EXCLUDE_TERMS',configured).split(',') if t.strip()]
archive=git('archive','--format=tar','HEAD')
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
 members=tar.getmembers()
 for member in members:
  path=Path(member.name)
  if path.is_absolute() or '..' in path.parts or '.git' in path.parts or member.issym() or member.islnk():
   raise SystemExit('Unsupported archive path: '+member.name)
  if not member.isfile():continue
  data=tar.extractfile(member).read()
  if any(term in data.lower() for term in private_terms):
   raise SystemExit('Review private affiliation reference before publication: '+member.name)
  if re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk-(?:proj-|ant-api\d*-)?[A-Za-z0-9_-]{40,}|AKIA[0-9A-Z]{16}',data):
   raise SystemExit('Review possible credential before publication: '+member.name)
 if not (checkout/'.git').exists():
  if checkout.exists() and any(checkout.iterdir()):raise SystemExit('Public checkout is not empty; preserve it before initializing.')
  checkout.mkdir(parents=True,exist_ok=True)
  git('init','--initial-branch=main',cwd=checkout)
  git('remote','add','origin',remote,cwd=checkout)
 if git('remote','get-url','origin',cwd=checkout).decode().strip()!=remote:
  raise SystemExit('Unexpected public checkout remote.')
 if git('status','--porcelain',cwd=checkout).strip():raise SystemExit('Preserve pending public checkout changes before publishing.')
 tracked={m.name for m in members if m.isfile()}
 for name in filter(None,git('ls-files','-z',cwd=checkout).decode().split('\0')):
  if name not in tracked:(checkout/name).unlink()
 for member in members:
  path=checkout/member.name
  if member.isdir():path.mkdir(parents=True,exist_ok=True)
  elif member.isfile():
   path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(tar.extractfile(member).read());path.chmod(member.mode&0o777)
 git('add','--all',cwd=checkout)
 if git('diff','--cached','--name-only',cwd=checkout).strip():
  git('commit','-m',args.message,cwd=checkout)
 if args.push:
  subprocess.run(['git','push','--set-upstream','origin','main'],cwd=checkout,check=True)
 print('Prepared public source commit:',git('rev-parse','--short','HEAD',cwd=checkout).decode().strip())
