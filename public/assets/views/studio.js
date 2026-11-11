// MARKETING STUDIO / CONTENT STUDIO — Claude-drafted content for LTGPeak. Drafts only; never published.
import { h, clear, fmt, empty, errorBox, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { viewHead } from './_shared.js';

const MODES = {
  marketing: { title: 'Marketing Studio', kinds: ['campaign', 'ad', 'email'], blurb: 'Marketing Intelligence drafts campaigns, ad concepts and newsletters for LTGPeak itself, grounded in your real pipeline numbers. Nothing is published — launching a campaign is an owner decision.' },
  content: { title: 'Content Studio', kinds: ['social', 'blog'], blurb: 'Social posts and blog articles that showcase LTGPeak’s work. Drafts use placeholders where a real client result or testimonial belongs — AKUMARU never invents them.' },
};

export default async function studio(root, ctx) {
  const mode = MODES[ctx.id];
  const list = h('div', { class: 'stack' });
  const formBox = h('section', { class: 'panel pad' });
  root.append(viewHead(mode.title, mode.blurb), formBox, h('div', { class: 'mt' }, list));
  let doctor = [];
  try { doctor = await api.get('/api/doctor'); } catch { /* shown below */ }
  const claude = doctor.find((d) => d.key === 'anthropic');
  const { kinds } = await api.get('/api/content').catch(() => ({ kinds: {} }));
  const kind = h('select', { class: 'input' }, mode.kinds.map((k) => h('option', { value: k, text: kinds[k] || k })));
  const brief = h('textarea', { class: 'input', rows: 3, placeholder: 'Brief — audience, goal, angle, channel. e.g. "Instagram series for Hamilton barbers showing before/after concept sites"' });
  const go = h('button', { class: 'btn primary', disabled: !claude?.configured }, icon('bolt'), 'Draft with Marketing Intelligence');
  formBox.append(
    !claude?.configured && h('div', { class: 'note warn', style: { marginBottom: '12px' } }, h('b', { text: 'Marketing Intelligence is offline. ' }), 'Original marketing needs Claude, and AKUMARU won’t fake it with templates. ', claude?.connect || 'Set ANTHROPIC_API_KEY in .env.', ' ', h('a', { href: '#/integrations', text: 'Integrations →' })),
    h('div', { class: 'form-grid' }, h('label', { class: 'field' }, 'Type', kind), h('label', { class: 'field', style: { gridColumn: 'span 3' } }, 'Brief', brief)),
    h('div', { class: 'row mt' }, go, h('span', { class: 'muted', style: { fontSize: '11.5px' }, text: 'Runs as a background operation — watch it in Live Activity.' })));
  go.addEventListener('click', async () => {
    go.disabled = true;
    try { const j = await api.post('/api/jobs', { kind: 'content', args: { kind: kind.value, brief: brief.value } }); toast('Drafting', j.label); ctx.refreshStatus(); brief.value = ''; } catch (e) { toast('Could not start', e.message, 'critical'); } finally { go.disabled = !claude?.configured; }
  });

  async function load() {
    try {
      const { items } = await api.get('/api/content');
      const mine = items.filter((i) => mode.kinds.includes(i.kind));
      clear(list);
      if (!mine.length) return list.append(h('section', { class: 'panel' }, empty('No drafts yet', claude?.configured ? 'Write a brief above to create the first one.' : 'Connect Claude to enable drafting.')));
      for (const d of mine) list.append(h('section', { class: 'panel' },
        h('header', { class: 'panel-head' }, h('h2', { text: d.title }), h('span', { class: 'pill', text: kinds[d.kind] || d.kind }), h('span', { class: 'pill', text: d.status }), h('div', { class: 'chart-card-tools' }, h('span', { class: 'muted mono', style: { fontSize: '11px' }, text: fmt.ago(d.created_at) }),
          h('button', { class: 'btn sm ghost', onclick: () => { navigator.clipboard?.writeText([d.body.title, d.body.summary, ...d.body.sections.map((s) => `\n## ${s.heading}\n${s.content}`)].join('\n')).then(() => toast('Copied to clipboard')); } }, 'Copy'))),
        h('div', { class: 'panel-body' }, h('p', { class: 'dim', style: { marginTop: 0 }, text: d.body.summary }), d.brief && h('div', { class: 'muted', style: { fontSize: '11.5px', marginBottom: '10px' }, text: `Brief: ${d.brief}` }),
          d.body.sections.map((s) => h('div', { style: { marginBottom: '12px' } }, h('div', { class: 'eyebrow', text: s.heading }), h('div', { style: { whiteSpace: 'pre-wrap', fontSize: '13px', marginTop: '4px' }, text: s.content }))))));
    } catch (e) { list.replaceChildren(errorBox(e)); }
  }
  ctx.onLive((type, d) => { if (type === 'job' && d.kind === 'content' && d.status === 'done') load(); });
  await load();
}
