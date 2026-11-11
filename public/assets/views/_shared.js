// Components shared across views.
import { h, clear, fmt, delta, confirmDialog, toast, statusDot, promptDialog } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { sparkline } from '../lib/charts.js';
import { AGENT, AGENT_STATUS, JOB_STATUS, actorLabel } from '../lib/labels.js';

export const RANGE_KEYS = [['7d', '7D'], ['30d', '30D'], ['90d', '90D'], ['12m', '12M'], ['all', 'ALL']];
export function rangeControl(value, onChange) {
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Date range' });
  for (const [k, label] of RANGE_KEYS) {
    seg.append(h('button', { type: 'button', 'aria-pressed': String(k === value), text: label, title: k === 'all' ? 'All time' : `Last ${label.toLowerCase()}`,
      onclick: () => { seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === label))); onChange(k); } }));
  }
  return seg;
}
export function savedRange(fallback = '30d') {
  try { return localStorage.getItem('akumaru_range') || fallback; } catch { return fallback; }
}
export function saveRange(k) { try { localStorage.setItem('akumaru_range', k); } catch { /* ignore */ } }

/** KPI tile. `value` null → explicit "no data" state with a reason. */
export function kpi({ label, value, sub, deltaValue, goodWhenUp = true, spark, na, title, href }) {
  const tile = h(href ? 'a' : 'div', { class: 'panel kpi', title: title || '', href, style: href ? { color: 'inherit', textDecoration: 'none' } : {} },
    h('div', { class: 'label', text: label }),
    value == null ? h('div', { class: 'value na', text: na || 'No data yet' }) : h('div', { class: 'value', text: value }),
    h('div', { class: 'sub' }, deltaValue !== undefined && value != null ? delta(deltaValue, { goodWhenUp }) : null, sub && h('span', { text: sub })),
    spark && value != null ? h('div', { class: 'spark' }, sparkline(spark)) : null);
  return tile;
}

export function agentGlyph(id) {
  return h('div', { class: 'agent-glyph' }, icon(AGENT[id]?.icon || 'agents'));
}

export function agentCard(a, { compact = false } = {}) {
  const [dot, label] = AGENT_STATUS[a.status] || AGENT_STATUS.standby;
  const live = a.status === 'active';
  const task = a.currentTask || (a.status === 'offline' ? `Needs ${(a.missingLabels || a.missing).join(', ')} — see Integrations` : a.recent[0] ? `Last: ${a.recent[0].text} · ${fmt.ago(a.recent[0].ts)}` : 'No activity recorded yet');
  return h('a', { class: 'panel agent-card', href: `#/agents`, style: { color: 'inherit', textDecoration: 'none' } },
    h('div', { class: 'head' }, agentGlyph(a.id),
      h('div', { style: { minWidth: 0, flex: 1 } }, h('div', { class: 'name truncate', text: a.name }), h('div', { class: 'code', text: a.codename })),
      statusDot(dot, label)),
    h('div', { class: `task ${live ? 'live' : ''}` }, live && h('span', { class: 'caret' }), h('span', { class: 'truncate', text: task })),
    !compact && h('div', { class: 'dim', style: { padding: '10px 16px 0', fontSize: '12px' }, text: a.mission }),
    h('div', { class: 'stats' },
      h('div', {}, h('b', { text: fmt.num(a.performance.actions7d) }), 'actions · 7d'),
      h('div', {}, h('b', { text: a.performance.successRate == null ? '—' : fmt.pct(a.performance.successRate) }), 'success rate'),
      h('div', {}, h('b', { text: a.queued || 0 }), 'queued')));
}

