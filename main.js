/* ==========================================================================
   MEGλ - Interactive Three.js WebGL & Minimalist Motion Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------------------------------------
     1. Custom Magnetic Smooth Cursor
     ------------------------------------------------------------------------ */
  const cursorDot = document.getElementById('cursor-dot');
  const cursorRing = document.getElementById('cursor-ring');

  if (cursorDot && cursorRing) {
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

    // Hover states on links, buttons and interactive elements
    const interactiveElements = document.querySelectorAll('a, button, .skill-bubble');
    interactiveElements.forEach((el) => {
      el.addEventListener('mouseenter', () => {
        cursorRing.style.width = '56px';
        cursorRing.style.height = '56px';
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
  }

  /* ------------------------------------------------------------------------
     2. Three.js Background Simulation (Fluid Particle Mesh)
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

    // Particle Sphere Geometry
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

    // Particle Material
    const material = new THREE.PointsMaterial({
      color: 0x00ffaa,
      size: 0.035,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Inner wireframe sphere for subtle depth
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

      // Fluid sinusoidal vertex displacement
      const posAttr = geometry.attributes.position;
      const currentArr = posAttr.array;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const ox = originalPositions[i3];
        const oy = originalPositions[i3 + 1];
        const oz = originalPositions[i3 + 2];

        const noise =
          Math.sin(ox * 1.5 + elapsedTime * 1.2) *
          Math.cos(oy * 1.5 + elapsedTime * 1.2) *
          Math.sin(oz * 1.5 + elapsedTime * 1.2);

        const displacement = 1 + noise * 0.16;

        currentArr[i3] = ox * displacement;
        currentArr[i3 + 1] = oy * displacement;
        currentArr[i3 + 2] = oz * displacement;
      }
      posAttr.needsUpdate = true;

      // Soft rotation easing
      particles.rotation.y += (targetRotationY - particles.rotation.y) * 0.04 + 0.0015;
      particles.rotation.x += (targetRotationX - particles.rotation.x) * 0.04;
      particles.rotation.z = scrollYOffset;

      wireMesh.rotation.y = particles.rotation.y * 0.8;
      wireMesh.rotation.x = particles.rotation.x * 0.8;

      renderer.render(scene, camera);
    }
    animateThree();
  }

  /* ------------------------------------------------------------------------
     3. Ambient Sound Synthesizer (Web Audio API)
     ------------------------------------------------------------------------ */
  const soundToggle = document.getElementById('sound-toggle');
  let audioCtx = null;
  let isSoundActive = false;
  let oscNodes = [];

  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (!isSoundActive) {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }

        const freqs = [55, 110, 164.81]; // A1, A2, E3 ambient drone
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

        soundToggle.classList.add('playing');
        const soundLabel = soundToggle.querySelector('.sound-label');
        if (soundLabel) soundLabel.textContent = 'MUTE';
        isSoundActive = true;
      } else {
        if (oscNodes.length > 0) {
          oscNodes.forEach(({ osc, gain }) => {
            gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
            setTimeout(() => {
              try { osc.stop(); } catch (err) {}
            }, 850);
          });
          oscNodes = [];
        }

        soundToggle.classList.remove('playing');
        const soundLabel = soundToggle.querySelector('.sound-label');
        if (soundLabel) soundLabel.textContent = 'SOUND';
        isSoundActive = false;
      }
    });
  }

  /* ------------------------------------------------------------------------
     4. GSAP Minimalist Entrance Animations
     ------------------------------------------------------------------------ */
  if (typeof gsap !== 'undefined') {
    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    gsap.from('.hero-tag', {
      duration: 1,
      y: 20,
      opacity: 0,
      delay: 0.1,
      ease: 'power3.out',
    });

    gsap.from('.hero-title .line', {
      duration: 1.2,
      y: 50,
      opacity: 0,
      stagger: 0.15,
      delay: 0.2,
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

  /* ------------------------------------------------------------------------
     5. Interactive Magnetic Physics Bubble Carousel
     ------------------------------------------------------------------------ */
  const bubbleContainer = document.getElementById('skills-bubble-carousel');
  const bubbles = Array.from(document.querySelectorAll('.skill-bubble'));

  if (bubbleContainer && bubbles.length > 0) {
    const bubbleStates = bubbles.map((el, i) => ({
      el: el,
      baseX: 0,
      baseY: 0,
      currentX: 0,
      currentY: 0,
      targetX: 0,
      targetY: 0,
      vx: 0,
      vy: 0,
      floatPhase: (i * Math.PI * 2) / bubbles.length,
      floatSpeed: 0.025 + (i * 0.005),
      floatRadius: 8 + (i % 3) * 3,
    }));

    let mouseInContainer = false;
    let bMouseX = 0;
    let bMouseY = 0;

    bubbleContainer.addEventListener('mouseenter', () => {
      mouseInContainer = true;
    });

    bubbleContainer.addEventListener('mouseleave', () => {
      mouseInContainer = false;
      bubbleStates.forEach((b) => {
        b.targetX = 0;
        b.targetY = 0;
      });
    });

    window.addEventListener('mousemove', (e) => {
      bMouseX = e.clientX;
      bMouseY = e.clientY;
    });

    let bubbleTime = 0;
    function animateBubbles() {
      bubbleTime += 1;

      bubbleStates.forEach((b) => {
        const rect = b.el.getBoundingClientRect();
        const bubbleCenterX = rect.left + rect.width / 2;
        const bubbleCenterY = rect.top + rect.height / 2;

        const naturalX = Math.cos(bubbleTime * b.floatSpeed + b.floatPhase) * b.floatRadius;
        const naturalY = Math.sin(bubbleTime * b.floatSpeed + b.floatPhase) * b.floatRadius;

        if (mouseInContainer) {
          const dx = bMouseX - bubbleCenterX;
          const dy = bMouseY - bubbleCenterY;
          const dist = Math.hypot(dx, dy);
          const maxDist = 260;

          if (dist < maxDist && dist > 1) {
            const force = (1 - dist / maxDist);
            const repel = dist < 70 ? -1.2 : 0.8;
            b.targetX = naturalX + (dx / dist) * force * 45 * repel;
            b.targetY = naturalY + (dy / dist) * force * 45 * repel;
          } else {
            b.targetX = naturalX;
            b.targetY = naturalY;
          }
        } else {
          b.targetX = naturalX;
          b.targetY = naturalY;
        }

        const spring = 0.08;
        const friction = 0.85;

        const ax = (b.targetX - b.currentX) * spring;
        const ay = (b.targetY - b.currentY) * spring;

        b.vx = (b.vx + ax) * friction;
        b.vy = (b.vy + ay) * friction;

        b.currentX += b.vx;
        b.currentY += b.vy;

        b.el.style.transform = `translate3d(${b.currentX.toFixed(2)}px, ${b.currentY.toFixed(2)}px, 0px)`;
      });

      requestAnimationFrame(animateBubbles);
    }

    requestAnimationFrame(animateBubbles);
  }

});
