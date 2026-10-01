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
     6. GSAP Scroll Animations
     ------------------------------------------------------------------------ */
  if (typeof gsap !== 'undefined') {
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
  }

});
