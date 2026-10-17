"""Seeded browser chaos against a disposable guest, with persistence checks.

Run from the repository root, for example:
  GNIMULA_QA_URL=https://gnimula.stream python3 scripts/monkey-qa.py --seed 101 --steps 180

The seed chooses actions; replay.jsonl also records the controls/coordinates actually
used because network timing and catalog contents can vary between runs. No account
cookies are loaded. AI/simulation budgets protect a public deployment during QA;
blocked requests are reported separately from actual service failures.
"""

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import random
import re
import time
from urllib.parse import urlparse

from playwright.sync_api import Error, TimeoutError, sync_playwright


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', type=int, default=101)
    parser.add_argument('--steps', type=int, default=180)
    parser.add_argument('--checkpoint-every', type=int, default=45)
    parser.add_argument('--ai-budget', type=int, default=2)
    parser.add_argument('--simulation-budget', type=int, default=2)
    parser.add_argument('--output', type=Path)
    return parser.parse_args()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def validate_document(document):
    """Structural checks independent of the application's validator."""
    assert isinstance(document['revision'], int) and document['revision'] >= 0
    for group in ('components', 'wires', 'shapes'):
        ids = [item['id'] for item in document[group]]
        assert len(ids) == len(set(ids)), f'duplicate IDs in {group}'
    components = {item['id']: item for item in document['components']}
    for wire in document['wires']:
        for end in ('from', 'to'):
            component = components.get(wire[end]['component'])
            assert component is not None, 'wire refers to missing component'
            allowed = ({'0'} if component['kind'] == 'ground' else
                       {'g', 'd', 's', 'b'} if component['kind'] in ('nmos', 'pmos') else {'p', 'n'})
            assert wire[end]['pin'] in allowed, 'wire refers to invalid terminal'
    for group in ('components', 'shapes'):
        for item in document[group]:
            for key in ('x', 'y'):
                assert isinstance(item[key], (int, float)) and math.isfinite(item[key])
            for key in ('width', 'height'):
                if key in item:
                    assert math.isfinite(item[key]) and item[key] > 0


