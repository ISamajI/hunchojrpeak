// Tiny DOM helpers. No framework.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null) continue;
    if (k.startsWith('aria-')) { el.setAttribute(k, String(v)); continue; }
    if (v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

let n = 0;
export const nid = (p = 'id') => `${p}-${++n}`;

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const isTextTarget = (el) =>
  !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
    || (el.tagName === 'INPUT' && !['range', 'button', 'checkbox', 'radio', 'color'].includes(el.type)));
