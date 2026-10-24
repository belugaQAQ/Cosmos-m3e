'use strict';

// GitHub alerts (`> [!NOTE] …`) rendered with the M3E callout component.
const TYPES = {
  note: { label: 'Note', variant: 'surface', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 8.1v.2M12 11v5.2"/>' },
  tip: { label: 'Tip', variant: 'secondary', icon: '<path d="M9.2 17.6h5.6M10.4 20.4h3.2"/><path d="M12 3.4a6 6 0 0 0-3.4 10.9c.5.4.8 1 .8 1.7V17h5.2v-1c0-.7.3-1.3.8-1.7A6 6 0 0 0 12 3.4Z"/>' },
  important: { label: 'Important', variant: 'primary', icon: '<path d="M12 3.6 3 19.4h18L12 3.6Z"/><path d="M12 9.4v4.4M12 16.6v.3"/>' },
  warning: { label: 'Warning', variant: 'tertiary', icon: '<path d="M12 3.6 3 19.4h18L12 3.6Z"/><path d="M12 9.4v4.4M12 16.6v.3"/>' },
  caution: { label: 'Caution', variant: 'error', icon: '<path d="M12 3.4 4.2 7v5.6c0 4.3 3.3 7.3 7.8 8 4.5-.7 7.8-3.7 7.8-8V7L12 3.4Z"/><path d="M12 7.9v4.6M12 15.4v.3"/>' }
};

const BLOCK = /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<\/p>|<br\s*\/?>)?\s*([\s\S]*?)<\/blockquote>/gi;

function icon(name) {
  return `<svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TYPES[name].icon}</svg>`;
}

function rewrite(html) {
  return html.replace(BLOCK, (match, type, close, body) => {
    const key = type.toLowerCase();
    const { label, variant } = TYPES[key];
    const content = close === '</p>' ? body : `<p>${body}`;
    return `<m3e-callout class="callout callout-${key}" variant="${variant}" shape="square">`
      + `${icon(key)}<span slot="label">${label}</span>${content}`
      + '</m3e-callout>';
  });
}

function preload(html) {
  const graph = hexo.m3ePreload;
  if (!graph || !html.includes('<m3e-callout')) return html;
  const [entry, ...deps] = graph.callout;
  const link = file => `<link rel="modulepreload" href="${graph.root}${file}" crossorigin>`;
  const tags = [link(entry), ...deps.map(link), `<script type="module" src="${graph.root}${entry}"></script>`].join('');
  return html.replace('</head>', `${tags}</head>`);
}

hexo.extend.filter.register('after_render:html', result => preload(rewrite(result)));
