"""Hosted checks through ordinary workbench/chat, using disposable guest projects."""
import copy,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
base='https://gnimula.stream';out=Path('runtime/engineering-probe');out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];report={'checks':checks,'pageErrors':errors,'circuits':{}}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':1600,'height':1080});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 def request(method,path,data=None):
  response=getattr(ctx.request,method)(base+'/api'+path,data=data,headers={'Origin':base},timeout=120000)
  assert response.ok,(path,response.status,response.text()[:2000]);return response.json()
 def pid():return page.evaluate("localStorage.getItem('gnimula:last-project')")
 def state():return request('get','/projects/'+pid()+'/engineering')['workflow']
 def chat(message):
  page.get_by_role('textbox',name='Message Gnimula').fill(message)
  with page.expect_response(lambda r:'/chat' in r.url and r.request.method=='POST',timeout=120000) as response:
   page.get_by_role('button',name='Send message',exact=True).click()
  r=response.value;assert r.ok,r.text();return r.json()
 def run_plan():
  button=page.get_by_role('button',name='Run tools',exact=True)
  if not button.count():button=page.get_by_role('button',name='Continue tools',exact=True)
  button.click();page.wait_for_timeout(1000);deadline=time.monotonic()+600
  while time.monotonic()<deadline:
   if page.get_by_role('alert').count():
    message=page.get_by_role('alert').inner_text()
    if any(t in message for t in ['still deploying','service is starting','tools are updating']):
     print(message,flush=True);page.get_by_role('button',name='Dismiss notification').click();page.wait_for_timeout(5000)
     button=page.get_by_role('button',name='Run tools',exact=True)
     if not button.count():button=page.get_by_role('button',name='Continue tools',exact=True)
     button.click()
    else:raise AssertionError(message)
   s=state()
   if s.get('post') and not page.get_by_role('button',name='Stop after current tool').count():
    expect(page.get_by_role('heading',name='Schematic / post-layout comparison')).to_be_visible(timeout=15000)
    return s
   page.wait_for_timeout(1200)
  raise AssertionError('Tool plan timed out: '+json.dumps(state())[:2000])
 def functional_check(s,kind):
  failures=[];samples=[]
  for stage in ['pre','post']:
   run=s[stage];labels=run['labels'];times=[5,15,25,35,45,55,65,75] if kind=='nand' else [10,30,50,70,90,110,130,150]
   inputs=['U (V)','V (V)'] if kind=='nand' else ['A (V)','B (V)'];output='Z (V)' if kind=='nand' else 'OUT (V)'
   for ns in times:
    row=min(run['rows'],key=lambda r:abs(r[0]-ns*1e-9));a=int(row[labels.index(inputs[0])]>.9);b=int(row[labels.index(inputs[1])]>.9);v=row[labels.index(output)];expected=1-(a&b) if kind=='nand' else a^b
    sample={'stage':stage,'timeNs':ns,'inputs':[a,b],'outputV':v,'expected':expected};samples.append(sample)
    if not (v>1.44 if expected else v<.36):failures.append(sample)
  return samples,failures
 def record(kind,s,answer):
  ext=s['extraction'];assert ext['connectivityMatches'] and ext['drcErrors']==0 and ext['parasiticCapacitors']>0
  samples,failures=functional_check(s,kind);assert not failures,(kind,failures)
  report['circuits'][kind]={'settledSamples':samples,'preDelayPs':s['pre']['worstDelayPs'],'postDelayPs':s['post']['worstDelayPs'],'devices':ext['devices'],'capacitances':ext['parasiticCapacitors'],'drcErrors':ext['drcErrors'],'timeline':s['timeline'],'model':answer['model'],'proposal':answer['proposal']}
  print(kind,json.dumps({k:v for k,v in report['circuits'][kind].items() if k not in ['timeline','proposal','settledSamples']}),flush=True)
 try:
  page.goto(base,wait_until='domcontentloaded',timeout=60000);expect(page.get_by_role('textbox',name='Message Gnimula')).to_be_visible(timeout=45000)
  request('patch','/session',{'trainingOptIn':False})
  assert 'Logic demo' not in page.locator('body').inner_text() and 'homework' not in page.locator('body').inner_text().lower()
  page.locator('.main > .tabs').get_by_role('button',name='Library',exact=True).click()
  page.get_by_role('tab',name='Starter circuits').click()
  card=page.locator('.ready-card').filter(has=page.get_by_role('heading',name='12-transistor CMOS XOR',exact=True))
  card.get_by_role('button',name='Open circuit',exact=True).click();expect(page.locator('.title-project')).to_contain_text('12-transistor CMOS XOR',timeout=30000)
  answer=chat('Simulate this circuit, generate its physical layout, verify and extract it, then simulate the extracted layout and compare the waveforms. Keep the schematic and testbench as they are.')
  assert answer['proposal']['toolPlan'];page.screenshot(path=str(out/'chat-tools.png'))
  s=run_plan();record('xor',s,answer);xor_id=pid();assert s['extraction']['devices']==12
  page.screenshot(path=str(out/'xor-comparison.png'));page.get_by_role('button',name='Zoom switching edge').click();page.screenshot(path=str(out/'xor-edge.png'))
  checks.append('Library XOR uses ordinary Chat and editor tools without a dedicated screen.')
  page.locator('.main > .tabs').get_by_role('button',name='layout.lay',exact=True).click();page.screenshot(path=str(out/'xor-layout.png'))
  page.reload(wait_until='domcontentloaded');expect(page.get_by_role('textbox',name='Message Gnimula')).to_be_visible(timeout=45000)
  assert state()['post'];assert not page.get_by_role('button',name='Run tools',exact=True).count()
  for artifact in ['gds','magic','spice']:
   r=ctx.request.get(base+'/api/projects/'+xor_id+'/artifact/'+artifact);assert r.ok and len(r.body())>100
  other=browser.new_context();other.request.post(base+'/api/session',data={},headers={'Origin':base})
  assert other.request.get(base+'/api/projects/'+xor_id+'/engineering').status==404
  assert other.request.get(base+'/api/projects/'+xor_id+'/artifact/gds').status==404
  other.request.delete(base+'/api/session',headers={'Origin':base});other.close()
  checks.append('Reload retains actual results; artifacts are available only to their owner.')
  # Exercise generic creation from a user-supplied circuit, absent from Library.
  # This checks netlist preparation/tooling, not invention of a correct topology.
  page.get_by_role('button',name='New project',exact=True).click();page.get_by_role('button',name='Blank canvas Build a circuit from the ground up.').click()
  expect(page.locator('.title-project')).to_contain_text('Untitled',timeout=15000)
  netlist=Path('tests/fixtures/engineering/nand.cir').read_text()
  report['nandInputSource']='Independent explicit netlist supplied through ordinary Chat; not a claim of autonomous circuit synthesis.'
  answer=chat('Create the circuit from the following exact supplied netlist. Preserve every device connection, net name, value, waveform and analysis. This is a blank project. Then simulate the schematic, generate physical layout, verify/extract and simulate the extracted layout. Use create_circuit and the engineering tools; no library template.\n\n'+netlist)
  assert answer['proposal']['toolPlan']['calls'][0]['action']=='create_circuit',answer
  s=run_plan();samples,failures=functional_check(s,'nand')
  assert not failures,failures
  record('nand',s,answer);assert s['extraction']['devices']==4
  doc=request('get','/projects/'+pid())['document'];assert doc['analysis']['stop']==80e-9
  assert all(x in s['post']['labels'] for x in ['U (V)','V (V)','Z (V)']),s['post']['labels']
  page.screenshot(path=str(out/'nand-comparison.png'));checks.append('Supplied NAND is created through Chat; both simulated responses pass eight settled samples through the same tools with different nets and timing.')
  # A single requested operation must remain a single tool, with persistent dismissal.
  answer=chat('Run only a fresh schematic simulation. Do not regenerate layout, verify, or run extracted simulation.')
  assert [t['action'] for t in answer['proposal']['toolPlan']['calls']]==['simulate'],answer
  page.get_by_role('button',name='Dismiss suggestion',exact=True).click();page.wait_for_timeout(700);page.reload(wait_until='domcontentloaded');expect(page.get_by_role('textbox',name='Message Gnimula')).to_be_visible(timeout=45000)
  assert not page.get_by_role('button',name='Run tools',exact=True).count();checks.append('A single operation is not expanded into a fixed flow; dismissed plans stay dismissed on reload.')
  # Geometry changes remove extraction and block obsolete downloads, retaining schematic result.
  changed=copy.deepcopy(doc);changed['revision']+=1;changed['shapes'][-1]['x']+=20
  request('put','/projects/'+pid(),{'baseRevision':doc['revision'],'document':changed});stale=state();assert 'post' not in stale and 'extraction' not in stale and stale.get('pre')
  assert ctx.request.get(base+'/api/projects/'+pid()+'/artifact/gds').status==404
  r=ctx.request.post(base+'/api/projects/'+pid()+'/tools',data={'revision':doc['revision'],'proposalId':answer['proposal']['id']},headers={'Origin':base});assert r.status==409
  checks.append('Geometry edits invalidate extraction and reject stale artifacts/tool requests.')
  page.reload(wait_until='domcontentloaded');expect(page.get_by_role('textbox',name='Message Gnimula')).to_be_visible(timeout=45000)
  edited=chat('Set the existing output load capacitor to 40 fF. Preserve all other values and wiring. Propose only this parameter edit, without running tools.')
  assert edited['proposal']['operations'] and not edited['proposal'].get('toolPlan')
  with page.expect_response(lambda r:'/apply' in r.url and r.request.method=='POST',timeout=30000) as applied:
   page.get_by_role('button',name='Apply suggestion',exact=True).click()
  assert applied.value.ok,applied.value.text()
  updated=applied.value.json()['document'];assert next(c for c in updated['components'] if c['kind']=='capacitor')['value']==40e-15
  checks.append('Ordinary parameter edits still preview and apply through Chat alongside tool plans.')
  assert not errors,errors
  (out/'hosted-qa.json').write_text(json.dumps(report,indent=2));print(json.dumps({'checks':checks,'pageErrors':errors},indent=2),flush=True)
 except Exception:
  page.screenshot(path=str(out/'failure.png'));(out/'partial-report.json').write_text(json.dumps(report,indent=2));raise
 finally:
  page.close();ctx.request.delete(base+'/api/session',headers={'Origin':base});browser.close()
