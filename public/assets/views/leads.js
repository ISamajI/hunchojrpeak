// LEADS — every discovered business, filterable and sortable, plus intake.
import { h, clear, fmt, empty, errorBox, toast, modal } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { viewHead, scoreCell, stagePill } from './_shared.js';

export default async function leads(root, ctx) {
  let rows = [];
  let sort = { key: 'score', dir: -1 };
  const state = { q: '', stage: '', tier: '' };
  const table = h('div', { class: 'table-wrap', style: { maxHeight: 'calc(100vh - 300px)' } });
  const count = h('span', { class: 'badge' });
  const stageSel = h('select', { class: 'input', 'aria-label': 'Stage', onchange: (e) => { state.stage = e.target.value; draw(); } }, h('option', { value: '', text: 'All stages' }));
  const tierSel = h('select', { class: 'input', 'aria-label': 'Opportunity', onchange: (e) => { state.tier = e.target.value; draw(); } },
    [['', 'Any score'], ['hot', 'Hot (60+)'], ['warm', 'Warm (40–59)'], ['cold', 'Cold (<40)'], ['none', 'Not scored']].map(([v, t]) => h('option', { value: v, text: t })));
  const search = h('input', { class: 'input', placeholder: 'Search name, city, email…', 'aria-label': 'Search leads', style: { minWidth: '220px' }, oninput: (e) => { state.q = e.target.value.toLowerCase(); draw(); } });

  root.append(viewHead('Leads', 'Businesses discovered by Sales Intelligence, imported from CSV, or added by you. Click a row for its full project record.',
    h('div', { class: 'row tight' },
      h('button', { class: 'btn', onclick: () => runDialog() }, icon('play'), 'Run discovery'),
      h('button', { class: 'btn', onclick: () => importDialog() }, icon('paperclip'), 'Import CSV'),
      h('button', { class: 'btn primary', onclick: () => addDialog() }, icon('plus'), 'Add lead'))),
    h('section', { class: 'panel' },
      h('header', { class: 'panel-head' }, h('h2', { text: 'All leads' }), count, h('div', { class: 'chart-card-tools' }, search, stageSel, tierSel)),
      table));

  const COLS = [['score', 'Score'], ['name', 'Business'], ['stage', 'Stage'], ['city', 'City'], ['email', 'Email'], ['phone', 'Phone'], ['source', 'Source'], ['updated_at', 'Updated'], ['preview_url', 'Demo']];
  function draw() {
    let list = rows.filter((r) => {
      if (state.stage && r.stage !== state.stage) return false;
      if (state.tier === 'hot' && !(r.score >= 60)) return false;
      if (state.tier === 'warm' && !(r.score >= 40 && r.score < 60)) return false;
      if (state.tier === 'cold' && !(r.score != null && r.score < 40)) return false;
      if (state.tier === 'none' && r.score != null) return false;
      if (state.q && !`${r.name} ${r.city} ${r.email} ${r.website} ${r.category}`.toLowerCase().includes(state.q)) return false;
      return true;
    });
    list = list.sort((a, b) => {
      const x = a[sort.key] ?? '', y = b[sort.key] ?? '';
      return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
    });
    count.textContent = list.length;
    clear(table);
    if (!rows.length) return table.append(empty('No leads yet', 'Run discovery, import a CSV, or add one manually.', h('button', { class: 'btn primary sm', onclick: () => runDialog(), text: 'Run discovery' })));
    if (!list.length) return table.append(empty('No leads match these filters'));
    table.append(h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, COLS.map(([k, l]) => h('th', { 'aria-sort': sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none' }, h('button', { onclick: () => { sort = { key: k, dir: sort.key === k ? -sort.dir : k === 'name' ? 1 : -1 }; draw(); } }, l, sort.key === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''))))),
      h('tbody', {}, list.map((r) => h('tr', { class: 'click', tabindex: 0, onclick: () => ctx.navigate(`#/projects/${r.id}`), onkeydown: (e) => e.key === 'Enter' && ctx.navigate(`#/projects/${r.id}`) },
        h('td', {}, scoreCell(r.score)),
        h('td', {}, h('div', { text: r.name }), h('div', { class: 'muted', style: { fontSize: '11px' }, text: r.category?.replace(/_/g, ' ') || '' })),
        h('td', {}, stagePill(r.stage)), h('td', { text: r.city || '—' }), h('td', { class: 'dim', text: r.email || '—' }), h('td', { class: 'dim mono', text: r.phone || '—' }),
        h('td', { class: 'muted', text: r.source }), h('td', { class: 'mono muted', text: fmt.ago(r.updated_at) }),
        h('td', {}, r.preview_url ? h('a', { href: r.preview_url, target: '_blank', rel: 'noopener', onclick: (e) => e.stopPropagation() }, icon('external')) : '—'))))));
  }

  function formDialog(title, fields, submitLabel, onSubmit) {
    const inputs = Object.fromEntries(fields.map(([k, label, opts = {}]) => [k, h('input', { class: 'input', name: k, ...opts })]));
    const err = h('div', {});
    const btn = h('button', { class: 'btn primary', text: submitLabel });
    const close = modal(h('form', { class: 'dialog', onsubmit: async (e) => {
      e.preventDefault(); btn.disabled = true; clear(err);
      try { await onSubmit(Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()]))); close(); } catch (x) { err.append(errorBox(x)); btn.disabled = false; }
    } }, h('h3', { text: title }), h('div', { class: 'form-grid', style: { marginTop: '14px' } }, fields.map(([k, label]) => h('label', { class: 'field' }, label, inputs[k]))), err,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn ghost', text: 'Cancel', onclick: () => close() }), btn)));
  }
  function addDialog() {
    formDialog('Add a lead', [['name', 'Business name', { required: true, autofocus: true }], ['category', 'Category'], ['city', 'City'], ['address', 'Address'], ['phone', 'Phone'], ['email', 'Email', { type: 'email' }], ['website', 'Website']], 'Add lead', async (v) => {
      const r = await api.post('/api/leads', v);
      toast(r.created ? 'Lead added' : 'Lead updated', v.name, 'good');
      ctx.navigate(`#/projects/${r.id}`);
    });
  }
  function runDialog() {
    formDialog('Run discovery pipeline', [['category', 'Category (blank = sweep common trades)', { placeholder: 'barber, restaurant, dentist…' }], ['near', 'Location', { required: true, placeholder: 'Hamilton, ON', autofocus: true }], ['limit', 'How many', { type: 'number', min: 1, max: 50, value: 10 }]], 'Start', async (v) => {
      const args = { near: v.near, limit: Number(v.limit) || 10, ...(v.category ? { category: v.category } : { categories: ['restaurant', 'barber', 'beauty', 'auto repair', 'cafe', 'dentist'] }) };
      await api.post('/api/jobs', { kind: 'pipeline', args });
      toast('Pipeline started', 'Follow it live in the AI activity panel.');
      ctx.refreshStatus();
    });
  }
  function importDialog() {
    const f = h('input', { type: 'file', accept: '.csv,text/csv', class: 'input', style: { paddingTop: '6px' } });
    const out = h('div', {});
    const close = modal(h('div', { class: 'dialog' }, h('h3', { text: 'Import leads from CSV' }),
      h('p', { class: 'dim', text: 'Needs a "name" column. Recognised: category/type, city, address, phone, email, website/url. Re-importing updates existing rows instead of duplicating.' }), f, out,
      h('div', { class: 'actions' }, h('button', { class: 'btn ghost', text: 'Close', onclick: () => close() }), h('button', { class: 'btn primary', text: 'Import', onclick: async () => {
        if (!f.files[0]) return;
        try { const r = await api.postText('/api/import/leads', await f.files[0].text()); clear(out).append(h('div', { class: 'note', text: `${r.created} created · ${r.updated} updated · ${r.skipped} skipped${r.errors.length ? ` · ${r.errors.length} errors: ${r.errors.slice(0, 3).join('; ')}` : ''}` })); load(); } catch (e) { clear(out).append(errorBox(e)); }
      } }))));
  }

  async function load() {
    try {
      rows = await api.get('/api/leads');
      const stages = [...new Set(rows.map((r) => r.stage))];
      if (stageSel.options.length === 1) stageSel.append(...stages.map((s) => h('option', { value: s, text: fmt.stage(s) })));
      draw();
    } catch (e) { table.replaceChildren(errorBox(e)); }
  }
  let t;
  ctx.onLive((type, d) => { if (type === 'activity' && /lead_created|stage_changed|business_researched|leads_imported/.test(d.action)) { clearTimeout(t); t = setTimeout(load, 500); } });
  await load();
  return () => clearTimeout(t);
}
