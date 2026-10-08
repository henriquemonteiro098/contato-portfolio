/* ==========================================================================
   MEGλ Studio - Dual-Mode Theme, RGB Chromatic Engine & iOS Navigation
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');

  // ── 1. Theme Controller (Magic UI AnimatedThemeToggler - Star Variant) ──
  const savedTheme = localStorage.getItem('jh_theme') || 'light';
  applyTheme(savedTheme);

  let isThemeTransitioning = false;
  let activeThemeAnim = null;

  function cancelThemeAnim() {
    if (activeThemeAnim) {
      activeThemeAnim.cancel();
      activeThemeAnim = null;
    }
  }

  function getStarClipPaths(cx, cy, maxRadius, viewportWidth, viewportHeight) {
    const toX = (x) => `${(x / viewportWidth) * 100}%`;
    const toY = (y) => `${(y / viewportHeight) * 100}%`;
    const point = (x, y) => `${toX(x)} ${toY(y)}`;

    // Slight overscan so extreme corners of the viewport are seamlessly covered
    const R = maxRadius * Math.SQRT2 * 1.05;
    const innerRatio = 0.42;

    const starPolygon = (radius) => {
      const verts = [];
      for (let i = 0; i < 5; i++) {
        const outerA = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        verts.push(point(cx + radius * Math.cos(outerA), cy + radius * Math.sin(outerA)));
        const innerA = outerA + Math.PI / 5;
        verts.push(point(cx + radius * innerRatio * Math.cos(innerA), cy + radius * innerRatio * Math.sin(innerA)));
      }
      return `polygon(${verts.join(', ')})`;
    };

    const startR = Math.max(2, R * 0.025);
    return [starPolygon(startR), starPolygon(R)];
  }

  function toggleThemeWithStarAnimation() {
    const currentTheme = root.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof document.startViewTransition !== 'function' || prefersReducedMotion) {
      applyTheme(newTheme);
      localStorage.setItem('jh_theme', newTheme);
      return;
    }

    if (isThemeTransitioning || root.dataset.magicuiThemeVt === 'active') {
      return;
    }

    const duration = 500;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let cx = viewportWidth / 2;
    let cy = viewportHeight / 2;

    if (themeToggle) {
      const rect = themeToggle.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
    }

    const maxRadius = Math.hypot(
      Math.max(cx, viewportWidth - cx),
      Math.max(cy, viewportHeight - cy)
    );

    const clipPaths = getStarClipPaths(cx, cy, maxRadius, viewportWidth, viewportHeight);

    root.dataset.magicuiThemeVt = 'active';
    root.style.setProperty('--magicui-theme-toggle-vt-duration', `${duration}ms`);
    root.style.setProperty('--magicui-theme-vt-clip-from', clipPaths[0]);

    const cleanup = () => {
      isThemeTransitioning = false;
      delete root.dataset.magicuiThemeVt;
      root.style.removeProperty('--magicui-theme-toggle-vt-duration');
      root.style.removeProperty('--magicui-theme-vt-clip-from');
      cancelThemeAnim();
    };

    isThemeTransitioning = true;

    const transition = document.startViewTransition(() => {
      applyTheme(newTheme);
      localStorage.setItem('jh_theme', newTheme);
    });

    if (transition && transition.finished && typeof transition.finished.finally === 'function') {
      transition.finished.finally(cleanup).catch(() => {});
    } else {
      cleanup();
    }

    if (transition && transition.ready && typeof transition.ready.then === 'function') {
      transition.ready.then(() => {
        const anim = document.documentElement.animate(
          {
            clipPath: clipPaths,
          },
          {
            duration: duration,
            easing: 'linear',
            fill: 'forwards',
            pseudoElement: '::view-transition-new(root)',
          }
        );
        activeThemeAnim = anim;
      }).catch(() => {});
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', toggleThemeWithStarAnimation);
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
  const sections = ['hero', 'pillars', 'works', 'education', 'contact'];

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

  // ── 5. Magic UI AnimatedList (Life Hub Notifications) ───────────────────
  const notifContainer = document.getElementById('lifehub-animated-list');
  if (notifContainer) {
    const notificationsData = [
      {
        name: "Despensa Inteligente",
        description: "Café em grãos atingiu o estoque mínimo",
        time: "Agora",
        icon: "☕",
        color: "#00C9A7"
      },
      {
        name: "Alerta de Validade",
        description: "Laticínios vencem em 48 horas",
        time: "5m atrás",
        icon: "⏳",
        color: "#FF3D71"
      },
      {
        name: "Fatura de Assinatura",
        description: "Cobrança de streaming agendada",
        time: "15m atrás",
        icon: "💸",
        color: "#FFB800"
      },
      {
        name: "Checklist Residencial",
        description: "Ciclo de limpeza de filtros programado",
        time: "30m atrás",
        icon: "🏡",
        color: "#1E86FF"
      },
      {
        name: "Meta & Hábito",
        description: "Sequência de 14 dias de foco atingida!",
        time: "1h atrás",
        icon: "⚡",
        color: "#8B5CF6"
      }
    ];

    let notifIndex = 2;

    function pushNextNotification() {
      const item = notificationsData[notifIndex % notificationsData.length];
      notifIndex++;

      const figure = document.createElement('figure');
      figure.className = 'magic-notification-item anim-spring-enter';
      figure.innerHTML = `
        <div class="magic-notif-icon-box" style="background-color: ${item.color};">
          <span>${item.icon}</span>
        </div>
        <div class="magic-notif-content">
          <figcaption class="magic-notif-header">
            <span>${item.name}</span>
            <span class="magic-notif-sep">·</span>
            <span class="magic-notif-time">${item.time}</span>
          </figcaption>
          <p class="magic-notif-desc">${item.description}</p>
        </div>
      `;

      notifContainer.prepend(figure);

      while (notifContainer.children.length > 3) {
        notifContainer.removeChild(notifContainer.lastElementChild);
      }
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion) {
      setInterval(pushNextNotification, 2800);
    }
  }
});
