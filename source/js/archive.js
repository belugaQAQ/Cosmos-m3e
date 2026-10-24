(() => {
  'use strict';

  const list = document.querySelector('[data-archive-list]');
  const chips = [...document.querySelectorAll('[data-archive-tags] a')];
  const form = document.querySelector('[data-archive-search]');
  if (!list) return;

  const entries = [...list.querySelectorAll('.archive-entry')];
  const years = [...list.querySelectorAll('.archive-year')];
  const input = form?.querySelector('input');
  const clear = form?.querySelector('.clear-search');
  const status = document.querySelector('.archive-status');
  const heading = document.querySelector('.index-heading h1');
  const baseTitle = heading?.firstChild?.nodeType === 3 ? heading.firstChild.nodeValue : null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let tag = '';

  function matches(entry) {
    const tags = (entry.dataset.tags || '').toLowerCase();
    const query = (input?.value || '').trim().toLowerCase();
    if (tag && !tags.split(' ').includes(tag.toLowerCase())) return false;
    if (!query) return true;
    return entry.textContent.toLowerCase().includes(query) || tags.includes(query);
  }

  function render() {
    let shown = 0;
    entries.forEach(entry => {
      const ok = matches(entry);
      entry.hidden = !ok;
      if (ok) shown += 1;
    });
    years.forEach(year => {
      year.hidden = ![...year.querySelectorAll('.archive-entry')].some(entry => !entry.hidden);
    });
    chips.forEach(chip => chip.toggleAttribute('aria-current', chip.dataset.tag === tag));
    if (heading && baseTitle !== null) heading.firstChild.nodeValue = tag ? `#${tag}` : baseTitle;
    if (clear) clear.hidden = !input.value;
    if (status) {
      // Only speak up when a filter hides everything; no running count on the page.
      status.hidden = shown !== 0;
      status.textContent = shown === 0 ? '没有匹配的文章' : '';
    }
  }

  // Tag switches use the site's own view transition, the same one cross-page navigation runs.
  function apply(options = {}) {
    if (!options.transition || reduced.matches || typeof document.startViewTransition !== 'function') {
      render();
      return;
    }
    document.startViewTransition(render);
  }

  chips.forEach(chip => {
    chip.addEventListener('click', event => {
      event.preventDefault();
      tag = chip.dataset.tag || '';
      apply({ transition: true });
      if (tag) history.replaceState(null, '', `#tag-${encodeURIComponent(tag)}`);
      else history.replaceState(null, '', location.pathname);
    });
  });

  if (input) {
    input.addEventListener('input', () => apply());
    form.addEventListener('submit', event => event.preventDefault());
    clear?.addEventListener('click', () => {
      input.value = '';
      input.focus();
      apply();
    });
  }

  const initial = decodeURIComponent(location.hash.replace(/^#tag-/, ''));
  if (initial && chips.some(chip => chip.dataset.tag === initial)) tag = initial;
  apply();

  // Entry tags link back here with a hash; keep the filter in sync without a reload.
  window.addEventListener('hashchange', () => {
    const value = decodeURIComponent(location.hash.replace(/^#tag-/, ''));
    tag = location.hash.startsWith('#tag-') && chips.some(chip => chip.dataset.tag === value) ? value : '';
    apply({ transition: true });
  });
})();
