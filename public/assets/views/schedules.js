// SCHEDULED TASKS — recurring autonomous operations.
import { h, clear, fmt, empty, errorBox, toast, confirmDialog } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { viewHead, sectionTitle } from './_shared.js';

export default async function schedules(root, ctx) {
  const list = h('section', { class: 'panel' });
  const form = h('form', { class: 'form-grid' });
  root.append(viewHead('Scheduled Tasks', 'Recurring operations AKUMARU runs on its own while the server is up. Schedules can only start autonomous work — anything they produce that needs approval still queues for you.'),
    list, sectionTitle('New schedule'), h('section', { class: 'panel pad' }, form));

  const kind = h('select', { class: 'input' }, [['pipeline', 'Discovery pipeline'], ['followups', 'Follow-up scan'], ['uptime', 'Uptime sweep']].map(([v, t]) => h('option', { value: v, text: t })));
  const category = h('input', { class: 'input', placeholder: 'barber (blank = sweep trades)' });
  const near = h('input', { class: 'input', placeholder: 'Hamilton, ON' });
  const limit = h('input', { class: 'input', type: 'number', min: 1, max: 50, value: 10 });
  const every = h('select', { class: 'input' }, [[1, 'Every hour'], [6, 'Every 6 hours'], [24, 'Daily'], [168, 'Weekly']].map(([v, t]) => h('option', { value: v, text: t, selected: v === 24 })));
  const pipeFields = [h('label', { class: 'field' }, 'Category', category), h('label', { class: 'field' }, 'Location', near), h('label', { class: 'field' }, 'Businesses per run', limit)];
  const syncKind = () => pipeFields.forEach((f) => f.classList.toggle('hidden', kind.value !== 'pipeline'));
  kind.addEventListener('change', syncKind);
  form.append(h('label', { class: 'field' }, 'Operation', kind), ...pipeFields, h('label', { class: 'field' }, 'Frequency', every), h('button', { class: 'btn primary' }, icon('plus'), 'Create schedule'));
  syncKind();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const args = kind.value === 'pipeline' ? { near: near.value.trim(), limit: Number(limit.value) || 10, ...(category.value.trim() ? { category: category.value.trim() } : { categories: ['restaurant', 'barber', 'beauty', 'auto repair', 'cafe', 'dentist'] }) } : {};
    try { await api.post('/api/schedules', { kind: kind.value, args, everyHours: Number(every.value) }); toast('Schedule created', '', 'good'); load(); } catch (x) { toast('Could not create schedule', x.message, 'critical'); }
  });

  async function load() {
    try {
      const { schedules: items, running } = await api.get('/api/schedules');
      clear(list).append(h('header', { class: 'panel-head' }, h('h2', { text: 'Schedules' }), h('span', { class: 'status-text', style: { marginLeft: '6px' } }, h('i', { class: `dot ${running ? 'good' : 'warning'}` }), running ? 'SCHEDULER RUNNING' : 'SCHEDULER STOPPED (CLI MODE)')));
      if (!items.length) return list.append(empty('No schedules', 'Create one below — e.g. a daily discovery sweep of your area.'));
      list.append(h('table', { class: 'data' }, h('thead', {}, h('tr', {}, ['Operation', 'Frequency', 'Next run', 'Last run', 'Enabled', ''].map((c) => h('th', { text: c })))),
        h('tbody', {}, items.map((s) => {
          const toggle = h('input', { type: 'checkbox', checked: !!s.enabled, 'aria-label': `Enable ${s.name}`, onchange: async () => { await api.post(`/api/schedules/${s.id}`, { enabled: toggle.checked }).catch((x) => toast('Error', x.message, 'critical')); load(); } });
          return h('tr', {}, h('td', {}, h('div', { text: s.name }), h('div', { class: 'muted', style: { fontSize: '11px' }, text: s.kind })),
            h('td', { text: s.every_hours >= 168 ? 'Weekly' : s.every_hours >= 24 ? `Every ${s.every_hours / 24} day(s)` : `Every ${s.every_hours}h` }),
            h('td', { class: 'mono', text: s.enabled ? `${fmt.date(s.next_run_at)} ${fmt.time(s.next_run_at)}` : 'paused' }),
            h('td', {}, s.last_job_id ? h('a', { href: `#/activity?job=${s.last_job_id}`, text: fmt.ago(s.last_run_at) }) : h('span', { class: 'muted', text: 'never' })),
            h('td', {}, h('label', { class: 'check' }, toggle)),
            h('td', { class: 'r' }, h('div', { class: 'row tight', style: { justifyContent: 'flex-end' } },
              h('button', { class: 'btn sm', onclick: async () => { try { await api.post(`/api/schedules/${s.id}/run`); toast('Started', s.name); ctx.refreshStatus(); load(); } catch (x) { toast('Error', x.message, 'critical'); } } }, icon('play'), 'Run now'),
              h('button', { class: 'btn sm danger', 'aria-label': 'Delete schedule', onclick: async () => { if (await confirmDialog({ title: 'Delete schedule?', body: s.name, confirmLabel: 'Delete', danger: true })) { await api.post(`/api/schedules/${s.id}/delete`); load(); } } }, icon('trash')))));
        }))));
    } catch (e) { list.replaceChildren(errorBox(e)); }
  }
  await load();
}