class Monkey:
    def __init__(self, page, context, args, base, output):
        self.page, self.context, self.args = page, context, args
        self.base, self.output = base, output
        self.rng = random.Random(args.seed)
        self.trace = (output / 'replay.jsonl').open('w')
        self.errors, self.responses, self.notifications = [], [], []
        self.checkpoints, self.actions, self.blocked = [], Counter(), Counter()
        self.requests = Counter()
        self.step = 0
        page.on('pageerror', lambda error: self.errors.append(str(error)))
        page.on('response', self.response)
        page.on('dialog', lambda dialog: dialog.dismiss())
        page.route('**/api/projects/*/suggest', lambda route: self.budget(route, 'ai', args.ai_budget))
        page.route('**/api/projects/*/chat', lambda route: self.budget(route, 'ai', args.ai_budget))
        page.route('**/api/projects/*/simulate', lambda route: self.budget(route, 'simulation', args.simulation_budget))

    def record(self, kind, **details):
        row = {'step': self.step, 'action': kind, **details}
        self.trace.write(json.dumps(row) + '\n')
        self.trace.flush()
        return row

    def budget(self, route, kind, limit):
        if self.requests[kind] >= limit:
            self.blocked[kind] += 1
            route.fulfill(status=429, content_type='application/json',
                          body=json.dumps({'error': 'QA request budget reached'}))
        else:
            self.requests[kind] += 1
            route.continue_()

    def response(self, response):
        if '/api/' not in response.url or response.status < 400:
            return
        path = urlparse(response.url).path
        try:
            detail = response.json().get('error', '')[:400]
        except Exception:
            detail = 'Non-JSON error response'
        self.responses.append({'step': self.step, 'path': path, 'status': response.status,
                               'query': urlparse(response.url).query[:500],
                               'detail': detail, 'qaBudget': detail == 'QA request budget reached'})

    def wait_ready(self):
        self.page.wait_for_selector('.workbench', timeout=60000)
        self.page.wait_for_selector('.project-select option', state='attached', timeout=30000)

    def disable_autocomplete(self):
        self.page.keyboard.press('Escape')
        self.page.get_by_role('button', name='Settings', exact=True).first.click()
        dialog = self.page.get_by_role('dialog')
        dialog.locator('label').filter(has_text='Autocomplete as I work').locator('input').uncheck()
        self.page.keyboard.press('Escape')

    def screenshot(self, name):
        self.page.screenshot(path=str(self.output / name), full_page=True)

    def checkpoint(self):
        """A saved circuit must survive a real page reload with the same content."""
        self.page.keyboard.press('Escape')
        self.page.evaluate('document.activeElement?.blur()')
        self.page.keyboard.press('Control+s')
        self.page.wait_for_timeout(1000)
        project = self.page.evaluate("localStorage.getItem('gnimula:last-project')")
        assert project, 'current project identifier disappeared'
        deadline = time.monotonic() + 25
        while True:
            response = self.context.request.get(self.base + '/api/projects/' + project)
            assert response.status == 200, f'cannot load active project: {response.status}'
            document = response.json()['document']
            visible_revision = self.page.locator('.breadcrumb .revision').inner_text()
            if visible_revision == 'r' + str(document['revision']):
                break
            assert time.monotonic() < deadline, 'visible draft did not reach cloud storage'
            self.page.wait_for_timeout(250)
        validate_document(document)
        before = digest(document)
        self.page.reload(wait_until='domcontentloaded', timeout=60000)
        self.wait_ready()
        self.disable_autocomplete()
        assert self.page.evaluate("localStorage.getItem('gnimula:last-project')") == project
        after_response = self.context.request.get(self.base + '/api/projects/' + project)
        assert after_response.status == 200
        after = after_response.json()['document']
        assert before == digest(after), 'saved document changed across reload'
        assert self.page.locator('.breadcrumb .revision').inner_text() == 'r' + str(after['revision'])
        # Rendering must contain the same number of actual schematic symbols.
        self.page.locator('.tabs').get_by_role('button', name='schematic.sch', exact=True).click()
        assert self.page.locator('.eda-canvas .symbol').count() == len(after['components'])
        events = self.context.request.get(self.base + '/api/projects/' + project + '/events')
        assert events.status == 200
        ids = [event['id'] for event in events.json()['events']]
        assert len(ids) == len(set(ids)), 'duplicate stored event IDs'
        assert not self.errors, self.errors
        row = {'step': self.step, 'revision': after['revision'], 'documentSha256': before,
               'components': len(after['components']), 'shapes': len(after['shapes']),
               'wires': len(after['wires']), 'eventsRead': len(ids)}
        self.checkpoints.append(row)
        self.record('save-reload-verified', **row)
        self.screenshot(f'checkpoint-{self.step:04d}.png')

    def visible_elements(self, selector):
        return self.page.locator(selector).evaluate_all('''elements => elements.map((e, index) => {
            const r=e.getBoundingClientRect();
            const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
            return {index, label:e.getAttribute('aria-label')||e.getAttribute('title')||e.innerText||e.name||e.type,
                x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height,
                disabled:e.disabled,type:e.type,hit:hit&&(e===hit||e.contains(hit))};
        }).filter(e=>e.hit&&!e.disabled&&e.width>2&&e.height>2&&e.x>0&&e.y>0&&e.x<innerWidth&&e.y<innerHeight)''')

    def random_button(self):
        selector = '[role="dialog"] button' if self.page.get_by_role('dialog').count() else 'button'
        candidates = self.visible_elements(selector)
        candidates = [item for item in candidates if not re.search(
            r'(delete.*guest|delete my data|import project|send|suggest|run|simulate|open.*&|use.*&)',
            item['label'], re.I)]
        if not candidates:
            return self.keypress()
        item = self.rng.choice(candidates)
        self.record('button', label=item['label'][:200], index=item['index'])
        self.page.locator(selector).nth(item['index']).click(timeout=900)
        return 'button'

    def keypress(self):
        key = self.rng.choice(['Escape', 'Escape', 'Tab', 'Shift+Tab', 'Control+z',
                               'Control+Shift+z', 'Control+s', 'Control+,', 'n', 'w',
                               'r', 'Delete', 'Control+d'])
        self.record('keyboard', key=key)
        self.page.keyboard.press(key)
        return 'keyboard'

    def canvas(self):
        if self.page.get_by_role('dialog').count():
            self.page.keyboard.press('Escape')
        self.reveal_canvas()
        if not self.page.locator('.eda-canvas').count():
            self.page.locator('.tabs').get_by_role('button', name=self.rng.choice(['schematic.sch', 'layout.lay']), exact=True).click()
        box = self.page.locator('.eda-canvas').bounding_box()
        assert box
        x = box['x'] + self.rng.uniform(.12, .88) * box['width']
        y = box['y'] + self.rng.uniform(.12, .88) * box['height']
        drag = self.rng.random() < .45
        dx, dy = self.rng.uniform(-65, 65), self.rng.uniform(-45, 45)
        self.record('canvas-drag' if drag else 'canvas-click', x=round(x, 2), y=round(y, 2),
                    dx=round(dx, 2) if drag else 0, dy=round(dy, 2) if drag else 0)
        self.page.mouse.move(x, y)
        self.page.mouse.down()
        if drag:
            self.page.mouse.move(x + dx, y + dy, steps=self.rng.randint(2, 6))
        self.page.mouse.up()
        return 'canvas'

    def device_or_shape(self):
        self.page.keyboard.press('Escape')
        self.reveal_canvas()
        layout = self.rng.random() < .35
        self.page.locator('.tabs').get_by_role('button', name='layout.lay' if layout else 'schematic.sch', exact=True).click()
        if layout:
            self.page.get_by_role('button', name='Draw rectangle', exact=True).click()
            select = self.page.get_by_label('Drawing layer')
            options = select.locator('option').evaluate_all('es=>es.map(e=>e.value)')
            select.select_option(self.rng.choice(options))
        else:
            kind = self.rng.choice(['nmos', 'pmos', 'resistor', 'capacitor', 'voltage', 'current', 'ground'])
            self.record('choose-device', device=kind)
            self.page.get_by_title('Place ' + kind, exact=True).click()
        self.canvas()
        return 'place'

    def reveal_canvas(self):
        if self.page.viewport_size['width'] < 650:
            close = self.page.get_by_role('button', name='Close inspector', exact=True)
            if close.count() and close.is_visible():
                self.record('reveal-canvas', close='mobile inspector')
                close.click()

    def input(self):
        selector = ('[role="dialog"] input,[role="dialog"] textarea,[role="dialog"] select'
                    if self.page.get_by_role('dialog').count()
                    else 'input:not([type="file"]),textarea,select')
        elements = self.visible_elements(selector)
        if not elements:
            return self.random_button()
        item = self.rng.choice(elements)
        target = self.page.locator(selector).nth(item['index'])
        tag = target.evaluate('e=>e.tagName')
        if item['type'] == 'checkbox':
            # Do not re-enable costly automatic model calls during the monkey.
            parent_text = target.evaluate("e=>e.closest('label')?.innerText||''")
            if 'Autocomplete as I work' in parent_text:
                return self.keypress()
            self.record('checkbox', label=parent_text[:120])
            target.click()
        elif tag == 'SELECT':
            options = target.locator('option').evaluate_all('es=>es.filter(e=>!e.disabled).map(e=>e.value)')
            if not options:
                return self.keypress()
            value = self.rng.choice(options)
            self.record('select', label=item['label'], value=value)
            target.select_option(value)
        elif item['type'] == 'number':
            value = str(self.rng.choice([0, 1, 2, 10, 40, 80, 120, -20]))
            self.record('number', label=target.get_attribute('aria-label'), value=value)
            target.fill(value)
            target.press('Tab')
        else:
            value = self.rng.choice(['RC filter', 'amplifier', 'sky130', 'ngspice', '', 'mirror', 'monkey test'])
            self.record('text', label=item['label'], value=value)
            target.fill(value)
            target.press('Tab')
        return 'input'

    def viewport(self):
        width, height = self.rng.choice([(1600, 1000), (1280, 900), (900, 800), (390, 844)])
        self.record('viewport', width=width, height=height)
        self.page.set_viewport_size({'width': width, 'height': height})
        return 'viewport'

    def run(self):
        self.page.goto(self.base, wait_until='domcontentloaded', timeout=60000)
        self.wait_ready()
        excluded = self.context.request.patch(self.base + '/api/session',
                                               headers={'Origin': self.base},
                                               data={'trainingOptIn': False})
        assert excluded.status == 200, 'could not exclude disposable QA guest from training'
        self.disable_autocomplete()
        self.checkpoint()
        choices = [self.random_button] * 9 + [self.keypress] * 3 + [self.canvas] * 3 + [self.device_or_shape] * 2 + [self.input] * 3 + [self.viewport]
        for self.step in range(1, self.args.steps + 1):
            action = self.rng.choice(choices)
            self.record('action-selected', method=action.__name__)
            try:
                category = action()
                self.actions[category] += 1
            except (TimeoutError, Error) as error:
                # Moving/disappearing controls during chaotic clicks are not app crashes.
                self.record('interaction-not-completed', method=action.__name__, message=str(error)[:1800])
                self.actions['not-completed'] += 1
                if self.actions['not-completed'] <= 5:
                    self.screenshot(f'obstructed-{self.step:04d}.png')
            self.page.wait_for_timeout(self.rng.randint(25, 160))
            assert self.page.url.startswith(self.base), 'unexpected navigation outside application'
            assert self.page.locator('.workbench').count() == 1, 'workbench unmounted during interaction'
            assert not self.errors, self.errors
            if self.page.get_by_role('alert').count():
                text = self.page.get_by_role('alert').inner_text()[:500]
                if not self.notifications or self.notifications[-1]['text'] != text:
                    self.notifications.append({'step': self.step, 'text': text})
            if self.step % self.args.checkpoint_every == 0:
                self.checkpoint()
        if self.step % self.args.checkpoint_every:
            self.checkpoint()


