// First-run welcome. The live stage shows beside/above it.
import { t, applyI18n, onLang } from '../i18n.js';
import { h } from './dom.js';
import { icon } from './icons.js';
import { langToggle } from './widgets.js';

export function createWelcome(ctx) {
  const { store } = ctx;
  const lang = langToggle();
  const openBtn = h('button', { type: 'button', class: 'btn btn-secondary btn-xl w-last', 'data-key': 'w-open', onclick: () => ctx.openHouses() });
  function paintOpen() {
    const list = store.projects.list();
    const last = [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    openBtn.replaceChildren(
      h('span', { class: 'thumb' }, last?.thumb ? h('img', { src: last.thumb, alt: '', width: 72, height: 72 }) : icon('folder-open', 28)),
      h('span', { class: 'wl-t' }, h('strong', { 'data-i18n': 'welcome.open' }, t('welcome.open')), last ? h('span', null, last.name || 'Mi Casa') : null));
  }
  const noSaved = h('p', { class: 'w-hint', 'data-i18n': 'welcome.noSaved' }, t('welcome.noSaved'));

  const el = h('section', { class: 'welcome', 'aria-labelledby': 'w-title' },
    h('div', { class: 'w-lang' }, lang.el),
    h('div', { class: 'w-card' },
      h('div', { class: 'w-brand' }, icon('home', 26), h('span', null, 'Casa 3D')),
      h('h1', { id: 'w-title', 'data-i18n': 'welcome.title' }, t('welcome.title')),
      h('p', { class: 'w-lede', 'data-i18n': 'welcome.lede' }, t('welcome.lede')),
      h('div', { class: 'w-actions' },
        h('button', { type: 'button', class: 'btn btn-primary btn-xl', 'data-key': 'w-start', onclick: () => ctx.startNew() },
          icon('home', 26), h('span', { 'data-i18n': 'welcome.start' }, t('welcome.start'))),
        openBtn,
        noSaved)));

  function refresh() {
    const has = store.projects.list().length > 0;
    openBtn.disabled = !has;
    noSaved.hidden = has;
    paintOpen();
  }
  onLang(() => { applyI18n(el); lang.sync(); });
  refresh();
  return { el, refresh };
}
