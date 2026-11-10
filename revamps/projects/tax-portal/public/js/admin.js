(async function () {
  const $ = (id) => document.getElementById(id);
  $('logout').onclick = logout;
  const cfg = await loadConfig();
  const me = (await api('/api/me')).user;
  $('who').textContent = me.name;
  const baseTitle = document.title;

  $('copyLink').onclick = async () => {
    const link = location.origin + '/';
    try { await navigator.clipboard.writeText(link); toast('Client link copied: ' + link); }
    catch { prompt('Send this link to your clients:', link); }
  };

  let all = [];
  let filter = 'active';
  let knownSubmitted = null;

  const FILTERS = [
    { key: 'submitted', label: 'New submissions', test: (r) => r.status === 'submitted' },
    { key: 'in_progress', label: 'In progress', test: (r) => r.status === 'in_progress' || r.status === 'needs_info' },
    { key: 'completed', label: 'Completed', test: (r) => r.status === 'completed' },
    { key: 'draft', label: 'Still filling out', test: (r) => r.status === 'draft' },
  ];

  async function loadList() {
    try { all = (await api('/api/admin/returns')).returns; } catch (e) { return toast(e.message); }
    const unseen = all.filter((r) => !r.seen_by_owner && r.status !== 'draft').length;
    document.title = (unseen ? `(${unseen}) ` : '') + baseTitle;
    const submittedIds = new Set(all.filter((r) => r.status === 'submitted').map((r) => r.id));
    if (knownSubmitted && [...submittedIds].some((id) => !knownSubmitted.has(id))) toast('🔔 New client submission received!', 5000);
    knownSubmitted = submittedIds;
    $('lastRefresh').textContent = 'Auto-refreshes every 30s · updated ' + new Date().toLocaleTimeString();
    drawList();
  }

  function drawList() {
    const stats = $('stats'); stats.innerHTML = '';
    for (const f of FILTERS) {
      stats.append(el('div', { class: 'stat' + (filter === f.key ? ' sel' : ''), onclick: () => { filter = filter === f.key ? 'active' : f.key; drawList(); } },
        el('div', { class: 'num', text: all.filter(f.test).length }), el('div', { class: 'muted small', text: f.label })));
    }
    const q = $('search').value.trim().toLowerCase();
    const f = FILTERS.find((x) => x.key === filter);
    const rows = all.filter((r) => (f ? f.test(r) : true) && (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)));
    const tb = $('rows'); tb.innerHTML = '';
    for (const r of rows) {
      const unseen = !r.seen_by_owner && r.status !== 'draft';
      tb.append(el('tr', { class: 'row' + (unseen ? ' unseen' : ''), onclick: () => openDetail(r.id) },
        el('td', {}, unseen ? el('span', { class: 'dotnew', title: 'New' }) : null, el('strong', { text: r.name }), el('div', { class: 'muted small', text: r.email })),
        el('td', {}, el('span', { class: 'badge b-' + r.status, text: STATUS_LABELS[r.status] })),
        el('td', { class: 'hide-sm', text: fmtDate(r.submitted_at) }),
        el('td', { class: 'hide-sm', text: r.file_count }),
        el('td', { class: 'hide-sm', text: fmtDate(r.updated_at) })));
    }
    $('empty').classList.toggle('hidden', all.length > 0);
  }
  $('search').oninput = drawList;

  async function openDetail(id, push = true) {
    let r;
    try { r = await api('/api/admin/returns/' + id); } catch (e) { return toast(e.message); }
    if (push && location.hash !== '#c' + id) history.pushState({ id }, '', '#c' + id);
    $('listView').classList.add('hidden');
    const v = $('detailView'); v.innerHTML = ''; v.classList.remove('hidden');
    window.scrollTo(0, 0);
    const d = r.data;
    const fullName = [d.first_name, d.middle_initial, d.last_name, d.suffix].filter(Boolean).join(' ') || r.client.name;

    // Header
    v.append(el('div', { class: 'detail-head' },
      el('div', {},
        el('button', { class: 'btn btn-ghost btn-sm no-print', type: 'button', text: '← All clients', onclick: () => { history.pushState({}, '', location.pathname); showList(); } }),
        el('h1', { text: fullName }),
        el('div', { class: 'muted' }, `${r.client.email}${d.phone ? ' · ' + d.phone : ''} · Tax year ${r.taxYear} `, el('span', { class: 'badge b-' + r.status, text: STATUS_LABELS[r.status] }))),
      el('div', { class: 'no-print' }, el('button', { class: 'btn btn-ghost', type: 'button', text: '🖨 Print / Save PDF', onclick: () => window.print() }))));

    // Main column: answers
    const main = el('div', { class: 'card' }, el('h2', { text: 'Questionnaire answers' }),
      r.status === 'draft' ? el('div', { class: 'alert alert-warn', text: 'This client has not submitted yet — answers below are a draft in progress.' }) : null,
      el('br'), renderSummary(d, { mask: true }));

    // Signature block
    const sigCard = el('div', { class: 'card' }, el('h2', { text: 'Signature' }));
    if (r.signature) {
      sigCard.append(el('img', { class: 'sigimg', src: r.signature, alt: 'Client signature' }),
        el('dl', { class: 'kv' }, el('dt', { text: 'Signed name' }), el('dd', { text: r.signedName }),
          el('dt', { text: 'Signed at' }), el('dd', { text: fmtDate(r.signedAt) }),
          el('dt', { text: 'IP address' }), el('dd', { text: r.signedIp || '—' })));
    } else sigCard.append(el('p', { class: 'muted', text: 'Not signed yet.' }));

    // Side: status, docs, activity
    const sel = el('select', {}, ['submitted', 'in_progress', 'needs_info', 'completed'].map((s) => el('option', { value: s, text: STATUS_LABELS[s] })));
    sel.value = r.status === 'draft' ? 'submitted' : r.status;
    const note = el('textarea', { placeholder: 'Note to client (required for “Needs info” — e.g. “Please upload your 1099-NEC from DoorDash”)' });
    const saveBtn = el('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'Update status' });
    saveBtn.onclick = async () => {
      try {
        await api(`/api/admin/returns/${r.id}/status`, { method: 'POST', body: { status: sel.value, note: note.value } });
        toast('Status updated.'); openDetail(r.id, false);
      } catch (e) { toast(e.message); }
    };
    const statusCard = el('div', { class: 'card no-print' }, el('h3', { text: 'Work status' }),
      r.status === 'draft' ? el('p', { class: 'small muted', text: 'Client hasn’t submitted yet.' }) : null,
      el('div', { class: 'grid' }, el('div', { class: 'f' }, sel), el('div', { class: 'f' }, note), el('div', { class: 'f' }, saveBtn)),
      r.ownerNote ? el('p', { class: 'small muted', text: 'Current note: ' + r.ownerNote }) : null);

    const docs = el('div', { class: 'card' }, el('h3', { text: `Documents (${r.files.length})` }));
    const ul = el('ul', { class: 'filelist' });
    if (!r.files.length) ul.append(el('li', { class: 'muted', text: 'No documents uploaded.' }));
    for (const f of r.files) {
      ul.append(el('li', {},
        el('span', {}, el('a', { href: `/api/admin/files/${f.id}`, target: '_blank', rel: 'noopener', text: f.orig_name }),
          el('div', {}, el('span', { class: 'cat', text: f.category }), ' ', el('span', { class: 'muted small', text: fmtSize(f.size) + ' · ' + fmtDate(f.created_at) }))),
        el('a', { class: 'btn btn-ghost btn-sm no-print', href: `/api/admin/files/${f.id}?dl=1`, text: '⬇' })));
    }
    docs.append(ul);

    const act = el('div', { class: 'card no-print' }, el('h3', { text: 'Activity' }),
      el('ul', { class: 'activity' }, r.activity.length ? r.activity.map((a) => el('li', {}, el('div', { text: a.message }), el('div', { class: 'muted small', text: fmtDate(a.created_at) })))
        : el('li', { class: 'muted', text: 'No activity yet.' })));

    const acct = el('div', { class: 'card no-print' }, el('h3', { text: 'Client account' }),
      el('p', { class: 'small muted', text: 'If the client forgot their password, generate a temporary one and send it to them.' }),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Reset client password', onclick: async () => {
        if (!confirm(`Reset password for ${r.client.email}?`)) return;
        try { const { tempPassword } = await api(`/api/admin/users/${r.client.userId}/reset-password`, { method: 'POST' });
          prompt('Temporary password (send this to the client — they can change it after signing in):', tempPassword);
        } catch (e) { toast(e.message); }
      } }));

    v.append(el('div', { class: 'cols' }, el('div', {}, main, sigCard), el('div', {}, statusCard, docs, act, acct)));
    loadList();
  }

  function showList() {
    $('detailView').classList.add('hidden');
    $('listView').classList.remove('hidden');
  }
  window.addEventListener('popstate', () => {
    const m = location.hash.match(/^#c(\d+)$/);
    if (m) openDetail(Number(m[1]), false); else showList();
  });

  await loadList();
  const m = location.hash.match(/^#c(\d+)$/);
  if (m) openDetail(Number(m[1]), false);
  setInterval(() => { if (!document.hidden) loadList(); }, 30000);
})();
