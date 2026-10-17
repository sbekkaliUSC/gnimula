"""Check hosted training preferences using disposable guests, never real user data."""
import json
import os
from urllib.parse import urlparse
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

base = os.environ.get('GNIMULA_QA_URL', 'https://gnimula.stream')
prior = Path('runtime/privacy-existing-session.json')
checks = []
with sync_playwright() as p:
    if prior.exists():
        request = p.request.new_context(base_url=base, storage_state=str(prior),
                                        extra_http_headers={'Origin': base})
        try:
            response = request.post('/api/session', data={})
            assert response.status == 200
            assert response.json()['trainingOptIn'] is False
            checks.append('Pre-release guest retains training disabled')
        finally:
            assert request.delete('/api/session').status == 200
            request.dispose()
            prior.unlink()

    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width': 1600, 'height': 1000})
    page = ctx.new_page()
    if os.environ.get('GNIMULA_QA_LOCAL_ASSETS') == '1':
        page.route(base + '/', lambda route: route.fulfill(path='dist/index.html', content_type='text/html'))
        def asset(route):
            name = Path(urlparse(route.request.url).path).name
            path = Path('dist/assets') / name
            route.fulfill(path=str(path), content_type='text/css' if path.suffix == '.css' else 'text/javascript')
        page.route(base + '/assets/*', asset)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    try:
        page.goto(base, wait_until='networkidle', timeout=60000)
        page.wait_for_selector('.chat-panel', timeout=45000)
        assert page.locator('.notice').count() == 0
        status = page.locator('.statusbar').inner_text()
        assert 'UTF-8' not in status and 'Privacy' not in status
        page.get_by_role('button', name='Settings', exact=True).click()
        assert page.get_by_role('heading', name='Editor', exact=True).is_visible()
        # Keyboard focus stays in the dialog; editor shortcuts do not run behind it.
        page.keyboard.press('Shift+Tab')
        assert page.get_by_role('button', name='Legal & privacy', exact=True).evaluate('(e)=>e===document.activeElement')
        page.keyboard.press('Tab')
        assert page.get_by_role('button', name='Close dialog', exact=True).evaluate('(e)=>e===document.activeElement')
        page.get_by_role('button', name='Data controls', exact=True).click()
        checkbox = page.locator('.consent input')
        assert checkbox.is_checked()
        assert 'Enabled by default for new guest sessions' in page.get_by_role('dialog').inner_text()
        assert page.get_by_role('button', name='Delete all guest data', exact=True).count() == 0
        assert page.get_by_role('button', name='Delete my data', exact=True).count() == 0
        checks.append('New guest starts enabled in Settings / Data controls; no deletion control or banner')
        page.screenshot(path='runtime/settings-data-desktop.png', full_page=True)
        with page.expect_response(lambda r: r.url.endswith('/api/session') and r.request.method == 'PATCH') as saved:
            checkbox.uncheck()
        assert saved.value.status == 200
        page.reload(wait_until='networkidle')
        page.wait_for_selector('.chat-panel', timeout=45000)
        page.get_by_role('button', name='Settings', exact=True).click()
        page.get_by_role('button', name='Data controls', exact=True).click()
        assert not page.locator('.consent input').is_checked()
        checks.append('Opt-out persists after reload and session refresh')
        with page.expect_download() as downloaded:
            page.get_by_role('button', name='Export this project & activity', exact=True).click()
        export = json.loads(Path(downloaded.value.path()).read_text())
        assert export['trainingOptIn'] is False
        assert export['document']['components']
        checks.append('Export still works and reflects disabled training')
        page.get_by_role('button', name='Close dialog', exact=True).click()
        page.get_by_role('button', name='Help', exact=True).click()
        page.get_by_role('button', name='Legal & privacy', exact=True).click()
        assert page.get_by_role('heading', name='Privacy policy', exact=True).is_visible()
        for title in ['Preview terms', 'Third-party notices']:
            page.get_by_role('button', name=title, exact=True).click()
            assert page.get_by_role('heading', name=title, exact=True).is_visible()
        assert page.get_by_role('link', name='SKY130 transistor models', exact=True).is_visible()
        page.get_by_role('button', name='Privacy policy', exact=True).click()
        page.get_by_role('button', name='Open data controls', exact=True).click()
        assert page.get_by_role('heading', name='Data controls', exact=True).is_visible()
        page.keyboard.press('Escape')
        page.keyboard.press('Control+,')
        assert page.get_by_role('heading', name='Settings', exact=True).is_visible()
        page.keyboard.press('Escape')
        checks.append('Help legal sections, direct data-control link, focus containment, and settings shortcut')
        page.set_viewport_size({'width': 390, 'height': 844})
        page.get_by_role('button', name='Settings', exact=True).click()
        page.get_by_role('button', name='Data controls', exact=True).click()
        assert not page.locator('.consent input').is_checked()
        box = page.get_by_role('dialog').bounding_box()
        assert box and box['x'] >= 0 and box['x'] + box['width'] <= 390
        assert page.get_by_role('dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
        page.screenshot(path='runtime/settings-data-mobile.png', full_page=True)
        page.get_by_role('button', name='Legal & privacy', exact=True).click()
        assert page.get_by_role('heading', name='Privacy policy', exact=True).is_visible()
        page.keyboard.press('Escape')
        checks.append('Settings and legal information remain reachable on mobile without horizontal overflow')
        assert not errors, errors
    finally:
        # Close the page first so its event outbox cannot race guest cleanup.
        page.close()
        deleted = ctx.request.delete(base + '/api/session', headers={'Origin': base})
        assert deleted.status == 200
        ctx.close()
        browser.close()

result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'url': base,
          'checks': checks, 'javascriptErrors': errors, 'disposableGuestsRemoved': True}
target = Path(os.environ.get('GNIMULA_QA_EVIDENCE', 'runtime/privacy-qa-results.json'))
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
