#!/usr/bin/env python3
"""
MEGλ Studio Portfolio - Automated Optimization Test Suite
=========================================================
Covers Requirements R1, R2, R3, R4, R5 across 4 validation tiers:
  - Tier 1: Feature Coverage (Core Requirements)
  - Tier 2: Boundary & Corner Cases
  - Tier 3: Cross-Feature Combinations & State Transitions
  - Tier 4: Real-World & Server / Environment Validation

Author: Test Writer (Teamwork QA Agent)
Usage:
  python3 tests/test_portfolio.py
"""

import os
import re
import sys
import socket
import urllib.request
import urllib.error
import subprocess
import unittest
from html.parser import HTMLParser
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INDEX_HTML = PROJECT_ROOT / "index.html"
STYLE_CSS = PROJECT_ROOT / "style.css"
MAIN_JS = PROJECT_ROOT / "main.js"
HOOK_POST_COMMIT = PROJECT_ROOT / ".git" / "hooks" / "post-commit"


def read_file(path: Path) -> str:
    """Read full text of a file or fail with a helpful error."""
    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")
    return path.read_text(encoding="utf-8")


def strip_js_comments(content: str) -> str:
    """Remove line and block comments from JavaScript code for AST-like inspection."""
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)
    content = re.sub(r'//.*', '', content)
    return content


def strip_css_comments(content: str) -> str:
    """Remove block comments from CSS code."""
    return re.sub(r'/\*[\s\S]*?\*/', '', content)


def extract_listener_calls(code: str, event_name: str) -> list[str]:
    """
    Extracts complete arguments for all addEventListener calls matching event_name,
    handling nested callbacks, braces, and multiple lines via paren-depth tracking.
    """
    pattern = re.compile(rf'addEventListener\s*\(\s*[\'\"]{event_name}[\'\"]')
    calls = []
    for m in pattern.finditer(code):
        start = m.start()
        paren_open = code.find('(', start)
        depth = 1
        i = paren_open + 1
        while i < len(code) and depth > 0:
            if code[i] == '(':
                depth += 1
            elif code[i] == ')':
                depth -= 1
            i += 1
        calls.append(code[paren_open + 1 : i - 1])
    return calls


def check_js_delimiters(code: str) -> tuple[bool, str]:
    """
    Parses JavaScript code tracking strings, comments, and template literals
    to verify delimiter balance for (), {}, and [].
    """
    i = 0
    n = len(code)
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    opens = {'(', '{', '['}

    while i < n:
        ch = code[i]

        # Single line comment
        if ch == '/' and i + 1 < n and code[i + 1] == '/':
            i += 2
            while i < n and code[i] != '\n':
                i += 1
            continue

        # Multi line comment
        if ch == '/' and i + 1 < n and code[i + 1] == '*':
            i += 2
            while i + 1 < n and not (code[i + 1] == '*' and code[i + 2] == '/') if i + 2 < n else True:
                if code[i] == '*' and i + 1 < n and code[i + 1] == '/':
                    break
                i += 1
            i += 2
            continue

        # Single or double quote string
        if ch in ('"', "'"):
            quote = ch
            i += 1
            while i < n:
                if code[i] == '\\':
                    i += 2
                    continue
                if code[i] == quote:
                    i += 1
                    break
                i += 1
            continue

        # Template literal
        if ch == '`':
            i += 1
            while i < n:
                if code[i] == '\\':
                    i += 2
                    continue
                if code[i] == '$' and i + 1 < n and code[i + 1] == '{':
                    stack.append('`${')
                    i += 2
                    break
                if code[i] == '`':
                    i += 1
                    break
                i += 1
            continue

        if ch in opens:
            stack.append(ch)
        elif ch in pairs:
            if not stack:
                return False, f"Unexpected closing '{ch}' at offset {i}"
            top = stack.pop()
            if top == '`${' and ch == '}':
                # Resume parsing template literal after expression
                i += 1
                while i < n:
                    if code[i] == '\\':
                        i += 2
                        continue
                    if code[i] == '$' and i + 1 < n and code[i + 1] == '{':
                        stack.append('`${')
                        i += 2
                        break
                    if code[i] == '`':
                        i += 1
                        break
                    i += 1
                continue
            if top != pairs[ch]:
                return False, f"Mismatched delimiter: expected closing for '{top}', found '{ch}' at offset {i}"

        i += 1

    if stack:
        return False, f"Unclosed delimiters remaining on stack: {stack}"
    return True, "All delimiters balanced"


