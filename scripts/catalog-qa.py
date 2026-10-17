"""Hosted federated-catalog regression; only disposable QA guest data is mutated."""
import json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
base=os.environ.get('GNIMULA_QA_URL','https://gnimula.stream')
out=Path('docs/verification/catalog-2026-10-17');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':1600,'height':1000});page=ctx.new_page();errors=[];checks=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def call(path,method='GET',data=None):
  r=ctx.request.fetch(base+'/api'+path,method=method,data=json.dumps(data) if data is not None else None,headers={'Origin':base,'Content-Type':'application/json'})
  return r.status,r.json()
 def loaded():page.locator('.catalog-count').wait_for(timeout=60000)
 def lib():page.get_by_role('button',name='Library',exact=True).first.click();loaded()
 try:
  page.goto(base,wait_until='networkidle',timeout=60000);page.wait_for_selector('.eda-canvas',timeout=60000)
  page.get_by_role('button',name='Settings',exact=True).click();page.get_by_role('button',name='Data controls',exact=True).click();page.locator('.consent input').uncheck();page.get_by_role('button',name='Close dialog',exact=True).click()
  initial=page.get_by_label('Open project').input_value();original=call('/projects/'+initial)[1]['document']
  lib();expect(page.locator('.catalog-card')).to_have_count(12,timeout=60000);assert '89,708' in page.locator('.catalog-count').inner_text();assert '130,409' in page.locator('.catalog-count').inner_text()
  first=page.locator('.catalog-record-id').first.inner_text();page.screenshot(path=str(out/'online-desktop.png'));checks.append('live dataset totals and compatible first page')
  page.get_by_role('button',name='Next',exact=True).click();page.wait_for_function("()=>document.querySelector('.catalog-pagination')?.textContent.includes('13–24')",timeout=60000);assert page.locator('.catalog-record-id').first.inner_text()!=first
  page.get_by_role('button',name='Previous',exact=True).click();page.wait_for_function("()=>document.querySelector('.catalog-pagination')?.textContent.includes('1–12')",timeout=60000);checks.append('dataset pagination')
  page.locator('.catalog-card').first.get_by_role('button',name='Open & explain',exact=True).click();page.wait_for_selector('.eda-canvas',timeout=60000);page.wait_for_function("()=>document.querySelector('[aria-label=\"Message Gnimula\"]')?.value.startsWith('Explain this imported circuit')")
  assert page.get_by_label('Assistant mode').input_value()=='ask';page.locator('.reference-entry>details>summary').first.click();page.locator('.reference-entry').get_by_text('Source text',exact=True).click();source=page.locator('.reference-entry pre').inner_text();assert '\n' in source and not source.lstrip().startswith('{');checks.append('readable original SPICE testbench');pid=page.get_by_label('Open project').input_value();assert pid!=initial
  state=call('/projects/'+pid+'/context')[1];assert state['references'][0]['metadata']['rowFingerprint'];assert state['context']['pdk']=='sky130';assert call('/projects/'+initial)[1]['document']==original;checks.append('source fingerprint, previous project and grounded Ask draft')
  page.get_by_role('button',name='Run simulation',exact=True).click();page.wait_for_selector('.plot',timeout=90000);run=call('/projects/'+pid+'/runs')[1]['runs'][0];assert len(run['rows'])>100 and 'SKY130' in run['model'];page.screenshot(path=str(out/'online-simulation.png'));checks.append('real SKY130 simulation after catalog open');page.get_by_role('button',name='Simulation setup',exact=True).click();assert page.get_by_label('Analysis type').is_visible();checks.append('direct simulation setup controls')
  lib();page.get_by_label('Search online circuits').fill('current mirror');page.locator('.online-catalog form').get_by_role('button',name='Search',exact=True).click();loaded();expect(page.locator('.catalog-count')).to_contain_text('matching circuit metadata records',timeout=60000);checks.append('indexed metadata search over public dataset')
  page.get_by_label('Online source').select_option('github');loaded();page.get_by_label('Search online circuits').fill('rc-meas-ac.sp');page.locator('.online-catalog form').get_by_role('button',name='Search',exact=True).click();loaded();expect(page.locator('.catalog-card')).to_have_count(1,timeout=60000)
  page.locator('.catalog-card').get_by_role('button',name='Check & open',exact=True).click();page.wait_for_selector('.eda-canvas',timeout=60000);gh=page.get_by_label('Open project').input_value();assert call('/projects/'+gh+'/context')[1]['references'][0]['provider']=='github';checks.append('recursive GitHub file search and preparation')
  lib();page.get_by_role('button',name='Find sources',exact=True).click();loaded();assert 'sources' in page.locator('.catalog-count').inner_text();assert page.get_by_role('button',name='Browse circuits').count()>0;checks.append('GitHub repository discovery distinguished from circuit counts')
  page.get_by_label('Online source').select_option('huggingface');loaded();page.get_by_label('Circuit collection').select_option('Si7li/ltspice-spice-circuits-no-aug');loaded();assert page.locator('.catalog-card').count()>0;assert page.locator('.availability.reference').count()>0;checks.append('unsupported formats explicitly shown as source-only')
  page.get_by_label('Circuit collection').select_option('pphilip/analog-circuits-sky130');loaded();page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'online-mobile.png'))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');checks.append('390px catalog navigation without page overflow')
  assert not errors
  (out/'results.json').write_text(json.dumps({'passed':True,'checks':checks,'browserErrors':errors,'sky130Rows':len(run['rows']),'sky130InitialGainDb':run['rows'][0][1]},indent=2));print(json.dumps({'passed':True,'checks':checks}),flush=True)
 except Exception:
  page.screenshot(path='runtime/catalog-failure.png');print(page.locator('body').inner_text()[-7000:],flush=True);raise
 finally:
  page.close();ctx.request.delete(base+'/api/session',headers={'Origin':base});browser.close()
