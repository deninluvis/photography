/* =============================================
   Portfolio — Jordan Vale · Mechanical Design
   main.js
   ============================================= */

// ── Crosshair cursor ──
const cx      = document.getElementById('cursor-x');
const cy      = document.getElementById('cursor-y');
const dot     = document.getElementById('cursor-dot');
const reticle = document.getElementById('cursor-reticle');

document.addEventListener('mousemove', e => {
  const x = e.clientX, y = e.clientY;
  cx.style.left      = x + 'px';  cx.style.top      = y + 'px';
  cy.style.left      = x + 'px';  cy.style.top      = y + 'px';
  dot.style.left     = x + 'px';  dot.style.top     = y + 'px';
  reticle.style.left = x + 'px';  reticle.style.top = y + 'px';
});

// Reticle expands & snaps upright on hover; returns to diamond on leave
document.querySelectorAll('a, .project-row, .btn').forEach(el => {
  el.addEventListener('mouseenter', () => {
    reticle.style.width     = '46px';
    reticle.style.height    = '46px';
    reticle.style.opacity   = '0.65';
    reticle.style.transform = 'translate(-50%,-50%) rotate(0deg)';
    dot.style.transform     = 'translate(-50%,-50%) scale(2)';
  });
  el.addEventListener('mouseleave', () => {
    reticle.style.width     = '26px';
    reticle.style.height    = '26px';
    reticle.style.opacity   = '0.38';
    reticle.style.transform = 'translate(-50%,-50%) rotate(45deg)';
    dot.style.transform     = 'translate(-50%,-50%) scale(1)';
  });
});

// ── Parallax scrolling ──
const parallaxEls = document.querySelectorAll('.parallax-bg');

window.addEventListener('scroll', () => {
  const sy = window.scrollY;
  parallaxEls.forEach(el => {
    const speed = parseFloat(el.dataset.speed) || 0.2;
    el.style.transform = `translateY(${sy * speed}px)`;
  });
}, { passive: true });

// ── Scroll reveal ──
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
