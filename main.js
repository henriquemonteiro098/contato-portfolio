/* ==========================================================================
   MEGλ (Lusion Style) - Interactive Three.js WebGL & Motion Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------------------------------------
     1. Custom Magnetic Smooth Cursor
     ------------------------------------------------------------------------ */
  const cursorDot = document.getElementById('cursor-dot');
  const cursorRing = document.getElementById('cursor-ring');

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
  });

  function renderCursor() {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;
    cursorRing.style.transform = `translate(${ringX}px, ${ringY}px)`;
    requestAnimationFrame(renderCursor);
  }
  requestAnimationFrame(renderCursor);

  // Hover states on links and buttons
  const interactiveElements = document.querySelectorAll('a, button, .project-card, .bento-card');
  interactiveElements.forEach((el) => {
    el.addEventListener('mouseenter', () => {
      cursorRing.style.width = '64px';
      cursorRing.style.height = '64px';
      cursorRing.style.borderColor = 'rgba(0, 255, 170, 0.7)';
      cursorRing.style.backgroundColor = 'rgba(0, 255, 170, 0.05)';
    });
    el.addEventListener('mouseleave', () => {
      cursorRing.style.width = '32px';
      cursorRing.style.height = '32px';
      cursorRing.style.borderColor = 'rgba(255, 255, 255, 0.4)';
      cursorRing.style.backgroundColor = 'transparent';
    });
  });

  /* ------------------------------------------------------------------------
     2. Three.js Background Simulation (Fluid Morphing Particle Mesh)
     ------------------------------------------------------------------------ */
  const canvas = document.getElementById('webgl-canvas');
  if (canvas && typeof THREE !== 'undefined') {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Particle Sphere Geometry (Lusion 3D Orb look)
    const particleCount = 2800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);

    const radius = 3.8;
    for (let i = 0; i < particleCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / particleCount);
      const theta = Math.sqrt(particleCount * Math.PI) * phi;

      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Particle Material with subtle cyan/white luminescence
    const material = new THREE.PointsMaterial({
      color: 0x00ffaa,
      size: 0.035,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Inner wireframe sphere for depth
    const wireGeo = new THREE.IcosahedronGeometry(2.5, 3);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.04,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wireMesh);

    // Responsive Resizing
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Mouse Interaction for 3D distortion
    let targetRotationX = 0;
    let targetRotationY = 0;
    let scrollYOffset = 0;

    window.addEventListener('mousemove', (e) => {
      const normalizedX = (e.clientX / window.innerWidth) * 2 - 1;
      const normalizedY = -(e.clientY / window.innerHeight) * 2 + 1;

      targetRotationY = normalizedX * 0.45;
      targetRotationX = -normalizedY * 0.45;
    });

    window.addEventListener('scroll', () => {
      scrollYOffset = window.scrollY * 0.0025;
    });

    // Animation Loop
    let clock = new THREE.Clock();

    function animateThree() {
      requestAnimationFrame(animateThree);
      const elapsedTime = clock.getElapsedTime();

      // Fluid rotation
      particles.rotation.y += 0.003;
      particles.rotation.x = THREE.MathUtils.lerp(particles.rotation.x, targetRotationX + scrollYOffset * 0.5, 0.05);
      particles.rotation.y = THREE.MathUtils.lerp(particles.rotation.y, targetRotationY + elapsedTime * 0.1, 0.05);

      wireMesh.rotation.y = -particles.rotation.y * 0.8;
      wireMesh.rotation.x = particles.rotation.x * 0.8;

      // Wave displacement effect
      const posAttr = geometry.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        const u = i * 3;
        const ox = originalPositions[u];
        const oy = originalPositions[u + 1];
        const oz = originalPositions[u + 2];

        // Complex sinusoidal pulse
        const wave = Math.sin(elapsedTime * 1.5 + ox * 1.8 + oy * 1.8) * 0.22;
        posAttr.array[u] = ox * (1 + wave * 0.25);
        posAttr.array[u + 1] = oy * (1 + wave * 0.25);
        posAttr.array[u + 2] = oz * (1 + wave * 0.25);
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
    }
    animateThree();
  }

  /* ------------------------------------------------------------------------
     3. 3D Tilt Effect on Project Cards
     ------------------------------------------------------------------------ */
  const tiltCards = document.querySelectorAll('[data-tilt]');
  tiltCards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -7;
      const rotateY = ((x - centerX) / centerX) * 7;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  });

  /* ------------------------------------------------------------------------
     4. Interactive Scratch Card Engine (HTML5 Canvas Scratch-to-Reveal)
     ------------------------------------------------------------------------ */
  const projectDetails = {
    'video-ia': {
      tag: 'PIPELINE TÉCNICO // CINEMATIC AI',
      title: 'Como Fazer Vídeos Bons de IA',
      link: 'https://github.com/henriquemonteiro098/como-fazer-videos-bons-de-ia',
      html: `
        <h4>🎬 Arquitetura da Metodologia</h4>
        <p>Desenvolvimento de um framework completo para produção de cinema digital com IA, eliminando anomalias e alucinações de movimento.</p>
        <h4>🛠️ O que foi construído nos bastidores:</h4>
        <ul>
          <li><strong>Direção de Fotografia Sintética:</strong> Calibração de anamorphic lenses (2.39:1), ISO, obturador e iluminação de 3 pontos em prompts estruturados.</li>
          <li><strong>Pipeline Multi-Modelos:</strong> Integração de Higgsfield CLI, Kling Diffusion e scripts em Python para interpolação de quadros e consistência de personagens.</li>
          <li><strong>Engenharia de Prompt Avançada:</strong> Estruturação com tags semânticas, seeds controladas e eliminação de artefatos temporais.</li>
        </ul>
      `
    },
    'fraude-cartao': {
      tag: 'MACHINE LEARNING // CYBERSECURITY',
      title: 'Detecção de Fraudes em Cartão',
      link: 'https://github.com/henriquemonteiro098/deteccao-fraudes-cartao',
      html: `
        <h4>🛡️ Detecção em Tempo Real</h4>
        <p>Engenharia de dados e machine learning focado na resolução de fraudes transacionais de alta criticidade.</p>
        <h4>🛠️ Destaques da Implementação:</h4>
        <ul>
          <li><strong>Tratamento de Desbalanceamento Extremo:</strong> Uso de técnicas SMOTE / Random Undersampling para bases financeiras onde fraudes representam < 0.2%.</li>
          <li><strong>Algoritmos Aplicados:</strong> Random Forest, Regressão Logística e XGBoost com otimização focada em Área sob a Curva Precision-Recall (PR-AUC).</li>
          <li><strong>Mitigação de Falsos Positivos:</strong> Ajuste fino de thresholds de decisão para garantir máxima proteção sem bloquear compras legítimas.</li>
        </ul>
      `
    },
    'assistente-ia': {
      tag: 'AUTONOMOUS AGENTS // NLP PIPELINES',
      title: 'Assistente Virtual com IA',
      link: 'https://github.com/henriquemonteiro098/assistente-virtual-ia',
      html: `
        <h4>🤖 Inteligência Autônoma em Python</h4>
        <p>Criação de um assistente virtual capaz de interpretar comandos complexos em linguagem natural e orquestrar tarefas locais no sistema operacional.</p>
        <h4>🛠️ Capacidades do Sistema:</h4>
        <ul>
          <li><strong>Processamento de Linguagem Natural:</strong> Conexão com modelos LLM para raciocínio contextual e extração de entidades de comando.</li>
          <li><strong>Tool Calling & Execução:</strong> Automação de rotinas em Shell/Python, buscas na web e controle de produtividade.</li>
          <li><strong>Memória de Sessão:</strong> Manutenção de histórico de conversação com baixo consumo de memória e latência minimizada.</li>
        </ul>
      `
    },
    'banco-ficticio': {
      tag: 'FULL STACK & DATABASE // ACID SIMULATION',
      title: 'Banco Fictício — Fintech Simulation',
      link: 'https://github.com/henriquemonteiro098/projects',
      html: `
        <h4>💳 Plataforma Bancária Resiliente</h4>
        <p>Simulação completa de um ecossistema bancário digital moderno com garantias ACID e automações corporativas.</p>
        <h4>🛠️ Tecnologias e Camadas:</h4>
        <ul>
          <li><strong>Camada de Dados Relacional:</strong> PostgreSQL estruturado com PL/pgSQL, triggers de validação de saldo e integridade transacional concorrente.</li>
          <li><strong>Regras de Negócio:</strong> Aplicação em JavaScript e Python gerenciando abertura de contas, transferências e histórico de extratos.</li>
          <li><strong>Automação de Infraestrutura:</strong> Shell Scripts para rotinas de backup, testes de concorrência e deploy ágil.</li>
        </ul>
      `
    },
    'katana-ai': {
      tag: 'CREATIVE TECH // 4K VISUAL STORYTELLING',
      title: 'MEGλ Creative & AI Direction',
      link: 'https://github.com/henriquemonteiro098',
      html: `
        <h4>⚡ Fusão entre Arte, Código e Cinema</h4>
        <p>Pesquisa visual de vanguarda que dá vida à identidade <strong>MEGλ ($A=\lambda$)</strong>.</p>
        <h4>🛠️ Bastidores da Criação:</h4>
        <ul>
          <li><strong>Estética Neo-Noir:</strong> Inspiração em diretores lendários (Wong Kar-Wai, Denis Villeneuve) fundidos com visual cyberpunk industrial.</li>
          <li><strong>Renderização & Motion:</strong> Geração de assets em resolução 2K/4K com texturização fina e iluminação volumétrica.</li>
          <li><strong>Design System Fluido:</strong> Aplicação dos conceitos da Lusion.co para transformar tecnologia em experiência imersiva.</li>
        </ul>
      `
    }
  };

  const scratchModal = document.getElementById('scratch-modal');
  const scratchCloseBtn = document.getElementById('scratch-modal-close');
  const scratchCanvas = document.getElementById('scratch-canvas');
  const secretTag = document.getElementById('secret-tag');
  const secretTitle = document.getElementById('secret-title');
  const secretBody = document.getElementById('secret-body');
  const secretLink = document.getElementById('secret-link');
  const revealAllBtn = document.getElementById('scratch-reveal-all');

  let ctx = null;
  let isScratching = false;

  function initScratchFoil() {
    if (!scratchCanvas) return;
    const rect = scratchCanvas.getBoundingClientRect();
    scratchCanvas.width = rect.width;
    scratchCanvas.height = rect.height;

    ctx = scratchCanvas.getContext('2d');
    
    // Draw Metallic Holographic Scratch Foil
    const grad = ctx.createLinearGradient(0, 0, scratchCanvas.width, scratchCanvas.height);
    grad.addColorStop(0, '#2c333f');
    grad.addColorStop(0.3, '#455062');
    grad.addColorStop(0.5, '#6a7891');
    grad.addColorStop(0.7, '#455062');
    grad.addColorStop(1, '#1e242d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, scratchCanvas.width, scratchCanvas.height);

    // Decorative holographic pattern
    ctx.strokeStyle = 'rgba(0, 255, 170, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < scratchCanvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 40, scratchCanvas.height);
      ctx.stroke();
    }

    // Centered instruction badge on the scratch foil
    ctx.fillStyle = '#0a0d12';
    const boxW = 280;
    const boxH = 50;
    const boxX = (scratchCanvas.width - boxW) / 2;
    const boxY = (scratchCanvas.height - boxH) / 2;
    ctx.roundRect ? ctx.roundRect(boxX, boxY, boxW, boxH, 25) : ctx.rect(boxX, boxY, boxW, boxH);
    ctx.fill();

    ctx.strokeStyle = '#00ffaa';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#00ffaa';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ RASPE AQUI COM O MOUSE ⚡', scratchCanvas.width / 2, scratchCanvas.height / 2 + 5);
  }

  function scratch(x, y) {
    if (!ctx) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  function handleScratchMove(e) {
    if (!isScratching) return;
    const rect = scratchCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    scratch(x, y);
  }

  if (scratchCanvas) {
    scratchCanvas.addEventListener('mousedown', (e) => {
      isScratching = true;
      handleScratchMove(e);
    });
    scratchCanvas.addEventListener('mousemove', handleScratchMove);
    window.addEventListener('mouseup', () => { isScratching = false; });

    // Touch events for mobile/tablet
    scratchCanvas.addEventListener('touchstart', (e) => {
      isScratching = true;
      handleScratchMove(e);
    }, { passive: true });
    scratchCanvas.addEventListener('touchmove', handleScratchMove, { passive: true });
    window.addEventListener('touchend', () => { isScratching = false; });
  }

  // Open Scratch Modal for Specific Project
  document.querySelectorAll('.btn-scratch-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const projKey = btn.getAttribute('data-project');
      const data = projectDetails[projKey];
      if (!data) return;

      secretTag.textContent = data.tag;
      secretTitle.textContent = data.title;
      secretBody.innerHTML = data.html;
      secretLink.href = data.link;

      scratchModal.classList.add('active');
      setTimeout(initScratchFoil, 50);
    });
  });

  // Close Modal
  if (scratchCloseBtn) {
    scratchCloseBtn.addEventListener('click', () => {
      scratchModal.classList.remove('active');
    });
  }

  scratchModal.addEventListener('click', (e) => {
    if (e.target === scratchModal) {
      scratchModal.classList.remove('active');
    }
  });

  // Reveal All button
  if (revealAllBtn) {
    revealAllBtn.addEventListener('click', () => {
      if (ctx && scratchCanvas) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(0, 0, scratchCanvas.width, scratchCanvas.height);
      }
    });
  }

  /* ------------------------------------------------------------------------
     4. Ambient Sound Synthesizer (Web Audio API)
     ------------------------------------------------------------------------ */
  const soundToggle = document.getElementById('sound-toggle');
  let audioCtx = null;
  let isSoundActive = false;
  let oscNodes = [];

  soundToggle.addEventListener('click', () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (!isSoundActive) {
      // Play deep ambient sine drone chord
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const freqs = [55, 110, 164.81]; // A1, A2, E3 ambient harmonic drone
      oscNodes = freqs.map((freq) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.035, audioCtx.currentTime + 2.5);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();

        return { osc, gain };
      });

      isSoundActive = true;
      soundToggle.classList.add('playing');
    } else {
      // Fade out
      oscNodes.forEach(({ osc, gain }) => {
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);
        setTimeout(() => osc.stop(), 1300);
      });
      oscNodes = [];
      isSoundActive = false;
      soundToggle.classList.remove('playing');
    }
  });

  /* ------------------------------------------------------------------------
     5. Video Reel Play / Pause Controller
     ------------------------------------------------------------------------ */
  const video = document.getElementById('main-reel-video');
  const playBtn = document.getElementById('video-play-btn');

  if (video && playBtn) {
    playBtn.addEventListener('click', () => {
      if (video.paused) {
        video.play();
        playBtn.querySelector('.play-text').textContent = 'PAUSAR REEL';
        playBtn.querySelector('.play-icon').textContent = '⏸';
      } else {
        video.pause();
        playBtn.querySelector('.play-text').textContent = 'ASSISTIR REEL';
        playBtn.querySelector('.play-icon').textContent = '▶';
      }
    });
  }

  /* ------------------------------------------------------------------------
     6. GSAP Scroll Animations & Lusion Line Reveals
     ------------------------------------------------------------------------ */
  if (typeof gsap !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    gsap.from('.hero-title .line', {
      duration: 1.2,
      y: 60,
      opacity: 0,
      stagger: 0.15,
      ease: 'power4.out',
    });

    gsap.from('.hero-footer', {
      duration: 1,
      y: 30,
      opacity: 0,
      delay: 0.6,
      ease: 'power3.out',
    });

    // Lusion Project Items & Scroll Lines Reveal
    document.querySelectorAll('.lusion-project-item').forEach((item) => {
      const lineTrack = item.querySelector('.line-track');
      const card = item.querySelector('.lusion-card');

      if (lineTrack) {
        gsap.fromTo(lineTrack, 
          { scaleY: 0.1, transformOrigin: 'top center' },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: item,
              start: 'top 85%',
              end: 'bottom 50%',
              scrub: 1,
            }
          }
        );
      }

      if (card) {
        gsap.fromTo(card,
          { y: 50, opacity: 0.35, scale: 0.98 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: item,
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            }
          }
        );
      }
    });
  }

});
