// OVERVIEW — the central operating station.
import { h, clear, fmt, empty, errorBox } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { lineChart, hbars, seriesTable, chartCard, SERIES } from '../lib/charts.js';
import { AGENT } from '../lib/labels.js';
import { kpi, agentCard, jobCard, approvalCard, streamRow, rangeControl, savedRange, saveRange, sectionTitle } from './_shared.js';

const ORDER = ['sales', 'web', 'marketing', 'client', 'analytics', 'security'];

/** The core: an orbit of the six agents around AKUMARU. Every mark reflects live status. */
function coreViz(agents, jobs) {
  const running = jobs.filter((j) => j.status === 'running').length;
  const S = 280, C = S / 2, R = 108;
  const svg = h('svg', { viewBox: `0 0 ${S} ${S}`, role: 'img', 'aria-label': `AKUMARU core: ${running ? running + ' operations executing' : 'standby'}` });
  const defs = h('defs', {}, h('radialGradient', { id: 'coreGlow' }, h('stop', { offset: '0%', 'stop-color': '#3fd0ef', 'stop-opacity': running ? 0.35 : 0.14 }), h('stop', { offset: '100%', 'stop-color': '#3fd0ef', 'stop-opacity': 0 })));
  svg.append(defs, h('circle', { cx: C, cy: C, r: 86, fill: 'url(#coreGlow)' }));
  svg.append(h('circle', { cx: C, cy: C, r: R, fill: 'none', stroke: 'rgba(148,163,184,.14)', 'stroke-dasharray': '2 5' }));
  // Tick ring rotates only while work is executing — speed carries meaning.
  const ticks = h('g', { style: { transformOrigin: `${C}px ${C}px`, animation: running ? `spin ${Math.max(4, 14 - running * 4)}s linear infinite` : 'none' } });
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r1 = 64, r2 = i % 5 ? 67 : 71;
    ticks.append(h('line', { x1: C + Math.cos(a) * r1, y1: C + Math.sin(a) * r1, x2: C + Math.cos(a) * r2, y2: C + Math.sin(a) * r2, stroke: i % 5 ? 'rgba(148,163,184,.25)' : 'rgba(63,208,239,.55)', 'stroke-width': 1 }));
  }
  svg.append(ticks);
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  ORDER.forEach((id, i) => {
    const a = byId[id];
    if (!a) return;
    const ang = -Math.PI / 2 + (i / ORDER.length) * Math.PI * 2;
    const x = C + Math.cos(ang) * R, y = C + Math.sin(ang) * R;
    const color = { active: '#3fd0ef', queued: '#fab219', attention: '#ec835a', offline: '#d03b3b', standby: '#485162' }[a.status];
    svg.append(h('line', { x1: C + Math.cos(ang) * 74, y1: C + Math.sin(ang) * 74, x2: x - Math.cos(ang) * 17, y2: y - Math.sin(ang) * 17, stroke: color, 'stroke-width': a.status === 'active' ? 1.6 : 1, 'stroke-dasharray': a.status === 'active' ? '4 5' : a.status === 'offline' ? '2 4' : 'none', opacity: a.status === 'standby' ? 0.5 : 0.9, style: a.status === 'active' ? { animation: 'flow 1s linear infinite' } : {} }));
    const g = h('g', { tabindex: 0, role: 'link', 'aria-label': `${a.name}: ${a.status}`, style: { cursor: 'pointer' }, onclick: () => (location.hash = '#/agents'), onkeydown: (e) => e.key === 'Enter' && (location.hash = '#/agents') },
      h('title', { text: `${a.name} — ${a.status}${a.currentTask ? ': ' + a.currentTask : ''}` }),
      h('circle', { cx: x, cy: y, r: 16, fill: '#10141b', stroke: color, 'stroke-width': a.status === 'active' ? 2 : 1.2 }),
      a.status === 'active' && h('circle', { cx: x, cy: y, r: 16, fill: 'none', stroke: color, opacity: 0.6, style: { transformOrigin: `${x}px ${y}px`, animation: 'ping 1.6s ease-out infinite' } }),
      h('text', { x, y: y + 3.5, 'text-anchor': 'middle', fill: a.status === 'standby' ? '#a7b1c0' : color, style: { font: '600 9px var(--mono)', letterSpacing: '.04em' }, text: AGENT[id].short.slice(0, 3) }));
    svg.append(g);
  });
  svg.append(h('circle', { cx: C, cy: C, r: 46, fill: '#0b0f15', stroke: running ? '#3fd0ef' : 'rgba(63,208,239,.4)', 'stroke-width': 1.4 }));
  svg.append(h('text', { x: C, y: C - 4, 'text-anchor': 'middle', fill: '#e8edf4', style: { font: '700 10px var(--mono)', letterSpacing: '.28em' }, text: 'CORE' }));
  svg.append(h('text', { x: C, y: C + 12, 'text-anchor': 'middle', fill: running ? '#3fd0ef' : '#6c7689', style: { font: '600 9px var(--mono)', letterSpacing: '.18em' }, text: running ? 'EXECUTING' : 'STANDBY' }));
  return svg;
}

