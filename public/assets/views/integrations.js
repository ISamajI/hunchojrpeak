// INTEGRATIONS — what is connected, what it powers, and exactly how to connect the rest.
import { h, clear, errorBox, statusDot } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { viewHead } from './_shared.js';

export default async function integrations(root) {
  const grid = h('div', { class: 'grid cols-2' });
  const probe = h('button', { class: 'btn' }, icon('refresh'), 'Run live connectivity probe');
  root.append(viewHead('Integrations', 'Every external service AKUMARU can use. Nothing is simulated: if a service is not connected, the feature it powers says so and falls back to the documented alternative.', probe), grid);
  async function load(live = false) {
    probe.disabled = true;
    try {
      const rows = await api.get(`/api/doctor${live ? '?live=1' : ''}`);
      clear(grid);
      const connected = rows.filter((r) => r.configured).length;
      grid.append(h('div', { class: 'note', style: { gridColumn: '1/-1' }, text: `${connected} of ${rows.length} integrations configured. Keys live in the server’s .env file — never in the browser.` }));
      for (const r of rows) {
        grid.append(h('section', { class: 'panel' },
          h('header', { class: 'panel-head' }, h('h2', { text: r.label }), h('div', { class: 'chart-card-tools' }, statusDot(r.configured ? 'good' : 'idle', r.configured ? 'CONNECTED' : 'NOT CONNECTED'))),
          h('div', { class: 'panel-body stack', style: { gap: '8px', fontSize: '12.5px' } },
            h('div', {}, h('span', { class: 'muted', text: 'Powers: ' }), r.powers),
            !r.configured && h('div', {}, h('span', { class: 'muted', text: 'Without it: ' }), r.fallback),
            !r.configured && r.missing.length > 0 && h('div', {}, h('span', { class: 'muted', text: 'Missing: ' }), r.missing.map((m) => h('span', { class: 'kbd', style: { marginRight: '4px' }, text: m }))),
            !r.configured && h('div', { class: 'note', text: r.connect }),
            r.reachable !== undefined && h('div', {}, statusDot(r.reachable ? 'good' : 'critical', r.reachable ? 'REACHABLE' : 'UNREACHABLE'), h('span', { class: 'mono muted', style: { fontSize: '11px', marginLeft: '8px' }, text: r.probe })))));
      }
    } catch (e) { grid.replaceChildren(errorBox(e)); } finally { probe.disabled = false; }
  }
  probe.addEventListener('click', () => load(true));
  await load();
}
