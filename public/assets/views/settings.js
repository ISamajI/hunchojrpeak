// SETTINGS — access, identity, automation thresholds, shortcuts.
import { h, toast, statusDot } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { api, getToken, setToken } from '../lib/api.js';
import { viewHead, sectionTitle } from './_shared.js';
import { showShortcuts } from '../app.js';

export default async function settings(root, ctx) {
  const meta = ctx.state.meta || (await api.get('/api/meta'));
  const tok = h('input', { class: 'input', type: 'password', value: getToken(), placeholder: 'Only needed when AKAMARU_ADMIN_TOKEN is set on the server', style: { flex: 1 }, autocomplete: 'off' });
  const row = (k, v, hint) => h('tr', {}, h('td', { class: 'muted', style: { width: '260px' }, text: k }), h('td', {}, h('span', { text: v }), hint && h('div', { class: 'muted', style: { fontSize: '11px' }, text: hint })));
  root.append(viewHead('Settings', 'Identity and automation settings are read from the server’s .env file so they stay in one place. Change them there and restart AKUMARU.'),
    h('section', { class: 'panel' }, h('header', { class: 'panel-head' }, h('h2', { text: 'Dashboard access' })),
      h('div', { class: 'panel-body' }, h('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); setToken(tok.value.trim()); toast('Token saved on this device', 'Reloading…', 'good'); setTimeout(() => location.reload(), 600); } },
        icon('key'), tok, h('button', { class: 'btn primary', text: 'Save token' }), h('button', { type: 'button', class: 'btn ghost', text: 'Clear', onclick: () => { setToken(''); tok.value = ''; toast('Token cleared'); } })),
        h('div', { class: 'muted', style: { fontSize: '11.5px', marginTop: '8px' }, text: 'Stored only in this browser. Without a server token, AKUMARU only accepts connections from this machine (127.0.0.1).' }))),
    sectionTitle('Identity'),
    h('section', { class: 'panel' }, h('table', { class: 'data' }, h('tbody', {},
      row('System name', meta.brand, 'AKAMARU_BRAND_NAME'), row('Agency', meta.agency.name, 'AGENCY_NAME'), row('Owner', meta.agency.owner, 'AGENCY_OWNER'),
      row('Agency website', meta.agency.site || '—', 'AGENCY_SITE — used in outreach signatures and demo footers'), row('Agency phone', meta.agency.phone || '—', 'AGENCY_PHONE')))),
    sectionTitle('Automation'),
    h('section', { class: 'panel' }, h('table', { class: 'data' }, h('tbody', {},
      row('Demo score threshold', `${meta.threshold} / 100`, 'AKAMARU_DEMO_THRESHOLD — leads scoring below this are researched but not pitched'),
      row('Owner approval required for', 'Email sends · replies · production publishing · payments · purchases · contracts · campaigns', 'Hard-coded in the decision engine; unknown actions also require approval'),
      row('Operation kinds', meta.jobKinds.join(', '))))),
    sectionTitle('Keyboard'),
    h('section', { class: 'panel pad' }, h('button', { class: 'btn', onclick: showShortcuts }, 'Show keyboard shortcuts'), ' ', h('span', { class: 'muted', style: { fontSize: '12px' } }, 'Or press ', h('span', { class: 'kbd', text: '?' }), ' anywhere.')),
    sectionTitle('Notifications & integrations'),
    h('section', { class: 'panel pad row' }, h('a', { class: 'btn', href: '#/notifications' }, icon('notifications'), 'Notification preferences'), h('a', { class: 'btn', href: '#/integrations' }, icon('integrations'), 'Integrations'), statusDot('good', 'CONFIG LOADED')));
}
