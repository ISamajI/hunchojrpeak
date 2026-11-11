// DOM + UI primitives. All dynamic text is set via textContent — never innerHTML
// with data — because lead names, emails and replies come from the outside world.
import { icon } from './icons.js';

export function h(tag, props = {}, ...kids) {
  const svgTags = new Set(['svg', 'g', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'text', 'defs', 'linearGradient', 'radialGradient', 'stop', 'tspan', 'clipPath', 'animate', 'title']);
  const el = svgTags.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && !svgTags.has(tag) && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export const clear = (el) => { el.replaceChildren(); return el; };

// ---------- Formatting ----------
export const fmt = {
  money(cents, { compact = false, decimals } = {}) {
    if (cents == null) return '—';
    const v = cents / 100;
    if (compact && Math.abs(v) >= 10000) return '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
    return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals ?? (v % 1 ? 2 : 0), maximumFractionDigits: decimals ?? 2 });
  },
  num(n, compact = false) {
    if (n == null) return '—';
    return compact && Math.abs(n) >= 10000 ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : Number(n).toLocaleString('en-US');
  },
  pct(x, digits = 0) { return x == null ? '—' : `${(x * 100).toFixed(digits)}%`; },
  date(s) {
    if (!s) return '—';
    const d = parseDate(s);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
  },
  time(s) { return s ? parseDate(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—'; },
  ago(s) {
    if (!s) return '—';
    const sec = Math.round((Date.now() - parseDate(s)) / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  },
  dur(sec) {
    if (sec == null) return '—';
    const d = Math.floor(sec / 86400), hh = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return d ? `${d}d ${hh}h` : hh ? `${hh}h ${m}m` : `${m}m ${sec % 60}s`;
  },
  bytes(b) { if (b == null) return '—'; const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return `${b.toFixed(i ? 1 : 0)} ${u[i]}`; },
  stage(s) { return String(s || '').replace(/_/g, ' '); },
};

/** SQLite "YYYY-MM-DD HH:MM:SS" is UTC; ISO strings pass through. */
export function parseDate(s) {
  if (s instanceof Date) return s;
  const str = String(s);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) return new Date(str.replace(' ', 'T') + 'Z');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + 'T00:00:00');
  return new Date(str);
}

export function delta(value, { goodWhenUp = true, suffix = ' vs prev' } = {}) {
  if (value == null || !Number.isFinite(value)) return h('span', { class: 'delta flat', text: 'no prior data' });
  const dir = Math.abs(value) < 0.005 ? 'flat' : value > 0 ? 'up' : 'down';
  const good = dir === 'flat' ? 'flat' : (dir === 'up') === goodWhenUp ? 'up' : 'down';
  return h('span', { class: `delta ${good}`, title: 'Change vs the previous period of equal length' }, `${dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'} ${Math.abs(value * 100).toFixed(value && Math.abs(value) < 0.1 ? 1 : 0)}%${suffix}`);
}

// ---------- States ----------
export function empty(title, detail, action) {
  return h('div', { class: 'empty' }, icon('inbox'), h('strong', { text: title }), detail && h('div', { text: detail }), action);
}
export function errorBox(e) {
  return h('div', { class: 'error-box', role: 'alert' }, h('b', { text: 'Something went wrong. ' }), e?.message || String(e));
}
export function skeleton(lines = 3) {
  return h('div', { class: 'stack', style: { gap: '10px', padding: '6px 0' } }, Array.from({ length: lines }, (_, i) => h('div', { class: 'skeleton', style: { width: `${90 - i * 15}%`, height: '14px' } })));
}

// ---------- Panels ----------
export function panel({ title, eyebrow, tools, body, pad = false, flush = false, cls = '' } = {}) {
  return h('section', { class: `panel ${cls}` },
    title && h('header', { class: 'panel-head' }, h('h2', { text: title }), eyebrow && h('span', { class: 'eyebrow', text: eyebrow }), tools && h('div', { class: 'chart-card-tools' }, tools)),
    h('div', { class: flush ? 'panel-body flush' : pad === false && title ? 'panel-body' : 'panel-body' }, body));
}

export function statusDot(level, label) {
  return h('span', { class: 'status-text' }, h('i', { class: `dot ${level}` }), label);
}

