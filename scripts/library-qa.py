"""Hosted, disposable-guest checks for the direct-use Library and privacy controls."""
import json,math,os,time
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('GNIMULA_QA_URL','https://gnimula.stream')
Path('runtime').mkdir(exist_ok=True)
evidence=Path(os.environ.get('GNIMULA_QA_EVIDENCE','docs/verification/catalog-2026-10-17/direct-use-results.json'))
evidence.parent.mkdir(parents=True,exist_ok=True)
report={'passed':False,'url':base,'checkedAt':datetime.now(timezone.utc).isoformat(),'checks':[],'browserErrors':[],'cleanup':[]}
guests=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 try:
  ctx=browser.new_context(viewport={'width':1600,'height':1000});guests.append(ctx);page=ctx.new_page();errors=report['browserErrors'];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base,wait_until='networkidle',timeout=60000);page.wait_for_selector('.chat-panel',timeout=45000)
  def call(path,method='GET',data=None):
   return page.evaluate('''async ({path,method,data})=>{const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json'},body:data===null?undefined:JSON.stringify(data)});return {status:r.status,data:await r.json()}}''',dict(path=path,method=method,data=data))
  def pid():return page.evaluate("localStorage.getItem('gnimula:last-project')")
  def library(section='Starter circuits'):
   page.get_by_role('button',name='Library',exact=True).first.click();page.get_by_role('tab',name=section,exact=True).click();page.wait_for_selector('.ready-card');page.wait_for_timeout(250)
  def open_card(name,run=False):
   before=pid();library();page.locator('.ready-card').filter(has=page.get_by_role('heading',name=name,exact=True)).get_by_role('button',name='Open & run' if run else 'Open circuit',exact=True).click()
   try:page.wait_for_selector('.plot' if run else '.eda-canvas',timeout=45000)
   except Exception:
    page.screenshot(path='runtime/library-failure.png');print('FAILED OPEN:',name,page.locator('body').inner_text()[-5000:],flush=True);print('RUNS',call(f'/projects/{pid()}/runs'),flush=True);raise
   for _ in range(30):
    if pid()!=before:break
    page.wait_for_timeout(100)
   assert pid()!=before
  oldpid=pid();old=call(f'/projects/{oldpid}')['data']['document']
  assert page.locator('.notice').count()==0
  page.get_by_role('button',name='Settings',exact=True).click();page.get_by_role('button',name='Data controls',exact=True).click();page.wait_for_selector('.consent input');assert page.locator('.consent input').is_checked()
  page.locator('.consent input').uncheck();page.wait_for_timeout(500);page.get_by_role('button',name='Close dialog',exact=True).click()
  page.reload(wait_until='networkidle');page.wait_for_selector('.chat-panel');page.get_by_role('button',name='Settings',exact=True).click();page.get_by_role('button',name='Data controls',exact=True).click();assert not page.locator('.consent input').is_checked();page.get_by_role('button',name='Close dialog',exact=True).click()
  library();assert page.locator('.ready-card').count()==9;assert page.get_by_role('button',name='Check editable import').count()==0
  page.screenshot(path='runtime/ready-library.png',full_page=True)
  library('Circuit tools');assert page.locator('.ready-card').count()==5;library()
  page.get_by_label('Library provider').select_option('Hugging Face');assert page.locator('.ready-card').count()==3
  page.get_by_label('Library provider').select_option('');page.get_by_label('Search design library').fill('band-pass');assert page.locator('.ready-card').count()==1
  page.get_by_label('Search design library').fill('')
  open_card('ngspice RC band-pass filter',True);ghpid=pid();run=call(f'/projects/{ghpid}/runs')['data']['runs'][0];assert len(run['rows'])>30
  max_error=0
  for f,db,phase in run['rows']:
   omega=2*math.pi*f;h=1j*omega*1000*500e-12/(1+1j*omega*(1000*1e-9+1000*500e-12+1000*500e-12)+(1j*omega)**2*1000*1000*1e-9*500e-12)
   error=abs(db-20*math.log10(abs(h)));max_error=max(max_error,error);assert error<1e-5
  report['bandpass']={'samples':len(run['rows']),'maxGainErrorDb':max_error}
  state=call(f'/projects/{ghpid}/context')['data'];assert state['references'][0]['provider']=='github';assert state['context']['goal'];assert call(f'/projects/{oldpid}')['data']['document']==old
  print('GITHUB: one click -> editable circuit + source + testbench -> numerical response verified',flush=True)
  original=call(f'/projects/{ghpid}')['data']['document'];library('Circuit tools');page.locator('.ready-card').filter(has=page.get_by_role('heading',name='10 kHz input signal',exact=True)).get_by_role('button',name='Use in this circuit',exact=True).click();page.wait_for_selector('.simulation-content');page.wait_for_timeout(1200)
  changed=call(f'/projects/{ghpid}')['data']['document'];assert changed['analysis']['mode']=='tran';assert changed['wires']==original['wires'];assert len(changed['components'])==len(original['components'])
  page.get_by_role('button',name='Undo (Ctrl+Z)',exact=True).click();page.wait_for_timeout(1200);undone=call(f'/projects/{ghpid}')['data']['document'];assert undone['analysis']==original['analysis'];assert undone['components']==original['components']
  library('Circuit tools');page.locator('.ready-card').filter(has=page.get_by_role('heading',name='Metal1-to-metal2 via',exact=True)).get_by_role('button',name='Add to layout',exact=True).click();page.wait_for_selector('.eda-canvas');page.wait_for_timeout(1000);assert len(call(f'/projects/{ghpid}')['data']['document']['shapes'])==3
  print('TOOLS: signal setup, undo and layout block passed',flush=True)
  open_card('SKY130 op amp · variant 1',True);skypid=pid();run=call(f'/projects/{skypid}/runs')['data']['runs'][0];assert 'SKY130' in run['model'];assert abs(run['rows'][0][1]-31.4656586)<.1;assert len(run['rows'])==1001
  report['sky130']={'samples':len(run['rows']),'lowFrequencyHz':run['rows'][0][0],'lowFrequencyGainDb':run['rows'][0][1],'model':run['model']}
  sky=call(f'/projects/{skypid}')['data']['document'];assert any(c.get('deviceModel') for c in sky['components']);assert any(c['kind']=='current' for c in sky['components']);assert all(c['bulk'] for c in sky['components'] if c.get('deviceModel'))
  state=call(f'/projects/{skypid}/context')['data'];assert state['context']['pdk']=='sky130';assert state['references'][0]['provider']=='huggingface';assert state['references'][0]['metadata']['preparation']
  assert page.get_by_label('PROJECT GOAL',exact=True).input_value()==state['context']['goal'];assert page.get_by_label('PDK reference').input_value()=='sky130'
  page.screenshot(path='runtime/sky130-library-run.png');page.get_by_role('button',name='Schematic',exact=True).first.click();page.wait_for_selector('.eda-canvas');page.screenshot(path='runtime/sky130-library-circuit.png')
  print('HUGGING FACE: prepared SKY130 circuit -> real installed models -> 31.47 dB',flush=True)
  page.reload(wait_until='networkidle');page.wait_for_selector('.chat-panel');assert pid()==skypid;assert page.get_by_label('PROJECT GOAL',exact=True).input_value()==state['context']['goal']
  library();page.locator('.public-link summary').click();page.get_by_label('Public circuit link').fill('https://github.com/ngspice/ngspice/blob/master/examples/measure/rc-meas-ac.sp');page.locator('.public-link').get_by_role('button',name='Open circuit',exact=True).click();page.wait_for_selector('.eda-canvas',timeout=45000);linkpid=pid();assert linkpid!=skypid
  assert call(f'/projects/{linkpid}/context')['data']['references'][0]['provider']=='github'
  before=len(call('/projects')['data']['projects']);bad=call('/projects','POST',{'sourceUrl':'https://example.com/secret.cir'});assert bad['status']==422;assert len(call('/projects')['data']['projects'])==before
  other=browser.new_context(viewport={'width':390,'height':844});guests.append(other);mobile=other.new_page();mobile.on('pageerror',lambda e:errors.append(str(e)));mobile.goto(base,wait_until='networkidle');mobile.wait_for_selector('.eda-canvas');mobile.get_by_role('button',name='Settings',exact=True).click();mobile.get_by_role('button',name='Data controls',exact=True).click();assert mobile.locator('.consent input').is_visible();mobile.get_by_role('button',name='Close dialog',exact=True).click()
  mobile.get_by_role('button',name='Library',exact=True).first.click();mobile.get_by_role('tab',name='Starter circuits',exact=True).click();mobile.wait_for_selector('.ready-card');mobile.screenshot(path='runtime/ready-library-mobile.png')
  mobile.get_by_label('Library provider').select_option('GitHub');mobile.get_by_role('button',name='Open circuit',exact=True).first.click();mobile.wait_for_selector('.eda-canvas');mobile.get_by_role('button',name='Chat',exact=True).first.click();assert mobile.get_by_label('Message Gnimula').is_visible();mobile.screenshot(path='runtime/library-mobile-opened.png')
  denied=mobile.evaluate('''async id=>{const r=await fetch('/api/projects/'+id+'/context');return r.status}''',skypid);assert denied==404
  assert not errors
  checks=['settings data controls without banner','training preference persistence','nine starter circuits and five circuit tools','filters','GitHub open and run','band-pass numeric transfer function','previous project preserved','testbench undo','layout tool','SKY130 public model simulation','body terminals and current sources','goal and provenance','reload','public URL automatic preparation','invalid source creates no partial project','mobile settings, library and chat','guest isolation']
  report.update(passed=True,checks=checks)
  print('PASSED:',checks,flush=True)
  
 except Exception as error:
  report['failure']={'type':type(error).__name__,'message':str(error)[:1500]}
  try:page.screenshot(path='runtime/direct-use-failure.png',full_page=True)
  except Exception:pass
  raise
 finally:
  for guest in guests:
   try:
    response=guest.request.delete(base+'/api/session',headers={'Origin':base})
    report['cleanup'].append({'status':response.status,'removed':response.status==200})
   except Exception as error:report['cleanup'].append({'removed':False,'error':type(error).__name__})
   guest.close()
  browser.close()
  report['passed']=report['passed'] and all(item['removed'] for item in report['cleanup'])
  evidence.write_text(json.dumps(report,indent=2)+'\n')
 assert report['passed'], 'Guest cleanup did not complete.'
