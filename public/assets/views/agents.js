// AI AGENTS — identity, status, current task, recent work, performance.
import { h, clear, fmt, errorBox, statusDot } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { AGENT_STATUS } from '../lib/labels.js';
import { agentGlyph, viewHead, jobCard, sectionTitle } from './_shared.js';
import { hbars } from '../lib/charts.js';

const LAUNCH = {
  sales: { label: 'Run discovery', href: '#/workflows' },
  web: { label: 'Generate a demo', href: '#/demos' },
  marketing: { label: 'Open Marketing Studio', href: '#/marketing' },
  client: { label: 'Find follow-ups', job: { kind: 'followup_scan', args: {} } },
  analytics: { label: 'Run analysis', job: { kind: 'analysis', args: { range: '30d' } } },
  security: { label: 'Uptime sweep', job: { kind: 'uptime', args: {} } },
};

export default async function agents(root, ctx) {
  const grid = h('div', { class: 'grid cols-3' });
  const perf = h('div', {});
  const orch = h('div', { class: 'stack', style: { gap: '8px' } });
  root.append(viewHead('AI Agents', 'Six specialist agents run LTGPeak, coordinated by the Tsunade orchestrator. Status, tasks and performance are computed from the live job queue and audit log.'), grid,
    sectionTitle('Orchestrator'), h('section', { class: 'panel' }, h('div', { class: 'panel-body' }, orch)),
    sectionTitle('Performance · last 7 days'), h('section', { class: 'panel' }, h('div', { class: 'panel-body' }, perf)));

  async function load() {
    try {
      const list = await api.get('/api/agents');
      clear(grid);
      for (const a of list) {
        const [dot, label] = AGENT_STATUS[a.status];
        const launch = LAUNCH[a.id];
        const btn = launch.job
          ? h('button', { class: 'btn sm', disabled: a.status === 'offline', onclick: async (e) => { e.target.disabled = true; try { await api.post('/api/jobs', launch.job); ctx.refreshStatus(); } finally { e.target.disabled = false; } } }, icon('play'), launch.label)
          : h('a', { class: 'btn sm', href: launch.href }, launch.label, icon('right'));
        grid.append(h('section', { class: 'panel agent-card' },
          h('div', { class: 'head' }, agentGlyph(a.id), h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 'name', text: a.name }), h('div', { class: 'code', text: `CODENAME · ${a.codename}` })), statusDot(dot, label)),
          h('div', { class: 'dim', style: { padding: '0 16px 10px', fontSize: '12.5px' }, text: a.mission }),
          h('div', { class: `task ${a.status === 'active' ? 'live' : ''}` }, a.status === 'active' && h('span', { class: 'caret' }), h('span', { class: 'truncate', text: a.currentTask || (a.status === 'offline' ? `Offline — connect ${(a.missingLabels || a.missing).join(', ')}` : 'Awaiting work') })),
          h('div', { class: 'stats' },
            h('div', {}, h('b', { text: fmt.num(a.performance.actions7d) }), 'actions · 7d'),
            h('div', {}, h('b', { text: a.performance.successRate == null ? '—' : fmt.pct(a.performance.successRate) }), 'success'),
            h('div', {}, h('b', { text: fmt.num(a.performance.failures7d) }), 'failures')),
          h('div', { style: { borderTop: '1px solid var(--line)' } },
            h('div', { class: 'eyebrow', style: { padding: '10px 16px 4px' }, text: 'RECENT ACTIVITY' }),
            a.recent.length ? h('div', { class: 'list' }, a.recent.slice(0, 5).map((r) => h('div', { class: 'list-item', style: { padding: '6px 16px' } },
              h('i', { class: `dot ${/failed/.test(r.action) ? 'critical' : 'good'}`, style: { marginTop: '6px' } }),
              h('div', { class: 'grow' }, h('div', { class: 'title truncate', text: r.text }), h('div', { class: 'meta', text: fmt.ago(r.ts) })))))
              : h('div', { class: 'muted', style: { padding: '4px 16px 12px', fontSize: '12px' }, text: 'No activity yet.' })),
          h('div', { style: { padding: '0 16px 14px', marginTop: 'auto' } }, btn)));
      }
      clear(perf).append(list.some((a) => a.performance.actions7d)
        ? hbars(list.map((a) => ({ label: a.name, value: a.performance.actions7d })), { format: (v) => fmt.num(v) })
        : h('div', { class: 'muted', style: { fontSize: '12.5px' }, text: 'No agent activity in the last 7 days.' }));
    } catch (e) { grid.replaceChildren(errorBox(e)); }
  }
  function drawOrch() {
    clear(orch);
    const jobs = ctx.state.jobs.filter((j) => j.agent === 'orchestrator');
    orch.append(h('div', { class: 'row' }, h('div', { class: 'agent-glyph' }, icon('bolt')), h('div', {}, h('div', { style: { fontWeight: 600 }, text: 'Tsunade · Orchestrator' }), h('div', { class: 'muted', style: { fontSize: '12px' }, text: 'Sequences discovery → research → demo → QA → preview → outreach; stops at every owner gate.' })), h('div', { class: 'spacer' }), statusDot(jobs.length ? 'active' : 'idle', jobs.length ? 'COORDINATING' : 'STANDBY')));
    jobs.forEach((j) => orch.append(jobCard(j)));
  }
  ctx.onState(() => { drawOrch(); });
  let t;
  ctx.onLive((type) => { if (type === 'job' || type === 'activity') { clearTimeout(t); t = setTimeout(load, 800); } });
  drawOrch();
  await load();
  return () => clearTimeout(t);
}
