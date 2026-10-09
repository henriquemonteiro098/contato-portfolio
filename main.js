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

  // ── 4. Magic UI InteractiveGridPattern Background ───────────────────────
  const gridSvg = document.getElementById('interactive-grid-pattern') || document.getElementById('animated-grid-pattern');
  const hoverSquaresGroup = document.getElementById('interactive-grid-hover-squares');
  const ambientSquaresGroup = document.getElementById('animated-grid-squares');

  if (gridSvg) {
    const squareSize = 40;
    const maxAmbientSquares = 35;
    const maxOpacity = 0.40;
    const duration = 4000;
    const repeatDelay = 500;

    let cols = Math.max(1, Math.ceil(window.innerWidth / squareSize));
    let rows = Math.max(1, Math.ceil(window.innerHeight / squareSize));

    function updateGridDimensions() {
      cols = Math.max(1, Math.ceil(window.innerWidth / squareSize));
      rows = Math.max(1, Math.ceil(window.innerHeight / squareSize));
    }

    window.addEventListener('resize', updateGridDimensions, { passive: true });

    // ── Mouse & Touch Interactive Trail (Magic UI) ────────────────────────
    if (hoverSquaresGroup) {
      let lastCol = -1;
      let lastRow = -1;
      const activeSquaresMap = new Map();

      function triggerSquareAt(x, y) {
        const col = Math.floor(x / squareSize);
        const row = Math.floor(y / squareSize);

        if (col === lastCol && row === lastRow) return;
        lastCol = col;
        lastRow = row;

        const key = `${col},${row}`;
        if (activeSquaresMap.has(key)) return;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', col * squareSize + 1);
        rect.setAttribute('y', row * squareSize + 1);
        rect.setAttribute('width', squareSize - 1);
        rect.setAttribute('height', squareSize - 1);
        rect.setAttribute('class', 'interactive-hover-square');

        hoverSquaresGroup.appendChild(rect);
        activeSquaresMap.set(key, rect);

        // Magic UI decay: not-[&:hover]:duration-1000
        requestAnimationFrame(() => {
          setTimeout(() => {
            rect.classList.add('fade-out');
            setTimeout(() => {
              if (rect.parentNode) {
                rect.parentNode.removeChild(rect);
              }
              activeSquaresMap.delete(key);
            }, 1000);
          }, 120);
        });
      }

      window.addEventListener('mousemove', (e) => {
        triggerSquareAt(e.clientX, e.clientY);
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
          triggerSquareAt(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true });
    }

    // ── Ambient Background Pulse ──────────────────────────────────────────
    if (ambientSquaresGroup) {
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
        ambientSquaresGroup.appendChild(rect);

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

        loopAnimation(index * 120);
      }

      for (let i = 0; i < maxAmbientSquares; i++) {
        createAndAnimateSquare(i);
      }
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

  /* --------------------------------------------------------------------------
     6. MAGIC UI ICONCLOUD 3D (ESFERA DE TECNOLOGIAS EM FORMAÇÕES)
     -------------------------------------------------------------------------- */
  const cloudCanvas = document.getElementById('icon-cloud-canvas');
  if (cloudCanvas) {
    const slugs = [
      "typescript", "javascript", "dart", "java", "react", "flutter", "android",
      "html5", "css3", "nodedotjs", "express", "nextdotjs", "prisma", "amazonaws",
      "postgresql", "firebase", "nginx", "vercel", "testinglibrary", "jest",
      "cypress", "docker", "git", "jira", "github", "gitlab", "visualstudiocode",
      "androidstudio", "sonarqube", "figma"
    ];

    const slugMap = {
      java: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg",
      css3: "https://cdn.simpleicons.org/css",
      amazonaws: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-original-wordmark.svg",
      visualstudiocode: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vscode/vscode-original.svg",
      sonarqube: "https://cdn.simpleicons.org/sonar"
    };

    const numIcons = slugs.length;
    const ctx = cloudCanvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const LOGICAL_WIDTH = 440;
    const LOGICAL_HEIGHT = 440;

    cloudCanvas.width = LOGICAL_WIDTH * dpr;
    cloudCanvas.height = LOGICAL_HEIGHT * dpr;

    // Configurações da esfera
    const SPHERE_RADIUS = 132;
    const offset = 2 / numIcons;
    const increment = Math.PI * (3 - Math.sqrt(5)); // Golden angle (~2.39996 rad)
    const iconPositions = [];

    for (let i = 0; i < numIcons; i++) {
      const y = i * offset - 1 + offset / 2;
      const r = Math.sqrt(1 - y * y);
      const phi = i * increment;
      const x = Math.cos(phi) * r;
      const z = Math.sin(phi) * r;

      iconPositions.push({
        x: x * SPHERE_RADIUS,
        y: y * SPHERE_RADIUS,
        z: z * SPHERE_RADIUS,
        slug: slugs[i],
        id: i
      });
    }

    // Carregamento de imagens
    const iconImages = [];
    const imagesLoaded = new Array(numIcons).fill(false);

    slugs.forEach((slug, idx) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = slugMap[slug] || `https://cdn.simpleicons.org/${slug}`;
      img.onload = () => {
        imagesLoaded[idx] = true;
      };
      img.onerror = () => {
        imagesLoaded[idx] = false;
      };
      iconImages.push(img);
    });

    // Estado de rotação e interatividade
    let rotation = { x: 0.15, y: 0.15 };
    let isDragging = false;
    let lastPointerPos = { x: 0, y: 0 };
    let mousePos = { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 };
    let isMouseOver = false;
    let hoveredIcon = null;
    let targetRotation = null;

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function getLogicalCoords(e) {
      const rect = cloudCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: ((clientX - rect.left) / rect.width) * LOGICAL_WIDTH,
        y: ((clientY - rect.top) / rect.height) * LOGICAL_HEIGHT,
        clientX,
        clientY
      };
    }

    // Interações de Mouse
    cloudCanvas.addEventListener('mousedown', (e) => {
      const coords = getLogicalCoords(e);
      isDragging = true;
      lastPointerPos = { x: coords.clientX, y: coords.clientY };

      if (hoveredIcon) {
        const icon = hoveredIcon;
        const targetX = -Math.atan2(icon.y, Math.sqrt(icon.x * icon.x + icon.z * icon.z));
        const targetY = Math.atan2(icon.x, icon.z);
        const currentX = rotation.x;
        const currentY = rotation.y;
        const distance = Math.sqrt(Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2));
        const duration = Math.min(1800, Math.max(700, distance * 800));

        targetRotation = {
          x: targetX,
          y: targetY,
          startX: currentX,
          startY: currentY,
          distance,
          startTime: performance.now(),
          duration
        };
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - lastPointerPos.x;
        const deltaY = e.clientY - lastPointerPos.y;
        rotation.x += deltaY * 0.003;
        rotation.y += deltaX * 0.003;
        lastPointerPos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    cloudCanvas.addEventListener('mouseenter', () => {
      isMouseOver = true;
    });

    cloudCanvas.addEventListener('mouseleave', () => {
      isMouseOver = false;
      hoveredIcon = null;
    });

    cloudCanvas.addEventListener('mousemove', (e) => {
      const coords = getLogicalCoords(e);
      mousePos = { x: coords.x, y: coords.y };
    });

    // Suporte a Touch para Mobile
    cloudCanvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const coords = getLogicalCoords(e);
        isDragging = true;
        lastPointerPos = { x: coords.clientX, y: coords.clientY };
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - lastPointerPos.x;
        const deltaY = e.touches[0].clientY - lastPointerPos.y;
        rotation.x += deltaY * 0.004;
        rotation.y += deltaX * 0.004;
        lastPointerPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isDragging = false;
    });

    // Loop de Animação 3D
    const motionPref = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function renderCloud() {
      ctx.clearRect(0, 0, cloudCanvas.width, cloudCanvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      const centerX = LOGICAL_WIDTH / 2;
      const centerY = LOGICAL_HEIGHT / 2;
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      // Atualizar rotação
      if (targetRotation) {
        const elapsed = performance.now() - targetRotation.startTime;
        const progress = Math.min(1, elapsed / targetRotation.duration);
        const eased = easeOutCubic(progress);

        rotation.x = targetRotation.startX + (targetRotation.x - targetRotation.startX) * eased;
        rotation.y = targetRotation.startY + (targetRotation.y - targetRotation.startY) * eased;

        if (progress >= 1) {
          targetRotation = null;
        }
      } else if (!isDragging && !motionPref) {
        if (isMouseOver) {
          const dx = mousePos.x - centerX;
          const dy = mousePos.y - centerY;
          rotation.y += (dx / LOGICAL_WIDTH) * 0.006;
          rotation.x += (dy / LOGICAL_HEIGHT) * 0.006;
        } else {
          // Auto-rotação contínua e fluida
          rotation.y += 0.0028;
          rotation.x += 0.0006;
        }
      }

      const cosX = Math.cos(rotation.x);
      const sinX = Math.sin(rotation.x);
      const cosY = Math.cos(rotation.y);
      const sinY = Math.sin(rotation.y);

      // Calcular projeção de cada ícone
      let nextHovered = null;
      let minHoverDist = 26;

      const projected = iconPositions.map((icon, idx) => {
        const rotatedX = icon.x * cosY - icon.z * sinY;
        const rotatedZ = icon.x * sinY + icon.z * cosY;
        const rotatedY = icon.y * cosX + rotatedZ * sinX;

        // Perspectiva e projeção
        const cameraZ = 300;
        const scale = (rotatedZ + cameraZ) / (cameraZ + SPHERE_RADIUS * 0.4);
        const screenX = centerX + rotatedX;
        const screenY = centerY + rotatedY;
        const opacity = Math.max(0.18, Math.min(1, (rotatedZ + SPHERE_RADIUS) / (SPHERE_RADIUS * 1.8)));

        if (isMouseOver && !isDragging) {
          const dx = mousePos.x - screenX;
          const dy = mousePos.y - screenY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minHoverDist * scale && rotatedZ > 0) {
            minHoverDist = dist;
            nextHovered = icon;
          }
        }

        return {
          icon,
          idx,
          screenX,
          screenY,
          rotatedZ,
          scale,
          opacity
        };
      });

      hoveredIcon = nextHovered;

      // Z-Sorting (desenha elementos de trás para a frente)
      projected.sort((a, b) => a.rotatedZ - b.rotatedZ);

      // Renderizar itens
      projected.forEach(({ icon, idx, screenX, screenY, scale, opacity }) => {
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.scale(Math.max(0.45, scale), Math.max(0.45, scale));
        ctx.globalAlpha = opacity;

        const isCurrentHovered = hoveredIcon && hoveredIcon.id === icon.id;
        const badgeRadius = 22;

        // Pill badge backdrop
        ctx.beginPath();
        ctx.arc(0, 0, badgeRadius, 0, Math.PI * 2);

        if (isCurrentHovered) {
          ctx.fillStyle = isDark ? "rgba(0, 255, 102, 0.22)" : "rgba(0, 153, 68, 0.16)";
          ctx.strokeStyle = isDark ? "rgba(0, 255, 102, 0.85)" : "rgba(0, 153, 68, 0.8)";
          ctx.lineWidth = 2;
        } else {
          ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)";
          ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(0, 0, 0, 0.08)";
          ctx.lineWidth = 1;
        }

        if (opacity > 0.6) {
          ctx.shadowColor = isDark ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.08)";
          ctx.shadowBlur = 8;
        }

        ctx.fill();
        ctx.stroke();

        // Desenhar SVG do Ícone
        if (imagesLoaded[idx]) {
          const imgSize = 25;
          ctx.drawImage(iconImages[idx], -imgSize / 2, -imgSize / 2, imgSize, imgSize);
        } else {
          ctx.fillStyle = isDark ? "#ffffff" : "#111111";
          ctx.font = "bold 10px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(icon.slug.slice(0, 3).toUpperCase(), 0, 0);
        }

        // Nome da tecnologia no hover
        if (isCurrentHovered) {
          ctx.shadowColor = "transparent";
          ctx.fillStyle = isDark ? "#ffffff" : "#09090b";
          ctx.font = "600 11px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(icon.slug, 0, -badgeRadius - 4);
        }

        ctx.restore();
      });

      ctx.restore();
      requestAnimationFrame(renderCloud);
    }

    requestAnimationFrame(renderCloud);
  }

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
