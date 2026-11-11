// PROJECTS — Kanban over the real pipeline, and a complete per-project record.
import { h, clear, fmt, empty, errorBox, toast, confirmDialog, promptDialog, contextMenu } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { AGENT } from '../lib/labels.js';
import { viewHead, scoreCell, stagePill, jobCard, localPreview } from './_shared.js';

const SENSITIVE = { won: 'Mark as won? AKUMARU will create the 12-step onboarding plan.', lost: 'Mark as lost? Any pending emails to this lead will be cancelled.' };

export default async function projects(root, ctx) {
  if (ctx.params[0]) return detail(root, ctx, Number(ctx.params[0]));
  const filter = h('input', { class: 'input', placeholder: 'Filter projects…', 'aria-label': 'Filter projects', style: { width: '220px' } });
  const board = h('div', { class: 'board' });
  root.append(viewHead('Projects', 'Every opportunity from first discovery to signed client. Drag cards between columns (or right-click → Move to). Stage changes are logged; Won and Lost ask for confirmation.', h('div', { class: 'row' }, filter, h('a', { class: 'btn', href: '#/leads' }, icon('plus'), 'Add lead'))), board);

  let data = null;
  async function move(p, colId) {
    if (p.column === colId) return;
    if (SENSITIVE[colId] && !(await confirmDialog({ title: `${p.name}`, body: SENSITIVE[colId], confirmLabel: colId === 'won' ? 'Mark won' : 'Mark lost', danger: colId === 'lost' }))) return;
    try {
      await api.post(`/api/projects/${p.id}/move`, { column: colId });
      toast('Project moved', `${p.name} → ${data.board.find((c) => c.id === colId).label}`);
      load();
      ctx.refreshStatus();
    } catch (e) { toast('Could not move project', e.message, 'critical'); }
  }

  function draw() {
    const q = filter.value.toLowerCase();
    clear(board);
    for (const col of data.board) {
      const items = data.projects.filter((p) => p.column === col.id && (!q || `${p.name} ${p.city} ${p.category}`.toLowerCase().includes(q)));
      const value = items.reduce((s, p) => s + (p.value_cents || 0), 0);
      const body = h('div', { class: 'col-body', dataset: { col: col.id } });
      body.addEventListener('dragover', (e) => { e.preventDefault(); body.classList.add('drop'); });
      body.addEventListener('dragleave', () => body.classList.remove('drop'));
      body.addEventListener('drop', (e) => {
        e.preventDefault();
        body.classList.remove('drop');
        const p = data.projects.find((x) => x.id === Number(e.dataTransfer.getData('text/plain')));
        if (p) move(p, col.id);
      });
      if (!items.length) body.append(h('div', { class: 'muted', style: { fontSize: '11.5px', textAlign: 'center', padding: '18px 4px' }, text: 'Empty' }));
      for (const p of items) {
        const card = h('div', { class: 'card', draggable: 'true', tabindex: 0, role: 'button', 'aria-label': `${p.name}, ${fmt.stage(p.stage)}. Enter to open, Shift+F10 for actions.` },
          h('div', { class: 'row tight', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('div', { class: 't truncate', text: p.name }), p.pending_approvals ? h('span', { class: 'badge cyan', title: 'Awaiting your approval', text: p.pending_approvals }) : null),
          h('div', { class: 'm truncate', text: [p.category?.replace(/_/g, ' '), p.city].filter(Boolean).join(' · ') || '—' }),
          h('div', { class: 'f' }, scoreCell(p.score), h('div', { class: 'spacer' }), p.value_cents ? h('span', { class: 'num', text: fmt.money(p.value_cents, { compact: true }) }) : null),
          p.progress != null && h('div', { class: 'meter', style: { marginTop: '8px' }, title: `${p.progress}% complete` }, h('i', { style: { width: `${p.progress}%` } })),
          h('div', { class: 'f', style: { marginTop: '7px' } },
            p.agent && h('span', { class: 'muted', style: { fontFamily: 'var(--mono)', fontSize: '10px', letterSpacing: '.08em' }, text: AGENT[p.agent].short }),
            h('div', { class: 'spacer' }),
            p.deadline && h('span', { class: new Date(p.deadline) < new Date() ? '' : 'muted', style: new Date(p.deadline) < new Date() ? { color: 'var(--critical-text)' } : {}, text: `due ${fmt.date(p.deadline)}` }),
            p.preview_url && h('a', { href: p.preview_url, target: '_blank', rel: 'noopener', title: 'Open demo preview', onclick: (e) => e.stopPropagation() }, icon('external'))));
        card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(p.id)); card.classList.add('dragging'); });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        card.addEventListener('click', () => ctx.navigate(`#/projects/${p.id}`));
        const menu = (x, y) => contextMenu(x, y, [
          { label: 'Open project', icon: 'right', run: () => ctx.navigate(`#/projects/${p.id}`) },
          { label: 'Process next steps', icon: 'play', run: async () => { await api.post('/api/jobs', { kind: 'process_lead', args: { businessId: p.id } }); ctx.refreshStatus(); toast('Queued', `Advancing ${p.name}`); } },
          '-',
          ...data.board.filter((c) => c.id !== p.column).map((c) => ({ label: `Move to ${c.label}`, run: () => move(p, c.id) })),
        ]);
        card.addEventListener('contextmenu', (e) => { e.preventDefault(); menu(e.clientX, e.clientY); });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') ctx.navigate(`#/projects/${p.id}`);
          if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') { e.preventDefault(); const r = card.getBoundingClientRect(); menu(r.left + 20, r.bottom); }
        });
        body.append(card);
      }
      board.append(h('section', { class: 'col', 'aria-label': col.label },
        h('div', { class: 'col-head' }, h('h3', { text: col.label }), h('span', { class: 'badge', text: items.length }), h('span', { class: 'sum', text: value ? fmt.money(value, { compact: true }) : '' })), body));
    }
  }
  async function load() {
    try { data = await api.get('/api/projects'); draw(); } catch (e) { board.replaceChildren(errorBox(e)); }
  }
  filter.addEventListener('input', () => data && draw());
  let t;
  ctx.onLive((type, d) => { if ((type === 'activity' && /stage_changed|lead_created|approval_/.test(d.action)) || (type === 'job' && d.status === 'done')) { clearTimeout(t); t = setTimeout(load, 500); } });
  await load();
  return () => clearTimeout(t);
}

