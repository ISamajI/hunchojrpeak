// WEBSITE BUILDER — production publishing (approval-gated) and uptime monitoring.
import { h, clear, fmt, empty, errorBox, toast, confirmDialog } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { viewHead, kpi, sectionTitle } from './_shared.js';

export default async function builder(root, ctx) {
  const tiles = h('div', { class: 'grid cols-4 kpis' });
  const ready = h('section', { class: 'panel' });
  const sites = h('section', { class: 'panel' });
  const add = h('form', { class: 'row' });
  root.append(viewHead('Website Builder', 'Move approved demos to production and keep client sites healthy. Publishing a live site is always an owner decision; uptime checks run on demand or on a schedule.'),
    tiles, sectionTitle('Ready to publish'), ready, sectionTitle('Monitored production sites', h('div', { class: 'row tight' }, h('button', { class: 'btn sm', onclick: async () => { await api.post('/api/jobs', { kind: 'uptime', args: {} }); toast('Uptime sweep started'); ctx.refreshStatus(); } }, icon('refresh'), 'Check all now'))), sites, h('section', { class: 'panel pad mt' }, add));

  const url = h('input', { class: 'input', type: 'url', placeholder: 'https://client-site.com', required: true, style: { flex: 1 }, 'aria-label': 'Site URL to monitor' });
  const label = h('input', { class: 'input', placeholder: 'Label (optional)', 'aria-label': 'Label' });
  add.append(icon('globe'), url, label, h('button', { class: 'btn' }, icon('plus'), 'Monitor site'));
  add.addEventListener('submit', async (e) => { e.preventDefault(); try { await api.post('/api/sites', { url: url.value, label: label.value || null }); url.value = ''; label.value = ''; toast('Monitoring started', '', 'good'); load(); } catch (x) { toast('Could not add site', x.message, 'critical'); } });

  async function load() {
    try {
      const [o, { projects }] = await Promise.all([api.get('/api/metrics/ops'), api.get('/api/projects')]);
      clear(tiles).append(
        kpi({ label: 'Production sites', value: fmt.num(o.productionSites), sub: `${o.sitesDown} down` }),
        kpi({ label: 'Average uptime · 30d', value: o.uptime == null ? null : fmt.pct(o.uptime, 2), na: 'No checks yet' }),
        kpi({ label: 'Awaiting publish approval', value: fmt.num(o.awaitingPublishApproval), href: '#/approvals' }),
        kpi({ label: 'Maintenance clients', value: fmt.num(o.maintenanceClients) }));
      const candidates = projects.filter((p) => p.preview_url && ['won', 'onboarding', 'active', 'interested'].includes(p.stage));
      clear(ready);
      if (!candidates.length) ready.append(empty('Nothing ready for production', 'Projects appear here once they are interested or won and have a QA-passed demo.'));
      else ready.append(h('div', { class: 'list' }, candidates.map((p) => h('div', { class: 'list-item', style: { alignItems: 'center' } }, h('div', { class: 'grow' }, h('div', { class: 'title', text: p.name }), h('div', { class: 'meta', text: `${fmt.stage(p.stage)} · ${p.preview_url}` })),
        h('a', { class: 'btn sm ghost', href: p.preview_url, target: '_blank', rel: 'noopener' }, icon('external'), 'Preview'),
        h('button', { class: 'btn sm', onclick: async () => { if (!(await confirmDialog({ title: `Request production publish for ${p.name}?`, body: 'This creates an approval request. Nothing goes live until you approve it — and it requires Vercel to be connected.', confirmLabel: 'Request approval' }))) return; try { await api.post(`/api/leads/${p.id}/publish`); toast('Approval requested', p.name); ctx.refreshStatus(); load(); } catch (x) { toast('Cannot request', x.message, 'critical'); } } }, icon('globe'), 'Request publish')))));
      clear(sites);
      if (!o.sites.length) sites.append(empty('No sites monitored', 'Production sites published through AKUMARU are added automatically; add existing client sites below.'));
      else sites.append(h('table', { class: 'data' }, h('thead', {}, h('tr', {}, ['Site', 'Status', 'Uptime · 30d', 'Last 48 checks', 'Response', ''].map((c) => h('th', { text: c })))),
        h('tbody', {}, o.sites.map((s) => h('tr', {},
          h('td', {}, h('div', { text: s.label || s.business_name || new URL(s.url).hostname }), h('a', { href: s.url, target: '_blank', rel: 'noopener', class: 'mono', style: { fontSize: '11px' }, text: s.url })),
          h('td', {}, !s.last ? h('span', { class: 'muted', text: 'not checked' }) : h('span', { class: 'status-text' }, h('i', { class: `dot ${s.last.ok ? 'good' : 'critical'}` }), s.last.ok ? 'UP' : 'DOWN')),
          h('td', { class: 'num', text: s.uptime == null ? '—' : fmt.pct(s.uptime, 2) }),
          h('td', { style: { minWidth: '200px' } }, h('div', { class: 'uptime-strip', role: 'img', 'aria-label': `${s.recent.filter((c) => !c.ok).length} failed of ${s.recent.length} recent checks` }, s.recent.length ? s.recent.map((c) => h('i', { class: c.ok ? '' : 'down', title: `${fmt.date(c.at)} ${fmt.time(c.at)} — ${c.ok ? 'up' : 'down'}${c.ms ? ` · ${c.ms}ms` : ''}` })) : h('i', { class: 'none', style: { maxWidth: 'none' } }))),
          h('td', { class: 'mono', text: s.last?.ms != null ? `${s.last.ms} ms` : '—' }),
          h('td', { class: 'r' }, h('button', { class: 'btn sm ghost', 'aria-label': 'Stop monitoring', onclick: async () => { if (await confirmDialog({ title: 'Stop monitoring this site?', body: s.url, confirmLabel: 'Stop', danger: true })) { await api.post(`/api/sites/${s.id}/delete`); load(); } } }, icon('trash'))))))));
    } catch (e) { clear(tiles).append(h('div', { style: { gridColumn: '1/-1' } }, errorBox(e))); }
  }
  ctx.onLive((type, d) => { if ((type === 'job' && d.kind === 'uptime' && d.status === 'done') || (type === 'activity' && /site_|production_published/.test(d.action))) load(); });
  await load();
}
