// WORKFLOWS — the autonomous pipeline as a diagram, with every owner gate marked.
import { h, clear, fmt, errorBox, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { AGENT } from '../lib/labels.js';
import { viewHead, sectionTitle } from './_shared.js';

export default async function workflows(root, ctx) {
  const flow = h('div', { class: 'topology', style: { overflowX: 'auto' } });
  const lists = h('div', { class: 'grid cols-2' });
  const run = h('form', { class: 'form-grid' });
  root.append(viewHead('Workflows', 'How AKUMARU turns a location into qualified, demo-ready, approval-gated opportunities. Green steps run autonomously; amber gates stop for you; the QA gate blocks anything that fails Itachi’s checks.'),
    h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Client acquisition pipeline' }), h('span', { class: 'eyebrow', text: 'TSUNADE ORCHESTRATOR' })), h('div', { class: 'panel-body' }, flow)),
    sectionTitle('Run this workflow'), h('section', { class: 'panel pad' }, run),
    sectionTitle('Decision engine'), lists);
  try {
    const w = await api.get('/api/workflow');
    const W = 1180, nodeW = 116, gap = (W - nodeW * w.steps.length) / (w.steps.length - 1), H = 150;
    const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, style: { minWidth: '900px' }, role: 'img', 'aria-label': 'Pipeline steps: ' + w.steps.map((s) => s.label).join(', ') });
    w.steps.forEach((s, i) => {
      const x = i * (nodeW + gap);
      if (i < w.steps.length - 1) svg.append(h('path', { class: 'link', d: `M${x + nodeW},60 L${x + nodeW + gap},60`}), h('polygon', { points: `${x + nodeW + gap - 6},56 ${x + nodeW + gap},60 ${x + nodeW + gap - 6},64`, fill: 'rgba(148,163,184,.4)' }));
      const cls = s.gate === 'approval' ? 'warn' : s.gate === 'gate' ? 'active' : 'good';
      const g = h('g', { class: `node ${cls}` },
        h('rect', { x, y: 30, width: nodeW, height: 60, rx: 9 }),
        h('text', { x: x + nodeW / 2, y: 55, 'text-anchor': 'middle', text: s.label }),
        h('text', { class: 'sub', x: x + nodeW / 2, y: 73, 'text-anchor': 'middle', text: s.gate === 'approval' ? 'OWNER GATE' : s.gate === 'gate' ? 'QA GATE' : AGENT[s.agent]?.short || '' }));
      g.append(h('title', { text: `${s.label} — ${s.detail}` }));
      svg.append(g);
      svg.append(h('text', { x: x + nodeW / 2, y: 110, 'text-anchor': 'middle', fill: '#6c7689', style: { font: '9.5px var(--font)' }, text: s.detail.length > 26 ? s.detail.slice(0, 25) + '…' : s.detail }));
    });
    flow.append(svg, h('div', { class: 'legend mt' }, h('span', {}, h('i', { style: { background: 'rgba(12,163,12,.7)' } }), 'Autonomous'), h('span', {}, h('i', { style: { background: '#3fd0ef' } }), 'QA gate (automatic block)'), h('span', {}, h('i', { style: { background: 'rgba(250,178,25,.7)' } }), 'Waits for your approval')));
    lists.append(
      h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'AKUMARU does these on its own' })), h('div', { class: 'list' }, w.autonomous.map((a) => h('div', { class: 'list-item' }, h('i', { class: 'dot good', style: { marginTop: '6px' } }), h('div', { class: 'title', text: a.replace(/_/g, ' ') }))))),
      h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'These always wait for you' })), h('div', { class: 'list' }, Object.entries(w.approval).map(([k, why]) => h('div', { class: 'list-item' }, h('i', { class: 'dot warning', style: { marginTop: '6px' } }), h('div', { class: 'grow' }, h('div', { class: 'title', text: k.replace(/_/g, ' ') }), h('div', { class: 'meta', style: { fontFamily: 'var(--font)' }, text: why })))),
        h('div', { class: 'list-item' }, h('i', { class: 'dot warning', style: { marginTop: '6px' } }), h('div', { class: 'grow' }, h('div', { class: 'title', text: 'anything unrecognised' }), h('div', { class: 'meta', style: { fontFamily: 'var(--font)' }, text: 'Unknown actions fail safe to owner approval.' }))))));
    const cat = h('input', { class: 'input', placeholder: 'barber (blank = sweep trades)' });
    const near = h('input', { class: 'input', placeholder: 'Hamilton, ON', required: true });
    const limit = h('input', { class: 'input', type: 'number', min: 1, max: 50, value: 10 });
    run.append(h('label', { class: 'field' }, 'Category', cat), h('label', { class: 'field' }, 'Location', near), h('label', { class: 'field' }, 'Businesses', limit), h('button', { class: 'btn primary' }, icon('play'), 'Run pipeline'));
    run.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const j = await api.post('/api/jobs', { kind: 'pipeline', args: { near: near.value, limit: Number(limit.value) || 10, ...(cat.value.trim() ? { category: cat.value.trim() } : { categories: ['restaurant', 'barber', 'beauty', 'auto repair', 'cafe', 'dentist'] }) } });
        toast('Pipeline started', j.label); ctx.refreshStatus(); ctx.navigate(`#/activity?job=${j.id}`);
      } catch (x) { toast('Could not start', x.message, 'critical'); }
    });
  } catch (e) { flow.replaceChildren(errorBox(e)); }
  void clear; void fmt;
}
