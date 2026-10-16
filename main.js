/* ==========================================================================
   MEGλ Studio - Dual-Mode Theme, RGB Chromatic Engine & iOS Navigation
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');

  // ── 1. Theme Controller (Magic UI AnimatedThemeToggler - Star Variant) ──
  const savedTheme = localStorage.getItem('jh_theme') || 'light';
  let isDarkTheme = savedTheme === 'dark';
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
    isDarkTheme = theme === 'dark';
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

  // ── 4. Hero Dynamic Scroll-To-Explore Fade Out ─────────────────────────
  const heroScrollIndicator = document.getElementById('hero-scroll-indicator');
  if (heroScrollIndicator) {
    function handleScrollIndicatorFade() {
      const scrollY = window.scrollY;
      const opacity = Math.max(0, 1 - scrollY / 130);
      heroScrollIndicator.style.opacity = opacity.toFixed(2);
      heroScrollIndicator.style.transform = `translateX(-50%) translateY(${Math.min(scrollY * 0.25, 25)}px)`;
      if (opacity <= 0) {
        heroScrollIndicator.style.visibility = 'hidden';
      } else {
        heroScrollIndicator.style.visibility = 'visible';
      }
    }

    window.addEventListener('scroll', handleScrollIndicatorFade, { passive: true });
    handleScrollIndicatorFade();
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

    const notifTarget = document.getElementById('life-hub-notifications') || notifContainer;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let notifIntervalId = null;
    let isNotifInView = false;

    function startNotifInterval() {
      if (!notifIntervalId && !prefersReducedMotion && isNotifInView && !document.hidden) {
        notifIntervalId = setInterval(pushNextNotification, 2800);
      }
    }

    function stopNotifInterval() {
      if (notifIntervalId) {
        clearInterval(notifIntervalId);
        notifIntervalId = null;
      }
    }

    if (notifTarget && !prefersReducedMotion) {
      const notifObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          isNotifInView = entry.isIntersecting;
          if (isNotifInView) {
            startNotifInterval();
          } else {
            stopNotifInterval();
          }
        });
      }, { threshold: 0.1 });

      notifObserver.observe(notifTarget);

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          stopNotifInterval();
        } else if (isNotifInView) {
          startNotifInterval();
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
     6. MAGIC UI SKILLS MARQUEE (FORMAÇÕES & HABILIDADES)
     O carrossel vertical de habilidades técnicas é gerenciado via CSS Animations
     com suporte a aceleração por hardware (GPU) e pausa em hover.
     -------------------------------------------------------------------------- */

  /* --------------------------------------------------------------------------
     7. MAGIC UI ANIMATED BEAM ENGINE (LIFE HUB)
     -------------------------------------------------------------------------- */
  const beamContainer = document.getElementById('lifehub-beam-container');
  const beamSvg = document.getElementById('lifehub-beam-svg');
  const pathsGroup = document.getElementById('lifehub-beam-paths');
  const coreNode = document.getElementById('beam-node-core');
  const floatingTooltip = document.getElementById('beam-floating-tooltip');

  if (beamContainer && beamSvg && pathsGroup && coreNode) {
    const connections = [
      { id: 'beam-node-drive', curvature: -40, endYOffset: -6, reverse: false },
      { id: 'beam-node-notion', curvature: 0, endYOffset: 0, reverse: false },
      { id: 'beam-node-whatsapp', curvature: 40, endYOffset: 6, reverse: false },
      { id: 'beam-node-docs', curvature: -40, endYOffset: -6, reverse: true },
      { id: 'beam-node-zapier', curvature: 0, endYOffset: 0, reverse: true },
      { id: 'beam-node-alerts', curvature: 40, endYOffset: 6, reverse: true }
    ];

    const pathElements = new Map();

    function createOrUpdatePaths() {
      const containerRect = beamContainer.getBoundingClientRect();
      if (containerRect.width === 0 || containerRect.height === 0) return;

      const coreRect = coreNode.getBoundingClientRect();
      const coreCenterX = coreRect.left - containerRect.left + coreRect.width / 2;
      const coreCenterY = coreRect.top - containerRect.top + coreRect.height / 2;

      connections.forEach((conn, index) => {
        const nodeEl = document.getElementById(conn.id);
        if (!nodeEl) return;

        const nodeRect = nodeEl.getBoundingClientRect();
        const nodeCenterX = nodeRect.left - containerRect.left + nodeRect.width / 2;
        const nodeCenterY = nodeRect.top - containerRect.top + nodeRect.height / 2;

        let startX, startY, endX, endY, curvature;
        if (!conn.reverse) {
          startX = nodeCenterX;
          startY = nodeCenterY;
          endX = coreCenterX;
          endY = coreCenterY + conn.endYOffset;
          curvature = conn.curvature;
        } else {
          startX = coreCenterX;
          startY = coreCenterY + conn.endYOffset;
          endX = nodeCenterX;
          endY = nodeCenterY;
          curvature = -conn.curvature;
        }

        const controlX = (startX + endX) / 2;
        const controlY = (startY + endY) / 2 + curvature;
        const d = `M ${startX.toFixed(1)},${startY.toFixed(1)} Q ${controlX.toFixed(1)},${controlY.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`;

        let elements = pathElements.get(conn.id);
        if (!elements) {
          const trackPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          trackPath.setAttribute('class', 'beam-track');

          const photonPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          photonPath.setAttribute('class', 'beam-photon');
          photonPath.setAttribute('stroke', conn.reverse ? 'url(#beamGradOut)' : 'url(#beamGradIn)');
          photonPath.setAttribute('filter', 'url(#beamPrecisionGlow)');
          photonPath.style.animationDelay = `${index * 0.55}s`;

          pathsGroup.appendChild(trackPath);
          pathsGroup.appendChild(photonPath);

          elements = { track: trackPath, photon: photonPath };
          pathElements.set(conn.id, elements);
        }

        elements.track.setAttribute('d', d);
        elements.photon.setAttribute('d', d);
      });
    }

    // Inicialização pós-renderização
    setTimeout(createOrUpdatePaths, 50);

    // ResizeObserver para manter alinhamento dinâmico sub-pixel em qualquer tela
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(createOrUpdatePaths);
      });
      resizeObserver.observe(beamContainer);
    } else {
      window.addEventListener('resize', createOrUpdatePaths, { passive: true });
    }

    // Micro-interações e Tooltips
    const allNodes = beamContainer.querySelectorAll('.beam-circle');
    allNodes.forEach((node) => {
      const tooltipText = node.getAttribute('data-tooltip');
      const nodeId = node.id;

      function highlightOn() {
        const elements = pathElements.get(nodeId);
        if (elements) {
          elements.track.classList.add('active-highlight');
          elements.photon.classList.add('active-highlight');
        } else if (nodeId === 'beam-node-core') {
          pathElements.forEach((el) => {
            el.track.classList.add('active-highlight');
            el.photon.classList.add('active-highlight');
          });
        }

        if (floatingTooltip && tooltipText) {
          floatingTooltip.textContent = tooltipText;
          floatingTooltip.classList.add('is-visible');
        }
      }

      function highlightOff() {
        pathElements.forEach((el) => {
          el.track.classList.remove('active-highlight');
          el.photon.classList.remove('active-highlight');
        });

        if (floatingTooltip) {
          floatingTooltip.classList.remove('is-visible');
        }
      }

      node.addEventListener('mouseenter', highlightOn);
      node.addEventListener('mouseleave', highlightOff);
      node.addEventListener('focus', highlightOn);
      node.addEventListener('blur', highlightOff);
    });
  }
});
