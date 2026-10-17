"""Recheck catalog findings through the hosted UI using one disposable guest."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

base = os.environ.get('GNIMULA_QA_URL', 'https://gnimula.stream').rstrip('/')
out = Path('docs/verification/monkey-2026-10-17')
out.mkdir(parents=True, exist_ok=True)
result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'url': base,
          'candidate': os.environ.get('GNIMULA_QA_BUILD', ''), 'passed': False,
          'checks': [], 'javascriptErrors': [], 'catalogResponses': []}


def match(response, key, value):
    parsed = urlparse(response.url)
    return parsed.path == '/api/library/discover' and parse_qs(parsed.query).get(key) == [value]


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width': 1600, 'height': 1000})
    page = ctx.new_page()
    page.on('pageerror', lambda error: result['javascriptErrors'].append(str(error)))
    try:
        page.goto(base, wait_until='networkidle', timeout=60000)
        page.wait_for_selector('.eda-canvas', timeout=60000)
        excluded = ctx.request.patch(base + '/api/session', headers={'Origin': base},
                                     data={'trainingOptIn': False})
        assert excluded.status == 200
        page.get_by_role('button', name='Library', exact=True).first.click()
        page.wait_for_selector('.catalog-count', timeout=60000)
        with page.expect_response(lambda response: match(response, 'repo', 'touhid314/cktformer-dataset'), timeout=60000) as response:
            page.get_by_label('Circuit collection').select_option('touhid314/cktformer-dataset')
        circuitformer = response.value
        payload = circuitformer.json()
        result['catalogResponses'].append({'case': 'CircuitFormer preset', 'status': circuitformer.status,
                                            'total': payload.get('total'), 'error': payload.get('error'),
                                            'warnings': payload.get('warnings', []), 'source': payload.get('source')})
        assert circuitformer.status != 400, payload
        assert circuitformer.status == 200, payload
        page.wait_for_selector('.catalog-count', timeout=60000)
        text = page.locator('.online-catalog').inner_text()
        if payload.get('total') is None:
            assert 'Results unavailable' in text and 'source could not be loaded' in text, text
            assert page.get_by_role('button', name='Retry source', exact=True).is_visible()
            result['checks'].append('CircuitFormer unavailable upstream is accurately explained with retry; no invalid default/train request')
        else:
            assert payload['total'] > 0 and page.locator('.catalog-card').count() > 0
            result['checks'].append('CircuitFormer discovers an actual provider configuration and shows records')
        page.screenshot(path='runtime/monkey-circuitformer-recheck.png', full_page=True)
        page.get_by_label('Circuit collection').select_option('pphilip/analog-circuits-sky130')
        page.wait_for_selector('.catalog-count', timeout=60000)
        page.get_by_label('Search online circuits').fill('current mirror')
        with page.expect_response(lambda response: match(response, 'q', 'current mirror'), timeout=60000) as response:
            page.locator('.online-catalog form').get_by_role('button', name='Search', exact=True).click()
        search = response.value
        payload = search.json()
        assert search.status == 200, payload
        assert payload['total'] > 0 and len(payload['items']) > 0, payload
        page.wait_for_function("()=>document.querySelector('.catalog-count')?.innerText.includes('matching circuit metadata records')", timeout=60000)
        assert page.locator('.catalog-card').count() == len(payload['items'])
        result['catalogResponses'].append({'case': 'SKY130 current mirror search', 'status': search.status,
                                            'total': payload['total'], 'itemsOnPage': len(payload['items']),
                                            'totalLabel': payload['totalLabel'], 'warnings': payload.get('warnings', []),
                                            'firstTitles': [item['name'] for item in payload['items'][:3]]})
        result['checks'].append('SKY130 current mirror query returns real matching metadata records and rendered result cards')
        page.screenshot(path='runtime/monkey-current-mirror-recheck.png', full_page=True)
        assert not result['javascriptErrors'], result['javascriptErrors']
        result['passed'] = True
    except Exception as error:
        result['failure'] = str(error)
        page.screenshot(path='runtime/monkey-catalog-recheck-failure.png', full_page=True)
    finally:
        page.close()
        result['disposableGuestRemoved'] = ctx.request.delete(base + '/api/session', headers={'Origin': base}).status == 200
        ctx.close()
        browser.close()

(out / 'catalog-recheck.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
if not result['passed'] or not result['disposableGuestRemoved']:
    raise SystemExit(1)
