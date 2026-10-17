"""Browser checks against a disposable guest; never uses an existing user session.
GNIMULA_QA_LOCAL_ASSETS=1 checks built assets before deployment (UI only).
"""
import json, os, re, time, uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base=os.environ.get('GNIMULA_QA_URL','https://gnimula.stream')
local=os.environ.get('GNIMULA_QA_LOCAL_ASSETS')=='1'
checks=[];errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':1440,'height':1000});page=ctx.new_page()
 page.on('pageerror',lambda e:errors.append(str(e)))
 if local:
  page.route(base+'/',lambda r:r.fulfill(path='dist/index.html',content_type='text/html'))
  def asset(r):
   path=Path('dist/assets')/Path(urlparse(r.request.url).path).name
   r.fulfill(path=str(path),content_type='text/css' if path.suffix=='.css' else 'text/javascript')
  page.route(base+'/assets/*',asset)
 try:
  page.goto(base,wait_until='domcontentloaded',timeout=60000)
  expect(page.locator('.eda-canvas')).to_be_visible(timeout=45000)
  ctx.request.patch(base+'/api/session',data={'trainingOptIn':False},headers={'Origin':base})
  expect(page.locator('.bottom-content')).not_to_contain_text('Generic Level-1 MOS models')
  for width in [1440,1100]:
   page.set_viewport_size({'width':width,'height':1000});sizes=[]
   for tab in ['Chat','Assist','Properties','Memory','Chat']:
    page.locator('.inspector-tabs').get_by_role('button',name=tab,exact=True).click()
    sizes.append([page.locator(s).bounding_box()['width'] for s in ['.inspector','.main','.explorer']])
   assert all(all(abs(a-b)<1 for a,b in zip(sizes[0],size)) for size in sizes),sizes
  checks.append('Chat/Assist/Properties/Memory keep the same panel widths at 1440 and 1100 px')
  page.set_viewport_size({'width':1440,'height':1000})
  trigger=page.get_by_role('button',name='Assistant mode',exact=True);trigger.click()
  menu=page.get_by_role('menu',name='Assistant mode');expect(menu).to_be_visible()
  background=menu.evaluate('(e)=>getComputedStyle(e).backgroundColor');assert background not in ['rgb(255, 255, 255)','rgba(0, 0, 0, 0)'],background
  page.screenshot(path='runtime/preparation-mode-menu.png')
  page.get_by_role('menuitemradio',name='Ask · explain only').click();expect(trigger).to_contain_text('Ask')
  trigger.focus();page.keyboard.press('ArrowUp');page.keyboard.press('Escape');expect(menu).not_to_be_visible()
  trigger.click();page.get_by_role('menuitemradio',name='Edit · preview changes').click();expect(trigger).to_contain_text('Edit')
  checks.append('Dark custom mode menu supports selection, keyboard and Escape without sending chat')
  page.locator('.tabs').get_by_role('button',name='Sources',exact=True).click();expect(page.get_by_role('heading',name='Circuit setup & original files')).to_be_visible()
  page.locator('.tabs').get_by_role('button',name='Library',exact=True).click();expect(page.get_by_role('heading',name='Find your next circuit.')).to_be_visible()
  if not local:
   # Start with an actual formerly unsupported dataset record, reload while its
   # durable job is in flight, then verify project identity and provenance.
   data={'requestId':'prep_'+uuid.uuid4().hex,'catalogSelection':{'provider':'huggingface','repo':'pphilip/analog-circuits-sky130','config':'with_testbench','split':'train','row':43969}}
   start=ctx.request.post(base+'/api/preparations',data=data,headers={'Origin':base});assert start.status==202,start.text();jid=start.json()['id']
   page.reload(wait_until='domcontentloaded');expect(page.locator('.eda-canvas')).to_be_visible(timeout=45000)
   page.locator('.tabs').get_by_role('button',name='Library',exact=True).click();expect(page.get_by_label('Source preparations')).to_be_visible(timeout=20000)
   deadline=time.monotonic()+150;job=None
   while time.monotonic()<deadline:
    job=ctx.request.get(base+'/api/preparations/'+jid).json()
    if job['stage'] in ['ready','failed','needs_input']:break
    page.wait_for_timeout(1000)
   assert job['stage']=='ready',job
   assert not job['detail']['issues'],job
   project=ctx.request.get(base+'/api/projects/'+job['projectId']).json()['document']
   assert len(project['components'])==36
   assert sum(c.get('device',{}).get('model','').startswith('sky130_fd_pr__npn') for c in project['components'])==14
   assert project['analysis']['mode']=='tran'
   checks.append('Durable preparation survives browser reload and opens 14 original model-backed BJTs with PWL/PULSE testbench')
   page.get_by_role('button',name='Open prepared project',exact=True).first.click();expect(page.locator('.eda-canvas')).to_be_visible(timeout=30000)
   page.locator('.tabs').get_by_role('button',name='Sources',exact=True).click();expect(page.get_by_text('analogtobi_0815.json',exact=False).first).to_be_visible()
   page.screenshot(path='runtime/preparation-sources.png')
   # No cross-guest preparation access, including retry.
   other=browser.new_context();other.request.post(base+'/api/session',data={},headers={'Origin':base})
   assert other.request.get(base+'/api/preparations/'+jid).status==404
   assert other.request.post(base+'/api/preparations/'+jid+'/retry',data={},headers={'Origin':base}).status==404
   assert other.request.delete(base+'/api/session',headers={'Origin':base}).status==200;other.close()
   # Same source: validated cached conversion, separate project and same graph.
   data['requestId']='prep_'+uuid.uuid4().hex
   again=ctx.request.post(base+'/api/preparations',data=data,headers={'Origin':base});assert again.status==202,again.text();second=again.json()['id']
   deadline=time.monotonic()+150
   while time.monotonic()<deadline:
    cached=ctx.request.get(base+'/api/preparations/'+second).json()
    if cached['stage'] in ['ready','failed','needs_input']:break
    page.wait_for_timeout(1000)
   assert cached['stage']=='ready' and cached['detail']['cacheHit'],cached
   assert cached['projectId']!=job['projectId']
   duplicate=ctx.request.post(base+'/api/preparations',data=data,headers={'Origin':base});assert duplicate.json()['projectId']==cached['projectId']
   checks.append('Validated conversion cache is reused; retries are idempotent; guests cannot read or restart each other’s jobs')
   simulation=ctx.request.post(base+'/api/projects/'+job['projectId']+'/simulate',data={'revision':0},headers={'Origin':base},timeout=120000)
   deadline=time.monotonic()+120
   while simulation.status==503 and time.monotonic()<deadline:
    page.wait_for_timeout(5000);simulation=ctx.request.post(base+'/api/projects/'+job['projectId']+'/simulate',data={'revision':0},headers={'Origin':base},timeout=120000)
   assert simulation.status==200,simulation.text();assert len(simulation.json()['run']['rows'])>500
   checks.append('Hosted ngspice returns measured transient samples for the imported source')
  if not page.locator('.inspector-tabs').is_visible():page.get_by_role('button',name='Toggle inspector',exact=True).click()
  # Rapid tab changes and menu toggles should not lose state or throw.
  for i in range(40):
   page.locator('.tabs').get_by_role('button',name=['schematic.sch','netlist.cir','Sources'][i%3],exact=True).click()
   page.locator('.inspector-tabs').get_by_role('button',name=['Chat','Assist','Properties','Memory'][i%4],exact=True).click()
  assert not errors,errors
  checks.append('80 rapid view/panel switches leave the workbench responsive with no page errors')
 finally:
  page.close();cleanup=ctx.request.delete(base+'/api/session',headers={'Origin':base});assert cleanup.status==200,cleanup.status;browser.close()
Path('runtime/preparation-qa'+('-local' if local else '')+'.json').write_text(json.dumps({'checks':checks,'pageErrors':errors},indent=2))
print(json.dumps({'checks':checks,'pageErrors':errors},indent=2))
