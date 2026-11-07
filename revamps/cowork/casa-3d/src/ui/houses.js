// "Mis casas": full-screen dialog listing saved designs.
import { t, getLang } from '../i18n.js';
import { h, nid } from './dom.js';
import { icon } from './icons.js';
import { confirmDialog, openDialog } from './widgets.js';

export function openHouses(ctx) {
  const { store, toast } = ctx;
  const tid = nid('dlg');
  const grid = h('div', { class: 'houses-grid' });
  const dlg = h('dialog', { class: 'dlg dlg-full', 'aria-labelledby': tid },
    h('div', { class: 'dlg-body full-body' },
      h('div', { class: 'houses-head' },
        h('h2', { id: tid }, t('houses.title')),
        h('div', { class: 'houses-actions' },
          h('button', {
            type: 'button', class: 'btn btn-secondary',
            onclick: async () => {
              if (!(await confirmDialog({ title: t('confirm.new.title'), body: t('confirm.new.body'), ok: t('confirm.new.ok'), danger: false }))) return;
              await ctx.newHouse();
              dlg.close();
            },
          }, icon('plus', 22), t('houses.new')),
          h('button', { type: 'button', class: 'btn btn-primary', autofocus: true, onclick: () => dlg.close() }, icon('x', 22), t('houses.close')))),
      grid));

  const fmt = new Intl.DateTimeFormat(getLang(), { dateStyle: 'medium' });

  function fill() {
    const list = store.projects.list();
    const cur = store.projects.currentId();
    if (!list.length) {
      grid.replaceChildren(h('p', { class: 'muted-p empty' }, t('houses.empty')));
      return;
    }
    grid.replaceChildren(...list.map((p) => h('article', { class: `house-card${p.id === cur ? ' current' : ''}` },
      h('div', { class: 'thumb' }, p.thumb
        ? h('img', { src: p.thumb, alt: '', width: 320, height: 200, loading: 'lazy' })
        : icon('home', 48)),
      h('div', { class: 'hc-body' },
        h('h3', null, p.name || 'Mi Casa'),
        p.id === cur ? h('span', { class: 'chip' }, icon('check', 16), t('houses.current')) : null,
        h('p', { class: 'hc-date' }, t('houses.updated', { date: fmt.format(new Date(Number.isFinite(p.updatedAt) ? p.updatedAt : Date.now())) })),
        h('div', { class: 'hc-actions' },
          h('button', {
            type: 'button', class: 'btn btn-primary',
            onclick: async () => {
              if (p.id !== cur) await ctx.openProject(p.id);
              dlg.close();
            },
          }, icon('folder-open', 22), t('houses.open')),
          h('button', {
            type: 'button', class: 'btn btn-secondary btn-danger-outline',
            onclick: async () => {
              if (!(await confirmDialog({ title: t('confirm.delete.title'), body: t('confirm.delete.body'), ok: t('confirm.delete.ok') }))) return;
              ctx.removeProject(p.id);
              toast(t('toast.deleted'));
              fill();
            },
          }, icon('trash-2', 22), t('houses.delete')))))));
  }

  fill();
  openDialog(dlg);
}
