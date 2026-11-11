// REVENUE — computed only from the invoice ledger. No ledger → explicit "no data".
import { h, clear, fmt, empty, errorBox, toast, modal } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { columnChart, seriesTable, chartCard } from '../lib/charts.js';
import { kpi, viewHead, rangeControl, savedRange, saveRange } from './_shared.js';

const money = (v, axis) => fmt.money(v, { compact: axis });

export default async function revenue(root, ctx) {
  let range = savedRange();
  const tiles = h('div', { class: 'grid cols-4 kpis' });
  const tiles2 = h('div', { class: 'grid cols-4 kpis mt' });
  const chart = h('div', { class: 'mt' });
  const ledger = h('section', { class: 'panel mt' });
  root.append(viewHead('Revenue', 'Every figure here is computed from your invoice ledger. AKUMARU never estimates revenue it can’t see — projections are a labeled model with their assumptions shown.',
    h('div', { class: 'row tight' }, rangeControl(range, (k) => { range = k; saveRange(k); load(); }), h('button', { class: 'btn primary', onclick: () => invoiceDialog() }, icon('plus'), 'Record invoice'))),
    tiles, tiles2, chart, ledger);

  async function load() {
    root.classList.add('loading-frame');
    try {
      const [r, inv, leads] = await Promise.all([api.get(`/api/metrics/revenue?range=${range}`), api.get('/api/invoices'), api.get('/api/leads')]);
      const none = !r.hasData;
      clear(tiles).append(
        kpi({ label: 'Revenue · selected period', value: none ? null : fmt.money(r.period), deltaValue: r.growth, spark: r.series.map((s) => s.value), na: 'No invoices recorded', sub: none ? '' : `vs ${fmt.money(r.previous)} previous period` }),
        kpi({ label: 'Total revenue · all time', value: none ? null : fmt.money(r.total), na: 'No invoices recorded' }),
        kpi({ label: 'This month', value: none ? null : fmt.money(r.thisMonth), na: '—', sub: none ? '' : `This week ${fmt.money(r.thisWeek)}` }),
        kpi({ label: 'Recurring revenue (MRR)', value: none ? null : fmt.money(r.mrr), na: 'No recurring plans', sub: none ? '' : `${r.recurringClients} client${r.recurringClients === 1 ? '' : 's'} · ARR ${fmt.money(r.mrr * 12, { compact: true })}`, title: 'Latest monthly invoice per client, if issued in the last 45 days' }));
      const model = h('div', {}, h('div', { class: 'muted', style: { fontSize: '11px' }, text: r.projected.model }),
        h('div', { class: 'muted', style: { fontSize: '11px' }, text: `MRR ${fmt.money(r.projected.components.mrr)} + outstanding ${fmt.money(r.projected.components.outstanding)} + weighted pipeline ${fmt.money(r.projected.components.pipelineWeighted)}` }));
      clear(tiles2).append(
        kpi({ label: 'Outstanding invoices', value: none ? null : fmt.money(r.outstanding.cents), na: 'None', sub: none ? '' : `${r.outstanding.count} open${r.outstanding.overdueCount ? ` · ${r.outstanding.overdueCount} overdue (${fmt.money(r.outstanding.overdueCents)})` : ' · none overdue'}` }),
        h('div', { class: 'panel kpi span-2', title: 'Projection model' }, h('div', { class: 'label' }, 'Projected · next 30 days', h('span', { class: 'pill', text: 'MODEL' })),
          h('div', { class: 'value', text: fmt.money(r.projected.cents) }), model,
          r.projected.dealsWithoutValue ? h('div', { class: 'note warn', style: { marginTop: '6px', fontSize: '11.5px' } }, `${r.projected.dealsWithoutValue} of ${r.projected.openDeals} open deals have no value set, so they count as $0. Set values on project pages.`) : null),
        h('div', { class: 'panel kpi' }, h('div', { class: 'label', text: 'Stage probabilities (model inputs)' }),
          h('div', { class: 'mono dim', style: { fontSize: '10.5px', lineHeight: '1.6' } }, Object.entries(r.projected.probabilities).map(([k, v]) => h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { text: fmt.stage(k) }), h('span', { text: fmt.pct(v) }))))));
      const label = r.range.bucket === 'day' ? 'Daily' : r.range.bucket === 'week' ? 'Weekly' : 'Monthly';
      clear(chart).append(none
        ? h('section', { class: 'panel' }, empty('No revenue recorded yet', 'Record your first invoice — paid, sent or recurring — and these charts will populate from it. Nothing is estimated.', h('button', { class: 'btn primary sm', text: 'Record invoice', onclick: () => invoiceDialog() })))
        : chartCard({ title: `${label} revenue`, eyebrow: 'PAID INVOICES · VS PREVIOUS PERIOD',
          draw: (c) => columnChart(c, { points: r.series, compare: r.previousSeries, format: money, bucket: r.range.bucket, name: 'This period', height: 240 }),
          table: () => seriesTable([{ name: 'This period', points: r.series }, { name: 'Previous period', points: r.previousSeries.map((p, i) => ({ ...p, x: r.series[i]?.x || p.x })) }], { format: (v) => fmt.money(v), bucket: r.range.bucket }) }));
      drawLedger(inv, leads);
    } catch (e) { clear(tiles).append(h('div', { style: { gridColumn: '1/-1' } }, errorBox(e))); } finally { root.classList.remove('loading-frame'); }
  }

  function drawLedger(inv, leads) {
    clear(ledger).append(h('header', { class: 'panel-head' }, h('h2', { text: 'Invoice ledger' }), h('span', { class: 'badge', text: inv.length })),
      inv.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, ['#', 'Client', 'Description', 'Amount', 'Status', 'Issued', 'Due', 'Paid', ''].map((c) => h('th', { class: c === 'Amount' ? 'r' : '', text: c })))),
        h('tbody', {}, inv.map((i) => {
          const overdue = i.status === 'sent' && i.due_at && i.due_at < new Date().toISOString().slice(0, 10);
          const sel = h('select', { class: 'input', style: { height: '28px' }, 'aria-label': `Status of invoice ${i.id}`, onchange: async () => { try { await api.post(`/api/invoices/${i.id}`, { status: sel.value }); toast('Invoice updated', `#${i.id} → ${sel.value}`, sel.value === 'paid' ? 'good' : ''); load(); } catch (e) { toast('Could not update', e.message, 'critical'); } } },
            ['draft', 'sent', 'paid', 'void'].map((s) => h('option', { value: s, text: s, selected: s === i.status })));
          return h('tr', {}, h('td', { class: 'mono muted', text: i.id }), h('td', {}, i.business_id ? h('a', { href: `#/projects/${i.business_id}`, text: i.business_name }) : h('span', { class: 'muted', text: '—' })),
            h('td', { text: i.description + (i.recurring ? ' · monthly' : '') }), h('td', { class: 'r num', text: fmt.money(i.amount_cents) }),
            h('td', {}, overdue ? h('span', { class: 'status-text', style: { color: 'var(--critical-text)' } }, h('i', { class: 'dot critical' }), 'OVERDUE') : h('span', { class: 'dim', text: i.status })),
            h('td', { class: 'mono', text: i.issued_at || '—' }), h('td', { class: 'mono', text: i.due_at || '—' }), h('td', { class: 'mono', text: i.paid_at || '—' }), h('td', {}, sel));
        }))))
        : empty('The ledger is empty', 'Invoices you record here are the single source of truth for every revenue number in AKUMARU.'));
    void leads;
  }

  async function invoiceDialog() {
    const leads = await api.get('/api/leads').catch(() => []);
    const today = new Date().toISOString().slice(0, 10);
    const f = {
      businessId: h('select', { class: 'input' }, h('option', { value: '', text: '— No client —' }), leads.sort((a, b) => a.name.localeCompare(b.name)).map((l) => h('option', { value: l.id, text: `${l.name}${l.city ? ' · ' + l.city : ''}` }))),
      description: h('input', { class: 'input', required: true, placeholder: 'Website build', autofocus: true }),
      amount: h('input', { class: 'input', type: 'number', min: '0.01', step: '0.01', required: true, placeholder: '1500' }),
      status: h('select', { class: 'input' }, [['paid', 'Paid'], ['sent', 'Sent (awaiting payment)'], ['draft', 'Draft']].map(([v, t]) => h('option', { value: v, text: t }))),
      issuedAt: h('input', { class: 'input', type: 'date', value: today }),
      dueAt: h('input', { class: 'input', type: 'date' }),
      paidAt: h('input', { class: 'input', type: 'date', value: today }),
      recurring: h('input', { type: 'checkbox' }),
    };
    const err = h('div', {});
    const close = modal(h('form', { class: 'dialog', onsubmit: async (e) => {
      e.preventDefault(); clear(err);
      try {
        await api.post('/api/invoices', { businessId: f.businessId.value || null, description: f.description.value, amount: Number(f.amount.value), status: f.status.value, issuedAt: f.issuedAt.value, dueAt: f.dueAt.value || null, paidAt: f.paidAt.value, recurring: f.recurring.checked });
        toast('Invoice recorded', `${f.description.value} · $${f.amount.value}`, 'good');
        close(); load();
      } catch (x) { err.append(errorBox(x)); }
    } }, h('h3', { text: 'Record an invoice' }), h('p', { class: 'dim', style: { margin: '0 0 12px' }, text: 'Bookkeeping only — this does not charge anyone. Payments integrations will require your approval.' }),
      h('div', { class: 'form-grid' },
        h('label', { class: 'field', style: { gridColumn: '1/-1' } }, 'Client', f.businessId), h('label', { class: 'field', style: { gridColumn: '1/-1' } }, 'Description', f.description),
        h('label', { class: 'field' }, 'Amount (USD)', f.amount), h('label', { class: 'field' }, 'Status', f.status),
        h('label', { class: 'field' }, 'Issued', f.issuedAt), h('label', { class: 'field' }, 'Due', f.dueAt), h('label', { class: 'field' }, 'Paid on', f.paidAt),
        h('label', { class: 'check', style: { alignSelf: 'center' } }, f.recurring, 'Monthly recurring')),
      err, h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn ghost', text: 'Cancel', onclick: () => close() }), h('button', { class: 'btn primary', text: 'Record invoice' }))));
  }

  ctx.onLive((type, d) => { if (type === 'activity' && /invoice_/.test(d.action)) load(); });
  await load();
}
