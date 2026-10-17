import json,time,os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('GNIMULA_QA_URL','https://gnimula.stream')
Path('runtime').mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':1600,'height':1000});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base,wait_until='networkidle',timeout=60000);page.wait_for_selector('.chat-panel',timeout=45000)
 def call(path,method='GET',data=None):
  return page.evaluate('''async ({path,method,data})=>{const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json'},body:data===null?undefined:JSON.stringify(data)});return {status:r.status,data:await r.json()}}''',dict(path=path,method=method,data=data))
 pid=call('/projects')['data']['projects'][0]['id']
 page.get_by_label('PROJECT GOAL',exact=True).fill('Preserve the existing amplifier topology. Tune component values only. Do not add voltage sources.')
 page.get_by_role('button',name='Save goal',exact=True).click();page.wait_for_timeout(800)
 assert call(f'/projects/{pid}/context')['data']['context']['version']==1
 page.get_by_label('Message Gnimula').fill('Set RD to 22 kΩ. Preserve all wiring and every other component parameter.');page.get_by_role('button',name='Send message',exact=True).click()
 page.wait_for_selector('.proposal',timeout=90000)
 print('CHAT EDIT:',page.locator('.proposal').inner_text()[:700],flush=True)
 page.screenshot(path='runtime/chat-edit.png')
 page.get_by_role('button',name='Apply suggestion',exact=True).click();page.wait_for_timeout(1000)
 doc=call(f'/projects/{pid}')['data']['document'];assert doc['revision']==1;assert len(doc['components'])==6;assert next(c for c in doc['components'] if c['id']=='rd')['value']==22000
 page.get_by_role('button',name='Undo (Ctrl+Z)',exact=True).click();page.wait_for_timeout(1000)
 assert next(c for c in call(f'/projects/{pid}')['data']['document']['components'] if c['id']=='rd')['value']==10000
 page.get_by_label('Assistant mode').select_option('ask');page.get_by_label('Message Gnimula').fill('Why does increasing RD change gain? Explain only; do not edit anything.');page.get_by_role('button',name='Send message',exact=True).click()
 page.locator('.chat-message.assistant').nth(1).wait_for(timeout=90000)
 assert not page.locator('.proposal').count();page.reload(wait_until='networkidle');page.wait_for_selector('.chat-message.assistant')
 assert 'Preserve the existing' in page.get_by_label('PROJECT GOAL',exact=True).input_value();assert page.locator('.chat-message').count()==4
 print('PERSISTENCE/ASK/UNDO: passed',flush=True)
 for path in ['/library/search?provider=github&q=skywater-pdk','/library/browse?provider=huggingface&repo=pphilip/analog-circuits-sky130&ref=main','/library/splits?provider=huggingface&repo=pphilip/analog-circuits-sky130','/library/rows?provider=huggingface&repo=pphilip/analog-circuits-sky130&config=with_testbench&split=train&offset=0']:
  r=call(path);print('PROVIDER:',path,r['status'],list(r['data'])[:5],flush=True);assert r['status']==200
 page.get_by_role('button',name='Library',exact=True).first.click();page.wait_for_selector('.ready-card')
 page.get_by_label('Library provider').select_option('Hugging Face');assert page.locator('.ready-card').count()==3
 page.get_by_label('Library provider').select_option('')
 page.locator('.ready-card').filter(has=page.get_by_role('heading',name='RC low-pass filter',exact=True)).get_by_role('button',name='Open & run',exact=True).click();page.wait_for_selector('.plot',timeout=90000)
 newpid=page.evaluate("localStorage.getItem('gnimula:last-project')");assert newpid!=pid
 state=call(f'/projects/{newpid}/context')['data'];assert len(state['references'])==1
 r=call(f'/projects/{newpid}/runs');assert len(r['data']['runs'])>=1
 print('IMPORTED RC SIMULATION:',r['status'],flush=True)
 bad=call(f'/projects/{newpid}/import-preview','POST',{'name':'pdk.cir','content':'PDK example\n.include sky130.lib\nX1 d g s b sky130_fd_pr__nfet_01v8\n.end'});assert bad['status']==422
 other=browser.new_context();op=other.new_page();op.goto(base,wait_until='networkidle');op.wait_for_selector('.eda-canvas')
 denied=op.evaluate('''async id=>{const r=await fetch('/api/projects/'+id+'/context');return r.status}''',newpid);assert denied==404
 export=call(f'/projects/{newpid}/export')['data'];assert export['references'] and 'context' in export and 'messages' in export
 ctx2=browser.new_context(viewport={'width':390,'height':844});mobile=ctx2.new_page();mobile.goto(base,wait_until='networkidle');mobile.wait_for_selector('.eda-canvas');mobile.get_by_role('button',name='Chat',exact=True).first.click();mobile.wait_for_selector('.chat-panel');mobile.screenshot(path='runtime/chat-mobile.png');assert mobile.get_by_label('Message Gnimula').is_visible()
 print('IMPORT/ISOLATION/MOBILE:',errors,flush=True);assert not errors
 Path('runtime/chat-library-qa-summary.json').write_text(json.dumps({'passed':True,'checks':['goal persistence','real model parameter edit','apply/undo','ask has no edits','chat reload','GitHub search','HF browse/splits/rows','type filters','reference persistence','RC import and hosted simulation','PDK rejection','guest isolation','export context','mobile chat'],'browserErrors':errors},indent=2))
 # Only remove disposable QA guest data; never touch existing visitor sessions.
 for pg in [page,op,mobile]:pg.evaluate("async()=>{await fetch('/api/session',{method:'DELETE'});}")
 browser.close()