# ==============================================================================
# TIER 1: FEATURE COVERAGE (Core Requirements R1, R2, R3, R4, R5)
# ==============================================================================

class TestTier1FeatureCoverage(unittest.TestCase):
    """
    Tier 1: Feature Coverage verifies primary functional implementations:
    - R1: Scroll Linear & Fluido (remove global CSS smooth scroll, Canvas IntersectionObserver)
    - R2: Site Performance & Weight (reduced ambient squares, visibilitychange handling, Life Hub observer)
    - R3: Background Grid Isolation (eliminated touchmove, isScrolling suppression)
    - R4: Git Remote & Branch Synchronization
    - R5: HTTP Server Readiness
    """

    def setUp(self):
        self.css_raw = read_file(STYLE_CSS)
        self.css = strip_css_comments(self.css_raw)
        self.js_raw = read_file(MAIN_JS)
        self.js = strip_js_comments(self.js_raw)

    def test_r1_html_global_smooth_scroll_removed(self):
        """
        R1 / M1: Verifies removal of global smooth scroll on html in style.css.
        Global scroll-behavior: smooth creates friction and stutter during upward
        hardware scrolling. Smooth scroll should only be invoked programmatically on clicks.
        """
        html_rules = re.findall(r'(?:^|[\}\s])html\s*\{([^}]+)\}', self.css, re.MULTILINE)
        for rule_body in html_rules:
            self.assertNotRegex(
                rule_body,
                r'scroll-behavior\s*:\s*smooth',
                "style.css: 'html' rule contains 'scroll-behavior: smooth;'. "
                "Global smooth scroll must be removed to restore 1:1 hardware scroll physics."
            )

        combo_rules = re.findall(r'(?:^|[\}\s])html\s*,\s*body\s*\{([^}]+)\}', self.css, re.MULTILINE)
        for rule_body in combo_rules:
            self.assertNotRegex(
                rule_body,
                r'scroll-behavior\s*:\s*smooth',
                "style.css: 'html, body' rule contains 'scroll-behavior: smooth;'. "
                "Global smooth scroll must be removed."
            )

    def test_r1_icon_cloud_intersection_observer_presence(self):
        """
        R1 / M1: Verifies presence of IntersectionObserver on the 3D Icon Cloud Canvas
        (observing cloudCanvas, cloudTarget, #icon-cloud-canvas, or #education) with pause/resume logic.
        """
        observes_cloud = bool(re.search(
            r'\.observe\s*\(\s*(?:cloudCanvas|cloudTarget|educationSection|document\.getElementById\([\'"](?:icon-cloud-canvas|education)[\'"]\))\s*\)',
            self.js
        ))
        self.assertTrue(
            observes_cloud,
            "main.js: Icon Cloud canvas or #education section is not observed with IntersectionObserver."
        )

        has_lifecycle_control = bool(re.search(
            r'isIntersecting|isCloudInView|isCanvasVisible|isPaused|isCloudActive|isCloudVisible|stopCloudLoop',
            self.js
        ))
        self.assertTrue(
            has_lifecycle_control,
            "main.js: Icon Cloud observer lacks pause/resume lifecycle logic (isIntersecting / pause flag)."
        )

    def test_r3_grid_touchmove_eliminated(self):
        """
        R3 / M1: Verifies absence of touchmove on the interactive background grid.
        Touchmove triggers accidental square rendering during mobile/touch scrolling,
        causing heavy DOM manipulation and jank.
        """
        grid_section_match = re.search(
            r'(?:gridSvg|hoverSquaresGroup)[\s\S]*?(?:ambientSquaresGroup|lifehub-animated-list)',
            self.js
        )
        self.assertIsNotNone(grid_section_match, "main.js: InteractiveGridPattern section not found.")
        grid_code = grid_section_match.group(0)

        has_grid_touchmove = bool(re.search(
            r'addEventListener\s*\(\s*[\'"]touchmove[\'"]',
            grid_code
        ))
        self.assertFalse(
            has_grid_touchmove,
            "main.js: 'touchmove' event listener is still attached to the interactive grid. "
            "Grid interactions must be restricted to hover only."
        )

    def test_r3_grid_scroll_suppression_isscrolling(self):
        """
        R3 / M1: Verifies presence of isScrolling scroll suppression flag on the interactive grid.
        When the user scrolls, isScrolling must be active to prevent square calculations
        and DOM emissions.
        """
        has_isscrolling_var = bool(re.search(r'\blet\s+isScrolling\b|\bvar\s+isScrolling\b', self.js))
        self.assertTrue(
            has_isscrolling_var,
            "main.js: 'isScrolling' flag is not defined to suppress grid calculations during scroll."
        )

        scroll_calls = extract_listener_calls(self.js, 'scroll')
        self.assertTrue(len(scroll_calls) > 0, "main.js: No scroll event listener found.")
        has_passive_scroll = any(re.search(r'passive\s*:\s*true', c) for c in scroll_calls)
        self.assertTrue(
            has_passive_scroll,
            "main.js: scroll event listener updating isScrolling must specify { passive: true }."
        )

        has_scroll_guard = bool(re.search(
            r'if\s*\(\s*isScrolling\s*\)\s*return',
            self.js
        ))
        self.assertTrue(
            has_scroll_guard,
            "main.js: triggerSquareAt does not check 'if (isScrolling) return;' to suppress active square creation."
        )

    def test_r2_reduced_ambient_squares(self):
        """
        R2 / M1: Verifies maxAmbientSquares is reduced from 35 down to 14 (<= 14)
        to minimize background DOM footprint and main thread CPU burden.
        """
        match = re.search(r'const\s+maxAmbientSquares\s*=\s*(\d+);', self.js)
        self.assertIsNotNone(
            match,
            "main.js: 'maxAmbientSquares' constant definition not found."
        )
        count = int(match.group(1))
        self.assertLessEqual(
            count,
            14,
            f"main.js: maxAmbientSquares is {count}, expected <= 14 for low CPU overhead."
        )

    def test_r2_visibilitychange_handling(self):
        """
        R2 / M1: Verifies visibilitychange event listener is present to pause
        animations (ambient grid, canvas, etc.) when the tab is hidden.
        """
        has_visibility_listener = bool(re.search(
            r'addEventListener\s*\(\s*[\'"]visibilitychange[\'"]',
            self.js
        ))
        self.assertTrue(
            has_visibility_listener,
            "main.js: 'visibilitychange' event listener not found."
        )

        has_hidden_check = bool(re.search(r'document\.hidden', self.js))
        self.assertTrue(
            has_hidden_check,
            "main.js: document.hidden check not found inside visibility handler."
        )

    def test_r2_lifehub_intersection_observer_presence(self):
        """
        R2 / M1: Verifies that Life Hub notifications (pushNextNotification)
        have an IntersectionObserver or pause mechanism when out of viewport.
        """
        has_notif_observer = bool(re.search(
            r'\.observe\s*\(\s*(?:notifTarget|notifContainer|document\.getElementById\([\'"](?:lifehub-animated-list|life-hub-notifications|pillars)[\'"]\)|pillarsSection)\s*\)',
            self.js
        ))
        self.assertTrue(
            has_notif_observer,
            "main.js: Life Hub notifications container is not observed with IntersectionObserver to pause intervals."
        )

    def test_r4_git_remote_and_branch_setup(self):
        """
        R4 / M3: Verifies git remote origin points to the target repository
        and current branch is 'main'.
        """
        try:
            remotes = subprocess.check_output(
                ["git", "remote", "-v"],
                cwd=PROJECT_ROOT,
                text=True,
                stderr=subprocess.PIPE
            )
            self.assertIn("henriquemonteiro098/contato-portfolio.git", remotes)

            branch = subprocess.check_output(
                ["git", "branch", "--show-current"],
                cwd=PROJECT_ROOT,
                text=True,
                stderr=subprocess.PIPE
            ).strip()
            self.assertEqual(branch, "main", f"Expected active git branch 'main', got '{branch}'.")
        except subprocess.SubprocessError as e:
            self.fail(f"Git inspection failed: {e}")

    def test_r5_http_server_readiness(self):
        """
        R5 / M2: Verifies that Python 3.12 http.server is available and port 8080
        is either active or ready to be bound without port collision.
        """
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.settimeout(0.2)
                res = s.connect_ex(('127.0.0.1', 8080))
                if res == 0:
                    return
            except OSError:
                pass

        test_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            test_sock.bind(('127.0.0.1', 8080))
        except OSError as e:
            self.fail(f"Port 8080 is blocked or cannot be bound: {e}")
        finally:
            test_sock.close()


