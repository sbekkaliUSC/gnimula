#!/usr/bin/env python3
"""Interactive fresh-browser usability harness; navigation is chosen by the tester.

Feed one JSON command per stdin line. No application source or private state is
read. Screenshots, rendered accessibility trees, and selected UI actions are the
only navigation evidence. Browser session data remains in memory.
"""

import json
from pathlib import Path
import sys
import time

from playwright.sync_api import sync_playwright


EVIDENCE = Path("docs/verification/usability-2026-10-17")
EVIDENCE.mkdir(parents=True, exist_ok=True)
origin = "https://gnimula.stream"
log_path = EVIDENCE / "interaction.jsonl"


def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1440, "height": 1000},
        device_scale_factor=1,
        accept_downloads=False,
    )
    page = context.new_page()
    needs_cleanup = False
    page.set_default_timeout(10000)
    page.on("download", lambda download: emit({"unexpected_download": download.suggested_filename}))
    emit({"ready": True, "browser": browser.version, "page": "about:blank"})
    for line in sys.stdin:
        try:
            command = json.loads(line)
            action = command["action"]
            if action == "goto":
                url = command.get("url", origin)
                if not url.startswith(origin):
                    raise ValueError("This test is scoped to gnimula.stream")
                page.goto(url, wait_until="domcontentloaded")
                needs_cleanup = True
            elif action == "snapshot":
                result = page.locator("body").aria_snapshot()
                if command.get("name"):
                    (EVIDENCE / (command["name"] + ".txt")).write_text(result)
                emit({"url": page.url, "snapshot": result})
                continue
            elif action == "screenshot":
                path = EVIDENCE / (command["name"] + ".png")
                page.screenshot(path=str(path), full_page=command.get("full_page", False))
                emit({"screenshot": str(path.resolve()), "url": page.url})
                continue
            elif action in ("click", "fill", "select", "press"):
                if "role" in command:
                    locator = page.get_by_role(command["role"], name=command.get("name"), exact=command.get("exact", True))
                elif "label" in command:
                    locator = page.get_by_label(command["label"], exact=command.get("exact", True))
                elif "placeholder" in command:
                    locator = page.get_by_placeholder(command["placeholder"], exact=command.get("exact", True))
                elif "text" in command:
                    locator = page.get_by_text(command["text"], exact=command.get("exact", True))
                else:
                    locator = page.locator(command["selector"])
                if "index" in command:
                    locator = locator.nth(command["index"])
                if action == "click":
                    locator.click()
                elif action == "fill":
                    locator.fill(command["value"])
                elif action == "select":
                    locator.select_option(label=command["value"])
                else:
                    locator.press(command["key"])
            elif action == "key":
                page.keyboard.press(command["key"])
            elif action == "mouse":
                page.mouse.click(command["x"], command["y"])
            elif action == "scroll":
                page.mouse.wheel(command.get("x", 0), command["y"])
            elif action == "wait":
                page.wait_for_timeout(min(command.get("ms", 1000), 10000))
            elif action == "controls":
                emit(page.locator("input, textarea, select").evaluate_all("els => els.map(e => ({tag:e.tagName, type:e.type, id:e.id, placeholder:e.placeholder, ariaLabel:e.getAttribute('aria-label'), value:e.type==='password' ? '[redacted]' : e.value, options:e.options ? [...e.options].map(o=>({text:o.text,selected:o.selected})) : undefined}))"))
                continue
            elif action == "cleanup":
                response = context.request.delete(origin + "/api/session", headers={"Origin": origin})
                emit({"cleanup_status": response.status})
                if not response.ok:
                    raise RuntimeError(f"Guest cleanup failed with HTTP {response.status}; browser retained for retry")
                needs_cleanup = False
            elif action == "close":
                if needs_cleanup:
                    raise RuntimeError("Run successful guest cleanup before closing the browser")
                break
            else:
                raise ValueError("Unknown action: " + action)
            record = {"time_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "command": command, "ok": True, "url": page.url}
            with log_path.open("a") as log:
                log.write(json.dumps(record, ensure_ascii=False) + "\n")
            emit(record)
        except Exception as error:
            record = {"time_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "command": command if "command" in locals() else {}, "error": str(error)}
            with log_path.open("a") as log:
                log.write(json.dumps(record, ensure_ascii=False) + "\n")
            emit(record)
    context.close()
    browser.close()