export function jobCard(job, { expanded = false } = {}) {
  const [dot, label] = JOB_STATUS[job.status] || ['idle', job.status];
  const el = h('div', { class: 'job-card', dataset: { job: job.id } });
  const fill = h('i', { style: { width: `${Math.round((job.progress || 0) * 100)}%` } });
  const stepEl = h('div', { class: 'op-step' }, job.status === 'running' && h('span', { class: 'caret' }), h('span', { text: job.status === 'failed' ? job.error : job.status === 'done' ? `Completed${job.finished_at ? ' ' + fmt.ago(job.finished_at) : ''}` : job.step || (job.status === 'queued' ? 'Waiting for a free worker…' : '') }));
  el.append(
    h('div', { class: 'op-head' }, h('span', { class: 'op-label', text: job.label }), h('div', { class: 'spacer' }), statusDot(dot, label), h('span', { class: 'mono muted', style: { fontSize: '11px' }, text: `#${job.id}` })),
    stepEl,
    h('div', { class: 'meter cyan' }, fill));
  if (expanded && job.steps?.length) el.append(h('div', { class: 'steps' }, job.steps.slice(-40).map((s) => h('div', {}, `${fmt.time(s.at)}  ${s.text}`))));
  if (job.status === 'done' && job.result) el.append(jobResult(job));
  return el;
}

export function jobResult(job) {
  const r = job.result;
  if (!r) return null;
  if (r.summary) {
    const s = r.summary;
    return h('div', { class: 'row tight mt', style: { fontSize: '12px' } },
      ['discovered', 'new', 'demos', 'previews', 'queuedForApproval', 'errors'].map((k) => h('span', { class: 'pill' }, h('b', { text: s[k] }), { discovered: 'found', new: 'new', demos: 'demos', previews: 'previews', queuedForApproval: 'awaiting you', errors: 'errors' }[k])),
      s.queuedForApproval ? h('a', { class: 'btn sm', href: '#/approvals', text: 'Review approvals →' }) : null);
  }
  if (r.previewUrl) return h('div', { class: 'row mt' }, h('a', { class: 'btn sm', href: r.previewUrl, target: '_blank', rel: 'noopener' }, icon('external'), 'Open preview'), h('span', { class: 'muted', style: { fontSize: '11.5px' }, text: `v${r.version} · ${r.copy} copy · ${r.provider}` }));
  if (r.findings) return h('ul', { style: { margin: '10px 0 0', paddingLeft: '18px', fontSize: '12.5px' } }, r.findings.map((f) => h('li', { text: f })));
  if (r.leads) return h('div', { class: 'mt dim', style: { fontSize: '12px' }, text: `${r.count} prospect(s) need follow-up.` });
  if (r.title && r.sections) return h('div', { class: 'row mt' }, h('a', { class: 'btn sm', href: '#/marketing', text: `Open draft: ${r.title}` }));
  if (r.checked != null) return h('div', { class: 'mt dim', style: { fontSize: '12px' }, text: `${r.checked} site(s) checked, ${r.down} down.` });
  return null;
}