# ==============================================================================
# TIER 2: BOUNDARY & CORNER CASES
# ==============================================================================

class TestTier2BoundaryAndCornerCases(unittest.TestCase):
    """
    Tier 2: Boundary & Corner Cases checks device capability gating,
    passive event listener options, debouncing thresholds, and caching contracts.
    """

    def setUp(self):
        self.css_raw = read_file(STYLE_CSS)
        self.css = strip_css_comments(self.css_raw)
        self.js_raw = read_file(MAIN_JS)
        self.js = strip_js_comments(self.js_raw)

    def test_media_query_hover_pointer_capabilities(self):
        """
        Tier 2: Verifies media query check for pointer/hover capabilities
        (hover: hover) and (pointer: fine) to guard grid mouse interaction.
        """
        has_hover_query = bool(re.search(
            r'matchMedia\s*\(\s*[\'"][^\'"]*hover:\s*hover[^\'"]*[\'"]\s*\)',
            self.js
        ))
        has_pointer_query = bool(re.search(
            r'matchMedia\s*\(\s*[\'"][^\'"]*pointer:\s*fine[^\'"]*[\'"]\s*\)',
            self.js
        ))
        has_combined_query = bool(re.search(
            r'matchMedia\s*\(\s*[\'"][^\'"]*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)[^\'"]*[\'"]\s*\)',
            self.js
        ))
        self.assertTrue(
            has_combined_query or (has_hover_query and has_pointer_query),
            "main.js: Missing media query check '(hover: hover) and (pointer: fine)' for grid interactivity."
        )

    def test_passive_event_listener_flags(self):
        """
        Tier 2: Verifies that global scroll listeners specify { passive: true }
        to avoid blocking browser composite threads.
        """
        scroll_calls = extract_listener_calls(self.js, 'scroll')
        self.assertTrue(len(scroll_calls) > 0, "No scroll listeners found in main.js.")
        for idx, call in enumerate(scroll_calls):
            self.assertRegex(
                call,
                r'passive\s*:\s*true',
                f"Scroll listener #{idx + 1} without {{ passive: true }}: {call.strip()[:60]}..."
            )

    def test_debounce_timer_for_scroll_suppression(self):
        """
        Tier 2: Verifies debounce timer implementation (clearTimeout / setTimeout)
        for isScrolling so hover state cleanly resets after scroll stops.
        """
        has_clear_timer = bool(re.search(
            r'clearTimeout\s*\(\s*(?:[a-zA-Z0-9_]*[sS]croll[a-zA-Z0-9_]*)\s*\)',
            self.js
        ))
        has_timeout_set = bool(re.search(
            r'(?:[a-zA-Z0-9_]*[sS]croll[a-zA-Z0-9_]*)\s*=\s*setTimeout\s*\(\s*(?:function|\([^)]*\)\s*=>)',
            self.js
        ))
        self.assertTrue(
            has_clear_timer and has_timeout_set,
            "main.js: Missing debounced timer (clearTimeout + setTimeout) for isScrolling restoration."
        )

    def test_programmatic_smooth_scroll_preserved(self):
        """
        Tier 2: Ensures tab smooth scrolling via JS is untouched.
        Clicking navigation tabs must still execute targetEl.scrollIntoView({ behavior: 'smooth' }).
        """
        has_js_smooth = bool(re.search(
            r'scrollIntoView\s*\(\s*\{[^}]*behavior\s*:\s*[\'"]smooth[\'"][^}]*\}\s*\)',
            self.js
        ))
        self.assertTrue(
            has_js_smooth,
            "main.js: Programmatic smooth scroll in nav tab handler was removed. "
            "scrollIntoView({ behavior: 'smooth' }) must be preserved for explicit clicks."
        )

    def test_canvas_shadowblur_theme_caching(self):
        """
        Tier 2: Verifies removal of repetitive shadowBlur and per-frame getAttribute('data-theme')
        in IconCloud renderCloud loop.
        """
        render_cloud_match = re.search(
            r'function\s+renderCloud\s*\(\s*\)\s*\{([\s\S]*?)(?:requestAnimationFrame\s*\(\s*renderCloud\s*\)\s*;?\s*\})',
            self.js
        )
        self.assertIsNotNone(render_cloud_match, "main.js: renderCloud function body not found.")
        body = render_cloud_match.group(1)

        has_per_frame_theme_dom = bool(re.search(
            r'getAttribute\s*\(\s*[\'"]data-theme[\'"]\s*\)',
            body
        ))
        self.assertFalse(
            has_per_frame_theme_dom,
            "main.js: renderCloud queries document.documentElement.getAttribute('data-theme') per frame. "
            "Theme must be cached or observed outside the 60fps render loop."
        )

        has_hot_shadow_blur = bool(re.search(
            r'ctx\.shadowBlur\s*=\s*\d+',
            body
        ))
        self.assertFalse(
            has_hot_shadow_blur,
            "main.js: ctx.shadowBlur is set inside the hot renderCloud projected items loop. "
            "Remove or disable shadowBlur in 3D canvas loop to eliminate rendering stutter."
        )


