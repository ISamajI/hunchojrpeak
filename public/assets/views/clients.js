// CLIENTS — won, onboarding and active accounts with revenue and onboarding progress.
import { h, clear, fmt, empty, errorBox } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { viewHead, kpi, stagePill } from './_shared.js';

export default async function clients(root, ctx) {
  const tiles = h('div', { class: 'grid cols-4 kpis' });
  const list = h('section', { class: 'panel mt' });
  const follow = h('section', { class: 'panel mt' });
  root.append(viewHead('Clients', 'Accounts you have won, with onboarding progress and revenue drawn from the invoice ledger.'), tiles, list, follow);
  try {
    const [{ projects }, rev, fu] = await Promise.all([api.get('/api/projects'), api.get('/api/metrics/revenue?range=all'), api.get('/api/followups')]);
    const clients = projects.filter((p) => ['won', 'onboarding', 'active'].includes(p.stage));
    const negotiating = projects.filter((p) => ['interested', 'replied'].includes(p.stage));
    tiles.append(
      kpi({ label: 'Total clients', value: fmt.num(clients.length), sub: `${clients.filter((c) => c.stage === 'active').length} active · ${clients.filter((c) => c.stage === 'onboarding').length} onboarding` }),
      kpi({ label: 'Revenue from clients', value: rev.hasData ? fmt.money(clients.reduce((s, c) => s + c.paid_cents, 0)) : null, na: 'No invoices recorded', href: '#/revenue' }),
      kpi({ label: 'MRR', value: rev.hasData ? fmt.money(rev.mrr) : null, na: 'No recurring plans', sub: rev.hasData ? `${rev.recurringClients} on a monthly plan` : '' }),
      kpi({ label: 'In negotiation', value: fmt.num(negotiating.length), sub: 'replied or interested', href: '#/projects' }));
    list.append(h('header', { class: 'panel-head' }, h('h2', { text: 'Client accounts' })),
      clients.length ? h('div', { class: 'table-wrap', style: { maxHeight: 'none' } }, h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, ['Client', 'Stage', 'Onboarding', 'Paid', 'Deal value', 'Deadline'].map((c) => h('th', { text: c })))),
        h('tbody', {}, clients.map((c) => h('tr', { class: 'click', onclick: () => ctx.navigate(`#/projects/${c.id}`) },
          h('td', {}, h('div', { text: c.name }), h('div', { class: 'muted', style: { fontSize: '11px' }, text: c.city || '' })), h('td', {}, stagePill(c.stage)),
          h('td', { style: { minWidth: '160px' } }, c.tasks_total ? h('div', {}, h('div', { class: 'meter' }, h('i', { style: { width: `${(c.tasks_done / c.tasks_total) * 100}%` } })), h('div', { class: 'muted mono', style: { fontSize: '10.5px', marginTop: '3px' }, text: `${c.tasks_done}/${c.tasks_total} tasks` })) : '—'),
          h('td', { class: 'num', text: fmt.money(c.paid_cents) }), h('td', { class: 'num', text: c.value_cents ? fmt.money(c.value_cents) : '—' }), h('td', { class: 'mono', text: c.deadline || '—' }))))))
        : empty('No clients yet', 'Move a project to Won (or mark it won from its page) to start onboarding.'));
    follow.append(h('header', { class: 'panel-head' }, h('h2', { text: 'Follow-up opportunities' }), h('span', { class: 'eyebrow', text: 'NO REPLY IN 3+ DAYS' })),
      fu.length ? h('div', { class: 'list' }, fu.map((f) => h('div', { class: 'list-item click', onclick: () => ctx.navigate(`#/projects/${f.id}`) }, h('i', { class: 'dot warning', style: { marginTop: '6px' } }), h('div', { class: 'grow' }, h('div', { class: 'title', text: f.name }), h('div', { class: 'meta', text: `${f.email || ''} · contacted ${fmt.ago(f.last_contacted)}` })))))
        : empty('No follow-ups due', 'Everyone you contacted has replied or was contacted recently.'));
  } catch (e) { clear(tiles).append(errorBox(e)); }
}
