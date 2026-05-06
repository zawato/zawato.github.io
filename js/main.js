// ========================================
// Typing Animation
// ========================================

const phrases = [
  'Data Scientist',
  'Programmer',
  'Blog Writer',
  'Problem Solver',
];

let phraseIndex = 0;
let charIndex   = 0;
let isDeleting  = false;
const typedEl   = document.getElementById('typedText');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function typeLoop() {
  if (!typedEl) return;

  if (reducedMotion) {
    typedEl.textContent = phrases[0];
    return;
  }

  const current = phrases[phraseIndex];

  if (isDeleting) {
    typedEl.textContent = current.slice(0, charIndex--);
    if (charIndex < 0) {
      isDeleting  = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      setTimeout(typeLoop, 400);
      return;
    }
    setTimeout(typeLoop, 55);
  } else {
    typedEl.textContent = current.slice(0, charIndex++);
    if (charIndex > current.length) {
      isDeleting = true;
      setTimeout(typeLoop, 1800);
      return;
    }
    setTimeout(typeLoop, 95);
  }
}

setTimeout(typeLoop, 600);

// ========================================
// Counter Animation (IntersectionObserver)
// ========================================

function animateCount(el, target, duration) {
  duration = duration || 1000;
  if (reducedMotion) {
    el.textContent = target;
    return;
  }
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(function () {
    start += step;
    if (start >= target) {
      el.textContent = target;
      clearInterval(timer);
    } else {
      el.textContent = Math.floor(start);
    }
  }, 16);
}

const statValues = document.querySelectorAll('.stat-value');
let counted = false;

if (statValues.length) {
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !counted) {
        counted = true;
        statValues.forEach(function (el) {
          const target = parseInt(el.getAttribute('data-target') || '0', 10);
          animateCount(el, target);
        });
      }
    });
  }, { threshold: 0.5 });

  observer.observe(statValues[0].closest('.stats-section') || statValues[0]);
}