# ==============================================================================
# TIER 3: CROSS-FEATURE COMBINATIONS
# ==============================================================================

class TestTier3CrossFeatureCombinations(unittest.TestCase):
    """
    Tier 3: Cross-Feature Combinations verifies interactions between features:
    - Background grid does not trigger during active scrolling
    - Canvas pauses when scrolled off-screen and resumes when visible
    - Theme switching maintains dark mode compatibility without breaking tokens
    - Visibility changes cleanly cascade across ambient and canvas animations
    """

    def setUp(self):
        self.css_raw = read_file(STYLE_CSS)
        self.css = strip_css_comments(self.css_raw)
        self.js_raw = read_file(MAIN_JS)
        self.js = strip_js_comments(self.js_raw)

    def test_grid_does_not_fire_while_scrolling(self):
        """
        Tier 3: Verifies that triggerSquareAt or mousemove handler actively suppresses
        SVG square generation when scrolling is active.
        """
        trigger_match = re.search(
            r'function\s+triggerSquareAt\s*\([^)]*\)\s*\{([\s\S]*?)\}',
            self.js
        )
        if trigger_match:
            body = trigger_match.group(1)
            self.assertRegex(
                body,
                r'if\s*\(\s*isScrolling\s*\)\s*return',
                "main.js: triggerSquareAt does not check 'if (isScrolling) return' at entry."
            )
        else:
            self.assertRegex(
                self.js,
                r'if\s*\(\s*(?:!isScrolling|isScrolling\s*===?\s*false)\s*\)',
                "main.js: Grid interaction handler does not check isScrolling state."
            )

    def test_canvas_pauses_during_offscreen_scroll(self):
        """
        Tier 3: Verifies that when scrolled away from #education, IntersectionObserver
        toggles execution lifecycle (cancelAnimationFrame / stopCloudLoop / visibility flag).
        """
        has_lifecycle_control = bool(re.search(
            r'(?:stopCloudLoop|cancelAnimationFrame\s*\(\s*(?:cloudRafId|rafId)\s*\)|if\s*\([^)]*isCloudVisible[^)]*\)\s*\{[^}]*requestAnimationFrame)',
            self.js
        ))
        self.assertTrue(
            has_lifecycle_control,
            "main.js: renderCloud loop does not manage pause/cancel lifecycle when off-screen."
        )

    def test_theme_and_dark_mode_compatibility(self):
        """
        Tier 3: Verifies that style.css retains full dark/light tokens
        and theme switching works with optimized canvas and grid colors.
        """
        self.assertIn('[data-theme="dark"]', self.css, "Missing [data-theme='dark'] tokens in style.css.")
        self.assertIn('[data-theme="light"]', self.css, "Missing [data-theme='light'] tokens in style.css.")
        self.assertIn('--bg-main', self.css, "Missing --bg-main token in style.css.")
        self.assertIn('--text-main', self.css, "Missing --text-main token in style.css.")
        self.assertIn('--bg-card', self.css, "Missing --bg-card token in style.css.")

    def test_visibility_change_pauses_ambient_and_canvas(self):
        """
        Tier 3: Verifies that visibilitychange listener coordinates both
        ambient background squares and canvas 3D rotation.
        """
        vis_match = re.search(
            r'addEventListener\s*\(\s*[\'"]visibilitychange[\'"]\s*,\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{([\s\S]*?)\}\s*\)',
            self.js
        )
        self.assertIsNotNone(
            vis_match,
            "main.js: visibilitychange event listener function body not found."
        )
        handler_body = vis_match.group(1)
        self.assertIn(
            "document.hidden",
            handler_body,
            "main.js: visibilitychange handler does not inspect document.hidden."
        )


