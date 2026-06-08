$(document).ready(function() {
  // ── 1. Navbar Glassmorphism Scroll Handler ──
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    let ticking = false;
    window.addEventListener('scroll', function() {
      if (!ticking) {
        window.requestAnimationFrame(function() {
          if (window.scrollY > 20) {
            navbar.classList.add('navbar-scroll-active');
          } else {
            navbar.classList.remove('navbar-scroll-active');
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // ── 2. Stat Counter Observer ──
  const statNumbers = document.querySelectorAll('.stat-value');
  
  function triggerCounterAnimation(target) {
    const text = target.innerText.trim();
    if (text === '–' || text === '') return;
    
    let cleanText = text.replace(/,/g, '').replace(/₹/g, '').replace(/x/g, '').replace(/%/g, '');
    let targetValue = parseFloat(cleanText);
    
    if (!isNaN(targetValue) && targetValue > 0) {
      let startValue = 0;
      let duration = 1200; // ms
      let startTime = null;

      function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        let progress = currentTime - startTime;
        let currentVal = Math.min(
          startValue + (progress / duration) * targetValue,
          targetValue
        );

        if (text.includes('₹')) {
          target.innerText = '₹' + Math.round(currentVal).toLocaleString('en-IN');
        } else if (text.includes('x')) {
          target.innerText = currentVal.toFixed(1) + 'x';
        } else if (text.includes('%')) {
          target.innerText = Math.round(currentVal) + '%';
        } else {
          target.innerText = Math.round(currentVal).toLocaleString('en-IN');
        }

        if (progress < duration) {
          requestAnimationFrame(animate);
        } else {
          target.innerText = text; // restore exact formatting
        }
      }
      requestAnimationFrame(animate);
    }
  }

  if (statNumbers.length > 0 && 'IntersectionObserver' in window) {
    const countObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          triggerCounterAnimation(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    statNumbers.forEach(num => {
      // If statistics are already loaded, animate immediately
      if (num.innerText !== '–' && num.innerText !== '') {
        countObserver.observe(num);
      } else {
        // Observe mutations (AJAX stats loading)
        const mutationObserver = new MutationObserver((mutationsList) => {
          for (let mutation of mutationsList) {
            if (num.innerText !== '–' && num.innerText !== '') {
              triggerCounterAnimation(num);
              mutationObserver.disconnect();
            }
          }
        });
        mutationObserver.observe(num, { childList: true, characterData: true, subtree: true });
      }
    });
  }

  // ── 3. Staggered Scroll-Reveal Animations ──
  const revealElements = document.querySelectorAll('.card, .stat-card, .category-card, .ql-card, .proc-card, .proc-insight-card');
  if (revealElements.length > 0 && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-up');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });

    revealElements.forEach((el) => {
      revealObserver.observe(el);
    });
  }
});
