// ANALYTICS — conversion, lead flow, stage distribution, opportunity scores, website ops.
import { h, clear, fmt, empty, errorBox } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { lineChart, hbars, seriesTable, chartCard, SERIES } from '../lib/charts.js';
import { kpi, viewHead, rangeControl, savedRange, saveRange, sectionTitle } from './_shared.js';

export default async function analytics(root, ctx) {
  let range = savedRange();
  const tiles = h('div', { class: 'grid cols-6 kpis' });
  const row1 = h('div', { class: 'grid cols-3 mt' });
  const row2 = h('div', { class: 'grid cols-3 mt' });
  const ops = h('div', { class: 'grid cols-6 kpis' });
  root.append(viewHead('Analytics', 'Pipeline performance and operations, computed live from the CRM, activity log and monitoring data.', rangeControl(range, (k) => { range = k; saveRange(k); load(); })),
    tiles, row1, row2, sectionTitle('Website operations'), ops);

  async function load() {
    root.classList.add('loading-frame');
    try {
      const [p, o, leads] = await Promise.all([api.get(`/api/metrics/pipeline?range=${range}`), api.get('/api/metrics/ops'), api.get('/api/leads')]);
      const t = p.totals;
      clear(tiles).append(
        kpi({ label: 'Total leads', value: fmt.num(t.leads) }),
        kpi({ label: 'New leads · period', value: fmt.num(t.newLeads), deltaValue: t.newLeadsGrowth, spark: p.series.discovered.map((s) => s.value) }),
        kpi({ label: 'Contacted', value: fmt.num(t.contacted), sub: 'emailed (approved sends)' }),
        kpi({ label: 'Replied', value: fmt.num(t.replied), sub: t.contacted ? `${fmt.pct(t.replied / t.contacted)} reply rate` : '' }),
        kpi({ label: 'Conversion', value: t.conversionRate == null ? null : fmt.pct(t.conversionRate, 1), na: 'No one contacted yet', sub: `${t.clients} won` }),
        kpi({ label: 'Pending proposals', value: fmt.num(t.pendingProposals), sub: `${t.followUps} follow-ups due`, href: '#/approvals' }));
      const series = [
        { name: 'Discovered', color: SERIES.blue, points: p.series.discovered },
        { name: 'Contacted', color: SERIES.orange, points: p.series.contacted },
        { name: 'Replies', color: SERIES.aqua, points: p.series.replies },
      ];
      const has = series.some((s) => s.points.some((x) => x.value));
      const funnel = [
        { label: 'Discovered', value: t.leads },
        { label: 'Researched', value: leads.filter((l) => l.score != null).length },
        { label: 'Demo built', value: leads.filter((l) => l.preview_url).length },
        { label: 'Contacted', value: t.contacted },
        { label: 'Replied', value: t.replied },
        { label: 'Won', value: t.clients },
      ];
      clear(row1).append(
        chartCard({ cls: 'span-2', title: 'Lead flow', eyebrow: `PER ${p.range.bucket.toUpperCase()}`, draw: (c) => (has ? lineChart(c, { series, bucket: p.range.bucket, height: 250 }) : (c.append(empty('No activity in this period')), null)), table: () => seriesTable(series, { bucket: p.range.bucket }) }),
        h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Conversion funnel' }), h('span', { class: 'eyebrow', text: 'ALL TIME' })),
          h('div', { class: 'panel-body' }, t.leads ? [hbars(funnel), h('div', { class: 'muted', style: { fontSize: '11px', marginTop: '8px' }, text: 'Each stage counts leads that reached it. Ratios: ' + funnel.slice(1).map((f, i) => `${f.label} ${funnel[i].value ? fmt.pct(f.value / funnel[i].value) : '—'}`).join(' · ') })] : empty('No leads yet'))));
      const buckets = [['0–19', 0, 20], ['20–39', 20, 40], ['40–59', 40, 60], ['60–79', 60, 80], ['80–100', 80, 101]];
      const scored = leads.filter((l) => l.score != null);
      clear(row2).append(
        h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Opportunity scores' }), h('span', { class: 'eyebrow', text: `${scored.length} SCORED` })),
          h('div', { class: 'panel-body' }, scored.length ? hbars(buckets.map(([label, lo, hi]) => ({ label: `Score ${label}`, value: scored.filter((l) => l.score >= lo && l.score < hi).length }))) : empty('No leads scored yet'))),
        h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Pipeline by stage' }), h('span', { class: 'eyebrow', text: 'NOW' })),
          h('div', { class: 'panel-body' }, t.leads ? hbars(p.board.map((b) => ({ label: b.label, value: b.count, color: b.id === 'lost' ? '#485162' : undefined }))) : empty('No leads yet'))),
        h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Lead sources' })),
          h('div', { class: 'panel-body' }, leads.length ? hbars(Object.entries(leads.reduce((m, l) => ((m[l.source] = (m[l.source] || 0) + 1), m), {})).map(([label, value]) => ({ label: label.replace(/_/g, ' '), value }))) : empty('No leads yet'))));
      clear(ops).append(
        kpi({ label: 'Websites created', value: fmt.num(o.demosBuilt), sub: `${o.leadsWithDemos} businesses` }),
        kpi({ label: 'Under development', value: fmt.num(o.inDevelopment) }),
        kpi({ label: 'Active demos', value: fmt.num(o.activeDemos) }),
        kpi({ label: 'Awaiting publish approval', value: fmt.num(o.awaitingPublishApproval), href: '#/approvals' }),
        kpi({ label: 'Maintenance clients', value: fmt.num(o.maintenanceClients) }),
        kpi({ label: 'Uptime · 30d', value: o.uptime == null ? null : fmt.pct(o.uptime, 2), na: 'No sites monitored', sub: `${o.productionSites} site${o.productionSites === 1 ? '' : 's'} · ${o.sitesDown} down`, href: '#/builder' }));
    } catch (e) { clear(tiles).append(h('div', { style: { gridColumn: '1/-1' } }, errorBox(e))); } finally { root.classList.remove('loading-frame'); }
  }
  await load();
}