/** Approval card with exact preview; approve requires an explicit confirmation showing the content. */
export function approvalCard(a, onDone) {
  const isSend = ['send_outreach', 'send_reply'].includes(a.action);
  const actions = h('div', { class: 'row tight' },
    h('button', { class: 'btn good sm', onclick: async () => {
      const ok = await confirmDialog({
        title: isSend ? 'Send this email?' : 'Approve this action?',
        body: `${a.summary}. ${a.reason}`,
        detail: a.preview ? h('pre', { class: 'code', text: a.preview }) : null,
        confirmLabel: isSend ? 'Approve & send' : 'Approve & execute',
      });
      if (!ok) return;
      try {
        const r = await api.post(`/api/approvals/${a.id}/approve`);
        if (r.status === 'failed') toast('Approved, but execution failed', r.result?.error, 'critical');
        else toast('Approved', r.note || a.summary, 'good');
      } catch (e) { toast('Could not approve', e.message, 'critical'); }
      onDone?.();
    } }, icon('check'), isSend ? 'Approve & send' : 'Approve'),
    h('button', { class: 'btn danger sm', onclick: async () => {
      const note = await promptDialog({ title: 'Reject this request?', label: 'Reason (optional — helps AKUMARU learn your preferences)', confirmLabel: 'Reject' });
      if (note === null) return;
      try { await api.post(`/api/approvals/${a.id}/reject`, { note }); toast('Rejected', a.summary); } catch (e) { toast('Could not reject', e.message, 'critical'); }
      onDone?.();
    } }, icon('x'), 'Reject'));
  return h('div', { class: 'list-item', style: { flexDirection: 'column', alignItems: 'stretch', gap: '8px' } },
    h('div', { class: 'row tight' }, h('span', { class: 'pill cyan', text: a.action.replace(/_/g, ' ') }), h('span', { class: 'meta', text: fmt.ago(a.requested_at) })),
    h('div', { class: 'title', style: { whiteSpace: 'normal' }, text: a.summary }),
    h('div', { class: 'meta', style: { fontFamily: 'var(--font)' }, text: a.reason }),
    a.preview && h('details', {}, h('summary', { class: 'muted', style: { cursor: 'pointer', fontSize: '11.5px' }, text: 'Show exact content' }), h('pre', { class: 'code', style: { marginTop: '6px' }, text: a.preview })),
    actions);
}

export function streamRow(a) {
  const fail = /failed|down|unauthenticated/.test(a.action);
  return h('div', { class: `stream-row ${fail ? 'fail' : ''}`, title: a.detail ? JSON.stringify(a.detail) : '' },
    h('span', { class: 'ts', text: fmt.time(a.ts) }),
    h('span', { class: 'who' }, h('i', { class: `dot ${fail ? 'critical' : a.agent ? 'good' : 'idle'}` }), actorLabel(a)),
    h('span', { class: 'what' }, a.text || a.action, describeDetail(a)));
}

function describeDetail(a) {
  const d = a.detail || {};
  const bits = [];
  if (d.name) bits.push(d.name);
  if (d.score != null) bits.push(`score ${d.score}`);
  if (d.from && d.to) bits.push(`${fmt.stage(d.from)} → ${fmt.stage(d.to)}`);
  if (d.summary) bits.push(d.summary);
  if (d.text) bits.push(`“${d.text}”`);
  if (d.url) bits.push(d.url);
  if (d.new != null && d.category) bits.push(`${d.new} new · ${d.category} near ${d.near}`);
  if (d.intent) bits.push(String(d.intent).replace(/_/g, ' '));
  if (d.error) bits.push(d.error);
  if (d.label) bits.push(d.label);
  return bits.length ? h('span', { class: 'muted', text: ` — ${bits.join(' · ')}` }) : null;
}

export function stagePill(stage) {
  return h('span', { class: 'pill', text: fmt.stage(stage) });
}
export function scoreCell(score) {
  if (score == null) return h('span', { class: 'muted', text: '—' });
  return h('span', { class: 'score', title: score >= 60 ? 'Hot opportunity' : score >= 40 ? 'Warm' : 'Cold' }, h('span', { class: 'bar' }, h('i', { style: { width: `${score}%` } })), String(score));
}

export function sectionTitle(title, extra) {
  return h('div', { class: 'section-title' }, h('h2', { text: title }), extra);
}

export function viewHead(title, subtitle, tools) {
  return h('div', { class: 'view-head' }, h('div', {}, h('h2', { text: title }), subtitle && h('p', { text: subtitle })), h('div', { class: 'spacer' }), tools);
}

export { clear };

/** Local previews are stored with the configured public URL; map loopback ones onto this origin so they embed. */
export function localPreview(url) {
  if (!url) return null;
  try {
    const u = new URL(url, location.origin);
    if (u.origin === location.origin) return u.pathname;
    if (['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) && u.pathname.startsWith('/preview/')) return u.pathname;
  } catch { /* ignore */ }
  return null;
}
