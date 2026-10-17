"""Exercise the hosted AI tool loop in a disposable browser session."""
import json,time,copy
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
base='https://gnimula.stream';checks=[];errors=[]
Path('runtime/logic-probe').mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':1600,'height':1080});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  page.goto(base+'/?demo=xor',wait_until='domcontentloaded',timeout=60000)
  expect(page.get_by_role('button',name='Start AI XOR demo')).to_be_visible(timeout=45000)
  ctx.request.patch(base+'/api/session',data={'trainingOptIn':False},headers={'Origin':base})
  page.screenshot(path='runtime/logic-probe/demo-start.png')
  page.get_by_role('button',name='Start AI XOR demo').click()
  deadline=time.monotonic()+300;last=None;retries=0;state=None
  while time.monotonic()<deadline:
   pid=page.evaluate("localStorage.getItem('gnimula:last-project')")
   if pid:
    response=ctx.request.get(base+'/api/projects/'+pid+'/logic')
    if response.ok:
     state=response.json()['workflow'];stage=state['stage']
     if stage!=last:
      print('Hosted stage:',stage,flush=True);last=stage
      if stage in ['layout','verified']:page.screenshot(path='runtime/logic-probe/demo-layout.png')
     if stage=='complete':break
   if page.get_by_role('alert').count():
    message=page.get_by_role('alert').inner_text()
    if any(s in message for s in ['still deploying','service is starting']) and retries<6:
     retries+=1;page.get_by_role('button',name='Dismiss notification').click();page.wait_for_timeout(5000);page.get_by_role('button',name='Continue demo',exact=True).click()
    else:raise AssertionError(message)
   page.wait_for_timeout(1500)
  assert state and state['stage']=='complete',state
  assert state['pre']['truthPassed'] and state['post']['truthPassed']
  assert state['extraction']['connectivityMatches'] and state['extraction']['drcErrors']==0
  assert state['extraction']['devices']==12 and state['extraction']['parasiticCapacitors']>0
  assert [s['action'] for s in state['timeline']]==['build_schematic','prelayout','layout','verify','postlayout']
  assert all('llama-3.3' in s['model'] for s in state['timeline'])
  checks.append('Real Workers AI invoked all five tools and completed the XOR loop.')
  expect(page.get_by_text('Measured loop complete',exact=True)).to_be_visible(timeout=15000)
  page.screenshot(path='runtime/logic-probe/demo-complete.png')
  page.get_by_role('button',name='Zoom first switching edge').click();page.locator('.logic-wave').scroll_into_view_if_needed();page.screenshot(path='runtime/logic-probe/demo-edge.png')
  page.locator('.logic-preview-tabs').get_by_role('button',name='Schematic',exact=True).click();page.locator('.logic-canvas').scroll_into_view_if_needed();page.screenshot(path='runtime/logic-probe/demo-schematic.png')
  page.reload(wait_until='domcontentloaded');expect(page.get_by_text('Measured loop complete',exact=True)).to_be_visible(timeout=45000)
  checks.append('Reload retains the completed work log, measurements and geometry.')
  for artifact in ['gds','magic','spice']:
   r=ctx.request.get(base+'/api/projects/'+pid+'/logic-artifact/'+artifact);assert r.status==200 and len(r.body())>100,(artifact,r.status)
  checks.append('Generated GDS, Magic layout and extracted SPICE download successfully.')
  other=browser.new_context();other.request.post(base+'/api/session',data={},headers={'Origin':base})
  assert other.request.get(base+'/api/projects/'+pid+'/logic').status==404
  assert other.request.get(base+'/api/projects/'+pid+'/logic-artifact/gds').status==404
  other.request.delete(base+'/api/session',headers={'Origin':base});other.close()
  checks.append('Other guests cannot read workflow results or physical artifacts.')
  # A real canvas edit must invalidate old extraction without a page reload.
  page.locator('.logic-preview-tabs').get_by_role('button',name='Layout',exact=True).click();page.locator('.logic-canvas').scroll_into_view_if_needed()
  shape=page.locator('.logic-canvas svg > g > rect').last;box=shape.bounding_box();assert box
  x,y=box['x']+box['width']/2,box['y']+box['height']/2
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+25,y+20,steps=5);page.mouse.up()
  expect(page.get_by_text('Layout changed. Rerun extraction and post-layout simulation.',exact=True)).to_be_visible(timeout=15000)
  expect(page.get_by_role('button',name='Continue demo',exact=True)).to_be_enabled()
  stale=ctx.request.get(base+'/api/projects/'+pid+'/logic').json()['workflow'];assert 'post' not in stale and 'extraction' not in stale and stale['pre']['truthPassed']
  checks.append('Canvas geometry edit invalidates results immediately and enables rechecking.')
  # The second built-in also runs through the real model and hosted tools.
  r=ctx.request.post(base+'/api/projects',data={'template':'logic-inverter'},headers={'Origin':base});assert r.status==201,r.text()
  inv=r.json();inv_id=inv['id'];inv_doc=inv['document'];inv_state=None
  for expected in ['build_schematic','prelayout','layout','verify','postlayout']:
   r=ctx.request.post(base+'/api/projects/'+inv_id+'/logic',data={'revision':inv_doc['revision'],'instruction':'Complete the inverter homework using the default sizing and 20 fF load. Run the next engineering step.'},headers={'Origin':base},timeout=120000)
   assert r.ok,r.text();v=r.json();assert v['action']==expected,v;inv_doc=v['document'];inv_state=v['workflow']
  assert inv_state['stage']=='complete' and inv_state['post']['truthPassed'] and inv_state['extraction']['drcErrors']==0
  checks.append('Inverter completes the same five hosted AI/tools steps.')
  # Electrical edits invalidate all following measurements, and stale writes fail.
  changed=copy.deepcopy(inv_doc);changed['revision']+=1
  next(c for c in changed['components'] if c['ref']=='CL')['value']=80e-15
  r=ctx.request.put(base+'/api/projects/'+inv_id,data={'baseRevision':inv_doc['revision'],'document':changed},headers={'Origin':base});assert r.ok,r.text()
  stale=ctx.request.get(base+'/api/projects/'+inv_id+'/logic').json()['workflow'];assert stale['stage']=='schematic' and 'pre' not in stale and 'post' not in stale
  r=ctx.request.post(base+'/api/projects/'+inv_id+'/logic',data={'revision':inv_doc['revision'],'instruction':'Continue'},headers={'Origin':base});assert r.status==409
  checks.append('Electrical edits invalidate baseline/post-layout results; stale tool revision is rejected.')
  assert not errors,errors
  report={'checks':checks,'pageErrors':errors,'rolloutRetries':retries,'transistors':state['extraction']['devices'],'parasiticCapacitors':state['extraction']['parasiticCapacitors'],'drcErrors':state['extraction']['drcErrors'],'connectivityMatches':state['extraction']['connectivityMatches'],'preDelayPs':state['pre']['worstDelayPs'],'postDelayPs':state['post']['worstDelayPs'],'truthTable':state['post']['truthTable'],'inverter':{'preDelayPs':inv_state['pre']['worstDelayPs'],'postDelayPs':inv_state['post']['worstDelayPs'],'devices':inv_state['extraction']['devices'],'drcErrors':inv_state['extraction']['drcErrors']},'actions':[{k:s[k] for k in ['action','reason','summary','model']} for s in state['timeline']]}
  Path('runtime/logic-probe/hosted-qa.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2),flush=True)
 finally:
  if page.get_by_role('alert').count():page.screenshot(path='runtime/logic-probe/demo-failure.png')
  page.close();r=ctx.request.delete(base+'/api/session',headers={'Origin':base});assert r.status==200;browser.close()