def main():
    args = arguments()
    base = os.environ.get('GNIMULA_QA_URL', 'https://gnimula.stream').rstrip('/')
    output = args.output or Path('runtime') / ('monkey-' + str(args.seed))
    output.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc).isoformat()
    result = {'startedAt': started, 'url': base, 'seed': args.seed, 'requestedSteps': args.steps,
              'localAssets': os.environ.get('GNIMULA_QA_LOCAL_ASSETS') == '1',
              'harnessSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'candidate': os.environ.get('GNIMULA_QA_BUILD', ''), 'passed': False}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1600, 'height': 1000})
        page = context.new_page()
        page.set_default_timeout(1000)
        if result['localAssets']:
            page.route(base + '/', lambda route: route.fulfill(path='dist/index.html', content_type='text/html'))
            def asset(route):
                path = Path('dist/assets') / Path(urlparse(route.request.url).path).name
                route.fulfill(path=str(path), content_type='text/css' if path.suffix == '.css' else 'text/javascript')
            page.route(base + '/assets/*', asset)
        monkey = Monkey(page, context, args, base, output)
        try:
            monkey.run()
            assert not [r for r in monkey.responses if r['status'] >= 500], 'server error during chaos run'
            result['passed'] = True
        except Exception as error:
            result['failure'] = str(error)
            try:
                monkey.screenshot('failure.png')
            except Exception:
                pass
        finally:
            result.update({'finishedAt': datetime.now(timezone.utc).isoformat(), 'completedStep': monkey.step,
                           'actions': dict(monkey.actions), 'checkpoints': monkey.checkpoints,
                           'javascriptErrors': monkey.errors, 'httpErrors': monkey.responses,
                           'notifications': monkey.notifications, 'paidRequests': dict(monkey.requests),
                           'blockedByQABudget': dict(monkey.blocked)})
            monkey.trace.close()
            page.close()
            try:
                response = context.request.delete(base + '/api/session', headers={'Origin': base})
                result['disposableGuestRemoved'] = response.status == 200
            except Exception as error:
                result['cleanupError'] = str(error)
                result['disposableGuestRemoved'] = False
            context.close()
            browser.close()
    (output / 'results.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    if not result['passed'] or not result['disposableGuestRemoved']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
