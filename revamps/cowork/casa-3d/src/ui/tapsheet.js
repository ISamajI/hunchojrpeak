// "Tap the house to change it": a small sheet with big color chips and one "Listo" button.
// Opens when the 3D view reports a pick (walls, roof, door, ... or a yard item).
import { PALETTES, ITEM_TYPES } from '../state.js';
import { t, pick, onLang } from '../i18n.js';
import { h } from './dom.js';
import { icon, ITEM_ICONS } from './icons.js';

const PATHS = {
  walls: 'house.colors.walls', roof: 'house.roof.color', trim: 'house.colors.trim', door: 'house.colors.door',
  windows: 'house.colors.windows', base: 'house.colors.base', accent: 'house.colors.accent', fence: 'yard.fenceColor',
};
// Six sensible choices per part (hex values come from PALETTES so names match).
const CHIPS = {
  walls: ['#ffffff', '#f2d8a7', '#e9c46a', '#f4a6a0', '#a7c98b', '#8fbfe0'],
  roof: ['#b8573a', '#9aa3a8', '#3b3d40', '#6b3b26', '#1f4e79', '#2a7d4f'],
  door: ['#6b3b26', '#1f4e79', '#2a7d4f', '#b8573a', '#3b3d40', '#ffffff'],
};
const GENERIC = ['#ffffff', '#f4f1ea', '#9aa3a8', '#3b3d40', '#6b3b26', '#1f4e79'];
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

export function createTapSheet(ctx) {
  const { store, ui, toast } = ctx;
  let part = null;
  const el = h('section', { class: 'tap-sheet', 'aria-label': t('tap.title'), hidden: true });

  const getPath = (path) => path.split('.').reduce((o, k) => o?.[k], store.get());

  function itemBody(id) {
    const it = store.get().yard.items.find((x) => x.id === id);
    if (!it) return null;
    const type = ITEM_TYPES.find((x) => x.id === it.type);
    const idx = store.get().yard.items.findIndex((x) => x.id === id);
    return [
      h('h3', { class: 'tap-title' }, icon(ITEM_ICONS[it.type] ?? 'trees', 28), pick(type) || it.type),
      h('p', { class: 'muted-p' }, t('item.dragHint')),
      h('div', { class: 'tap-actions' },
        h('button', {
          type: 'button', class: 'btn btn-secondary', 'data-key': 'tap-rotate',
          onclick: () => store.set(`yard.items.${idx}.rot`, Math.round((((it.rot ?? 0) + Math.PI / 4) % (Math.PI * 2)) * 100) / 100),
        }, icon('rotate-cw', 22), t('item.rotate')),
        h('button', {
          type: 'button', class: 'btn btn-secondary btn-danger-outline', 'data-key': 'tap-remove',
          onclick: () => { toast(t('toast.itemRemoved', { item: pick(type) })); store.removeItem(id); close(); },
        }, icon('trash-2', 22), t('item.remove'))),
    ];
  }

  function colorBody(name) {
    const cur = getPath(PATHS[name]);
    const hexes = CHIPS[name] ?? GENERIC;
    return [
      h('h3', { class: 'tap-title' }, h('span', { class: 'dot', style: { background: cur } }), t(`part.${name}`)),
      h('div', { class: 'tap-chips', role: 'group', 'aria-label': t(`part.${name}`) },
        hexes.map((hex) => {
          const p = PALETTES.find((x) => same(x.hex, hex)) ?? { hex, es: hex, en: hex };
          const on = same(hex, cur);
          return h('button', {
            type: 'button', class: `swatch${on ? ' on' : ''}`, 'aria-pressed': on, 'data-key': `tap:${hex}`,
            onclick: () => store.set(PATHS[name], hex),
          }, h('span', { class: 'sw-dot', style: { background: hex } }, on ? icon('check', 24) : null), h('span', { class: 'sw-name' }, pick(p)));
        })),
      h('button', { type: 'button', class: 'btn btn-ghost', 'data-key': 'tap-more', onclick: () => ctx.openColors(name) }, icon('paintbrush', 22), t('color.more')),
    ];
  }

  function paint() {
    if (!part) return;
    const kids = part.startsWith('item:') ? itemBody(part.slice(5)) : PATHS[part] ? colorBody(part) : null;
    if (!kids) { close(); return; }
    el.replaceChildren(...kids, h('button', { type: 'button', class: 'btn btn-primary btn-xl', 'data-key': 'tap-done', onclick: close }, icon('check', 24), t('step.done')));
  }

  function open(p) {
    part = p;
    if (p.startsWith('item:')) ui.hiItem = p.slice(5);
    el.hidden = false;
    document.body.classList.add('tap-open');
    el.setAttribute('aria-label', t('tap.title'));
    paint();
  }
  function close() {
    if (!part && el.hidden) return;
    part = null;
    ui.hiItem = null;
    el.hidden = true;
    document.body.classList.remove('tap-open');
  }

  store.subscribe(() => { if (part) paint(); });
  onLang(() => paint());
  return { el, open, close, isOpen: () => !!part };
}
