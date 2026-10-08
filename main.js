/* ==========================================================================
   MEGλ Studio - Dual-Mode Theme, RGB Chromatic Engine & iOS Navigation
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');

  // ── 1. Theme Controller (Light / Dark) ──────────────────────────────────
  const savedTheme = localStorage.getItem('jh_theme') || 'light';
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = root.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      localStorage.setItem('jh_theme', newTheme);
    });
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
  }

  // ── 2. RGB Chromatic Engine ─────────────────────────────────────────────
  const savedRgb = localStorage.getItem('jh_rgb') || 'r';
  applyRgb(savedRgb);

  function applyRgb(channel) {
    root.setAttribute('data-rgb', channel);
  }

  // ── 3. iOS Tab Navigation — Intersection Observer ────────────────────────
  const tabItems = document.querySelectorAll('.tab-item[data-section]');
  const sections = ['hero', 'pillars', 'education', 'contact'];

  const sectionEls = {};
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) sectionEls[id] = el;
  });

  let activeSection = 'hero';

  function setActiveTab(sectionId) {
    if (activeSection === sectionId) return;
    activeSection = sectionId;
    tabItems.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.section === sectionId);
    });
  }

  // Smooth carousel-style scroll
  tabItems.forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      const targetId = tab.dataset.section;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setActiveTab(targetId);
    });
  });

  const observerOptions = {
    root: null,
    threshold: [0, 0.15, 0.35, 0.5, 0.75, 1],
    rootMargin: '-80px 0px -20% 0px'
  };

  const ratioMap = {};
  sections.forEach(id => { ratioMap[id] = 0; });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.id;
      ratioMap[id] = entry.intersectionRatio;
    });

    let best = null;
    let bestRatio = -1;
    for (const id of sections) {
      if (ratioMap[id] > bestRatio) {
        bestRatio = ratioMap[id];
        best = id;
      }
    }
    if (best && bestRatio > 0) {
      setActiveTab(best);
    }
  }, observerOptions);

  Object.values(sectionEls).forEach(el => observer.observe(el));

  // ── 4. Animated Grid Pattern Background ─────────────────────────────────
  const gridSvg = document.getElementById('animated-grid-pattern');
  const squaresGroup = document.getElementById('animated-grid-squares');

  if (gridSvg && squaresGroup) {
    const squareSize = 40;
    const numSquares = 45;
    const maxOpacity = 0.45;
    const duration = 4000;
    const repeatDelay = 500;

    let cols = Math.max(1, Math.ceil(window.innerWidth / squareSize));
    let rows = Math.max(1, Math.ceil(window.innerHeight / squareSize));

    function updateGridDimensions() {
      cols = Math.max(1, Math.ceil(window.innerWidth / squareSize));
      rows = Math.max(1, Math.ceil(window.innerHeight / squareSize));
    }

    window.addEventListener('resize', updateGridDimensions, { passive: true });

    function getRandomGridPos() {
      return {
        x: Math.floor(Math.random() * cols) * squareSize + 1,
        y: Math.floor(Math.random() * rows) * squareSize + 1
      };
    }

    function createAndAnimateSquare(index) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', squareSize - 1);
      rect.setAttribute('height', squareSize - 1);
      rect.setAttribute('class', 'grid-square');
      rect.setAttribute('opacity', '0');
      squaresGroup.appendChild(rect);

      function loopAnimation(initialDelay = 0) {
        const pos = getRandomGridPos();
        rect.setAttribute('x', pos.x);
        rect.setAttribute('y', pos.y);

        const anim = rect.animate([
          { opacity: 0 },
          { opacity: maxOpacity, offset: 0.5 },
          { opacity: 0 }
        ], {
          duration: duration,
          delay: initialDelay,
          easing: 'ease-in-out'
        });

        anim.onfinish = () => {
          setTimeout(() => {
            loopAnimation(0);
          }, repeatDelay);
        };
      }

      loopAnimation(index * 100);
    }

    for (let i = 0; i < numSquares; i++) {
      createAndAnimateSquare(i);
    }
  }
});
