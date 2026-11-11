// APPROVALS — the owner's decision queue. Nothing binding happens without a click here.
import { h, clear, fmt, empty, errorBox } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { approvalCard, viewHead } from './_shared.js';

export default async function approvals(root, ctx) {
  let tab = 'pending';
  const body = h('div', {});
  const tabs = h('div', { class: 'tabs', role: 'tablist' }, [['pending', 'Waiting on you'], ['all', 'History']].map(([k, l]) =>
    h('button', { role: 'tab', 'aria-selected': String(k === tab), text: l, onclick: (e) => { tab = k; tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === e.target))); load(); } })));
  root.append(viewHead('Approvals', 'AKUMARU runs research, demos, previews and drafts on its own. Sending email, publishing live sites, payments, contracts and campaigns always wait for you here — with the exact content shown before you approve.'), tabs, body);

  async function load() {
    try {
      const list = await api.get(`/api/approvals?status=${tab}`);
      clear(body);
      if (!list.length) return body.append(h('section', { class: 'panel' }, empty(tab === 'pending' ? 'Nothing needs your decision' : 'No approval history yet', tab === 'pending' ? 'When AKUMARU wants to send, publish or spend, it will ask here first.' : '')));
      if (tab === 'pending') {
        body.append(h('section', { class: 'panel' }, h('div', { class: 'list' }, list.map((a) => approvalCard(a, () => { load(); ctx.refreshStatus(); })))));
      } else {
        body.append(h('section', { class: 'panel' }, h('div', { class: 'table-wrap', style: { maxHeight: 'none' } }, h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, ['#', 'Action', 'Summary', 'Status', 'Requested', 'Decided by', 'Result'].map((c) => h('th', { text: c })))),
          h('tbody', {}, list.map((a) => h('tr', {},
            h('td', { class: 'mono muted', text: a.id }), h('td', {}, h('span', { class: 'pill', text: a.action.replace(/_/g, ' ') })), h('td', { text: a.summary }),
            h('td', {}, h('span', { class: `status-text` }, h('i', { class: `dot ${{ executed: 'good', approved: 'good', rejected: 'idle', failed: 'critical', pending: 'warning' }[a.status]}` }), a.status)),
            h('td', { class: 'mono', text: fmt.ago(a.requested_at) }), h('td', { class: 'dim', text: a.decided_by || '—' }),
            h('td', { class: a.status === 'failed' ? '' : 'dim', style: a.status === 'failed' ? { color: 'var(--critical-text)' } : {}, text: a.result?.error || a.result?.note || (a.result?.providerMessageId ? `sent · ${a.result.providerMessageId}` : a.result?.url || '—') }))))))));
      }
    } catch (e) { body.replaceChildren(errorBox(e)); }
  }
  ctx.onLive((type, d) => { if (type === 'activity' && /approval_/.test(d.action)) load(); });
  await load();
}
