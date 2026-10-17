"""Exercise canvas gestures in Chromium using a disposable hosted guest.
Set GNIMULA_QA_LOCAL_ASSETS=1 to test built frontend assets before deployment.
"""
import json, os, re
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect

base=os.environ.get('GNIMULA_QA_URL','https://gnimula.stream')
checks=[]; errors=[]; calls=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':1600,'height':1000})
 page=ctx.new_page()
 if os.environ.get('GNIMULA_QA_LOCAL_ASSETS')=='1':
  page.route(base+'/',lambda r:r.fulfill(path='dist/index.html',content_type='text/html'))
  def asset(r):
   path=Path('dist/assets')/Path(urlparse(r.request.url).path).name
   r.fulfill(path=str(path),content_type='text/css' if path.suffix=='.css' else 'text/javascript')
  page.route(base+'/assets/*',asset)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:calls.append(r.url) if any(x in r.url for x in ['/suggest','/chat','/simulate']) else None)
 def box(): return [float(n) for n in page.locator('.eda-canvas').get_attribute('viewBox').split()]
 def world(x,y): return page.locator('.eda-canvas').evaluate('(e,p)=>{const v=new DOMPoint(...p).matrixTransform(e.getScreenCTM().inverse());return [v.x,v.y]}',[x,y])
 def screen(x,y): return page.locator('.eda-canvas').evaluate('(e,p)=>{const v=new DOMPoint(...p).matrixTransform(e.getScreenCTM());return [v.x,v.y]}',[x,y])
 def close(a,b,tol=.02): assert all(abs(x-y)<tol for x,y in zip(a,b)),(a,b)
 def settle():page.wait_for_timeout(150)
 def fit():
  page.locator('.eda-canvas').hover();page.locator('.eda-canvas').focus();page.keyboard.press('f');settle()
 def drag(x,y,dx,dy,button='left',space=False):
  page.mouse.move(x,y)
  if space:page.keyboard.down('Space')
  page.mouse.down(button=button);page.mouse.move(x+dx,y+dy,steps=6);page.mouse.up(button=button)
  if space:page.keyboard.up('Space')
  settle()
 try:
  page.goto(base,wait_until='networkidle',timeout=60000)
  expect(page.locator('.eda-canvas')).to_be_visible(timeout=45000)
  ctx.request.patch(base+'/api/session',data={'trainingOptIn':False},headers={'Origin':base})
  pid=page.evaluate("()=>localStorage.getItem('gnimula:last-project')")
  original=ctx.request.get(base+'/api/projects/'+pid).json()['document']
  fit();initial_box=box();bounds=page.locator('.eda-canvas').bounding_box()
  x=round(bounds['x']+bounds['width']*.3);y=round(bounds['y']+bounds['height']*.4)
  page.mouse.move(x,y);before=world(x,y);width=box()[2]
  page.mouse.wheel(0,-120);settle()
  assert box()[2]<width;close(world(x,y),before)
  page.keyboard.down('Control');page.mouse.wheel(0,80);page.keyboard.up('Control');settle();close(world(x,y),before)
  assert page.evaluate('()=>window.visualViewport.scale')==1
  checks.append('Wheel and Ctrl-wheel/pinch events zoom around an off-center pointer without page zoom')
  # Consistent toolbar limits/camera, plus/minus reversibility.
  page.get_by_role('button',name='Zoom in (+)',exact=True).click();settle()
  c=box();page.get_by_role('button',name='Zoom out (−)',exact=True).click();settle();d=box()
  close([c[0]+c[2]/2,c[1]+c[3]/2],[d[0]+d[2]/2,d[1]+d[3]/2])
  fit();close(box(),initial_box)
  # Navigation begins on actual devices/pins/wires without selection or geometry edits.
  device=original['components'][0];px,py=screen(device['x'],device['y']);origin=world(px,py)
  drag(px,py,84,42,space=True);close(screen(*origin),[px+84,py+42])
  assert 'tool-select' in page.locator('.eda-canvas').get_attribute('class')
  fit();page.keyboard.press('w');settle()
  pin=page.locator('.symbol .pin').first.bounding_box();px=pin['x']+pin['width']/2;py=pin['y']+pin['height']/2
  start=box();drag(px,py,-60,30,space=True);assert box()!=start
  assert 'tool-wire' in page.locator('.eda-canvas').get_attribute('class')
  assert page.locator('.canvas-tip').count()==0
  fit();point=page.locator('g > path[stroke="transparent"]').first.evaluate('(e)=>{const p=e.getPointAtLength(e.getTotalLength()/2),v=new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM());return [v.x,v.y]}')
  start=box();drag(*point,50,-25,button='middle');assert box()!=start
  checks.append('Space+drag pans over devices and wire-tool pins; middle drag pans over wires; no accidental wire starts')
  fit();start=box();page.mouse.move(x,y);page.keyboard.down('Shift');page.mouse.wheel(35,65);page.keyboard.up('Shift');settle()
  assert box()[:2]!=start[:2];close(box()[2:],start[2:])
  page.keyboard.press('ArrowRight');settle();assert box()[0]>start[0]
  c=box();page.keyboard.press('+');settle();page.keyboard.press('-');settle();close(box(),c)
  checks.append('Shift-scroll and arrows pan; +/- zoom reverses without drift')
  # Ctrl+Z remains undo; we have not edited anything.
  page.keyboard.press('Control+z');settle();fit()
  page.keyboard.press('z');drag(x,y,140,90);assert box()[2]<initial_box[2]
  fit();start=box();drag(x,y,3,3,button='right');close(box(),start)
  drag(x,y,150,110,button='right');assert box()[2]<start[2]
  fit();page.keyboard.press('z');page.keyboard.press('Escape');assert page.locator('.canvas-tip').count()==0
  # Window blur cancels a held Space; it cannot leave the hand mode stuck.
  page.keyboard.down('Space');page.evaluate("()=>window.dispatchEvent(new Event('blur'))");page.keyboard.up('Space')
  assert 'pan-ready' not in page.locator('.eda-canvas').get_attribute('class')
  checks.append('Z/right-drag box zoom works; 3px jitter is ignored; Escape/blur clear transient modes')
  # Text fields and settings must retain ordinary keyboard behavior.
  fit();start=box();chat=page.get_by_role('textbox',name='Message Gnimula');chat.fill('f z + - ');chat.press('Space');chat.press('ArrowLeft');settle();close(box(),start)
  page.get_by_role('button',name='Settings',exact=True).click();page.keyboard.press('f');page.keyboard.press('+');settle();close(box(),start)
  page.get_by_role('button',name='Close dialog',exact=True).click();checks.append('Chat typing and dialog shortcuts do not navigate or edit the circuit')
  # Focus is selection based, and fit/zoom work in the concept layout as well.
  page.locator('.eda-canvas').focus();fit();px,py=screen(device['x'],device['y']);page.mouse.click(px,py);page.keyboard.press('Shift+f');settle();assert box()[2]<initial_box[2]
  page.get_by_role('button',name='Layout',exact=True).first.click();settle();fit()
  layout=box();page.locator('.eda-canvas').hover();page.mouse.wheel(0,-80);settle();assert box()[2]<layout[2]
  page.keyboard.press('Space');page.keyboard.press('f');settle();close(box(),layout)
  checks.append('Selection focus and concept-layout navigation work')
  page.get_by_role('button',name='Schematic',exact=True).first.click();settle();fit()
  # Wait for coalesced navigation events to pass through the existing outbox.
  page.wait_for_timeout(2700)
  current=ctx.request.get(base+'/api/projects/'+pid).json()['document'];assert current==original
  events=ctx.request.get(base+'/api/projects/'+pid+'/events').json()['events']
  nav=[e for e in events if e['event_type']=='viewport.changed'];assert nav
  assert not calls,calls
  assert not errors,errors
  checks.append('Saved document/revision unchanged; viewport events persisted; no AI/simulation calls or JS exceptions')
  # Space release restores ordinary editing; navigation does not occupy undo slots.
  page.get_by_role('button',name='Settings',exact=True).click()
  page.get_by_role('checkbox',name=re.compile('Autocomplete as I work')).uncheck()
  page.get_by_role('button',name='Close dialog',exact=True).click()
  fit();page.keyboard.press('Escape');px,py=screen(device['x'],device['y']);drag(px,py,80,40)
  page.keyboard.press('Control+s');page.wait_for_timeout(800)
  moved=ctx.request.get(base+'/api/projects/'+pid).json()['document']
  moved_device=next(c for c in moved['components'] if c['id']==device['id'])
  assert (moved_device['x'],moved_device['y'])!=(device['x'],device['y'])
  assert moved['wires']==original['wires']
  page.keyboard.press('ArrowRight');page.keyboard.press('+');page.keyboard.press('Control+z');page.keyboard.press('Control+s');page.wait_for_timeout(800)
  restored=ctx.request.get(base+'/api/projects/'+pid).json()['document']
  assert restored['components']==original['components'] and restored['wires']==original['wires']
  checks.append('Normal device drag still edits after panning; undo restores that edit even after more navigation')
  fit();page.screenshot(path='runtime/navigation-desktop.png',full_page=True)
  # Narrow canvas: pointer zoom remains anchored despite SVG letterboxing.
  page.set_viewport_size({'width':760,'height':900});fit();bounds=page.locator('.eda-canvas').bounding_box();x=round(bounds['x']+bounds['width']*.4);y=round(bounds['y']+bounds['height']*.6)
  page.mouse.move(x,y);pt=world(x,y);page.mouse.wheel(0,-80);settle();close(world(x,y),pt)
  checks.append('Pointer anchor holds in a narrow letterboxed canvas')
  assert not errors,errors
  assert not calls,calls
  output={'time':datetime.now(timezone.utc).isoformat(),'candidate_assets':os.environ.get('GNIMULA_QA_LOCAL_ASSETS')=='1','checks':checks,'navigation_events':len(nav),'errors':errors}
  Path('runtime/navigation-qa.json').write_text(json.dumps(output,indent=2));print(json.dumps(output,indent=2))
 except Exception:
  page.screenshot(path='runtime/navigation-failure.png',full_page=True)
  print('Completed checks:',json.dumps(checks));raise
 finally:
  page.close();assert ctx.request.delete(base+'/api/session',headers={'Origin':base}).status==200;browser.close()