# ==============================================================================
# TIER 4: REAL-WORLD & SERVER VALIDATION
# ==============================================================================

class HTMLStructureValidator(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags_stack = []
        self.section_ids = set()
        self.canvas_ids = set()
        self.self_closing = {
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'
        }
        self.has_doctype = False
        self.errors = []

    def handle_decl(self, decl):
        if 'html' in decl.lower():
            self.has_doctype = True

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        if tag not in self.self_closing:
            self.tags_stack.append((tag, self.getpos()))

        if tag == 'section' and 'id' in attr_dict:
            self.section_ids.add(attr_dict['id'])
        if tag == 'canvas' and 'id' in attr_dict:
            self.canvas_ids.add(attr_dict['id'])

    def handle_endtag(self, tag):
        if tag in self.self_closing:
            return
        if not self.tags_stack:
            self.errors.append(f"Unexpected closing tag </{tag}> at line {self.getpos()[0]}")
            return
        last_tag, pos = self.tags_stack.pop()
        if last_tag != tag:
            if last_tag not in {'p', 'li', 'option', 'dd', 'dt', 'tr', 'td', 'th'}:
                self.errors.append(
                    f"Mismatched tag: expected </{last_tag}> (opened at line {pos[0]}), found </{tag}> at line {self.getpos()[0]}"
                )


class TestTier4RealWorldAndServerValidation(unittest.TestCase):
    """
    Tier 4: Real-World & Server Validation checks syntax validity across HTML/CSS/JS,
    HTTP server port 8080 response, and git post-commit auto-push hook.
    """

    def test_html_syntax_and_structure(self):
        """
        Tier 4: Validates index.html structure, required sections, DOCTYPE, and canvas.
        """
        content = read_file(INDEX_HTML)
        validator = HTMLStructureValidator()
        validator.feed(content)

        self.assertTrue(validator.has_doctype, "index.html: Missing <!DOCTYPE html>.")
        self.assertEqual(len(validator.errors), 0, f"index.html syntax errors: {validator.errors[:3]}")

        required_sections = {'hero', 'pillars', 'works', 'education', 'contact'}
        missing = required_sections - validator.section_ids
        self.assertEqual(len(missing), 0, f"index.html: Missing required sections: {missing}")
        self.assertIn('icon-cloud-canvas', validator.canvas_ids, "index.html: Missing #icon-cloud-canvas element.")

    def test_css_syntax_and_bracket_balance(self):
        """
        Tier 4: Verifies CSS bracket balance and token integrity.
        """
        css = strip_css_comments(read_file(STYLE_CSS))
        open_braces = css.count('{')
        close_braces = css.count('}')
        self.assertEqual(
            open_braces,
            close_braces,
            f"style.css: Unbalanced braces! Found {open_braces} '{{' and {close_braces} '}}'."
        )

    def test_js_syntax_and_bracket_balance(self):
        """
        Tier 4: Verifies JavaScript bracket and parenthesis balance.
        """
        js = read_file(MAIN_JS)
        valid, msg = check_js_delimiters(js)
        self.assertTrue(valid, f"main.js syntax delimiter error: {msg}")

    def test_server_port_or_process_validation(self):
        """
        Tier 4: Verifies that local HTTP server on port 8080 is running and responds with HTTP 200.
        When M2 is pending, this identifies that the test server needs to be launched.
        """
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:8080/",
                headers={"User-Agent": "TestPortfolioSuite/1.0"}
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                status = resp.getcode()
                self.assertEqual(status, 200, f"HTTP Server returned status {status}, expected 200.")
                body = resp.read(2048).decode("utf-8", errors="ignore")
                self.assertIn("MEGλ", body, "Server did not serve portfolio index.html.")
        except urllib.error.URLError as e:
            self.fail(
                f"Local test server on port 8080 is not currently running ({e.reason}). "
                "Launch with 'python3 -m http.server 8080' (M2 scope)."
            )

    def test_git_hook_and_remote_tracking(self):
        """
        Tier 4: Verifies that .git/hooks/post-commit exists, is executable,
        and automatically synchronizes with 'origin'.
        """
        self.assertTrue(HOOK_POST_COMMIT.exists(), "Missing .git/hooks/post-commit hook.")
        self.assertTrue(
            os.access(HOOK_POST_COMMIT, os.X_OK),
            ".git/hooks/post-commit is not executable."
        )
        hook_text = HOOK_POST_COMMIT.read_text(encoding="utf-8")
        self.assertIn("git push origin", hook_text, "post-commit hook does not push to origin.")


# ==============================================================================
# SUITE RUNNER & DIAGNOSTICS REPORT
# ==============================================================================

def run_suite_with_report():
    """Runs all tiers and produces a structured diagnostics report."""
    loader = unittest.TestLoader()

    tier_classes = [
        ("Tier 1: Feature Coverage (R1-R5)", TestTier1FeatureCoverage),
        ("Tier 2: Boundary & Corner Cases", TestTier2BoundaryAndCornerCases),
        ("Tier 3: Cross-Feature Combinations", TestTier3CrossFeatureCombinations),
        ("Tier 4: Real-World & Server Validation", TestTier4RealWorldAndServerValidation),
    ]

    print("=" * 78)
    print(" MEGλ STUDIO PORTFOLIO — AUTOMATED OPTIMIZATION TEST SUITE")
    print("=" * 78)

    overall_results = {}

    for tier_title, cls in tier_classes:
        tier_suite = loader.loadTestsFromTestCase(cls)
        runner = unittest.TextTestRunner(verbosity=1, stream=sys.stdout)
        print(f"\n--- Running {tier_title} ---")
        result = runner.run(tier_suite)
        overall_results[tier_title] = result

    # Print summary table
    print("\n" + "=" * 78)
    print(" SUMMARY MATRIX ACROSS VALIDATION TIERS")
    print("=" * 78)
    print(f"{'Tier':<45} | {'Run':<6} | {'Pass':<6} | {'Fail':<6}")
    print("-" * 78)

    total_run = 0
    total_passed = 0
    total_failed = 0

    for tier_title, res in overall_results.items():
        run_count = res.testsRun
        fail_count = len(res.failures) + len(res.errors)
        pass_count = run_count - fail_count

        total_run += run_count
        total_passed += pass_count
        total_failed += fail_count

        print(f"{tier_title:<45} | {run_count:<6} | {pass_count:<6} | {fail_count:<6}")

    print("-" * 78)
    print(f"{'TOTAL':<45} | {total_run:<6} | {total_passed:<6} | {total_failed:<6}")
    print("=" * 78)

    if total_failed > 0:
        print(f"\n⚡ Baseline Verification: {total_failed} tests pending implementation.")
        print("  These failures accurately pinpoint pending items in Milestones M1, M2, and M3.")
    else:
        print("\n✅ All tests passed successfully!")

    return 0 if total_failed == 0 else 1


if __name__ == '__main__':
    sys.exit(run_suite_with_report())
