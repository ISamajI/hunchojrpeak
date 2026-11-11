// SYSTEM HEALTH — live infrastructure map, process/DB telemetry, error log.
import { h, clear, fmt, empty, errorBox } from '../lib/dom.js';
import { api, live } from '../lib/api.js';
import { kpi, viewHead, sectionTitle, streamRow } from './_shared.js';

function topology(sys, linkStatus, running) {
  const W = 1100, H = 430;
  const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'System topology' });
  const nodes = {};
  const node = (id, x, y, w, title, sub, cls) => { nodes[id] = { x, y, w, h: 50 }; svg.append(h('g', { class: `node ${cls}` }, h('title', { text: `${title} — ${sub}` }), h('rect', { x, y, width: w, height: 50, rx: 9 }), h('text', { x: x + w / 2, y: y + 22, 'text-anchor': 'middle', text: title }), h('text', { class: 'sub', x: x + w / 2, y: y + 38, 'text-anchor': 'middle', text: sub }))); };
  const link = (a, b, cls = '') => { const A = nodes[a], B = nodes[b]; const x1 = A.x + A.w / 2, y1 = A.y + 50, x2 = B.x + B.w / 2, y2 = B.y; const my = (y1 + y2) / 2; svg.prepend(h('path', { class: `link ${cls}`, d: `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}` })); };
  node('ui', 470, 10, 160, 'Command Center', linkStatus === 'live' ? 'SSE LINK LIVE' : 'RECONNECTING', linkStatus === 'live' ? 'good' : 'warn');
  node('api', 470, 100, 160, 'API Server', `NODE ${sys.process.node} · ${fmt.dur(sys.process.uptimeSec)}`, 'good');
  node('db', 120, 190, 170, 'SQLite Database', `${sys.database.ok ? 'INTEGRITY OK' : 'CHECK FAILED'} · ${sys.database.latencyMs}ms`, sys.database.ok ? 'good' : 'bad');
  node('jobs', 330, 190, 170, 'Job Runner', `${sys.jobs.running} RUNNING · ${sys.jobs.queued} QUEUED`, sys.jobs.running ? 'active' : 'good');
  node('bus', 600, 190, 170, 'Event Bus', `${sys.realtime.clients} LIVE CLIENT${sys.realtime.clients === 1 ? '' : 'S'}`, 'good');
  node('sched', 810, 190, 170, 'Scheduler', sys.scheduler.running ? `${sys.scheduler.enabled} ENABLED` : 'STOPPED', sys.scheduler.running ? 'good' : 'warn');
  const agentW = 160, agentGap = (W - 20 - agentW * 6) / 5;
  sys.agents.forEach((a, i) => node(`a_${a.id}`, 10 + i * (agentW + agentGap), 280, agentW, a.name, a.status.toUpperCase(), { active: 'active', offline: 'bad', attention: 'warn', queued: 'warn', standby: '' }[a.status]));
  const ints = sys.integrations.filter((i) => !['dashboard_auth', 'inbound'].includes(i.key));
  const intW = 140, intGap = (W - 20 - intW * ints.length) / Math.max(1, ints.length - 1);
  ints.forEach((it, i) => node(`i_${it.key}`, 10 + i * (intW + intGap), 370, intW, it.label.replace(/ \(.*\)/, '').replace('Google Places API (New)', 'Google Places').replace('OpenStreetMap', 'OpenStreetMap'), it.configured ? 'CONFIGURED' : 'NOT CONNECTED', it.configured ? 'good' : ''));
  link('ui', 'api', linkStatus === 'live' ? 'live' : 'off');
  ['db', 'jobs', 'bus', 'sched'].forEach((n) => link('api', n, n === 'jobs' && running ? 'live' : n === 'bus' && sys.realtime.clients ? 'live' : ''));
  const agentFor = { anthropic: ['sales', 'web', 'marketing', 'client'], google_places: ['sales'], openstreetmap: ['sales'], vercel: ['web'], resend: ['client'], twilio: ['security'] };
  sys.agents.forEach((a) => link('jobs', `a_${a.id}`, a.status === 'active' ? 'live' : a.status === 'offline' ? 'off' : ''));
  ints.forEach((it) => (agentFor[it.key] || []).slice(0, 1).forEach((ag) => link(`a_${ag}`, `i_${it.key}`, it.configured ? '' : 'off')));
  return svg;
}