// ---------- Toasts ----------
let toastRoot;
export function toast(title, body = '', level = '') {
  toastRoot ||= document.body.appendChild(h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }));
  const t = h('div', { class: `toast ${level}` }, h('b', { text: title }), body && h('div', { class: 'dim', text: body }));
  toastRoot.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, level === 'critical' ? 9000 : 4500);
}

// ---------- Dialogs ----------
export function modal(content, { onClose } = {}) {
  const prev = document.activeElement;
  const ov = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' });
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey, true); onClose?.(); prev?.focus?.(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') { // focus trap
      const f = [...ov.querySelectorAll('button, input, textarea, select, a[href], [tabindex="0"]')].filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  };
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', onKey, true);
  ov.append(content);
  document.body.append(ov);
  setTimeout(() => (ov.querySelector('[autofocus]') || ov.querySelector('input, textarea, button'))?.focus(), 10);
  return close;
}

/** Confirmation for sensitive actions. Resolves true/false. `detail` may be a Node (e.g. the exact email). */
export function confirmDialog({ title, body, detail, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); close(); } };
    const yes = h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, text: confirmLabel, onclick: () => finish(true) });
    const box = h('div', { class: 'dialog' },
      h('h3', { text: title }),
      body && h('p', { class: 'dim', style: { margin: '0 0 10px' }, text: body }),
      detail,
      h('div', { class: 'actions' }, h('button', { class: 'btn ghost', text: 'Cancel', onclick: () => finish(false) }), yes));
    const close = modal(box, { onClose: () => finish(false) });
    setTimeout(() => yes.focus(), 20);
  });
}

export function promptDialog({ title, label, placeholder = '', confirmLabel = 'Save', multiline = false, value = '' }) {
  return new Promise((resolve) => {
    let done = false;
    const input = multiline ? h('textarea', { class: 'input', rows: 6, placeholder, value }) : h('input', { class: 'input', placeholder, value });
    const finish = (v) => { if (!done) { done = true; resolve(v); close(); } };
    const box = h('form', { class: 'dialog', onsubmit: (e) => { e.preventDefault(); finish(input.value); } },
      h('h3', { text: title }), h('label', { class: 'field', style: { marginTop: '10px' } }, label, input),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn ghost', text: 'Cancel', onclick: () => finish(null) }), h('button', { class: 'btn primary', text: confirmLabel })));
    const close = modal(box, { onClose: () => finish(null) });
    setTimeout(() => input.focus(), 20);
  });
}

// ---------- Context menu ----------
export function contextMenu(x, y, items) {
  document.querySelector('.ctx-menu')?.remove();
  const menu = h('div', { class: 'ctx-menu', role: 'menu' }, items.map((it) => (it === '-' ? h('hr') : h('button', { role: 'menuitem', onclick: () => { menu.remove(); it.run(); } }, it.icon && icon(it.icon), it.label))));
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
  menu.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;
  menu.querySelector('button')?.focus();
  const off = (e) => { if (!menu.contains(e.target) || e.key === 'Escape') { menu.remove(); removeEventListener('mousedown', off, true); removeEventListener('keydown', off, true); } };
  setTimeout(() => { addEventListener('mousedown', off, true); addEventListener('keydown', off, true); });
}

// ---------- Tooltip ----------
let tip;
export function showTip(e, build) {
  tip ||= document.body.appendChild(h('div', { class: 'tooltip', role: 'tooltip' }));
  clear(tip).append(build());
  tip.classList.add('show');
  const r = tip.getBoundingClientRect();
  const x = e.clientX + 14 + r.width > innerWidth ? e.clientX - r.width - 14 : e.clientX + 14;
  const y = Math.max(8, Math.min(e.clientY - r.height / 2, innerHeight - r.height - 8));
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}
export function hideTip() { tip?.classList.remove('show'); }

/** Wrap an async loader: shows skeleton first time, keeps old frame (dimmed) on refresh, error box on failure. */
export async function loadInto(el, loader, { keepFrame = true } = {}) {
  const first = !el.childNodes.length;
  if (first) el.replaceChildren(skeleton(4));
  else if (keepFrame) el.classList.add('loading-frame');
  try {
    const node = await loader();
    el.replaceChildren(...[node].flat().filter(Boolean));
  } catch (e) {
    el.replaceChildren(errorBox(e));
  } finally {
    el.classList.remove('loading-frame');
  }
}
