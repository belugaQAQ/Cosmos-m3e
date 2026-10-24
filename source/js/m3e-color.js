(() => {
  'use strict';

  const toggle = document.querySelector('.color-toggle');
  const dialog = document.querySelector('.color-dialog');
  const theme = document.querySelector('m3e-theme');
  if (!toggle || !dialog || !theme) return;

  const input = dialog.querySelector('input[type=color]');
  const failure = dialog.querySelector('.color-picker-error');
  const custom = dialog.querySelector('.color-custom');
  const variants = [...dialog.querySelectorAll('[data-variant]')];
  const swatches = [...dialog.querySelectorAll('[data-color]')];
  const stored = () => {
    try { return localStorage.getItem('m3e.pref.color'); } catch { return null; }
  };
  const storedVariant = () => {
    try { return localStorage.getItem('m3e.pref.variant'); } catch { return null; }
  };
  const current = () => (window.m3eSeed?.color || stored() || '#6750A4').toUpperCase();
  const morphMs = () => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--m3e-morph-duration').trim();
    const value = parseFloat(raw) || 0;
    return raw.endsWith('ms') ? value : value * 1000;
  };
  let pending = false;

  function sync() {
    const active = current();
    const preset = swatches.some(swatch => swatch.dataset.color.toUpperCase() === active);
    input.value = active.toLowerCase();
    swatches.forEach(swatch => swatch.setAttribute('aria-pressed', String(swatch.dataset.color.toUpperCase() === active)));
    const activeVariant = window.m3eSeed?.variant || storedVariant() || 'fidelity';
    variants.forEach(chip => chip.setAttribute('aria-checked', String(chip.dataset.variant === activeVariant)));
    custom.classList.toggle('has-color', !preset);
    custom.style.setProperty('--swatch', active);
    custom.setAttribute('aria-pressed', String(!preset));
  }

  function apply(value) {
    const color = String(value || '').trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(color)) return;
    if (window.m3eSeed) window.m3eSeed.color = color;
    try { localStorage.setItem('m3e.pref.color', color); } catch {}
    const root = document.documentElement;
    root.classList.add('m3e-morph');
    theme.addEventListener('change', () => setTimeout(() => root.classList.remove('m3e-morph'), morphMs() + 60), { once: true });
    setTimeout(() => root.classList.remove('m3e-morph'), morphMs() * 3);
    theme.setAttribute('color', color);
    window.m3eLoad?.();
    sync();
  }

  function applyVariant(variant) {
    if (window.m3eSeed) window.m3eSeed.variant = variant;
    try { localStorage.setItem('m3e.pref.variant', variant); } catch {}
    theme.setAttribute('variant', variant);
    window.m3eLoad?.('theme');
    sync();
  }

  // The dialog is a custom element, so the runtime must exist before show() does.
  async function open() {
    if (dialog.classList.contains('is-fallback')) {
      dialog.classList.remove('is-fallback');
      return;
    }
    sync();
    if (pending) return;
    pending = true;
    try {
      const loaded = window.m3eLoad ? await window.m3eLoad('dialog') : true;
      if (!loaded) {
        failure.hidden = false;
        dialog.classList.add('is-fallback');
        return;
      }
      await customElements.whenDefined('m3e-dialog');
      failure.hidden = true;
      dialog.show?.();
    } finally {
      pending = false;
    }
  }

  toggle.addEventListener('click', open);
  swatches.forEach(swatch => swatch.addEventListener('click', () => {
    apply(swatch.dataset.color);
    dialog.hide?.();
  }));
  input.addEventListener('change', () => apply(input.value));
  variants.forEach(chip => chip.addEventListener('click', () => applyVariant(chip.dataset.variant)));
  dialog.querySelector('.color-close').addEventListener('click', () => dialog.hide?.());
  dialog.addEventListener('closed', () => toggle.focus());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') dialog.classList.remove('is-fallback');
  });

  sync();
})();