async function detail(root, ctx, id) {
  let tab = 'overview';
  let d;
  const head = h('div', {});
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const body = h('div', {});
  root.append(h('a', { class: 'btn sm ghost', href: '#/projects', style: { marginBottom: '10px' } }, icon('chevron'), 'All projects'), head, tabs, body);

  const action = (label, ic, fn, cls = '') => h('button', { class: `btn ${cls}`, onclick: async (e) => { e.currentTarget.disabled = true; try { await fn(); } catch (err) { toast(label + ' failed', err.message, 'critical'); } finally { e.currentTarget && (e.currentTarget.disabled = false); load(); ctx.refreshStatus(); } } }, icon(ic), label);

  function drawHead() {
    const b = d.business, p = d.project;
    ctx.setTitle(b.name);
    clear(head).append(h('div', { class: 'view-head' },
      h('div', {}, h('div', { class: 'row tight' }, stagePill(p.stage), scoreCell(p.score), p.agent && h('span', { class: 'pill', text: AGENT[p.agent].name })),
        h('h2', { style: { marginTop: '8px' }, text: b.name }),
        h('p', { text: [b.category?.replace(/_/g, ' '), b.address || b.city, b.phone, b.email].filter(Boolean).join(' · ') || 'No contact details yet' }),
        b.website && h('a', { href: b.website, target: '_blank', rel: 'noopener', style: { fontSize: '12.5px' } }, b.website)),
      h('div', { class: 'spacer' }),
      h('div', { class: 'row tight' },
        action('Process next steps', 'play', () => api.post('/api/jobs', { kind: 'process_lead', args: { businessId: id } }), 'primary'),
        action('Build demo', 'demos', () => api.post('/api/jobs', { kind: 'build_demo', args: { businessId: id } })),
        h('button', { class: 'btn', 'aria-label': 'More actions', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); contextMenu(r.left, r.bottom + 4, [
          { label: 'Mark won → onboarding', icon: 'check', run: async () => { if (await confirmDialog({ title: 'Mark as won?', body: SENSITIVE.won, confirmLabel: 'Mark won' })) { await api.post(`/api/projects/${id}/move`, { column: 'won' }); load(); } } },
          { label: 'Mark lost', icon: 'x', run: async () => { if (await confirmDialog({ title: 'Mark as lost?', body: SENSITIVE.lost, confirmLabel: 'Mark lost', danger: true })) { await api.post(`/api/projects/${id}/move`, { column: 'lost' }); load(); } } },
          { label: 'Request production publish', icon: 'globe', run: async () => { if (await confirmDialog({ title: 'Request production publish?', body: 'This queues an approval. Nothing goes live until you approve it in Approvals.', confirmLabel: 'Request approval' })) { try { await api.post(`/api/leads/${id}/publish`); toast('Approval requested', 'See Approvals'); ctx.refreshStatus(); } catch (err) { toast('Cannot request publish', err.message, 'critical'); } } } },
          '-',
          { label: 'Add note', icon: 'content', run: async () => { const n = await promptDialog({ title: 'Add a note', label: 'Note', multiline: true }); if (n) { await api.post(`/api/leads/${id}/note`, { note: n }); load(); } } },
        ]); } }, icon('more')))));
    // Meta strip: value, deadline, progress, paid
    const valueIn = h('input', { class: 'input', type: 'number', min: 0, step: 50, placeholder: 'e.g. 2500', value: p.value_cents != null ? p.value_cents / 100 : '' });
    const deadlineIn = h('input', { class: 'input', type: 'date', value: p.deadline || '' });
    const save = async () => { try { await api.post(`/api/projects/${id}/meta`, { value: valueIn.value === '' ? null : Number(valueIn.value), deadline: deadlineIn.value || null }); toast('Saved', 'Project details updated', 'good'); load(); } catch (e) { toast('Could not save', e.message, 'critical'); } };
    valueIn.addEventListener('change', save);
    deadlineIn.addEventListener('change', save);
    head.append(h('div', { class: 'grid cols-4 kpis' },
      h('div', { class: 'panel kpi' }, h('div', { class: 'label', text: 'Revenue potential (USD)' }), valueIn, h('div', { class: 'sub', text: 'Feeds the revenue projection' })),
      h('div', { class: 'panel kpi' }, h('div', { class: 'label', text: 'Deadline' }), deadlineIn, h('div', { class: 'sub', text: p.deadline && new Date(p.deadline) < new Date() ? 'Overdue' : '' })),
      h('div', { class: 'panel kpi' }, h('div', { class: 'label', text: 'Completion' }), h('div', { class: 'value', text: p.progress == null ? '—' : `${p.progress}%` }), p.progress != null && h('div', { class: 'meter', style: { marginTop: 'auto' } }, h('i', { style: { width: `${p.progress}%` } }))),
      h('div', { class: 'panel kpi' }, h('div', { class: 'label', text: 'Paid to date' }), h('div', { class: 'value', text: fmt.money(p.paid_cents || 0) }), h('div', { class: 'sub', text: `${d.invoices.length} invoice${d.invoices.length === 1 ? '' : 's'}` }))));
    const jobs = ctx.state.jobs.filter((j) => Number(j.args?.businessId) === id);
    if (jobs.length) head.append(h('div', { class: 'mt' }, jobs.map((j) => jobCard(j))));
  }

  function drawTabs() {
    const list = [['overview', 'Research'], ['deliverables', `Deliverables (${d.demos.length + d.campaigns.length})`], ['onboarding', `Onboarding (${d.onboarding.length})`], ['invoices', `Invoices (${d.invoices.length})`], ['messages', `Messages (${d.messages.length})`], ['history', `History (${d.history.length})`]];
    clear(tabs).append(...list.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': String(k === tab), text: l, onclick: () => { tab = k; drawTabs(); drawBody(); } })));
  }

  function drawBody() {
    clear(body);
    if (tab === 'overview') {
      const r = d.research;
      if (!r) return body.append(h('section', { class: 'panel' }, empty('Not researched yet', 'Run "Process next steps" to have Sales Intelligence audit this business.')));
      const s = r.data.site;
      body.append(h('div', { class: 'grid cols-2' },
        h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: `Opportunity score · ${r.score}` }), h('span', { class: 'eyebrow', text: fmt.ago(r.created_at) })),
          h('div', { class: 'panel-body' },
            r.data.ai?.summary && h('p', { style: { marginTop: 0 }, text: r.data.ai.summary }),
            h('div', { class: 'stack', style: { gap: '4px' } }, r.data.score.reasons.map((x) => h('div', { class: 'row tight', style: { fontSize: '12.5px' } }, h('span', { class: 'mono', style: { color: x.startsWith('-') ? 'var(--critical-text)' : 'var(--good-text)', width: '34px' }, text: x.split(' ')[0] }), h('span', { class: 'dim', text: x.split(' ').slice(1).join(' ') })))),
            r.data.ai?.pitch_angles?.length && h('div', { class: 'mt' }, h('div', { class: 'eyebrow', text: 'PITCH ANGLES' }), h('ul', { style: { paddingLeft: '18px', fontSize: '12.5px' } }, r.data.ai.pitch_angles.map((p) => h('li', { text: p })))))),
        h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Website audit' })),
          h('div', { class: 'panel-body' }, r.data.site_error ? h('div', { class: 'error-box', text: `Site unreachable: ${r.data.site_error}` }) : !s ? h('div', { class: 'dim', text: 'No website on record — the strongest possible pitch.' }) :
            h('table', { class: 'data' }, h('tbody', {}, [
              ['Title', s.title], ['Platform', s.platform], ['HTTPS', s.https ? 'Yes' : 'No'], ['Mobile-friendly', s.mobile_viewport ? 'Yes' : 'No'], ['Online booking', s.has_booking ? 'Yes' : 'No'],
              ['Contact form', s.has_contact_form ? 'Yes' : 'No'], ['Copyright year', s.copyright_year], ['Response time', s.response_ms != null ? `${s.response_ms} ms` : null], ['Emails found', s.emails.join(', ')], ['Socials', Object.keys(s.socials).join(', ')],
            ].map(([k, v]) => h('tr', {}, h('td', { class: 'muted', text: k }), h('td', { text: v == null || v === '' ? '—' : String(v) })))))))));
      if (d.lead.notes) body.append(h('section', { class: 'panel mt' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Notes' })), h('div', { class: 'panel-body' }, h('pre', { class: 'code', text: d.lead.notes }))));
    }
    if (tab === 'deliverables') {
      if (!d.demos.length && !d.campaigns.length) return body.append(h('section', { class: 'panel' }, empty('No deliverables yet', 'Demos, previews and outreach drafts appear here as agents produce them.')));
      const latest = d.demos[0];
      if (latest) {
        const local = localPreview(latest.preview_url);
        body.append(h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: `Demo v${latest.version}` }), h('span', { class: 'pill', text: `${latest.copy_source} copy` }), h('span', { class: 'pill', text: latest.qa_passed ? 'QA passed' : 'QA failed' }),
          h('div', { class: 'chart-card-tools' }, latest.preview_url && h('a', { class: 'btn sm', href: latest.preview_url, target: '_blank', rel: 'noopener' }, icon('external'), `Open (${latest.deploy_provider})`))),
          h('div', { class: 'panel-body' }, local ? h('iframe', { class: 'iframe-full', src: local, title: `Demo preview for ${d.business.name}`, sandbox: '', loading: 'lazy' }) : latest.preview_url ? h('div', { class: 'dim', text: 'Hosted externally — use Open to view it in a new tab.' }) : h('div', { class: 'dim', text: 'Not deployed yet.' }))));
        if (d.demos.length > 1) body.append(h('section', { class: 'panel mt' }, h('header', { class: 'panel-head' }, h('h2', { text: 'All versions' })), h('table', { class: 'data' }, h('tbody', {}, d.demos.map((v) => h('tr', {}, h('td', { class: 'mono', text: `v${v.version}` }), h('td', { text: v.copy_source }), h('td', { text: v.qa_passed ? 'QA passed' : `QA failed: ${(v.qa?.failures || []).join(', ')}` }), h('td', { class: 'mono muted', text: fmt.ago(v.created_at) }), h('td', {}, v.preview_url ? h('a', { href: v.preview_url, target: '_blank', rel: 'noopener', text: 'open' }) : '—')))))));
      }
      for (const c of d.campaigns) body.append(h('section', { class: 'panel mt' }, h('header', { class: 'panel-head' }, h('h2', { text: `${c.kind === 'reply' ? 'Reply' : 'Outreach'} · ${c.channel}` }), h('span', { class: 'pill', text: c.status.replace(/_/g, ' ') }), h('span', { class: 'eyebrow', text: c.copy_source })),
        h('div', { class: 'panel-body' }, h('pre', { class: 'code', text: `To: ${c.to_addr || '—'}\nSubject: ${c.subject || ''}\n\n${c.body}` }),
          c.followups?.length && h('details', { class: 'mt' }, h('summary', { class: 'muted', style: { cursor: 'pointer', fontSize: '12px' }, text: `${c.followups.length} follow-ups planned` }), c.followups.map((f) => h('pre', { class: 'code mt', text: `Day ${f.day} — ${f.subject}\n\n${f.body}` }))),
          c.status === 'draft' && c.channel === 'email' && h('button', { class: 'btn mt', onclick: async () => { const body2 = await promptDialog({ title: 'Edit & queue for approval', label: 'Email body', multiline: true, value: c.body, confirmLabel: 'Queue for approval' }); if (body2) { try { await api.post(`/api/campaigns/${c.id}/queue`, { body: body2 }); toast('Queued', 'Waiting for your approval'); load(); } catch (e) { toast('Cannot queue', e.message, 'critical'); } } } }, 'Edit & queue for approval'))));
    }
    if (tab === 'onboarding') {
      if (!d.onboarding.length) return body.append(h('section', { class: 'panel' }, empty('No onboarding plan', 'Mark this project Won to generate the 12-step onboarding plan.')));
      body.append(h('section', { class: 'panel' }, h('div', { class: 'list' }, d.onboarding.map((t) => {
        const sel = h('select', { class: 'input', style: { width: '120px', height: '30px' }, 'aria-label': `Status of ${t.title}`, onchange: async () => { try { await api.post(`/api/tasks/${t.id}`, { status: sel.value }); load(); } catch (e) { toast('Could not update', e.message, 'critical'); } } }, ['todo', 'doing', 'done', 'skipped'].map((s) => h('option', { value: s, text: s, selected: s === t.status })));
        return h('div', { class: 'list-item', style: { alignItems: 'center' } }, h('i', { class: `dot ${t.status === 'done' ? 'good' : t.status === 'doing' ? 'active' : 'idle'}` }), h('div', { class: 'grow' }, h('div', { class: 'title', text: t.title }), h('div', { class: 'meta', text: t.requires_approval ? 'OWNER ONLY — binding or financial' : 'AKUMARU can prepare this' })), sel);
      }))));
    }
    if (tab === 'invoices') {
      body.append(h('section', { class: 'panel' }, d.invoices.length ? h('table', { class: 'data' }, h('thead', {}, h('tr', {}, ['Description', 'Amount', 'Status', 'Issued', 'Paid'].map((c) => h('th', { text: c })))), h('tbody', {}, d.invoices.map((i) => h('tr', {}, h('td', { text: i.description }), h('td', { class: 'num', text: fmt.money(i.amount_cents) }), h('td', { text: i.status + (i.recurring ? ' · monthly' : '') }), h('td', { class: 'mono', text: i.issued_at || '—' }), h('td', { class: 'mono', text: i.paid_at || '—' })))))
        : empty('No invoices for this client', 'Record invoices in Revenue.', h('a', { class: 'btn sm', href: '#/revenue', text: 'Go to Revenue' }))));
    }
    if (tab === 'messages') {
      body.append(h('section', { class: 'panel' }, d.messages.length ? h('div', { class: 'list' }, d.messages.map((m) => h('div', { class: 'list-item' }, h('i', { class: `dot ${m.direction === 'inbound' ? 'active' : 'idle'}`, style: { marginTop: '6px' } }), h('div', { class: 'grow' },
        h('div', { class: 'row tight' }, h('b', { text: m.direction === 'inbound' ? 'From client' : 'Sent' }), m.intent && h('span', { class: 'pill', text: m.intent.replace(/_/g, ' ') }), h('span', { class: 'meta', text: fmt.ago(m.created_at) })),
        m.subject && h('div', { class: 'dim', text: m.subject }), h('div', { class: 'txt', style: { whiteSpace: 'pre-wrap', fontSize: '12.5px', marginTop: '4px' }, text: m.body || '' })))))
        : empty('No messages yet')));
    }
    if (tab === 'history') {
      body.append(h('section', { class: 'panel pad' }, d.history.length ? h('div', { class: 'timeline' }, d.history.map((a) => h('div', { class: `t ${/failed/.test(a.action) ? '' : a.actor.startsWith('owner') ? 'hl' : ''}` },
        h('div', { class: 'when', text: `${fmt.date(a.ts)} ${fmt.time(a.ts)} · ${a.actor.toUpperCase()}` }), h('div', { text: a.text || a.action, style: /failed/.test(a.action) ? { color: 'var(--critical-text)' } : {} }),
        a.detail && Object.keys(a.detail).length ? h('div', { class: 'muted', style: { fontSize: '11.5px' }, text: Object.entries(a.detail).filter(([, v]) => v != null && typeof v !== 'object').map(([k, v]) => `${k}: ${v}`).join(' · ') }) : null)))
        : empty('No history')));
    }
  }

  async function load() {
    try {
      d = await api.get(`/api/projects/${id}`);
      drawHead(); drawTabs(); drawBody();
    } catch (e) { clear(head).append(errorBox(e)); }
  }
  let t;
  ctx.onLive((type, x) => {
    const mine = (type === 'activity' && (x.entity_id === id || x.detail?.businessId === id)) || (type === 'job' && Number(x.args?.businessId) === id);
    if (mine) { clearTimeout(t); t = setTimeout(load, 400); }
  });
  await load();
  return () => clearTimeout(t);
}
