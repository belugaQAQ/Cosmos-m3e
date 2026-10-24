'use strict';

const fs = require('node:fs');
const path = require('node:path');
const katex = require('katex');

const katexDist = path.dirname(require.resolve('katex/dist/katex.min.css'));
const mermaidFile = path.join(path.dirname(require.resolve('mermaid/dist/mermaid.min.js')), 'mermaid.min.js');

// The payload travels inside the placeholder, so no state has to survive between filters.
function placeholder(kind, data) {
  return `<!--MD:${kind}:${Buffer.from(JSON.stringify(data)).toString('base64url')}-->`;
}

function extractMath(segment) {
  return segment
    .split(/(`[^`\n]*`)/)
    .map(part => {
      if (part.startsWith('`') && part.endsWith('`')) return part;
      return part
        .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => placeholder('M', { tex: tex, display: true }))
        .replace(/(?<!\\)\$(?!\s)((?:\\.|[^$\\\n])+?)(?<!\s)\$/g, (_, tex) => placeholder('M', { tex: tex, display: false }))
        // Obsidian-style highlight; runs after math so equations are already placeholders.
        .replace(/(?<![=\\])==(?=\S)([^=\n]+?)(?<!\s)==(?!=)/g, '<mark>$1</mark>');
    })
    .join('');
}

function extract(text) {
  const fences = /^```([\w-]*)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;
  let cursor = 0;
  let output = '';
  let match;
  while ((match = fences.exec(text))) {
    output += extractMath(text.slice(cursor, match.index));
    output += match[1].toLowerCase() === 'mermaid'
      ? placeholder('G', { source: match[2].replace(/\s+$/, '') })
      : match[0];
    cursor = fences.lastIndex;
  }
  return output + extractMath(text.slice(cursor));
}

function renderMath(payload) {
  return katex.renderToString(String(payload.tex).trim(), {
    displayMode: payload.display,
    throwOnError: false,
    strict: false,
    output: 'htmlAndMathml'
  });
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const mermaidBoot = `<script>document.addEventListener('DOMContentLoaded',function(){if(!window.mermaid)return;
var s=getComputedStyle(document.documentElement),v=function(n){return s.getPropertyValue(n).trim()};
mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',themeVariables:{
primaryColor:v('--md-sys-color-primary-container'),primaryTextColor:v('--md-sys-color-on-primary-container'),
primaryBorderColor:v('--md-sys-color-outline'),lineColor:v('--md-sys-color-outline'),
secondaryColor:v('--md-sys-color-secondary-container'),tertiaryColor:v('--md-sys-color-surface-container'),
background:v('--md-sys-color-surface'),mainBkg:v('--md-sys-color-primary-container'),
nodeBorder:v('--md-sys-color-outline'),clusterBkg:v('--md-sys-color-surface-container'),
titleColor:v('--md-sys-color-on-surface'),textColor:v('--md-sys-color-on-surface'),
fontFamily:v('--sans')||'sans-serif'}});
mermaid.run({querySelector:'.mermaid'});});</script>`;

hexo.extend.filter.register('before_post_render', data => {
  if (typeof data.content === 'string' && data.content.includes('$') || typeof data.content === 'string' && data.content.includes('```mermaid')) {
    data.content = extract(data.content);
  }
  return data;
}, 5);

hexo.extend.filter.register('after_render:html', html => {
  if (!html.includes('<!--MD:')) return html;
  let math = false;
  let diagram = false;

  const rendered = html.replace(/<!--MD:([MG]):([A-Za-z0-9_-]+)-->/g, (match, kind, encoded) => {
    let payload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      return match;
    }
    if (kind === 'M') {
      math = true;
      return renderMath({ tex: payload.tex, display: Boolean(payload.display) });
    }
    diagram = true;
    return `<div class="mermaid">${escapeHtml(payload.source)}</div>`;
  });

  const root = hexo.config.root || '/';
  const head = [
    math ? `<link rel="stylesheet" href="${root}katex/katex.min.css">` : '',
    diagram ? `<script defer src="${root}mermaid/mermaid.min.js"></script>${mermaidBoot}` : ''
  ].join('');

  return head ? rendered.replace('</head>', `${head}</head>`) : rendered;
});

// KaTeX ships its own fonts; its stylesheet references them relatively.
hexo.extend.generator.register('katex-assets', () => {
  const routes = [{ path: 'katex/katex.min.css', data: () => fs.createReadStream(path.join(katexDist, 'katex.min.css')) }];
  for (const name of fs.readdirSync(path.join(katexDist, 'fonts'))) {
    routes.push({ path: `katex/fonts/${name}`, data: () => fs.createReadStream(path.join(katexDist, 'fonts', name)) });
  }
  return routes;
});

hexo.extend.generator.register('mermaid-asset', () => ({
  path: 'mermaid/mermaid.min.js',
  data: () => fs.createReadStream(mermaidFile)
}));

hexo.extend.filter.register('after_render:html', html => {
  if (!html.includes('<mark')) return html;
  const root = hexo.config.root || '/';
  if (html.includes('js/highlight.js')) return html;
  return html.replace('</head>', `<script defer src="${root}js/highlight.js"></script></head>`);
});

hexo.extend.filter.register('after_render:html', html => {
  if (!html.includes('data-archive-tags') || html.includes('js/archive.js')) return html;
  const root = hexo.config.root || '/';
  return html.replace('</head>', `<script defer src="${root}js/archive.js"></script></head>`);
});
