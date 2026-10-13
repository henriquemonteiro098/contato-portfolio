#!/usr/bin/env python3
"""
Challenger Verification & Stress Test Suite: R2 (Ambient Loops) & R3 (Grid Isolation)
======================================================================================
Empirical verification suite written by Challenger Agent (challenger_m1_2).
Performs both static AST/token inspection and live headless Google Chrome CDP stress testing.

Assertions covered:
  1. Absolute absence of `window.addEventListener('touchmove', ...)` on background grid pattern.
  2. Immediate abort of `triggerSquareAt` when `isScrolling === true`.
  3. Presence of `matchMedia('(hover: hover) and (pointer: fine)')` guard.
  4. Throttling of mousemove via `requestAnimationFrame`.
  5. Ambient square count <= 14 and presence of `visibilitychange` listener.
  6. Scroll debounce recovery and edge case stability under high event frequency.
"""

import os
import re
import sys
import json
import time
import shutil
import socket
import asyncio
import unittest
import subprocess
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MAIN_JS = PROJECT_ROOT / "main.js"
INDEX_HTML = PROJECT_ROOT / "index.html"


def get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class ChromeCDPSession:
    """Manages a dedicated headless Chrome process and CDP websocket session."""
    def __init__(self, html_path: Path, pre_script: str = None):
        self.html_path = html_path
        self.pre_script = pre_script
        self.port = get_free_port()
        self.user_dir = Path(f"/tmp/chrome_cdp_chal_{self.port}")
        self.proc = None
        self.ws = None
        self.msg_id = 0

    async def __aenter__(self):
        import websockets
        shutil.rmtree(self.user_dir, ignore_errors=True)
        self.proc = subprocess.Popen([
            'google-chrome',
            '--headless=new',
            f'--remote-debugging-port={self.port}',
            '--no-sandbox',
            '--disable-gpu',
            f'--user-data-dir={self.user_dir}',
            'about:blank'
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Wait for debugging port
        for _ in range(30):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{self.port}/json", timeout=0.5) as r:
                    tabs = [t for t in json.loads(r.read().decode()) if t.get('type') == 'page']
                    if tabs:
                        ws_url = tabs[0]['webSocketDebuggerUrl']
                        self.ws = await websockets.connect(ws_url)
                        break
            except Exception:
                await asyncio.sleep(0.1)
        else:
            raise RuntimeError(f"Failed to connect to headless Chrome on port {self.port}")

        await self.send_cmd('Page.enable')
        if self.pre_script:
            await self.send_cmd('Page.addScriptToEvaluateOnNewDocument', {'source': self.pre_script})

        await self.send_cmd('Page.navigate', {'url': f"file://{self.html_path.resolve()}"})
        # Wait for DOM ready and initial layout events to settle
        for _ in range(50):
            try:
                ready = await self.eval_js("document.readyState")
                if ready in ('interactive', 'complete'):
                    break
            except Exception:
                pass
            await asyncio.sleep(0.1)
        # Give 300ms for any initial layout scroll event and 150ms debounce to settle
        await asyncio.sleep(0.35)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.ws:
            await self.ws.close()
        if self.proc:
            self.proc.terminate()
            self.proc.wait()
        shutil.rmtree(self.user_dir, ignore_errors=True)

    async def send_cmd(self, method: str, params: dict = None) -> dict:
        self.msg_id += 1
        curr_id = self.msg_id
        payload = {'id': curr_id, 'method': method}
        if params:
            payload['params'] = params
        await self.ws.send(json.dumps(payload))
        while True:
            raw = await self.ws.recv()
            data = json.loads(raw)
            if data.get('id') == curr_id:
                return data

    async def eval_js(self, expression: str):
        res = await self.send_cmd('Runtime.evaluate', {
            'expression': expression,
            'returnByValue': True
        })
        if 'exceptionDetails' in res.get('result', {}):
            raise RuntimeError(f"JS Error: {res['result']['exceptionDetails']}")
        return res.get('result', {}).get('result', {}).get('value')


class TestChallengerGridAndAmbient(unittest.TestCase):
    """Adversarial stress-testing of Background Grid (R3) and Ambient Loops (R2)."""

    @classmethod
    def setUpClass(cls):
        cls.js_code = MAIN_JS.read_text(encoding="utf-8")
        # Extract section 4: InteractiveGridPattern Background
        match = re.search(
            r'// ── 4\. Magic UI InteractiveGridPattern Background ───────────────────────([\s\S]*?)(?=// ── 5\. Magic UI AnimatedList)',
            cls.js_code
        )
        assert match, "Could not locate section 4 (InteractiveGridPattern) in main.js"
        cls.grid_code = match.group(1)

    def test_01_absolute_absence_of_touchmove_on_grid(self):
        """
        [R3 Assertion 1]
        Verify absolute absence of `window.addEventListener('touchmove', ...)`
        or element-level touchmove on the background grid pattern.
        """
        # Static AST/regex verification
        touchmove_in_grid = re.search(r'addEventListener\s*\(\s*[\'"]touchmove[\'"]', self.grid_code)
        self.assertIsNone(
            touchmove_in_grid,
            f"VIOLATION: Found touchmove event listener in grid code: {touchmove_in_grid}"
        )

        # Live CDP verification: Dispatching touchmove should never add hover squares
        async def verify_live_touch():
            async with ChromeCDPSession(INDEX_HTML) as session:
                # Dispatch 50 touchmove events
                await session.eval_js('''
                    for (let i = 0; i < 50; i++) {
                        try {
                            const touch = new Touch({
                                identifier: i,
                                target: window,
                                clientX: 50 + i * 5,
                                clientY: 50 + i * 5
                            });
                            window.dispatchEvent(new TouchEvent('touchmove', { touches: [touch] }));
                        } catch (e) {
                            window.dispatchEvent(new Event('touchmove'));
                        }
                    }
                ''')
                await asyncio.sleep(0.1)
                count = await session.eval_js('document.querySelectorAll("#interactive-grid-hover-squares rect").length')
                return count

        hover_count = asyncio.run(verify_live_touch())
        self.assertEqual(
            hover_count,
            0,
            f"VIOLATION: Touch events caused {hover_count} squares to be rendered in #interactive-grid-hover-squares."
        )

    def test_02_immediate_abort_of_trigger_square_when_isscrolling(self):
        """
        [R3 Assertion 2]
        Verify immediate abort of `triggerSquareAt` when `isScrolling === true`.
        """
        # Static assertion: Check function entry guard
        func_match = re.search(r'function\s+triggerSquareAt\s*\([^)]*\)\s*\{([\s\S]*?)\}', self.grid_code)
        self.assertIsNotNone(func_match, "Function triggerSquareAt not found in grid code")
        func_body = func_match.group(1).strip()

        # Must have `if (isScrolling) return;` at entry
        first_statement = func_body.split(';')[0].strip()
        self.assertRegex(
            first_statement,
            r'if\s*\(\s*isScrolling\s*\)\s*return',
            f"VIOLATION: First statement in triggerSquareAt is '{first_statement}', expected 'if (isScrolling) return'"
        )

        # Dynamic stress test: Active scroll + 100 rapid mousemoves must generate 0 squares
        pre_script = '''
            const origMM = window.matchMedia;
            window.matchMedia = function(q) {
                if (q === '(hover: hover) and (pointer: fine)') {
                    return { matches: true, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{} };
                }
                return origMM.call(window, q);
            };
        '''

        async def verify_live_scroll_abort():
            async with ChromeCDPSession(INDEX_HTML, pre_script=pre_script) as session:
                # First, verify hover works normally when not scrolling
                await session.eval_js('''
                    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 120 }));
                ''')
                await asyncio.sleep(0.1)
                initial_count = await session.eval_js('document.querySelectorAll("#interactive-grid-hover-squares rect").length')

                # Now trigger scroll
                await session.eval_js("window.dispatchEvent(new Event('scroll'));")

                # Fire 100 high-frequency mousemoves across 100 different grid cells
                await session.eval_js('''
                    for (let i = 0; i < 100; i++) {
                        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 + (i % 10) * 40, clientY: 200 + Math.floor(i / 10) * 40 }));
                    }
                ''')
                await asyncio.sleep(0.1)
                during_scroll_count = await session.eval_js('document.querySelectorAll("#interactive-grid-hover-squares rect").length')

                return initial_count, during_scroll_count

        init_c, scroll_c = asyncio.run(verify_live_scroll_abort())
        self.assertEqual(init_c, 1, "Baseline hover trail failed to generate initial square")
        self.assertEqual(
            scroll_c,
            1,
            f"VIOLATION: During active scroll, squares increased from {init_c} to {scroll_c}. Abort failed!"
        )

    def test_03_presence_of_matchmedia_hover_and_pointer_fine_guard(self):
        """
        [R3 Assertion 3]
        Verify presence of `matchMedia('(hover: hover) and (pointer: fine)')` guard.
        """
        self.assertRegex(
            self.grid_code,
            r'matchMedia\s*\(\s*[\'"]\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)[\'"]\s*\)',
            "VIOLATION: Missing media query check '(hover: hover) and (pointer: fine)' in grid pattern."
        )

        # Verify that without fine pointer hover, listener is never attached and no squares are generated
        async def verify_no_hover_mode():
            async with ChromeCDPSession(INDEX_HTML) as session:  # Default headless has no fine pointer
                is_match = await session.eval_js('window.matchMedia("(hover: hover) and (pointer: fine)").matches')
                self.assertFalse(is_match, "Default headless Chrome should not match fine hover")

                # Fire 50 mousemoves
                await session.eval_js('''
                    for (let i = 0; i < 50; i++) {
                        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 + i * 5, clientY: 100 + i * 5 }));
                    }
                ''')
                await asyncio.sleep(0.1)
                count = await session.eval_js('document.querySelectorAll("#interactive-grid-hover-squares rect").length')
                return count

        hover_count = asyncio.run(verify_no_hover_mode())
        self.assertEqual(
            hover_count,
            0,
            f"VIOLATION: Non-hover device generated {hover_count} hover squares."
        )

    def test_04_throttling_of_mousemove_via_requestanimationframe(self):
        """
        [R3 Assertion 4]
        Verify throttling of mousemove via `requestAnimationFrame`.
        """
        # Static check
        self.assertIn("isMouseRafPending", self.grid_code)
        self.assertRegex(
            self.grid_code,
            r'if\s*\(\s*!isMouseRafPending\s*\)\s*\{[\s\S]*?requestAnimationFrame',
            "VIOLATION: mousemove is not throttled via an isMouseRafPending guard and requestAnimationFrame."
        )

        # Dynamic stress test: Fire 200 mousemove events synchronously in one task,
        # count how many times requestAnimationFrame is called.
        pre_script = '''
            const origMM = window.matchMedia;
            window.matchMedia = function(q) {
                if (q === '(hover: hover) and (pointer: fine)') {
                    return { matches: true, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{} };
                }
                return origMM.call(window, q);
            };
        '''

        async def verify_raf_throttling():
            async with ChromeCDPSession(INDEX_HTML, pre_script=pre_script) as session:
                # Spy on window.requestAnimationFrame
                await session.eval_js('''
                    window.__rafCount = 0;
                    const origRaf = window.requestAnimationFrame;
                    window.requestAnimationFrame = function(cb) {
                        window.__rafCount++;
                        return origRaf.call(window, cb);
                    };
                ''')

                # Dispatch 100 mousemove events synchronously
                await session.eval_js('''
                    window.__rafCountBefore = window.__rafCount;
                    for (let i = 0; i < 100; i++) {
                        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 + i, clientY: 100 + i }));
                    }
                    window.__rafCountAfter = window.__rafCount;
                ''')

                before = await session.eval_js('window.__rafCountBefore')
                after = await session.eval_js('window.__rafCountAfter')
                return after - before

        raf_calls = asyncio.run(verify_raf_throttling())
        self.assertEqual(
            raf_calls,
            1,
            f"VIOLATION: 100 mousemove events triggered {raf_calls} rAF callbacks in a single tick. Expected exactly 1!"
        )

    def test_05_ambient_square_count_and_visibilitychange_listener(self):
        """
        [R2 Assertion 5]
        Verify ambient square count <= 14 and presence of `visibilitychange` listener.
        """
        # Static check
        count_match = re.search(r'const\s+maxAmbientSquares\s*=\s*(\d+);', self.grid_code)
        self.assertIsNotNone(count_match, "maxAmbientSquares definition not found")
        count_val = int(count_match.group(1))
        self.assertLessEqual(
            count_val,
            14,
            f"VIOLATION: maxAmbientSquares is {count_val}, expected <= 14."
        )

        self.assertRegex(
            self.grid_code,
            r'document\.addEventListener\s*\(\s*[\'"]visibilitychange[\'"]',
            "VIOLATION: visibilitychange listener missing in ambient grid section."
        )

        # Dynamic check in live headless Chrome
        async def verify_live_ambient():
            async with ChromeCDPSession(INDEX_HTML) as session:
                # Check live DOM rect count
                dom_count = await session.eval_js('document.querySelectorAll("#animated-grid-squares rect").length')

                # Spy on Animation.prototype.pause and play
                await session.eval_js('''
                    window.__ambientPauses = 0;
                    window.__ambientPlays = 0;
                    const origP = Animation.prototype.pause;
                    const origPl = Animation.prototype.play;
                    Animation.prototype.pause = function() {
                        window.__ambientPauses++;
                        return origP.apply(this, arguments);
                    };
                    Animation.prototype.play = function() {
                        window.__ambientPlays++;
                        return origPl.apply(this, arguments);
                    };
                ''')

                # Trigger visibilitychange -> hidden
                await session.eval_js('''
                    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
                    document.dispatchEvent(new Event('visibilitychange'));
                ''')
                await asyncio.sleep(0.05)
                pauses = await session.eval_js('window.__ambientPauses')

                # Trigger visibilitychange -> visible
                await session.eval_js('''
                    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
                    document.dispatchEvent(new Event('visibilitychange'));
                ''')
                await asyncio.sleep(0.05)
                plays = await session.eval_js('window.__ambientPlays')

                return dom_count, pauses, plays

        dom_c, pause_c, play_c = asyncio.run(verify_live_ambient())
        self.assertEqual(dom_c, 14, f"VIOLATION: Expected exactly 14 ambient squares in DOM, found {dom_c}")
        self.assertEqual(pause_c, 14, f"VIOLATION: Expected 14 pause calls on document.hidden, found {pause_c}")
        self.assertEqual(play_c, 14, f"VIOLATION: Expected 14 play calls on document.visible, found {play_c}")

    def test_06_scroll_debounce_recovery_stress(self):
        """
        [Stress Assertion 6]
        Verify that after scroll stops and 150ms debounce window passes,
        hover functionality resumes seamlessly.
        """
        pre_script = '''
            const origMM = window.matchMedia;
            window.matchMedia = function(q) {
                if (q === '(hover: hover) and (pointer: fine)') {
                    return { matches: true, media: q, onchange: null, addListener: ()=>{}, removeListener: ()=>{}, addEventListener: ()=>{}, removeEventListener: ()=>{} };
                }
                return origMM.call(window, q);
            };
        '''

        async def verify_debounce_recovery():
            async with ChromeCDPSession(INDEX_HTML, pre_script=pre_script) as session:
                # Trigger multiple consecutive scrolls
                for _ in range(5):
                    await session.eval_js("window.dispatchEvent(new Event('scroll'));")
                    await asyncio.sleep(0.05)

                # Mousemove immediately during scroll -> should NOT generate
                await session.eval_js("window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 200 }));")
                await asyncio.sleep(0.05)
                count_during = await session.eval_js('document.querySelectorAll("#interactive-grid-hover-squares rect").length')

                # Wait for debounce timer to expire (> 150ms, let's wait 250ms)
                await asyncio.sleep(0.25)

                # Mousemove after debounce -> SHOULD generate
                await session.eval_js("window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 }));")
                await asyncio.sleep(0.1)
                count_after = await session.eval_js('document.querySelectorAll("#interactive-grid-hover-squares rect").length')

                return count_during, count_after

        c_during, c_after = asyncio.run(verify_debounce_recovery())
        self.assertEqual(c_during, 0, "Square was generated during consecutive scrolling")
        self.assertEqual(c_after, 1, "Square was NOT generated after debounce timeout expired")

    def test_07_rapid_visibility_toggle_stress(self):
        """
        [Stress Assertion 7]
        Verify system stability under 20 rapid visibility toggles without throwing
        exceptions or breaking the animation loop.
        """
        async def verify_visibility_stress():
            async with ChromeCDPSession(INDEX_HTML) as session:
                # Catch any unhandled window errors
                await session.eval_js('''
                    window.__unhandledErrors = [];
                    window.addEventListener('error', e => window.__unhandledErrors.push(e.message));
                ''')

                # 20 rapid toggles
                for i in range(20):
                    is_hidden = (i % 2 == 0)
                    await session.eval_js(f'''
                        Object.defineProperty(document, 'hidden', {{ value: {'true' if is_hidden else 'false'}, configurable: true }});
                        document.dispatchEvent(new Event('visibilitychange'));
                    ''')
                    await asyncio.sleep(0.02)

                # Restore visible
                await session.eval_js('''
                    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
                    document.dispatchEvent(new Event('visibilitychange'));
                ''')
                await asyncio.sleep(0.1)

                errors = await session.eval_js('window.__unhandledErrors')
                rect_count = await session.eval_js('document.querySelectorAll("#animated-grid-squares rect").length')
                return errors, rect_count

        errs, count = asyncio.run(verify_visibility_stress())
        self.assertEqual(errs, [], f"Unhandled errors during rapid visibility toggling: {errs}")
        self.assertEqual(count, 14, f"Ambient square count compromised: {count}")


if __name__ == '__main__':
    unittest.main(verbosity=2)
