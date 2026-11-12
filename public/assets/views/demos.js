// DEMO GENERATOR — every generated demo, live previews, and one-click generation.
import { h, clear, fmt, empty, errorBox, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { viewHead, scoreCell, localPreview } from './_shared.js';

export default async function demos(root, ctx) {
  const picker = h('select', { class: 'input', style: { minWidth: '260px' }, 'aria-label': 'Business to build a demo for' });
  const gen = h('button', { class: 'btn primary' }, icon('demos'), 'Generate demo');
  const grid = h('div', { class: 'grid cols-3' });
  root.append(viewHead('Demo Generator', 'Web Development builds a personalized concept site from each business’s real data, Itachi QA-gates it, and it deploys as a preview. Demos are labeled as concepts and hidden from search engines.', h('div', { class: 'row tight' }, picker, gen)), grid);
  gen.addEventListener('click', async () => {
    if (!picker.value) return;
    gen.disabled = true;
    try { const j = await api.post('/api/jobs', { kind: 'build_demo', args: { businessId: Number(picker.value) } }); toast('Building demo', j.label); ctx.refreshStatus(); } catch (e) { toast('Could not start', e.message, 'critical'); } finally { gen.disabled = false; }
  });
  async function load() {
    try {
      const { projects } = await api.get('/api/projects');
      clear(picker).append(h('option', { value: '', text: projects.length ? 'Choose a business…' : 'No leads yet' }), ...projects.filter((p) => !['lost', 'do_not_contact'].includes(p.stage)).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map((p) => h('option', { value: p.id, text: `${p.name}${p.score != null ? ` · score ${p.score}` : ''}${p.demo_count ? ` · ${p.demo_count} demo${p.demo_count > 1 ? 's' : ''}` : ''}` })));
      const withDemos = projects.filter((p) => p.preview_url);
      clear(grid);
      if (!withDemos.length) return grid.append(h('section', { class: 'panel', style: { gridColumn: '1/-1' } }, empty('No demos yet', 'Pick a business above and generate one, or run the discovery pipeline.')));
      for (const p of withDemos) {
        const local = localPreview(p.preview_url);
        grid.append(h('section', { class: 'panel' },
          h('div', { style: { padding: '12px 12px 0' } }, local ? h('div', { class: 'iframe-thumb' }, h('iframe', { src: local, title: `${p.name} demo thumbnail`, sandbox: 'allow-scripts', loading: 'lazy', tabindex: '-1' })) : h('div', { class: 'iframe-thumb', style: { display: 'grid', placeItems: 'center', background: 'var(--surface)' } }, h('span', { class: 'muted', text: 'Hosted on Vercel' }))),
          h('div', { class: 'panel-body' },
            h('div', { class: 'row tight', style: { justifyContent: 'space-between' } }, h('b', { class: 'truncate', text: p.name }), scoreCell(p.score)),
            h('div', { class: 'muted', style: { fontSize: '11.5px', margin: '2px 0 10px' }, text: [p.category?.replace(/_/g, ' '), p.city, `${p.demo_count} version${p.demo_count > 1 ? 's' : ''}`].filter(Boolean).join(' · ') }),
            h('div', { class: 'row tight' }, h('a', { class: 'btn sm', href: p.preview_url, target: '_blank', rel: 'noopener' }, icon('external'), 'Open'), h('a', { class: 'btn sm ghost', href: `#/projects/${p.id}` }, 'Project', icon('right')),
              h('button', { class: 'btn sm ghost', onclick: async () => { await api.post('/api/jobs', { kind: 'build_demo', args: { businessId: p.id } }); toast('Rebuilding', p.name); ctx.refreshStatus(); } }, icon('refresh'), 'Rebuild')))));
      }
    } catch (e) { grid.replaceChildren(errorBox(e)); }
  }
  let t;
  ctx.onLive((type, d) => { if ((type === 'job' && d.kind === 'build_demo' && d.status === 'done') || (type === 'activity' && d.action === 'preview_deployed')) { clearTimeout(t); t = setTimeout(load, 400); } });
  await load();
  return () => clearTimeout(t);
}
