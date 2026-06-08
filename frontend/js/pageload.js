/**
 * pageload.js — MedPrice Cinematic Page Entry System v2
 *
 * More visible, dramatic animations across ALL pages:
 *  1. Full-screen branded splash (once per session) — bigger, bolder
 *  2. Dramatic hero text shimmer on index.html
 *  3. Card entrance: 3D flip-up (not just fade)
 *  4. Smooth page-exit fade when navigating
 *  5. Scroll-triggered reveal with stagger and blur clear
 *  6. Glowing scan-line sweep effect on cards after reveal
 *  7. Dynamic gradient mesh animation behind page content
 */

(function () {
  'use strict';

  // ── 1. Global styles ────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* ── Body fade-in ── */
    @keyframes pageEnter {
      from { opacity: 0; transform: translateY(16px) scale(0.99); filter: blur(4px); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    filter: blur(0);  }
    }

    /* ── Splash ── */
    #mp-splash {
      position: fixed; inset: 0; z-index: 9999;
      background: radial-gradient(ellipse at 60% 40%, #0d1a12 0%, #0a0e14 100%);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
      transition: opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1);
    }
    #mp-splash.hide { opacity: 0; transform: scale(1.04) translateY(-16px); pointer-events: none; }

    /* Animated logo ring — two rings, different speeds */
    .splash-rings { position: relative; width: 90px; height: 90px; margin-bottom: 8px; }
    .splash-ring {
      position: absolute; inset: 0; border-radius: 50%;
      border: 2.5px solid transparent; border-top-color: #00e676;
      animation: splashSpin 900ms linear infinite;
    }
    .splash-ring.outer {
      inset: -14px; border-top-color: transparent; border-right-color: rgba(0,184,212,0.5);
      animation-duration: 1600ms; animation-direction: reverse;
    }
    .splash-logo-center {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Space Grotesk', sans-serif; font-size: 1.1rem; font-weight: 800;
      color: #fff; letter-spacing: -0.02em;
    }
    .splash-logo-center span { color: #00e676; }
    @keyframes splashSpin { to { transform: rotate(360deg); } }

    .splash-wordmark {
      font-family: 'Space Grotesk', sans-serif; font-size: 2.4rem; font-weight: 800;
      color: #fff; letter-spacing: -0.04em;
      animation: splashWord 400ms 200ms both cubic-bezier(0.16,1,0.3,1);
    }
    .splash-wordmark span { color: #00e676; text-shadow: 0 0 20px rgba(0,230,118,0.5); }
    @keyframes splashWord {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .splash-tagline {
      font-size: 0.78rem; color: rgba(255,255,255,0.3);
      letter-spacing: 0.18em; text-transform: uppercase;
      animation: splashWord 400ms 500ms both cubic-bezier(0.16,1,0.3,1);
    }

    /* Progress beam */
    .splash-beam {
      position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
      background: rgba(255,255,255,0.04); overflow: hidden;
    }
    .splash-beam-fill {
      height: 100%;
      background: linear-gradient(90deg, transparent, #00e676 20%, #00b8d4 80%, transparent);
      width: 0%; transition: width 700ms cubic-bezier(0.25,1,0.5,1);
    }

    /* ── 3D card entrance ── */
    @keyframes cardFlipUp {
      from { opacity: 0; transform: perspective(600px) rotateX(12deg) translateY(28px); filter: blur(3px); }
      to   { opacity: 1; transform: perspective(600px) rotateX(0deg)  translateY(0);   filter: blur(0); }
    }

    .reveal-item {
      opacity: 0;
      animation: none;
    }
    .reveal-item.visible {
      animation: cardFlipUp 550ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    /* ── Hero text shimmer (home page) ── */
    @keyframes heroShimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    .hero h1 em {
      background: linear-gradient(90deg, #00e676 0%, #00b8d4 30%, #ffffff 50%, #00e676 70%, #00b8d4 100%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: heroShimmer 3.5s linear infinite;
      display: inline;
    }

    /* ── Scan-line sweep on cards after reveal ── */
    @keyframes scanSweep {
      from { top: -100%; }
      to   { top: 120%; }
    }
    .card-scan-wrap { position: relative; overflow: hidden; }
    .card-scan-wrap::after {
      content: '';
      position: absolute; left: 0; right: 0; height: 40%;
      background: linear-gradient(180deg, transparent 0%, rgba(0,230,118,0.04) 50%, transparent 100%);
      top: -100%;
      animation: scanSweep 1.4s ease-out forwards;
      pointer-events: none;
    }

    /* ── Page exit ── */
    body.page-exit {
      opacity: 0;
      transform: scale(0.99) translateY(-6px);
      filter: blur(2px);
      transition: all 280ms cubic-bezier(0.4, 0, 1, 1);
    }

    /* ── Gradient mesh background ── */
    body::before {
      content: '';
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background:
        radial-gradient(ellipse 70% 40% at 80% 10%, rgba(0,230,118,0.04) 0%, transparent 70%),
        radial-gradient(ellipse 50% 30% at 10% 80%, rgba(0,184,212,0.04) 0%, transparent 70%),
        radial-gradient(ellipse 40% 50% at 50% 50%, rgba(167,139,250,0.02) 0%, transparent 70%);
      animation: meshPulse 12s ease-in-out infinite alternate;
    }
    @keyframes meshPulse {
      from { opacity: 0.6; }
      to   { opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // ── 2. Splash screen (once per session) ───────────────────────────────────
  const splashShown = sessionStorage.getItem('mp_splash_v2');
  if (!splashShown) {
    const splash = document.createElement('div');
    splash.id = 'mp-splash';
    splash.innerHTML = `
      <div class="splash-rings">
        <div class="splash-ring outer"></div>
        <div class="splash-ring"></div>
        <div class="splash-logo-center">Med<span>P</span></div>
      </div>
      <div class="splash-wordmark">Med<span>Price</span></div>
      <div class="splash-tagline">Healthcare Price Intelligence · India</div>
      <div class="splash-beam"><div class="splash-beam-fill" id="splash-fill"></div></div>
    `;
    document.body.appendChild(splash);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById('splash-fill').style.width = '100%';
    }));

    setTimeout(() => {
      splash.classList.add('hide');
      sessionStorage.setItem('mp_splash_v2', '1');
      setTimeout(() => splash.remove(), 650);
    }, 1100);
  }

  // ── 3. Body entrance animation ────────────────────────────────────────────
  document.body.style.animation = 'pageEnter 500ms cubic-bezier(0.16,1,0.3,1) both';

  // ── 4. Staggered card reveal with 3D flip-up ─────────────────────────────
  function initReveal() {
    const selectors = [
      '.card', '.stat-card', '.proc-card', '.hosp-nearby-card',
      '.proc-insight-card', '.similar-card', '.category-card',
      '.ql-card', '.rank-row', '.avg-row', '.hosp-row', '.bar-row'
    ];
    const targets = document.querySelectorAll(selectors.join(', '));

    if (!('IntersectionObserver' in window)) {
      targets.forEach(el => { el.classList.add('reveal-item', 'visible'); });
      return;
    }

    targets.forEach((el, i) => {
      el.classList.add('reveal-item');
      el.style.animationDelay = Math.min(i % 8 * 65, 420) + 'ms';
    });

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Add scan-line sweep to card elements only
          if (entry.target.classList.contains('card') ||
              entry.target.classList.contains('proc-card') ||
              entry.target.classList.contains('stat-card')) {
            entry.target.classList.add('card-scan-wrap');
          }
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });

    targets.forEach(el => io.observe(el));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }

  // ── 5. Page-exit transition ───────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') ||
        href.startsWith('mailto') || link.target === '_blank') return;
    e.preventDefault();
    document.body.classList.add('page-exit');
    setTimeout(() => { window.location.href = href; }, 290);
  });

  // ── 6. Hero particle constellation (home page) ───────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'hero-particles';
    canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;';
    hero.style.position = 'relative';
    hero.insertBefore(canvas, hero.firstChild);

    const ctx = canvas.getContext('2d');
    let W, H, pts, raf;
    const N = 70;

    function resize() {
      W = canvas.width  = hero.offsetWidth;
      H = canvas.height = hero.offsetHeight;
    }

    function init() {
      pts = Array.from({ length: N }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 0.5,
        c: Math.random() > 0.5 ? '0,230,118' : '0,184,212'
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,230,118,${(1 - d / 130) * 0.22})`;
            ctx.lineWidth   = 1;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, pts[i].r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pts[i].c},0.7)`;
        ctx.fill();
        pts[i].x += pts[i].vx; pts[i].y += pts[i].vy;
        if (pts[i].x < 0 || pts[i].x > W) pts[i].vx *= -1;
        if (pts[i].y < 0 || pts[i].y > H) pts[i].vy *= -1;
      }
      raf = requestAnimationFrame(draw);
    }

    resize(); init(); draw();
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { cancelAnimationFrame(raf); resize(); init(); draw(); }, 200);
    });
  });

})();
