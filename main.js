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

  // ── 2. RGB Chromatic Engine (R → G → B Cycle) ───────────────────────────
  const rgbChannels = ['r', 'g', 'b'];
  const channelLabels = { r: 'R', g: 'G', b: 'B' };
  const savedRgb = localStorage.getItem('jh_rgb') || 'r';
  applyRgb(savedRgb);

  const titleTrigger = document.getElementById('hero-title-trigger');
  const pillTrigger = document.getElementById('rgb-pill-trigger');

  function cycleRgb() {
    const currentRgb = root.getAttribute('data-rgb') || 'r';
    const nextIndex = (rgbChannels.indexOf(currentRgb) + 1) % rgbChannels.length;
    const nextRgb = rgbChannels[nextIndex];
    applyRgb(nextRgb);
    localStorage.setItem('jh_rgb', nextRgb);

    // Micro-interação tátil/visual
    if (titleTrigger) {
      titleTrigger.style.transform = 'scale(0.985)';
      setTimeout(() => {
        titleTrigger.style.transform = '';
      }, 150);
    }
  }

  function applyRgb(channel) {
    root.setAttribute('data-rgb', channel);
    const labelEls = document.querySelectorAll('.rgb-channel-name');
    labelEls.forEach(el => {
      el.textContent = channelLabels[channel] || 'R';
    });
  }

  if (titleTrigger) {
    titleTrigger.addEventListener('click', cycleRgb);
  }
  if (pillTrigger) {
    pillTrigger.addEventListener('click', cycleRgb);
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
});
