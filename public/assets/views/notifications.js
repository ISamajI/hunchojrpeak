// NOTIFICATIONS — prioritized feed + preferences + SMS / phone escalation.
import { h, clear, fmt, empty, errorBox, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { PRIORITY } from '../lib/labels.js';
import { viewHead } from './_shared.js';

const KIND_ICON = { approval: 'approvals', reply: 'mail', lead: 'leads', demo: 'demos', payment: 'revenue', error: 'x', opportunity: 'target', site: 'globe' };

export function renderNotification(n, onNavigate, onChange) {
  const [dot, label] = PRIORITY[n.priority];
  const el = h('div', { class: 'list-item click', style: n.read_at ? { opacity: 0.6 } : {}, tabindex: 0, onclick: async () => { if (!n.read_at) { await api.post(`/api/notifications/${n.id}/read`).catch(() => {}); onChange?.(); } onNavigate?.(); if (n.link) location.hash = n.link; } },
    h('div', { class: 'agent-glyph', style: { width: '30px', height: '30px' } }, icon(KIND_ICON[n.kind] || 'notifications')),
    h('div', { class: 'grow' },
      h('div', { class: 'row tight' }, h('span', { class: 'title', style: { fontWeight: n.read_at ? 400 : 600 }, text: n.title }), h('span', { class: 'status-text', style: { marginLeft: 'auto' } }, h('i', { class: `dot ${dot}` }), label)),
      n.body && h('div', { class: 'dim', style: { fontSize: '12px' }, text: n.body }),
      h('div', { class: 'meta', text: `${fmt.ago(n.created_at)}${n.external ? ' · ' + (n.external.sms ? 'SMS sent' : n.external.smsError ? 'SMS failed: ' + n.external.smsError : '') + (n.external.call ? ' · call placed' : '') : ''}` })));
  return el;
}

export default async function notifications(root, ctx) {
  let min = '';
  const feed = h('div', { class: 'list' });
  const prefsBox = h('div', { class: 'panel-body' });
  const minSel = h('select', { class: 'input', 'aria-label': 'Minimum priority', onchange: (e) => { min = e.target.value; load(); } }, [['', 'All priorities'], ['normal', 'Normal +'], ['high', 'High +'], ['critical', 'Critical only']].map(([v, t]) => h('option', { value: v, text: t })));
  root.append(viewHead('Notifications', 'AKUMARU tells you the moment it needs a decision, a client responds, money arrives, or something breaks. Critical alerts can reach your phone.',
    h('div', { class: 'row tight' }, minSel, h('button', { class: 'btn', onclick: async () => { await api.post('/api/notifications/read-all'); ctx.refreshStatus(); load(); } }, icon('check'), 'Mark all read'))),
    h('div', { class: 'grid cols-3' }, h('section', { class: 'panel span-2' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Feed' })), feed),
      h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Preferences' })), prefsBox)));

  async function load() {
    try {
      const { items } = await api.get(`/api/notifications${min ? `?min=${min}` : ''}`);
      clear(feed);
      if (!items.length) return feed.append(empty('No notifications', 'They appear here as agents work.'));
      items.forEach((n) => feed.append(renderNotification(n, null, () => { ctx.refreshStatus(); load(); })));
    } catch (e) { feed.replaceChildren(errorBox(e)); }
  }
  async function loadPrefs() {
    try {
      const [{ prefs, kinds, priorities }, doctor] = await Promise.all([api.get('/api/settings/notifications'), api.get('/api/doctor')]);
      const tw = doctor.find((d) => d.key === 'twilio');
      const save = async (patch) => { try { await api.post('/api/settings/notifications', patch); toast('Preferences saved', '', 'good'); } catch (e) { toast('Could not save', e.message, 'critical'); } };
      const sms = h('select', { class: 'input', disabled: !tw.configured, onchange: () => save({ smsMinPriority: sms.value }) }, [['off', 'Never'], ...priorities.slice().reverse().map((p) => [p, `${p[0].toUpperCase() + p.slice(1)} and above`])].map(([v, t]) => h('option', { value: v, text: t, selected: v === prefs.smsMinPriority })));
      const call = h('input', { type: 'checkbox', checked: prefs.callOnCritical, disabled: !tw.configured, onchange: () => save({ callOnCritical: call.checked }) });
      clear(prefsBox).append(
        h('div', { class: 'eyebrow', text: 'NOTIFY ME ABOUT' }),
        h('div', { class: 'stack', style: { gap: '8px', margin: '10px 0 18px' } }, Object.entries(kinds).map(([k, label]) => {
          const cb = h('input', { type: 'checkbox', checked: prefs.enabled[k] !== false, onchange: () => save({ enabled: { [k]: cb.checked } }) });
          return h('label', { class: 'check' }, cb, label);
        })),
        h('div', { class: 'muted', style: { fontSize: '11px', marginBottom: '14px' }, text: 'Critical alerts are always recorded, even if their type is turned off.' }),
        h('div', { class: 'eyebrow', text: 'PHONE ESCALATION' }),
        !tw.configured && h('div', { class: 'note warn', style: { margin: '10px 0' } }, 'Twilio is not connected. ', tw.connect),
        h('label', { class: 'field', style: { marginTop: '10px' } }, 'Text me (SMS) for', sms),
        h('label', { class: 'check', style: { marginTop: '10px' } }, call, 'Also call me for critical alerts'));
    } catch (e) { prefsBox.replaceChildren(errorBox(e)); }
  }
  ctx.onLive((type) => { if (type === 'notification') load(); });
  await Promise.all([load(), loadPrefs()]);
}
