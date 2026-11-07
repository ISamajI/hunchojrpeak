// Toasts, native <dialog> helpers (focus trap + Esc come free with showModal), language toggle.
import { t, getLang, setLang } from '../i18n.js';
import { h, nid } from './dom.js';
import { icon } from './icons.js';

export function createToaster() {
  const host = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  // `action: { label, onClick }` adds a button (used for "Deshacer" after removing something).
  function toast(text, { kind = 'good', ms = 4000, action } = {}) {
    const el = h('div', { class: `toast toast-${kind}` }, h('span', null, text),
      action ? h('button', { type: 'button', class: 'toast-action', 'data-key': 'toast-action', onclick: () => { el.remove(); action.onClick(); } }, action.label) : null);
    host.append(el);
    // One at a time: a new message replaces the old one (they must never pile up over the drawing area).
    while (host.children.length > 1) host.firstChild.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 260);
    }, action ? Math.max(ms, 7000) : ms);
  }
  return { host, toast };
}

export function openDialog(dlg) {
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove(), { once: true });
  dlg.showModal();
  return dlg;
}

// Resolves true only for the destructive/confirm choice. Default focus is the safe choice.
export function confirmDialog({ title, body, ok, danger = true }) {
  return new Promise((resolve) => {
    const tid = nid('dlg');
    const dlg = h('dialog', { class: 'dlg', 'aria-labelledby': tid },
      h('form', { method: 'dialog', class: 'dlg-body' },
        h('h2', { id: tid }, title),
        body ? h('p', null, body) : null,
        h('div', { class: 'dlg-actions' },
          h('button', { class: 'btn btn-secondary', value: 'cancel', autofocus: true }, t('confirm.cancel')),
          h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, value: 'ok' }, ok))));
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    openDialog(dlg);
  });
}

export function alertDialog({ title, body }) {
  return new Promise((resolve) => {
    const tid = nid('dlg');
    const dlg = h('dialog', { class: 'dlg', 'aria-labelledby': tid },
      h('form', { method: 'dialog', class: 'dlg-body' },
        h('h2', { id: tid }, title ?? t('app.name')),
        body ? h('p', null, body) : null,
        h('div', { class: 'dlg-actions' }, h('button', { class: 'btn btn-primary', value: 'ok', autofocus: true }, t('ok')))));
    dlg.addEventListener('close', resolve, { once: true });
    openDialog(dlg);
  });
}

// ES | EN segmented toggle. Rebuilt text is handled by the caller via setLang listeners.
export function langToggle() {
  const mk = (code) => h('button', {
    type: 'button', role: 'radio', class: 'seg-btn', 'data-lang': code, 'data-key': `lang-${code}`,
    onclick: () => setLang(code),
  }, code.toUpperCase());
  const es = mk('es');
  const en = mk('en');
  const wrap = h('div', { class: 'lang-seg', role: 'radiogroup', 'data-i18n-aria': 'top.lang' }, icon('languages', 20), es, en);
  const sync = () => {
    for (const b of [es, en]) {
      const on = b.dataset.lang === getLang();
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    wrap.setAttribute('aria-label', t('top.lang'));
  };
  wrap.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = getLang() === 'es' ? en : es;
    next.focus();
    next.click();
  });
  sync();
  return { el: wrap, sync };
}
