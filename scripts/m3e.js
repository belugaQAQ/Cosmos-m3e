'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const distDir = path.dirname(require.resolve('@m3e/web/all'));
const requireFromDist = createRequire(path.join(distDir, 'entry.js'));
const version = require(path.join(distDir, '..', 'package.json')).version;

const ENTRIES = {
  theme: path.join(distDir, 'theme.min.js'),
  dialog: path.join(distDir, 'dialog.min.js'),
  callout: path.join(distDir, 'callout.min.js')
};

const HEX = /^#[0-9a-f]{6}$/i;
const VARIANTS = new Set(['tonal-spot', 'vibrant', 'fidelity', 'expressive', 'monochrome', 'neutral', 'rainbow', 'fruit-salad']);
const CONTRASTS = new Set(['standard', 'medium', 'high']);
const settings = () => hexo.config.m3e || {};

function color() {
  const page = (this && this.page) || {};
  for (const candidate of [page.m3e_color, settings().color]) {
    const value = String(candidate || '').trim();
    if (HEX.test(value)) return value.toUpperCase();
  }
  return '#6750A4';
}

function pick(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function vendorPath(file) {
  const marker = `${path.sep}node_modules${path.sep}`;
  return file.slice(file.lastIndexOf(marker) + marker.length).split(path.sep).join('/');
}

// Node resolution picks the "node" export condition (SSR shims); browsers need the sibling build.
function browserBuild(file) {
  const marker = `${path.sep}node_modules${path.sep}`;
  const index = file.lastIndexOf(marker);
  const head = file.slice(0, index + marker.length);
  const tail = file.slice(index + marker.length);
  if (!tail.includes(`${path.sep}node${path.sep}`)) return file;
  const twin = path.join(head, tail.replace(`${path.sep}node${path.sep}`, path.sep));
  return fs.existsSync(twin) ? twin : file;
}

// M3E ships a minified twin for every dist module; the browser should parse that one.
function minified(file) {
  if (!file.startsWith(distDir) || file.endsWith('.min.js')) return file;
  const candidate = file.replace(/\.js$/, '.min.js');
  return fs.existsSync(candidate) ? candidate : file;
}

function routeFor(file) {
  return file.startsWith(distDir)
    ? `m3e/dist/${path.basename(file)}`
    : `m3e/vendor/${vendorPath(file)}`;
}

function conditions(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return null;
  for (const condition of ['browser', 'module', 'import', 'default']) {
    if (Object.hasOwn(entry, condition)) {
      const target = conditions(entry[condition]);
      if (target) return target;
    }
  }
  return null;
}

function exportsTarget(exportsField, subpath) {
  if (!exportsField) return null;
  if (typeof exportsField === 'string') return subpath ? null : exportsField;
  const key = subpath ? `./${subpath}` : '.';
  if (Object.hasOwn(exportsField, key)) return conditions(exportsField[key]);
  if (!subpath && !Object.keys(exportsField).some(name => name.startsWith('.'))) return conditions(exportsField);
  const wildcard = exportsField['./*'];
  return subpath && typeof wildcard === 'string' ? wildcard.replace('*', subpath) : null;
}

function packageRoot(file) {
  let dir = path.dirname(file);
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return dir;
}

// Node's require resolves "require"/"node" conditions; browsers need the ESM, browser-condition build.
function resolveEsm(specifier) {
  const segments = specifier.split('/');
  const name = specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
  const subpath = specifier.slice(name.length).replace(/^\/+/, '');
  let resolved;
  try {
    resolved = requireFromDist.resolve(specifier);
  } catch {
    return null;
  }
  const root = packageRoot(resolved);
  if (!root) return resolved;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const target = exportsTarget(manifest.exports, subpath) || (subpath ? null : manifest.module || manifest.main);
  if (!target) return browserBuild(resolved);
  let file = path.join(root, target);
  if (file.endsWith('.mjs') && fs.existsSync(file.replace(/\.mjs$/, '.js'))) file = file.replace(/\.mjs$/, '.js');
  return fs.existsSync(file) ? file : browserBuild(resolved);
}

// Walk every entry once so the import map covers exactly the graph the browser will fetch.
const files = new Map();
const imports = {};
const importsOf = new Map();

function visit(original) {
  const file = minified(original);
  if (files.has(file) || !fs.existsSync(file)) return;
  files.set(file, routeFor(file));
  const next = [];
  importsOf.set(file, next);
  const source = fs.readFileSync(file, 'utf8');
  const specs = [...source.matchAll(/(?:^|[^\w$.])(?:from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|import\s*["']([^"']+)["'])/g)]
    .map(match => match[1] || match[2] || match[3]);
  for (const specifier of specs) {
    if (specifier.startsWith('.')) {
      const target = path.resolve(path.dirname(file), specifier);
      next.push(target);
      visit(target);
      continue;
    }
    const resolved = resolveEsm(specifier);
    if (!resolved) continue;
    const target = minified(resolved);
    imports[specifier] = routeFor(target);
    next.push(target);
    visit(target);
  }
}

for (const file of Object.values(ENTRIES)) visit(file);

function closure(entry) {
  const seen = [];
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (!files.has(file) || seen.includes(file)) continue;
    seen.push(file);
    for (const specifier of importsOf.get(file) || []) stack.push(specifier);
  }
  return seen;
}

const calloutEntry = routeFor(ENTRIES.callout);
hexo.m3ePreload = {
  root: hexo.config.root || '/',
  callout: [calloutEntry, ...closure(ENTRIES.callout).map(file => files.get(file)).filter(route => route !== calloutEntry)]
};

hexo.extend.helper.register('m3e_version', () => version);
hexo.extend.helper.register('m3e_color', color);
hexo.extend.helper.register('m3e_variant', () => pick(settings().variant, VARIANTS, 'fidelity'));
hexo.extend.helper.register('m3e_contrast', () => pick(settings().contrast, CONTRASTS, 'standard'));

hexo.extend.helper.register('m3e_entries', function () {
  return Object.fromEntries(Object.entries(ENTRIES).map(([name, file]) => [name, this.url_for(routeFor(file))]));
});

hexo.extend.helper.register('m3e_importmap', function () {
  const map = {};
  for (const [specifier, route] of Object.entries(imports)) map[specifier] = this.url_for(route);
  return JSON.stringify({ imports: map });
});

hexo.extend.generator.register('m3e-modules', () => [...files].map(([file, route]) => ({
  path: route,
  data: () => fs.createReadStream(file)
})));