export default async function overview(root, ctx) {
  let range = savedRange();
  let data = null;
  const greet = h('div', {});
  const tools = rangeControl(range, (k) => { range = k; saveRange(k); load(); });
  root.append(h('div', { class: 'view-head' }, greet, h('div', { class: 'spacer' }), tools));

  // Row 1: core + operations + live stream | decisions + quick command
  const coreBox = h('div', { class: 'core-viz' });
  const opsBox = h('div', {});
  const streamList = h('div', { class: 'stream-list', 'aria-live': 'polite' });
  const approvalsBox = h('div', { class: 'list' });
  const approvalsCount = h('span', { class: 'badge cyan hidden' });
  const quick = h('form', { class: 'quick-cmd', onsubmit: (e) => { e.preventDefault(); const v = quickInput.value.trim(); if (!v) return; sessionStorage.setItem('akumaru_pending_cmd', v); location.hash = '#/command'; } });
  const quickInput = h('input', { placeholder: 'Tell AKUMARU what to do…', 'aria-label': 'Quick command', dataset: { commandInput: '1' } });
  quick.append(icon('command'), quickInput, h('button', { class: 'btn primary sm', 'aria-label': 'Run command' }, icon('send')));
  root.append(h('div', { class: 'grid cols-3' },
    h('section', { class: 'panel span-2' },
      h('header', { class: 'panel-head' }, h('h2', { text: 'AI Activity' }), h('span', { class: 'eyebrow', text: 'REAL-TIME' }), h('div', { class: 'chart-card-tools' }, h('a', { class: 'btn sm ghost', href: '#/activity' }, 'Full log', icon('right')))),
      h('div', { class: 'core-panel' }, coreBox, h('div', { class: 'core-ops' }, opsBox, h('div', { class: 'stream' }, streamList)))),
    h('div', { class: 'stack' },
      h('section', { class: 'panel', style: { flex: 1 } },
        h('header', { class: 'panel-head' }, h('h2', { text: 'Decisions required' }), approvalsCount, h('div', { class: 'chart-card-tools' }, h('a', { class: 'btn sm ghost', href: '#/approvals' }, 'All', icon('right')))),
        h('div', { style: { maxHeight: '300px', overflowY: 'auto' } }, approvalsBox)),
      h('section', { class: 'panel pad' }, h('div', { class: 'eyebrow', style: { marginBottom: '8px' }, text: 'COMMAND' }), quick))));

  const kpis = h('div', { class: 'grid cols-6 kpis mt' });
  root.append(kpis);
  const charts = h('div', { class: 'grid cols-3 mt' });
  root.append(charts);
  const agentsGrid = h('div', { class: 'grid cols-3' });
  root.append(sectionTitle('Autonomous agents', h('a', { class: 'btn sm ghost', href: '#/agents' }, 'Agent console', icon('right'))), agentsGrid);
  const bottom = h('div', { class: 'grid cols-3 mt' });
  root.append(bottom);

  function renderGreeting() {
    const hr = new Date().getHours();
    const part = hr < 5 ? 'Working late' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const owner = ctx.state.meta?.agency?.owner || '';
    const running = ctx.state.jobs.filter((j) => j.status === 'running').length;
    const bits = [];
    if (data) {
      const n = data.approvals.length;
      bits.push(n ? `${n} decision${n > 1 ? 's' : ''} need${n > 1 ? '' : 's'} you` : 'No decisions waiting');
      bits.push(running ? `${running} operation${running > 1 ? 's' : ''} executing` : 'agents on standby');
      bits.push(data.health.level === 'nominal' ? 'all systems nominal' : `${data.health.signals.length} signal${data.health.signals.length > 1 ? 's' : ''} need attention`);
    }
    clear(greet).append(h('h2', { text: `${part}${owner ? ', ' + owner : ''}.` }), h('p', { text: bits.join(' · ') || 'Connecting to the core…' }));
  }

  function renderCore() {
    if (!data) return;
    clear(coreBox).append(h('div', {}, coreViz(data.agents, ctx.state.jobs.length ? ctx.state.jobs : data.jobs)));
    const jobs = ctx.state.jobs;
    clear(opsBox);
    if (!jobs.length) {
      const last = data.recentJobs[0];
      opsBox.append(h('div', { class: 'op' },
        h('div', { class: 'op-head' }, h('span', { class: 'op-label', text: 'No operations running' })),
        h('div', { class: 'muted', style: { fontSize: '12px', marginTop: '4px' } }, last ? `Last: ${last.label} — ${last.status} ${fmt.ago(last.finished_at || last.created_at)}` : 'Give AKUMARU a command to start working.')));
    } else for (const j of jobs.slice(0, 3)) opsBox.append(h('div', { class: 'op' }, jobCard(j)));
  }

  function renderApprovals() {
    clear(approvalsBox);
    approvalsCount.textContent = data.approvals.length;
    approvalsCount.classList.toggle('hidden', !data.approvals.length);
    if (!data.approvals.length) approvalsBox.append(empty('Nothing needs your decision', 'Sends, publishes, payments and contracts will queue here.'));
    else data.approvals.slice(0, 4).forEach((a) => approvalsBox.append(approvalCard(a, () => { load(); ctx.refreshStatus(); })));
  }

  function renderKpis() {
    const r = data.revenue, p = data.pipeline, o = data.ops;
    const noRev = !r.hasData;
    clear(kpis).append(
      kpi({ label: 'Revenue · period', value: noRev ? null : fmt.money(r.period, { compact: true }), deltaValue: r.growth, spark: r.series.map((s) => s.value), na: 'No invoices recorded', sub: noRev ? 'Record one under Revenue' : `${fmt.money(r.total, { compact: true })} all-time`, href: '#/revenue' }),
      kpi({ label: 'Recurring (MRR)', value: noRev ? null : fmt.money(r.mrr), sub: noRev ? '' : `${r.recurringClients} recurring client${r.recurringClients === 1 ? '' : 's'}`, na: 'No recurring plans', href: '#/revenue' }),
      kpi({ label: 'Outstanding', value: noRev ? null : fmt.money(r.outstanding.cents, { compact: true }), sub: noRev ? '' : `${r.outstanding.count} open${r.outstanding.overdueCount ? ` · ${r.outstanding.overdueCount} overdue` : ''}`, na: 'No open invoices', href: '#/revenue' }),
      kpi({ label: 'New leads', value: fmt.num(p.totals.newLeads), deltaValue: p.totals.newLeadsGrowth, spark: p.series.discovered.map((s) => s.value), sub: `${fmt.num(p.totals.leads)} total`, href: '#/leads' }),
      kpi({ label: 'Conversion', value: p.totals.conversionRate == null ? null : fmt.pct(p.totals.conversionRate), na: 'No one contacted yet', sub: `${p.totals.wonContacted} won of ${p.totals.contacted} contacted`, title: 'Won ÷ prospects who were emailed', href: '#/analytics' }),
      kpi({ label: 'Active demos', value: fmt.num(o.activeDemos), sub: `${o.demosBuilt} built · ${o.qaFailures30d} QA blocks (30d)`, href: '#/demos' }));
  }

  function renderCharts() {
    const p = data.pipeline;
    const series = [
      { name: 'Discovered', color: SERIES.blue, points: p.series.discovered },
      { name: 'Contacted', color: SERIES.orange, points: p.series.contacted },
      { name: 'Replies', color: SERIES.aqua, points: p.series.replies },
    ];
    const hasFlow = series.some((s) => s.points.some((pt) => pt.value));
    clear(charts).append(
      chartCard({ cls: 'span-2', title: 'Lead flow', eyebrow: p.range.bucket === 'day' ? 'PER DAY' : `PER ${p.range.bucket.toUpperCase()}`,
        draw: (c) => (hasFlow ? lineChart(c, { series, bucket: p.range.bucket, height: 230 }) : (c.append(empty('No lead activity in this period', 'Run the pipeline or a discovery command to start the flow.')), null)),
        table: () => seriesTable(series, { bucket: p.range.bucket }) }),
      h('section', { class: 'panel' },
        h('header', { class: 'panel-head' }, h('h2', { text: 'Pipeline' }), h('span', { class: 'eyebrow', text: 'NOW' }), h('div', { class: 'chart-card-tools' }, h('a', { class: 'btn sm ghost', href: '#/projects' }, 'Board', icon('right')))),
        h('div', { class: 'panel-body' }, p.totals.leads ? hbars(p.board.map((b) => ({ label: b.label, value: b.count, id: b.id, color: b.id === 'lost' ? '#485162' : undefined })), { onClick: () => (location.hash = '#/projects') }) : empty('Pipeline is empty', 'Discovered businesses will flow through these stages.'))));
  }

  function renderAgents() {
    clear(agentsGrid).append(...data.agents.map((a) => agentCard(a, { compact: true })));
  }

  function renderBottom() {
    const o = data.ops, t = data.today, hl = data.health;
    const row = (label, value, hint) => h('div', { class: 'row', style: { justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: '12.5px' } }, h('span', { class: 'dim', text: label, title: hint || '' }), h('b', { class: 'num', text: value }));
    clear(bottom).append(
      h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Website operations' }), h('div', { class: 'chart-card-tools' }, h('a', { class: 'btn sm ghost', href: '#/builder' }, icon('right')))),
        h('div', { class: 'panel-body' },
          row('Demos built (all time)', fmt.num(o.demosBuilt)), row('Active demo previews', fmt.num(o.activeDemos)), row('In development', fmt.num(o.inDevelopment)),
          row('Awaiting publish approval', fmt.num(o.awaitingPublishApproval)), row('Maintenance clients', fmt.num(o.maintenanceClients)),
          row('Production uptime (30d)', o.uptime == null ? 'Not monitored' : fmt.pct(o.uptime, 1), 'Average across monitored client sites'), row('Alerts · 24h', fmt.num(o.alerts24h)))),
      h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Completed today' }), h('span', { class: 'eyebrow', text: t.date })),
        h('div', { class: 'panel-body' },
          row('Leads discovered', t.discovered), row('Businesses researched', t.researched), row('Demos built', t.demos), row('Previews deployed', t.previews),
          row('Outreach drafted', t.drafts), row('Emails sent (approved)', t.emailsSent), row('Replies processed', t.replies))),
      h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Business health' }), h('div', { class: 'chart-card-tools' }, h('a', { class: 'btn sm ghost', href: '#/health' }, icon('right')))),
        h('div', { class: 'panel-body' },
          h('div', { class: 'row', style: { marginBottom: '10px' } }, h('span', { class: 'status-text' }, h('i', { class: `dot ${{ nominal: 'good', attention: 'warning', serious: 'serious', critical: 'critical' }[hl.level]}` }), hl.level.toUpperCase())),
          hl.signals.length ? h('div', { class: 'stack', style: { gap: '6px' } }, hl.signals.map((s) => h('div', { class: 'row tight', style: { fontSize: '12.5px' } }, h('i', { class: `dot ${s.level === 'attention' ? 'warning' : s.level}` }), s.text)))
            : h('div', { class: 'dim', style: { fontSize: '12.5px' }, text: 'No failed operations, outages, overdue invoices or pending decisions.' }))));
  }

  async function loadStream() {
    try {
      const rows = await api.get('/api/activity?limit=40');
      clear(streamList);
      if (!rows.length) streamList.append(h('div', { class: 'muted', style: { padding: '14px 16px', fontSize: '12px' }, text: 'The live activity stream will appear here as AKUMARU works.' }));
      rows.forEach((r) => streamList.append(streamRow(r)));
    } catch (e) { streamList.replaceChildren(errorBox(e)); }
  }

  async function load() {
    root.classList.add('loading-frame');
    try {
      data = await api.get(`/api/overview?range=${range}`);
      renderGreeting(); renderCore(); renderApprovals(); renderKpis(); renderCharts(); renderAgents(); renderBottom();
    } catch (e) {
      clear(kpis).append(h('div', { style: { gridColumn: '1 / -1' } }, errorBox(e)));
    } finally { root.classList.remove('loading-frame'); }
  }

  ctx.onLive((type, d) => {
    if (type === 'activity') {
      streamList.querySelector('.muted')?.remove();
      streamList.prepend(streamRow(d));
      while (streamList.childNodes.length > 60) streamList.lastChild.remove();
    }
  });
  ctx.onState(() => { renderCore(); renderGreeting(); });
  let reloadTimer;
  ctx.onLive((type, d) => {
    if (type === 'job' && ['done', 'failed'].includes(d.status) || (type === 'activity' && /approval_|invoice_paid|stage_changed/.test(d.action))) {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(load, 600);
    }
  });
  const interval = setInterval(() => { if (data) api.get(`/api/agents`).then((a) => { data.agents = a; renderAgents(); renderCore(); }).catch(() => {}); }, 15000);
  await Promise.all([load(), loadStream()]);
  return () => { clearInterval(interval); clearTimeout(reloadTimer); };
}
