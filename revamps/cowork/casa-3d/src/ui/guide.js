// First-run guide: three big picture cards. Restart it any time from "Más".
import { t, onLang } from '../i18n.js';
import { h, nid } from './dom.js';
import { icon } from './icons.js';
import { openDialog } from './widgets.js';

const GUIDED = 'casa3d.guided';
const SLIDES = [
  { ico: 'layout-dashboard', title: 'guide.1.t', body: 'guide.1.b' },
  { ico: 'hammer', title: 'guide.2.t', body: 'guide.2.b' },
  { ico: 'eye', title: 'guide.3.t', body: 'guide.3.b' },
];

export const wasGuided = () => { try { return !!localStorage.getItem(GUIDED); } catch { return true; } };
const markGuided = () => { try { localStorage.setItem(GUIDED, '1'); } catch { /* ignore */ } };

export function openGuide({ onClose } = {}) {
  let i = 0;
  const tid = nid('dlg');
  const body = h('div', { class: 'dlg-body guide-body' });
  const dlg = h('dialog', { class: 'dlg guide', 'aria-labelledby': tid }, h('form', { method: 'dialog' }, body));

  function paint() {
    const s = SLIDES[i];
    const last = i === SLIDES.length - 1;
    body.replaceChildren(
      h('div', { class: 'guide-ico' }, icon(s.ico, 48)),
      h('p', { class: 'guide-count num' }, t('guide.count', { n: i + 1, m: SLIDES.length })),
      h('h2', { id: tid }, t(s.title)),
      h('p', { class: 'guide-text' }, t(s.body)),
      h('div', { class: 'dlg-actions' },
        last ? null : h('button', { type: 'submit', class: 'btn btn-secondary', value: 'skip', 'data-key': 'guide-skip' }, t('guide.skip')),
        h('button', {
          type: last ? 'submit' : 'button', class: 'btn btn-primary', value: 'done', autofocus: true, 'data-key': 'guide-next',
          onclick: last ? null : () => { i += 1; paint(); body.querySelector('[data-key="guide-next"]')?.focus(); },
        }, last ? t('guide.done') : t('step.next'))));
  }
  paint();
  const off = onLang(paint);
  dlg.addEventListener('close', () => { off(); markGuided(); onClose?.(); }, { once: true });
  openDialog(dlg);
}
