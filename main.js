/* ==========================================================================
   MEGλ Studio - Dual-Mode Theme Controller & iOS Tab Navigation
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');

  // ── Theme ────────────────────────────────────────────────────────────────
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

  // ── iOS Tab Navigation — Intersection Observer ────────────────────────────
  const tabItems = document.querySelectorAll('.tab-item[data-section]');
  const sections = ['hero', 'pillars', 'education', 'contact'];

  // Map each section element
  const sectionEls = {};
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) sectionEls[id] = el;
  });

  // Track which section is most visible
  let activeSection = 'hero';

  function setActiveTab(sectionId) {
    if (activeSection === sectionId) return;
    activeSection = sectionId;
    tabItems.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.section === sectionId);
    });
  }

  // Smooth carousel-style scroll — prevent default anchor jump
  tabItems.forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      const targetId = tab.dataset.section;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Eagerly update active state for responsiveness
      setActiveTab(targetId);
    });
  });

  // IntersectionObserver: detect which section is in view
  const observerOptions = {
    root: null,
    // Section must be at least 35% visible to become "active"
    threshold: [0, 0.15, 0.35, 0.5, 0.75, 1],
    // Account for fixed header height
    rootMargin: '-80px 0px -20% 0px'
  };

  // Keep a score map: sectionId → intersectionRatio
  const ratioMap = {};
  sections.forEach(id => { ratioMap[id] = 0; });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.id;
      ratioMap[id] = entry.intersectionRatio;
    });

    // Pick the section with the highest ratio
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
