(() => {
  'use strict';

  const marks = [...document.querySelectorAll('.prose mark')];
  if (!marks.length) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!('IntersectionObserver' in window) || reduced.matches) return;

  // Opt in only when this script actually runs, so a missing/blocked script still shows solid marks.
  document.documentElement.classList.add('highlight-motion');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-shown');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.35, rootMargin: '0px 0px -8% 0px' });

  marks.forEach(mark => observer.observe(mark));

  reduced.addEventListener('change', event => {
    if (!event.matches) return;
    document.documentElement.classList.remove('highlight-motion');
    marks.forEach(mark => mark.classList.add('is-shown'));
  });
})();
