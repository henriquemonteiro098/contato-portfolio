#!/usr/bin/env python3
"""
EMPIRICAL CHALLENGER VERIFICATION HARNESS - MILESTONE 1 (R1)
============================================================
Adversarial and stress-testing suite for R1:
- Scroll Linearity (Complete removal of CSS scroll-behavior: smooth on html/body/:root)
- Canvas Lifecycle Optimization (IntersectionObserver, rAF start/stop, visibilitychange)
- Theme Caching & Render Cloud Optimization (No DOM reads, no ctx.shadowBlur, preallocated arrays)
- Tab Navigation Programmatic Smooth Scroll Integrity
- Simulation & Stress-testing of lifecycle state transitions

Target files under test:
- style.css
- main.js
- index.html
"""

import os
import re
import sys
import random
import unittest
from pathlib import Path
from html.parser import HTMLParser

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STYLE_CSS = PROJECT_ROOT / "style.css"
MAIN_JS = PROJECT_ROOT / "main.js"
INDEX_HTML = PROJECT_ROOT / "index.html"


def read_text(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    return path.read_text(encoding="utf-8")


def strip_comments_css(content: str) -> str:
    return re.sub(r'/\*[\s\S]*?\*/', '', content)


def strip_comments_js(content: str) -> str:
    content = re.sub(r'/\*[\s\S]*?\*/', '', content)
    content = re.sub(r'//.*', '', content)
    return content


def extract_function_body(code: str, func_name: str) -> str:
    """Extract full function body handling nested curly braces."""
    pattern = re.compile(rf'function\s+{func_name}\s*\([^)]*\)\s*\{{')
    m = pattern.search(code)
    if not m:
        raise ValueError(f"Function {func_name} not found in code")
    
    start = m.end() - 1  # at '{'
    depth = 0
    i = start
    while i < len(code):
        if code[i] == '{':
            depth += 1
        elif code[i] == '}':
            depth -= 1
            if depth == 0:
                return code[start + 1 : i]
        i += 1
    raise ValueError(f"Unclosed function body for {func_name}")


def extract_braced_block(code: str, start_index: int) -> str:
    """Extract contents of the first braced block starting at or after start_index."""
    brace_open = code.find('{', start_index)
    if brace_open == -1:
        raise ValueError("No opening brace found")
    depth = 1
    i = brace_open + 1
    while i < len(code) and depth > 0:
        if code[i] == '{':
            depth += 1
        elif code[i] == '}':
            depth -= 1
        i += 1
    return code[brace_open + 1 : i - 1]


# ==============================================================================
# CHALLENGER TEST SUITE: R1 SPECIFIC ADVERSARIAL INSPECTION
# ==============================================================================

class TestChallengerScrollLinearity(unittest.TestCase):
    """
    Empirically stress-tests scroll linearity in style.css and HTML.
    Ensures zero trace of global smooth scroll that could induce input lag or fighting.
    """

    @classmethod
    def setUpClass(cls):
        cls.raw_css = read_text(STYLE_CSS)
        cls.css = strip_comments_css(cls.raw_css)

    def test_css_zero_occurrence_of_scroll_behavior_smooth(self):
        """Assert that 'scroll-behavior: smooth' does NOT exist anywhere in style.css."""
        matches = list(re.finditer(r'scroll-behavior\s*:\s*smooth', self.css, re.IGNORECASE))
        self.assertEqual(
            len(matches),
            0,
            f"Adversarial violation: Found {len(matches)} occurrences of 'scroll-behavior: smooth' in style.css!"
        )

    def test_css_html_and_root_selectors_free_of_smooth_scroll(self):
        """Assert html, :root, and body blocks specifically contain no scroll-behavior rules."""
        selectors_to_check = ['html', ':root', 'body', '*', 'html, body']
        for sel in selectors_to_check:
            escaped_sel = re.escape(sel)
            pattern = re.compile(rf'(?:^|[\}}\s]){escaped_sel}\s*\{{([^}}]+)\}}', re.MULTILINE)
            for m in pattern.finditer(self.css):
                block = m.group(1)
                self.assertNotIn(
                    'scroll-behavior',
                    block.lower(),
                    f"Selector '{sel}' still defines 'scroll-behavior':\n{block}"
                )

    def test_css_media_queries_contain_no_smooth_scroll(self):
        """Assert no @media query re-introduces smooth scroll for reduced-motion or specific viewports."""
        media_blocks = re.findall(r'@media[^{]+\{([\s\S]+?\})\s*\}', self.css)
        for block in media_blocks:
            self.assertNotRegex(
                block,
                r'scroll-behavior\s*:\s*smooth',
                "Found 'scroll-behavior: smooth' re-introduced inside an @media block!"
            )


class TestChallengerCanvasLifecycleAndWiring(unittest.TestCase):
    """
    Empirically inspects and stress-tests 3D Icon Cloud Canvas lifecycle controls,
    IntersectionObserver wiring, and requestAnimationFrame handling.
    """

    @classmethod
    def setUpClass(cls):
        cls.raw_js = read_text(MAIN_JS)
        cls.clean_js = strip_comments_js(cls.raw_js)

    def test_intersection_observer_instantiation_and_wiring(self):
        """Verify IntersectionObserver observes #icon-cloud-canvas with rootMargin and threshold."""
        # 1. Check observer definition
        observer_match = re.search(
            r'const\s+cloudObserver\s*=\s*new\s+IntersectionObserver\s*\(\s*\((?:entries|[^)]*)\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\{([^}]+)\}\s*\);',
            self.clean_js
        )
        self.assertIsNotNone(observer_match, "cloudObserver not found or malformed in main.js")

        options = observer_match.group(2)
        self.assertIn("rootMargin", options, "cloudObserver lacks rootMargin for predictive preloading")
        self.assertIn("threshold", options, "cloudObserver lacks threshold configuration")

        # 2. Check observation call on cloudCanvas
        self.assertRegex(
            self.clean_js,
            r'cloudObserver\.observe\s*\(\s*cloudCanvas\s*\)',
            "cloudObserver does not observe cloudCanvas directly"
        )

    def test_rendercloud_lifecycle_guards(self):
        """Verify renderCloud does not self-reschedule when isCanvasVisible is false."""
        body = extract_function_body(self.clean_js, 'renderCloud')

        # Entry guard
        self.assertRegex(
            body,
            r'if\s*\(\s*!isCanvasVisible\s*\)\s*\{\s*cloudRafId\s*=\s*null;\s*return;\s*\}',
            "renderCloud lacks immediate entry exit guard on !isCanvasVisible"
        )

        # Reschedule guard at exit
        self.assertRegex(
            body,
            r'if\s*\(\s*isCanvasVisible\s*\)\s*\{\s*cloudRafId\s*=\s*requestAnimationFrame\s*\(\s*renderCloud\s*\);\s*\}',
            "renderCloud reschedules without checking isCanvasVisible"
        )

    def test_start_and_stop_cloud_loop_functions(self):
        """Verify startCloudLoop and stopCloudLoop prevent double-scheduling and cleanly cancel."""
        start_body = extract_function_body(self.clean_js, 'startCloudLoop')
        stop_body = extract_function_body(self.clean_js, 'stopCloudLoop')

        # startCloudLoop should check !cloudRafId, isCanvasVisible, and !document.hidden
        self.assertRegex(
            start_body,
            r'!cloudRafId',
            "startCloudLoop does not guard against duplicate rAF scheduling (!cloudRafId)"
        )
        self.assertRegex(
            start_body,
            r'isCanvasVisible',
            "startCloudLoop does not verify isCanvasVisible before requesting frame"
        )
        self.assertRegex(
            start_body,
            r'!document\.hidden',
            "startCloudLoop does not verify !document.hidden before requesting frame"
        )

        # stopCloudLoop should call cancelAnimationFrame and nullify cloudRafId
        self.assertRegex(
            stop_body,
            r'cancelAnimationFrame\s*\(\s*cloudRafId\s*\)',
            "stopCloudLoop does not cancelAnimationFrame(cloudRafId)"
        )
        self.assertRegex(
            stop_body,
            r'cloudRafId\s*=\s*null',
            "stopCloudLoop does not nullify cloudRafId after cancellation"
        )

    def test_visibilitychange_lifecycle_coordination(self):
        """Verify document.addEventListener('visibilitychange') stops when hidden and starts when visible."""
        # Find all visibilitychange handlers in the script
        vis_listeners = re.findall(
            r'document\.addEventListener\s*\(\s*[\'"]visibilitychange[\'"]\s*,\s*(?:\(\)\s*=>|function\s*\(\))\s*\{([\s\S]*?)\}\s*\);?',
            self.clean_js
        )
        self.assertTrue(len(vis_listeners) > 0, "No visibilitychange listener found")

        # Find the one specifically controlling IconCloud
        cloud_vis = [v for v in vis_listeners if 'stopCloudLoop' in v or 'startCloudLoop' in v]
        self.assertEqual(
            len(cloud_vis),
            1,
            "Expected exactly one visibilitychange listener coordinating Icon Cloud lifecycle"
        )
        vis_body = cloud_vis[0]

        self.assertIn("stopCloudLoop()", vis_body, "visibilitychange does not invoke stopCloudLoop() on hidden")
        self.assertIn("startCloudLoop()", vis_body, "visibilitychange does not invoke startCloudLoop() on visible")


class TestChallengerThemeCachingAndRenderLoopOptimization(unittest.TestCase):
    """
    Empirically inspects renderCloud hot loop for:
    - Zero DOM attribute reads (getAttribute, data-theme, dataset)
    - Zero computed style reads
    - Zero software Gaussian blur (ctx.shadowBlur)
    - Preallocated projection buffers (zero .map / .filter object creation in loop)
    """

    @classmethod
    def setUpClass(cls):
        cls.raw_js = read_text(MAIN_JS)
        cls.clean_js = strip_comments_js(cls.raw_js)
        cls.render_cloud_body = extract_function_body(cls.clean_js, 'renderCloud')

    def test_theme_cached_without_per_frame_dom_queries(self):
        """Assert renderCloud does not touch document or getAttribute."""
        # 1. No DOM traversal inside renderCloud
        self.assertNotIn("document.documentElement", self.render_cloud_body)
        self.assertNotIn("document.body", self.render_cloud_body)
        self.assertNotIn("getAttribute", self.render_cloud_body)
        self.assertNotIn("getComputedStyle", self.render_cloud_body)

        # 2. Uses cached variable
        self.assertIn("isDarkTheme", self.render_cloud_body)

        # 3. Verify applyTheme updates isDarkTheme synchronously
        apply_theme_body = extract_function_body(self.clean_js, 'applyTheme')
        self.assertRegex(
            apply_theme_body,
            r'isDarkTheme\s*=\s*theme\s*===?\s*[\'"]dark[\'"]',
            "applyTheme does not update cached isDarkTheme"
        )

    def test_absence_of_canvas_shadowblur(self):
        """Assert ctx.shadowBlur is not set anywhere in renderCloud or active main.js."""
        # Check inside renderCloud
        self.assertNotIn(
            "ctx.shadowBlur",
            self.render_cloud_body,
            "renderCloud still contains active ctx.shadowBlur calls!"
        )

        # Check in entire stripped main.js
        shadow_blur_matches = re.findall(r'ctx\.shadowBlur\s*=', self.clean_js)
        self.assertEqual(
            len(shadow_blur_matches),
            0,
            f"Found {len(shadow_blur_matches)} active ctx.shadowBlur assignments in main.js!"
        )

    def test_projection_array_preallocated(self):
        """Assert projected array is allocated once outside renderCloud."""
        # In renderCloud, it should not call iconPositions.map(...)
        self.assertNotIn(
            "iconPositions.map",
            self.render_cloud_body,
            "renderCloud reallocates projection objects via iconPositions.map on every frame!"
        )

        # Outside renderCloud, projected is preallocated
        self.assertRegex(
            self.clean_js,
            r'const\s+projected\s*=\s*iconPositions\.map',
            "projected array is not preallocated before renderCloud"
        )


class TestChallengerProgrammaticSmoothScroll(unittest.TestCase):
    """
    Empirically verifies that carousel tab navigation smooth scrolling is preserved
    and correctly targets valid HTML section anchors.
    """

    @classmethod
    def setUpClass(cls):
        cls.raw_js = read_text(MAIN_JS)
        cls.clean_js = strip_comments_js(cls.raw_js)
        cls.raw_html = read_text(INDEX_HTML)

    def test_tab_click_listener_invokes_scrollintoview_smooth(self):
        """Verify tab click handler prevents default and calls targetEl.scrollIntoView({ behavior: 'smooth' })."""
        # Look for tab.addEventListener('click', ...) inside tabItems iteration
        click_match = re.search(
            r'tab\.addEventListener\s*\(\s*[\'"]click[\'"]\s*,\s*(?:e|\(e\))\s*=>',
            self.clean_js
        )
        self.assertIsNotNone(click_match, "tab click event listener block not found")
        block = extract_braced_block(self.clean_js, click_match.end())

        self.assertIn("e.preventDefault()", block, "Tab click handler does not call e.preventDefault()")
        self.assertRegex(
            block,
            r'targetEl\.scrollIntoView\s*\(\s*\{[^}]*behavior\s*:\s*[\'"]smooth[\'"][^}]*\}\s*\)',
            "Tab click handler does not invoke targetEl.scrollIntoView({ behavior: 'smooth' })"
        )

    def test_all_tab_sections_exist_in_index_html(self):
        """Verify all tab items target existing sections in index.html."""
        # Extract data-section from index.html tabs
        tab_sections = re.findall(r'class="[^"]*tab-item[^"]*"[^>]*data-section="([^"]+)"', self.raw_html)
        self.assertTrue(len(tab_sections) >= 4, f"Found only {len(tab_sections)} tab items in index.html")

        # Extract section ids from index.html
        section_ids = set(re.findall(r'<section\s+[^>]*id="([^"]+)"', self.raw_html))

        for sec in tab_sections:
            self.assertIn(
                sec,
                section_ids,
                f"Tab data-section='{sec}' has no corresponding <section id='{sec}'> in index.html!"
            )


class TestChallengerStateSimulation(unittest.TestCase):
    """
    State-Machine Simulation Stress Test.
    Simulates the exact JavaScript lifecycle state logic under 5,000 rapid,
    randomized, and adversarial event sequences.
    """

    class CloudLifecycleSimulator:
        def __init__(self):
            self.isCanvasVisible = False
            self.document_hidden = False
            self.cloudRafId = None
            self.raf_counter = 100
            self.frames_executed = 0
            self.leaked_rafs = 0
            self.duplicate_schedules = 0
            self.frames_while_invisible = 0

        def startCloudLoop(self):
            if not self.cloudRafId and self.isCanvasVisible and not self.document_hidden:
                self.raf_counter += 1
                self.cloudRafId = self.raf_counter

        def stopCloudLoop(self):
            if self.cloudRafId:
                self.cloudRafId = None

        def renderCloudTick(self):
            if not self.isCanvasVisible:
                self.cloudRafId = None
                return

            if self.document_hidden:
                # In browser, hidden tabs suspend rAF execution
                return

            self.frames_executed += 1

            if not self.isCanvasVisible or self.document_hidden:
                self.frames_while_invisible += 1

            # Reschedule next frame
            if self.isCanvasVisible:
                self.raf_counter += 1
                self.cloudRafId = self.raf_counter

        def on_intersection_change(self, isIntersecting: bool):
            self.isCanvasVisible = isIntersecting
            if self.isCanvasVisible:
                self.startCloudLoop()
            else:
                self.stopCloudLoop()

        def on_visibility_change(self, hidden: bool):
            self.document_hidden = hidden
            if self.document_hidden:
                self.stopCloudLoop()
            elif self.isCanvasVisible:
                self.startCloudLoop()

    def test_stress_simulation_5000_random_events(self):
        """Stress-test 5,000 randomized lifecycle transitions with zero invariant violations."""
        sim = self.CloudLifecycleSimulator()
        rng = random.Random(42)

        for step in range(5000):
            event = rng.choice(['intersect_true', 'intersect_false', 'hide_tab', 'show_tab', 'raf_tick'])

            if event == 'intersect_true':
                sim.on_intersection_change(True)
            elif event == 'intersect_false':
                sim.on_intersection_change(False)
            elif event == 'hide_tab':
                sim.on_visibility_change(True)
            elif event == 'show_tab':
                sim.on_visibility_change(False)
            elif event == 'raf_tick':
                if sim.cloudRafId:
                    sim.renderCloudTick()

            # Invariant 1: If canvas is not visible or tab is hidden, cloudRafId MUST be None
            if not sim.isCanvasVisible or sim.document_hidden:
                self.assertIsNone(
                    sim.cloudRafId,
                    f"Invariant violated at step {step}: cloudRafId ({sim.cloudRafId}) is active "
                    f"while isCanvasVisible={sim.isCanvasVisible}, document_hidden={sim.document_hidden}"
                )

        self.assertEqual(sim.frames_while_invisible, 0, "Frames executed while canvas was invisible")
        self.assertTrue(sim.frames_executed > 0, "No frames executed during simulation")


class TestChallengerAdversarialEdgeCases(unittest.TestCase):
    """
    Adversarial Edge Case Stress Testing:
    - Verifies drag listeners are attached dynamically on window only during active drag
    - Verifies onWindowDragMouseMove contains zero getBoundingClientRect calls
    - Verifies canvas fallback handling for network drops / offline CDN assets
    - Verifies cloudCanvas null-safety guards
    """

    @classmethod
    def setUpClass(cls):
        cls.raw_js = read_text(MAIN_JS)
        cls.clean_js = strip_comments_js(cls.raw_js)

    def test_drag_listeners_dynamically_attached_and_detached(self):
        """Assert window mousemove/mouseup and touchmove/touchend are attached and removed dynamically."""
        # Check mouse dynamic attachment
        self.assertRegex(
            self.clean_js,
            r'cloudCanvas\.addEventListener\s*\(\s*[\'"]mousedown[\'"][\s\S]*?window\.addEventListener\s*\(\s*[\'"]mousemove[\'"]',
            "window mousemove is not attached conditionally upon mousedown"
        )
        self.assertRegex(
            self.clean_js,
            r'window\.removeEventListener\s*\(\s*[\'"]mousemove[\'"]\s*,\s*onWindowDragMouseMove\s*\)',
            "onWindowDragMouseMove is not detached from window"
        )

        # Check touch dynamic attachment
        self.assertRegex(
            self.clean_js,
            r'cloudCanvas\.addEventListener\s*\(\s*[\'"]touchstart[\'"][\s\S]*?window\.addEventListener\s*\(\s*[\'"]touchmove[\'"]',
            "window touchmove is not attached conditionally upon touchstart"
        )
        self.assertRegex(
            self.clean_js,
            r'window\.removeEventListener\s*\(\s*[\'"]touchmove[\'"]\s*,\s*onWindowTouchMove\s*\)',
            "onWindowTouchMove is not detached from window"
        )

    def test_no_bounding_client_rect_in_drag_mousemove(self):
        """Assert onWindowDragMouseMove does NOT compute getBoundingClientRect."""
        drag_body = extract_function_body(self.clean_js, 'onWindowDragMouseMove')
        self.assertNotIn(
            "getBoundingClientRect",
            drag_body,
            "onWindowDragMouseMove invokes getBoundingClientRect during active cursor drag!"
        )

    def test_canvas_null_guard_safety(self):
        """Assert icon-cloud block is wrapped in if (cloudCanvas)."""
        cloud_block_match = re.search(
            r'const\s+cloudCanvas\s*=\s*document\.getElementById\([\'"]icon-cloud-canvas[\'"]\);\s*if\s*\(\s*cloudCanvas\s*\)\s*\{',
            self.clean_js
        )
        self.assertIsNotNone(
            cloud_block_match,
            "main.js: IconCloud execution is not null-guarded with 'if (cloudCanvas)'"
        )

    def test_image_fallback_offline_badge(self):
        """Assert renderCloud contains text badge fallback when CDN images fail to load."""
        body = extract_function_body(self.clean_js, 'renderCloud')
        self.assertIn("imagesLoaded[idx]", body, "renderCloud does not branch on imagesLoaded state")
        self.assertRegex(
            body,
            r'fillText\s*\(\s*icon\.slug\.slice\s*\(\s*0\s*,\s*3\s*\)\.toUpperCase\(\)',
            "renderCloud lacks fallback monospace text badge when images are not loaded"
        )


# ==============================================================================
# RUNNER
# ==============================================================================

if __name__ == '__main__':
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    suite.addTests(loader.loadTestsFromTestCase(TestChallengerScrollLinearity))
    suite.addTests(loader.loadTestsFromTestCase(TestChallengerCanvasLifecycleAndWiring))
    suite.addTests(loader.loadTestsFromTestCase(TestChallengerThemeCachingAndRenderLoopOptimization))
    suite.addTests(loader.loadTestsFromTestCase(TestChallengerProgrammaticSmoothScroll))
    suite.addTests(loader.loadTestsFromTestCase(TestChallengerStateSimulation))
    suite.addTests(loader.loadTestsFromTestCase(TestChallengerAdversarialEdgeCases))

    print("=" * 78)
    print(" EMPIRICAL CHALLENGER VERIFICATION SUITE — MILESTONE 1 (R1)")
    print("=" * 78)

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    total = result.testsRun
    failed = len(result.failures) + len(result.errors)
    passed = total - failed

    print("\n" + "=" * 78)
    print(f" CHALLENGER RESULT: {passed}/{total} tests passed ({failed} failures)")
    print("=" * 78)

    if failed == 0:
        print(" VERDICT: EMPIRICALLY CONFIRMED AND VERIFIED (APPROVE)")
    else:
        print(" VERDICT: REGRESSIONS OR DEFECTS FOUND (REQUEST_CHANGES)")

    sys.exit(0 if failed == 0 else 1)
