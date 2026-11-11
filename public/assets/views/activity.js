// LIVE ACTIVITY — every operation and every logged action, streaming.
import { h, clear, fmt, empty, errorBox, statusDot } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { AGENT, JOB_STATUS } from '../lib/labels.js';
import { jobCard, streamRow, viewHead, jobResult } from './_shared.js';

export default async function activity(root, ctx) {
  let filter = 'all';
  let q = '';
  let rows = [];
  const runningBox = h('div', { class: 'stack', style: { gap: '8px' } });
  const jobsBox = h('div', { class: 'list' });
  const streamBox = h('div', { class: 'stream-list', style: { position: 'static', maxHeight: '640px' } });
  const agentSel = h('select', { class: 'input', 'aria-label': 'Filter by agent', onchange: (e) => { filter = e.target.value; drawStream(); } },
    h('option', { value: 'all', text: 'All agents' }), Object.entries(AGENT).map(([k, v]) => h('option', { value: k, text: v.name })), h('option', { value: 'owner', text: 'Your actions' }), h('option', { value: 'failures', text: 'Failures only' }));
  const search = h('input', { class: 'input', placeholder: 'Filter…', 'aria-label': 'Filter activity', oninput: (e) => { q = e.target.value.toLowerCase(); drawStream(); } });

  root.append(viewHead('Live Activity', 'Everything AKUMARU is executing right now, every operation it has run, and the full audit trail — streamed in real time.'),
    h('div', { class: 'grid cols-3' },
      h('div', { class: 'stack' },
        h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Executing now' }), h('span', { class: 'eyebrow', text: 'LIVE' })), h('div', { class: 'panel-body' }, runningBox)),
        h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Operations' }), h('span', { class: 'eyebrow', text: 'RECENT' })), h('div', { style: { maxHeight: '520px', overflowY: 'auto' } }, jobsBox))),
      h('section', { class: 'panel span-2' },
        h('header', { class: 'panel-head' }, h('h2', { text: 'Audit stream' }), h('span', { class: 'eyebrow', text: 'EVERY ACTION' }), h('div', { class: 'chart-card-tools' }, search, agentSel)),
        streamBox)));

  const highlight = Number(ctx.query.get('job')) || null;

  function drawRunning() {
    clear(runningBox);
    if (!ctx.state.jobs.length) runningBox.append(empty('Nothing executing', 'Agents are on standby.'));
    ctx.state.jobs.forEach((j) => runningBox.append(jobCard(j, { expanded: true })));
  }
  async function loadJobs() {
    try {
      const jobs = await api.get('/api/jobs?limit=60');
      clear(jobsBox);
      if (!jobs.length) return jobsBox.append(empty('No operations yet', 'Run a command or the pipeline to get started.'));
      for (const j of jobs) {
        const [dot, label] = JOB_STATUS[j.status];
        const det = h('details', { open: j.id === highlight },
          h('summary', { class: 'list-item click', style: { listStyle: 'none' } },
            h('i', { class: `dot ${dot}`, style: { marginTop: '6px' } }),
            h('div', { class: 'grow' }, h('div', { class: 'title truncate', text: j.label }), h('div', { class: 'meta', text: `#${j.id} · ${label} · ${j.source} · ${fmt.ago(j.finished_at || j.started_at || j.created_at)}` }))),
          h('div', { style: { padding: '0 16px 12px' } },
            j.error && h('div', { class: 'error-box', text: j.error }),
            j.steps?.length ? h('pre', { class: 'code', text: j.steps.map((s) => `${fmt.time(s.at)}  ${s.text}`).join('\n') }) : h('div', { class: 'muted', style: { fontSize: '12px' }, text: 'No steps recorded.' }),
            jobResult(j)));
        jobsBox.append(det);
      }
    } catch (e) { jobsBox.replaceChildren(errorBox(e)); }
  }
  function drawStream() {
    clear(streamBox);
    const shown = rows.filter((r) => {
      if (filter === 'failures' && !/failed|down/.test(r.action)) return false;
      if (filter === 'owner' && !String(r.actor).startsWith('owner')) return false;
      if (!['all', 'failures', 'owner'].includes(filter) && r.agent !== filter) return false;
      if (q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
      return true;
    });
    if (!shown.length) streamBox.append(empty('No matching activity'));
    shown.forEach((r) => streamBox.append(streamRow(r)));
  }
  ctx.onLive((type, d) => {
    if (type === 'activity') { rows.unshift(d); rows = rows.slice(0, 500); drawStream(); }
    if (type === 'job' && ['done', 'failed', 'queued'].includes(d.status)) loadJobs();
  });
  ctx.onState(drawRunning);
  drawRunning();
  try { rows = await api.get('/api/activity?limit=300'); drawStream(); } catch (e) { streamBox.replaceChildren(errorBox(e)); }
  await loadJobs();
  void icon; void statusDot;
}
