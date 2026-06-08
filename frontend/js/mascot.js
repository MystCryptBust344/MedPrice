/**
 * mascot.js — Pulse, the MedPrice AI Medic Bot
 *
 * Pulse is a pure CSS/SVG mascot that:
 *  - Floats as a persistent widget on every page (bottom-left corner)
 *  - Reacts to page context: idle bob, thinking spin, success bounce
 *  - Shows fun tooltips / quips when clicked
 *  - Appears in loading states (replaces the plain spinner)
 *  - Has idle ambient idle animations (blinking, antenna glow, floating)
 */

(function () {
  'use strict';

  // ── Pulse SVG definition ────────────────────────────────────────────────────
  // Built entirely from SVG primitives — no external images
  const PULSE_SVG = `
    <svg id="pulse-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100" width="80" height="100">
      <!-- Antenna -->
      <line x1="40" y1="4" x2="40" y2="18" stroke="#00e676" stroke-width="2" stroke-linecap="round"/>
      <circle id="pulse-antenna-dot" cx="40" cy="4" r="4" fill="#00e676">
        <animate attributeName="r" values="3;5;3" dur="1.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite"/>
      </circle>

      <!-- Head -->
      <rect x="14" y="18" width="52" height="42" rx="14" fill="#121824" stroke="#00e676" stroke-width="1.5"/>

      <!-- Screen glow inside head -->
      <rect x="18" y="22" width="44" height="34" rx="10" fill="rgba(0,230,118,0.04)"/>

      <!-- Eyes -->
      <g id="pulse-eyes">
        <!-- Left eye -->
        <rect id="pulse-eye-l" x="21" y="30" width="14" height="10" rx="5" fill="#00e676" opacity="0.9"/>
        <!-- Right eye -->
        <rect id="pulse-eye-r" x="45" y="30" width="14" height="10" rx="5" fill="#00e676" opacity="0.9"/>
      </g>

      <!-- Blink animation overlay (white bar that slides down) -->
      <rect id="pulse-blink-l" x="21" y="30" width="14" height="0" rx="5" fill="#121824"/>
      <rect id="pulse-blink-r" x="45" y="30" width="14" height="0" rx="5" fill="#121824"/>

      <!-- Mouth — a small curved line -->
      <path id="pulse-mouth" d="M28 50 Q40 58 52 50" fill="none" stroke="#00e676" stroke-width="2" stroke-linecap="round"/>

      <!-- Heartbeat line across forehead -->
      <polyline id="pulse-ecg"
        points="18,44 24,44 27,38 30,50 33,44 36,44 39,42 42,46 45,44 62,44"
        fill="none" stroke="#00b8d4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>

      <!-- Body -->
      <rect x="20" y="62" width="40" height="26" rx="10" fill="#121824" stroke="#00e676" stroke-width="1.5"/>

      <!-- Medical cross on body -->
      <rect x="34" y="67" width="12" height="4" rx="2" fill="#00e676" opacity="0.7"/>
      <rect x="38" y="63" width="4" height="12" rx="2" fill="#00e676" opacity="0.7"/>

      <!-- Arms -->
      <rect x="6"  y="64" width="14" height="6" rx="3" fill="#121824" stroke="#00e676" stroke-width="1.5"/>
      <rect x="60" y="64" width="14" height="6" rx="3" fill="#121824" stroke="#00e676" stroke-width="1.5"/>

      <!-- Stethoscope on left arm -->
      <circle cx="10" cy="67" r="3" fill="none" stroke="#00b8d4" stroke-width="1.5"/>
      <path d="M13 67 Q18 72 18 69" fill="none" stroke="#00b8d4" stroke-width="1.5" stroke-linecap="round"/>

      <!-- Legs -->
      <rect x="24" y="88" width="12" height="10" rx="4" fill="#121824" stroke="#00e676" stroke-width="1.5"/>
      <rect x="44" y="88" width="12" height="10" rx="4" fill="#121824" stroke="#00e676" stroke-width="1.5"/>

      <!-- Feet -->
      <ellipse cx="30" cy="98" rx="8" ry="3" fill="#00e676" opacity="0.5"/>
      <ellipse cx="50" cy="98" rx="8" ry="3" fill="#00e676" opacity="0.5"/>
    </svg>
  `;

  // ── Quips by state ─────────────────────────────────────────────────────────
  const QUIPS = {
    idle: [
      "💡 Tip: CGHS rates are the government's fair-price benchmark!",
      "🏥 I've indexed 30+ hospitals across 6 Indian cities.",
      "💰 Prices vary up to 8× between hospitals for the same surgery!",
      "🔍 Try asking me: 'How much is an MRI in Mumbai?'",
      "📊 Check the Dashboard for markup analytics!",
      "❤️ Built to make healthcare costs transparent for everyone.",
    ],
    thinking: [
      "🤔 Let me check the database…",
      "⚡ Querying CGHS benchmarks…",
      "🔬 Analysing price corridors…",
    ],
    success: [
      "✅ Found it! Compare hospitals for the best deal.",
      "🎉 Data loaded! Remember to compare before you decide.",
    ],
    error: [
      "😅 Hmm, something went sideways. Try again?",
      "🔧 My circuits are a bit confused. Retry!",
    ],
  };

  function randomQuip(state) {
    const arr = QUIPS[state] || QUIPS.idle;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ── Build the DOM widget ───────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* ── Floating mascot widget ── */
    #pulse-widget {
      position: fixed;
      bottom: 28px;
      right: 28px;
      left: auto;
      z-index: 8000;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: grab;
      user-select: none;
      transition: bottom 350ms cubic-bezier(0.16, 1, 0.3, 1),
                  right 350ms cubic-bezier(0.16, 1, 0.3, 1),
                  transform 200ms ease;
    }
    #pulse-widget:active {
      cursor: grabbing;
    }

    /* Shifted class when compare bar is active */
    #pulse-widget.compare-shifted {
      bottom: 100px;
    }

    #pulse-body {
      animation: pulseFloat 3s ease-in-out infinite;
      filter: drop-shadow(0 4px 16px rgba(0,230,118,0.25));
      transition: filter 0.3s ease, transform 0.2s ease;
    }
    #pulse-widget:hover #pulse-body {
      filter: drop-shadow(0 6px 24px rgba(0,230,118,0.5));
      transform: scale(1.08);
    }

    @keyframes pulseFloat {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-8px); }
    }

    /* Thinking state — shake */
    #pulse-body.thinking {
      animation: pulseThink 0.4s ease-in-out infinite alternate;
    }
    @keyframes pulseThink {
      from { transform: rotate(-4deg) scale(0.97); }
      to   { transform: rotate(4deg)  scale(1.02); }
    }

    /* Success state — bounce */
    #pulse-body.success {
      animation: pulseBounce 0.5s cubic-bezier(0.36,0.07,0.19,0.97) 2;
    }
    @keyframes pulseBounce {
      0%,100% { transform: translateY(0); }
      30%     { transform: translateY(-18px) scale(1.05); }
      60%     { transform: translateY(-6px);  }
    }

    /* Blink keyframe — JS triggers it by setting eye heights */
    #pulse-widget.blink #pulse-eye-l,
    #pulse-widget.blink #pulse-eye-r { height: 2px; transform-origin: center; }

    /* ── Tooltip bubble (adjusted for right-side position) ── */
    #pulse-tooltip {
      background: #121824;
      border: 1px solid rgba(0,230,118,0.3);
      border-radius: 14px 14px 4px 14px;
      padding: 10px 14px;
      font-size: 0.78rem;
      color: #e2e8f0;
      max-width: 210px;
      text-align: left;
      line-height: 1.5;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5), 0 0 12px rgba(0,230,118,0.1);
      pointer-events: none;
      opacity: 0;
      transform: translateY(6px) scale(0.95);
      transition: opacity 300ms ease, transform 300ms cubic-bezier(0.16,1,0.3,1);
      position: absolute;
      bottom: 110px;
      right: 0;
      min-width: 180px;
    }
    #pulse-tooltip.show {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    /* ── Name tag ── */
    #pulse-name {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 0.65rem;
      font-weight: 700;
      color: rgba(0,230,118,0.6);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    /* ── Ambient background aurora on every page ── */
    #mp-aurora {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }
    .aurora-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.07;
      animation: auroraMove var(--dur, 18s) ease-in-out infinite alternate;
    }
    @keyframes auroraMove {
      from { transform: translate(0, 0) scale(1); }
      to   { transform: translate(var(--tx, 40px), var(--ty, -30px)) scale(1.1); }
    }

    /* ── Floating particles (global, lightweight) ── */
    #mp-global-canvas {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      opacity: 0.35;
    }

    /* ── Mascot loading overlay (replaces plain spinner) ── */
    .pulse-loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 3rem;
    }
    .pulse-loading-state svg { animation: pulseFloat 2s ease-in-out infinite; }
    .pulse-loading-text {
      font-size: 0.85rem;
      color: var(--text-muted);
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);

  // ── Aurora blobs (global ambient) ──────────────────────────────────────────
  function injectAurora() {
    const aurora = document.createElement('div');
    aurora.id = 'mp-aurora';
    aurora.innerHTML = `
      <div class="aurora-blob" style="width:500px;height:500px;background:#00e676;top:-150px;right:-100px;--dur:20s;--tx:-60px;--ty:40px;"></div>
      <div class="aurora-blob" style="width:380px;height:380px;background:#00b8d4;bottom:-100px;left:-80px;--dur:24s;--tx:50px;--ty:-50px;"></div>
      <div class="aurora-blob" style="width:280px;height:280px;background:#a78bfa;top:40%;left:60%;--dur:16s;--tx:-40px;--ty:30px;"></div>
    `;
    document.body.insertBefore(aurora, document.body.firstChild);
  }

  // ── Global floating particle canvas ────────────────────────────────────────
  function injectGlobalParticles() {
    const canvas = document.createElement('canvas');
    canvas.id = 'mp-global-canvas';
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    let W, H, pts, raf;
    const N = 40;

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function init() {
      pts = Array.from({ length: N }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.8 + 0.4,
        c: Math.random() > 0.5 ? '0,230,118' : '0,184,212'
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d  = Math.hypot(dx, dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,230,118,${(1 - d / 120) * 0.12})`;
            ctx.lineWidth   = 0.7;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, pts[i].r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pts[i].c},0.55)`;
        ctx.fill();
        pts[i].x += pts[i].vx;
        pts[i].y += pts[i].vy;
        if (pts[i].x < 0 || pts[i].x > W) pts[i].vx *= -1;
        if (pts[i].y < 0 || pts[i].y > H) pts[i].vy *= -1;
      }
      raf = requestAnimationFrame(draw);
    }

    resize(); init(); draw();
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      resize(); init(); draw();
    });
  }

  // ── Build Pulse widget ─────────────────────────────────────────────────────
  function buildPulse() {
    const widget = document.createElement('div');
    widget.id = 'pulse-widget';
    widget.innerHTML = `
      <div id="pulse-tooltip"></div>
      <div id="pulse-body">${PULSE_SVG}</div>
      <div id="pulse-name">Pulse</div>
    `;
    document.body.appendChild(widget);

    const $body    = widget.querySelector('#pulse-body');
    const $tooltip = widget.querySelector('#pulse-tooltip');

    // Restore saved dragging coordinates if present
    const savedPos = localStorage.getItem('pulse_mascot_pos');
    if (savedPos) {
      try {
        const pos = JSON.parse(savedPos);
        widget.style.bottom = 'auto';
        widget.style.right = 'auto';
        widget.style.left = pos.left + 'px';
        widget.style.top = pos.top + 'px';
      } catch (e) {
        localStorage.removeItem('pulse_mascot_pos');
      }
    }

    // ── Draggable Physics Logic ──
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;
    let hasMoved = false;

    const onStart = (e) => {
      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

      startX = clientX;
      startY = clientY;

      const rect = widget.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      isDragging = true;
      hasMoved = false;

      // Temporary disable CSS transitions to make dragging ultra-fluid
      widget.style.transition = 'none';

      if (e.type === 'mousedown') {
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
      } else {
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
      }
    };

    const onMove = (e) => {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();

      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

      const dx = clientX - startX;
      const dy = clientY - startY;

      if (Math.hypot(dx, dy) > 6) {
        hasMoved = true;
      }

      const newLeft = initialLeft + dx;
      const newTop = initialTop + dy;

      widget.style.bottom = 'auto';
      widget.style.right = 'auto';
      widget.style.left = newLeft + 'px';
      widget.style.top = newTop + 'px';
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;

      // Re-enable smooth transition curves
      widget.style.transition = 'bottom 350ms cubic-bezier(0.16, 1, 0.3, 1), right 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms ease';

      // Save custom coordinates
      const rect = widget.getBoundingClientRect();
      localStorage.setItem('pulse_mascot_pos', JSON.stringify({
        left: Math.round(rect.left),
        top: Math.round(rect.top)
      }));

      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    widget.addEventListener('mousedown', onStart);
    widget.addEventListener('touchstart', onStart, { passive: true });

    // ── Idle blink every 4s ──
    setInterval(() => {
      const eyeL = document.getElementById('pulse-blink-l');
      const eyeR = document.getElementById('pulse-blink-r');
      if (!eyeL) return;
      eyeL.style.height = eyeR.style.height = '10px';
      setTimeout(() => { eyeL.style.height = eyeR.style.height = '0'; }, 150);
    }, 4000);

    // ── Random idle quip every 18s ──
    let quipTimer = setTimeout(showIdleQuip, 5000);

    function showIdleQuip() {
      if (!isDragging) {
        showTooltip(randomQuip('idle'));
      }
      quipTimer = setTimeout(showIdleQuip, 18000);
    }

    function showTooltip(text) {
      $tooltip.textContent = text;
      $tooltip.classList.add('show');
      setTimeout(() => $tooltip.classList.remove('show'), 4500);
    }

    // ── Click handler ──
    widget.addEventListener('click', (e) => {
      // If user dragged the mascot, do not trigger a quip/bounce!
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      clearTimeout(quipTimer);
      showTooltip(randomQuip('idle'));
      quipTimer = setTimeout(showIdleQuip, 18000);
      // Mini bounce on click
      $body.style.animation = 'none';
      $body.offsetHeight; // reflow
      $body.classList.add('success');
      setTimeout(() => {
        $body.classList.remove('success');
        $body.style.animation = '';
      }, 1100);
    });

    // ── Automatic Compare Bar shifting ──
    const compareBar = document.getElementById('compare-bar') || document.getElementById('hosp-compare-bar');
    if (compareBar) {
      const checkOverlap = () => {
        // Only apply standard bottom-shifting if the widget has NOT been custom dragged by the user!
        if (localStorage.getItem('pulse_mascot_pos')) return;

        const isVisible = getComputedStyle(compareBar).display !== 'none';
        if (isVisible) {
          widget.classList.add('compare-shifted');
        } else {
          widget.classList.remove('compare-shifted');
        }
      };

      checkOverlap();
      const obs = new MutationObserver(checkOverlap);
      obs.observe(compareBar, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    // ── Expose global Pulse API for other scripts ──
    window.Pulse = {
      think() {
        $body.style.animation = 'none';
        $body.offsetHeight;
        $body.classList.remove('success');
        $body.classList.add('thinking');
        showTooltip(randomQuip('thinking'));
      },
      success() {
        $body.classList.remove('thinking');
        $body.style.animation = 'none';
        $body.offsetHeight;
        $body.classList.add('success');
        showTooltip(randomQuip('success'));
        setTimeout(() => {
          $body.classList.remove('success');
          $body.style.animation = '';
        }, 1100);
      },
      error() {
        $body.classList.remove('thinking');
        $body.style.animation = '';
        showTooltip(randomQuip('error'));
      },
      say(msg) { showTooltip(msg); }
    };
  }

  // ── Upgrade loading spinners to mini Pulse ─────────────────────────────────
  function upgradePulseSpinner() {
    document.querySelectorAll('.loading').forEach(el => {
      const mini = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100" width="60" height="75">
          <line x1="40" y1="4" x2="40" y2="18" stroke="#00e676" stroke-width="2" stroke-linecap="round"/>
          <circle cx="40" cy="4" r="4" fill="#00e676"><animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite"/></circle>
          <rect x="14" y="18" width="52" height="42" rx="14" fill="#121824" stroke="#00e676" stroke-width="1.5"/>
          <rect x="21" y="30" width="14" height="10" rx="5" fill="#00e676" opacity="0.9"/>
          <rect x="45" y="30" width="14" height="10" rx="5" fill="#00e676" opacity="0.9"/>
          <path d="M28 50 Q40 58 52 50" fill="none" stroke="#00e676" stroke-width="2" stroke-linecap="round"/>
          <rect x="20" y="62" width="40" height="26" rx="10" fill="#121824" stroke="#00e676" stroke-width="1.5"/>
        </svg>
      `;
      el.innerHTML = `<div class="pulse-loading-state">${mini}<div class="pulse-loading-text">Pulse is loading…</div></div>`;
    });
  }

  // ── Run everything after DOM is ready ─────────────────────────────────────
  function init() {
    injectAurora();
    injectGlobalParticles();
    buildPulse();
    upgradePulseSpinner();

    // Hook Pulse into AJAX loading states via MutationObserver
    const loader = document.getElementById('loader');
    if (loader) {
      const obs = new MutationObserver(() => {
        const visible = loader.style.display !== 'none' && !loader.hidden;
        if (visible && window.Pulse) window.Pulse.think();
        else if (!visible && window.Pulse) window.Pulse.success();
      });
      obs.observe(loader, { attributes: true, attributeFilter: ['style'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