export default async function health(root, ctx) {
  const map = h('div', { class: 'topology' });
  const tiles = h('div', { class: 'grid cols-6 kpis' });
  const dbBox = h('div', { class: 'panel-body' });
  const errors = h('div', { class: 'stream-list', style: { position: 'static', maxHeight: '360px' } });
  const intBox = h('div', { class: 'list' });
  root.append(viewHead('System Health', 'Live map of the AKUMARU infrastructure — refreshed every 5 seconds and on every event.'),
    h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Infrastructure map' }), h('span', { class: 'eyebrow', text: 'LIVE' })), h('div', { class: 'panel-body', style: { overflowX: 'auto' } }, map)),
    h('div', { class: 'mt' }, tiles),
    h('div', { class: 'grid cols-3 mt' },
      h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Database' })), dbBox),
      h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'API connectivity' }), h('div', { class: 'chart-card-tools' }, h('a', { class: 'btn sm ghost', href: '#/integrations', text: 'Details' }))), intBox),
      h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Errors · 24h' })), errors)));
  let busy = false;
  async function load() {
    if (busy) return;
    busy = true;
    try {
      const s = await api.get('/api/system');
      clear(map).append(h('div', { style: { minWidth: '860px' } }, topology(s, live.status, ctx.state.jobs.some((j) => j.status === 'running'))));
      clear(tiles).append(
        kpi({ label: 'Uptime', value: fmt.dur(s.process.uptimeSec), sub: s.process.platform }),
        kpi({ label: 'Memory (RSS)', value: `${s.process.rssMb} MB`, sub: `heap ${s.process.heapUsedMb}/${s.process.heapTotalMb} MB` }),
        kpi({ label: 'Event loop p99', value: `${s.process.eventLoopP99Ms} ms`, sub: `mean ${s.process.eventLoopMeanMs} ms` }),
        kpi({ label: 'Load average', value: s.process.loadAvg[0].toFixed(2), sub: `${s.process.cpus} CPUs · 5m ${s.process.loadAvg[1]}` }),
        kpi({ label: 'Operations', value: `${s.jobs.running} / ${s.jobs.queued}`, sub: `running / queued · ${s.jobs.done} done · ${s.jobs.failed} failed` }),
        kpi({ label: 'Errors · 24h', value: fmt.num(s.errors24h.length), sub: s.errors24h.length ? 'see log below' : 'none' }));
      clear(dbBox).append(h('table', { class: 'data' }, h('tbody', {},
        [['Integrity', s.database.ok ? 'OK' : 'FAILED'], ['Query latency', `${s.database.latencyMs} ms`], ['Size on disk', fmt.bytes(s.database.bytes)], ['Schema version', s.database.schemaVersion],
          ...Object.entries(s.database.rows).map(([k, v]) => [`${k} rows`, fmt.num(v)])].map(([k, v]) => h('tr', {}, h('td', { class: 'muted', text: k }), h('td', { class: 'r num', text: v }))))));
      clear(intBox).append(...s.integrations.map((i) => h('div', { class: 'list-item', style: { alignItems: 'center', padding: '8px 16px' } }, h('i', { class: `dot ${i.configured ? 'good' : 'idle'}` }), h('div', { class: 'grow title', text: i.label }), h('span', { class: 'mono muted', style: { fontSize: '10.5px' }, text: i.configured ? 'CONFIGURED' : 'NOT CONNECTED' }))));
      clear(errors);
      if (!s.errors24h.length) errors.append(empty('No errors in the last 24 hours'));
      s.errors24h.forEach((e) => errors.append(streamRow({ ...e, text: e.action.replace(/_/g, ' '), detail: e.detail ? JSON.parse(e.detail) : null })));
    } catch (e) { clear(tiles).append(h('div', { style: { gridColumn: '1/-1' } }, errorBox(e))); } finally { busy = false; }
  }
  const timer = setInterval(load, 5000);
  ctx.onLive((type) => { if (type === 'job') load(); });
  const offLink = live.onStatus(() => load());
  await load();
  return () => { clearInterval(timer); offLink(); };
}
