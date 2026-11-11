// AKUMARU shell: navigation, router, top bar telemetry, command palette,
// notifications drawer, keyboard shortcuts and the live event connection.
import { h, clear, fmt, toast, modal, statusDot, empty, errorBox, promptDialog } from './lib/dom.js';
import { icon, brandMark } from './lib/icons.js';
import { api, live, connectLive, getToken, setToken } from './lib/api.js';

export const NAV = [
  { group: 'Command', items: [
    { id: 'overview', label: 'Overview', icon: 'overview', key: 'o' },
    { id: 'command', label: 'AI Command Center', icon: 'command', key: 'c' },
    { id: 'activity', label: 'Live Activity', icon: 'activity', key: 'l' },
  ] },
  { group: 'Business', items: [
    { id: 'leads', label: 'Leads', icon: 'leads', key: 'e' },
    { id: 'clients', label: 'Clients', icon: 'clients' },
    { id: 'projects', label: 'Projects', icon: 'projects', key: 'p' },
    { id: 'revenue', label: 'Revenue', icon: 'revenue', key: 'r' },
    { id: 'analytics', label: 'Analytics', icon: 'analytics', key: 'y' },
  ] },
  { group: 'Automation', items: [
    { id: 'agents', label: 'AI Agents', icon: 'agents', key: 'g' },
    { id: 'workflows', label: 'Workflows', icon: 'workflows' },
    { id: 'schedules', label: 'Scheduled Tasks', icon: 'schedules' },
    { id: 'approvals', label: 'Approvals', icon: 'approvals', key: 'a', badge: 'approvals' },
  ] },
  { group: 'Creation', items: [
    { id: 'builder', label: 'Website Builder', icon: 'builder' },
    { id: 'demos', label: 'Demo Generator', icon: 'demos', key: 'd' },
    { id: 'marketing', label: 'Marketing Studio', icon: 'marketing' },
    { id: 'content', label: 'Content Studio', icon: 'content' },
  ] },
  { group: 'System', items: [
    { id: 'integrations', label: 'Integrations', icon: 'integrations', key: 'i' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications', key: 'n', badge: 'notifications' },
    { id: 'health', label: 'System Health', icon: 'health', key: 'h' },
    { id: 'settings', label: 'Settings', icon: 'settings', key: 's' },
  ] },
];
const ALL = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));
const VIEWS = {
  overview: () => import('./views/overview.js'), command: () => import('./views/command.js'), activity: () => import('./views/activity.js'),
  leads: () => import('./views/leads.js'), clients: () => import('./views/clients.js'), projects: () => import('./views/projects.js'),
  revenue: () => import('./views/revenue.js'), analytics: () => import('./views/analytics.js'), agents: () => import('./views/agents.js'),
  workflows: () => import('./views/workflows.js'), schedules: () => import('./views/schedules.js'), approvals: () => import('./views/approvals.js'),
  builder: () => import('./views/builder.js'), demos: () => import('./views/demos.js'), marketing: () => import('./views/studio.js'),
  content: () => import('./views/studio.js'), integrations: () => import('./views/integrations.js'), notifications: () => import('./views/notifications.js'),
  health: () => import('./views/health.js'), settings: () => import('./views/settings.js'),
};

// ---------- shared state ----------
export const state = { meta: null, counts: { approvals: 0, notifications: 0, critical: 0 }, jobs: [], health: null };
const stateListeners = new Set();
export function onState(fn) { stateListeners.add(fn); return () => stateListeners.delete(fn); }
function emitState() { for (const fn of stateListeners) fn(state); }

export function navigate(hash) { if (location.hash !== hash) location.hash = hash; else route(); }

// ---------- shell DOM ----------
const app = h('div', { class: 'app' });
const navEls = {};
const badgeEls = { approvals: [], notifications: [] };
const sidebar = h('aside', { class: 'sidebar', 'aria-label': 'Primary' },
  h('div', { class: 'brand' }, brandMark(), h('div', { class: 'brand-text' }, h('div', { class: 'brand-name', id: 'brand-name', text: 'AKUMARU' }), h('div', { class: 'brand-sub', text: 'AUTONOMOUS INTELLIGENCE' }))),
  h('nav', { class: 'nav' }, NAV.map((g) => h('div', { class: 'nav-group' },
    h('div', { class: 'nav-label', text: g.group.toUpperCase() }),
    g.items.map((it) => {
      const badge = it.badge ? h('span', { class: 'badge hidden' }) : null;
      if (badge) badgeEls[it.badge].push(badge);
      const a = h('a', { href: `#/${it.id}`, title: it.label + (it.key ? `  (g ${it.key})` : '') }, icon(it.icon), h('span', { class: 'nav-text', text: it.label }), badge);
      navEls[it.id] = a;
      return a;
    })))),
  h('div', { class: 'sidebar-foot' }, h('button', { class: 'collapse-btn', onclick: () => toggleSidebar(), title: 'Collapse sidebar  ( [ )' }, icon('chevron'), h('span', { class: 'collapse-text', text: 'Collapse' }))));

const titleEl = h('h1', {});
const crumbEl = h('div', { class: 'crumb' });
const linkChip = h('span', { class: 'chip keep', title: 'Real-time connection to the AKUMARU core' });
const aiChip = h('button', { class: 'chip', title: 'What AKUMARU is doing — open Live Activity', onclick: () => navigate('#/activity') });
const healthChip = h('button', { class: 'chip opt', title: 'Business health', onclick: () => navigate('#/health') });
const clock = h('div', { class: 'clock', 'aria-live': 'off' });
const bellCount = h('span', { class: 'badge count hidden' });
const bell = h('button', { class: 'icon-btn', 'aria-label': 'Notifications', title: 'Notifications  (g n)', onclick: () => openNotifications() }, icon('notifications'), bellCount);
const topbar = h('header', { class: 'topbar' },
  h('button', { class: 'icon-btn menu-btn', 'aria-label': 'Open menu', onclick: () => app.classList.toggle('mobile-open') }, icon('menu')),
  h('div', { class: 'page-title' }, crumbEl, titleEl),
  h('button', { class: 'search-trigger', onclick: () => openPalette(), 'aria-label': 'Search or run a command' }, icon('search'), h('span', { class: 'label', text: 'Search or tell AKUMARU what to do…' }), h('span', { class: 'kbd', text: navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K' })),
  h('div', { class: 'status-cluster' }, linkChip, aiChip, healthChip),
  clock, bell);
const view = h('main', { class: 'view', id: 'main', tabindex: '-1' });
app.append(sidebar, h('div', { class: 'workspace' }, topbar, view));
document.body.append(app);
view.addEventListener('click', () => app.classList.remove('mobile-open'));

try { if (localStorage.getItem('akumaru_sidebar') === 'collapsed') app.classList.add('collapsed'); } catch { /* ignore */ }
function toggleSidebar() {
  app.classList.toggle('collapsed');
  try { localStorage.setItem('akumaru_sidebar', app.classList.contains('collapsed') ? 'collapsed' : 'open'); } catch { /* ignore */ }
}

function tickClock() {
  const d = new Date();
  clear(clock).append(h('b', { text: d.toLocaleTimeString('en-US', { hour12: false }) }), d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase());
}
tickClock();
setInterval(tickClock, 1000);

live.onStatus((s) => {
  clear(linkChip).append(h('i', { class: `dot ${s === 'live' ? 'good' : s === 'connecting' ? 'warning' : 'critical'}` }), h('span', { text: s === 'live' ? 'LINK LIVE' : s === 'connecting' ? 'LINKING' : 'RECONNECTING' }));
});

function renderStatus() {
  const running = state.jobs.filter((j) => j.status === 'running').length;
  const queued = state.jobs.filter((j) => j.status === 'queued').length;
  clear(aiChip).append(h('i', { class: `dot ${running ? 'active' : 'idle'}` }), running ? h('span', {}, 'AI ', h('b', { text: 'EXECUTING' }), ` · ${running}${queued ? `+${queued}` : ''}`) : h('span', {}, 'AI ', h('b', { text: 'STANDBY' })));
  const lvl = state.health?.level || 'nominal';
  const map = { nominal: ['good', 'NOMINAL'], attention: ['warning', 'ATTENTION'], serious: ['serious', 'DEGRADED'], critical: ['critical', 'CRITICAL'] };
  clear(healthChip).append(h('i', { class: `dot ${map[lvl][0]}` }), h('span', {}, 'HEALTH ', h('b', { text: map[lvl][1] })));
  healthChip.title = state.health?.signals?.map((s) => s.text).join('\n') || 'No issues detected';
  for (const [k, els] of Object.entries(badgeEls)) {
    const n = state.counts[k];
    for (const b of els) { b.textContent = n; b.classList.toggle('hidden', !n); b.className = `badge ${n ? '' : 'hidden'} ${k === 'approvals' ? 'cyan' : state.counts.critical ? 'critical' : 'cyan'}`; }
  }
  bellCount.textContent = state.counts.notifications;
  bellCount.className = `badge count ${state.counts.notifications ? '' : 'hidden'} ${state.counts.critical ? 'critical' : 'cyan'}`;
  document.title = `${state.counts.approvals ? `(${state.counts.approvals}) ` : ''}${state.meta?.brand || 'AKUMARU'} · Command Center`;
}

let statusTimer;
export async function refreshStatus() {
  clearTimeout(statusTimer);
  try {
    const [jobs, notes, approvals, sys] = await Promise.all([
      api.get('/api/jobs?status=running,queued'),
      api.get('/api/notifications?unread=1'),
      api.get('/api/approvals'),
      api.get('/api/overview?range=7d').then((o) => o.health),
    ]);
    state.jobs = jobs;
    state.counts = { approvals: approvals.length, notifications: notes.counts.total, critical: notes.counts.critical };
    state.health = sys;
    renderStatus();
    emitState();
  } catch { /* shown by views */ }
  statusTimer = setTimeout(refreshStatus, 30000);
}

let refreshQueued = false;
function scheduleStatusRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  setTimeout(() => { refreshQueued = false; refreshStatus(); }, 400);
}

live.on((type, data) => {
  if (type === 'job') {
    const i = state.jobs.findIndex((j) => j.id === data.id);
    if (['running', 'queued'].includes(data.status)) { if (i >= 0) state.jobs[i] = data; else state.jobs.push(data); }
    else if (i >= 0) state.jobs.splice(i, 1);
    renderStatus();
    emitState();
    if (data.status === 'done' && data.source !== 'schedule') toast('Operation complete', data.label, 'good');
    if (data.status === 'failed') toast('Operation failed', `${data.label}: ${data.error}`, 'critical');
  }
  if (type === 'notification') {
    if (['high', 'critical'].includes(data.priority)) toast(data.title, data.body || '', data.priority);
    scheduleStatusRefresh();
  }
  if (type === 'activity' && /approval_|stage_changed|invoice/.test(data.action)) scheduleStatusRefresh();
});

// ---------- router ----------
let cleanup = null;
let currentView = null;
async function route() {
  const raw = location.hash.replace(/^#\/?/, '') || 'overview';
  const [path, query = ''] = raw.split('?');
  const [id, ...rest] = path.split('/');
  const item = ALL.find((i) => i.id === id) || ALL[0];
  for (const [k, a] of Object.entries(navEls)) { a.classList.toggle('active', k === item.id); if (k === item.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  titleEl.textContent = item.label;
  crumbEl.textContent = item.group;
  app.classList.remove('mobile-open');
  try { cleanup?.(); } catch { /* ignore */ }
  cleanup = null;
  const inner = h('div', { class: 'view-inner' });
  clear(view).append(inner);
  view.scrollTop = 0;
  currentView = item.id;
  try {
    const mod = await VIEWS[item.id]();
    if (currentView !== item.id) return;
    const subs = [];
    const ctx = {
      params: rest, query: new URLSearchParams(query), id: item.id, navigate, state, refreshStatus,
      onLive: (fn) => subs.push(live.on(fn)),
      onState: (fn) => subs.push(onState(fn)),
      setTitle: (t) => { titleEl.textContent = t; },
    };
    const off = await mod.default(inner, ctx);
    cleanup = () => { subs.forEach((u) => u()); off?.(); };
  } catch (e) {
    inner.append(errorBox(e));
  }
}
window.addEventListener('hashchange', route);

// ---------- palette (search + navigate + command) ----------
function openPalette(initial = '') {
  const input = h('input', { placeholder: 'Search leads, pages, operations — or type a command and press Enter', value: initial, 'aria-label': 'Command palette', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list' });
  const list = h('div', { class: 'palette-list', id: 'palette-list', role: 'listbox' });
  let items = [];
  let sel = 0;
  let seq = 0;
  const close = modal(h('div', { class: 'palette' }, input, list,
    h('div', { class: 'palette-foot' }, h('span', {}, h('span', { class: 'kbd', text: '↑↓' }), ' navigate'), h('span', {}, h('span', { class: 'kbd', text: '↵' }), ' open / run'), h('span', {}, h('span', { class: 'kbd', text: 'esc' }), ' close'))));
  const draw = () => {
    clear(list);
    let lastGroup = null;
    items.forEach((it, i) => {
      if (it.group !== lastGroup) { list.append(h('div', { class: 'palette-group', text: it.group })); lastGroup = it.group; }
      list.append(h('div', { class: 'palette-item', role: 'option', 'aria-selected': String(i === sel), onmousemove: () => { if (sel !== i) { sel = i; draw(); } }, onclick: () => run(it) },
        icon(it.icon), h('div', { class: 'pt' }, h('div', { text: it.title }), it.subtitle && h('div', { class: 'ps', text: it.subtitle })), it.hint && h('span', { class: 'kbd', text: it.hint })));
    });
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };
  const run = (it) => { close(); it.run(); };
  const update = async () => {
    const q = input.value.trim();
    const my = ++seq;
    const nav = ALL.filter((i) => !q || i.label.toLowerCase().includes(q.toLowerCase())).slice(0, q ? 6 : 20)
      .map((i) => ({ group: 'Go to', title: i.label, subtitle: i.group, icon: i.icon, hint: i.key ? `g ${i.key}` : null, run: () => navigate(`#/${i.id}`) }));
    const cmd = q ? [{ group: 'Ask AKUMARU', title: `Run: “${q}”`, subtitle: 'Execute as a command in the AI Command Center', icon: 'command', hint: '↵', run: () => { sessionStorage.setItem('akumaru_pending_cmd', q); navigate('#/command'); window.dispatchEvent(new CustomEvent('akumaru:command', { detail: q })); } }] : [];
    items = [...cmd, ...nav];
    sel = 0;
    draw();
    if (q.length >= 2) {
      try {
        const res = await api.get(`/api/search?q=${encodeURIComponent(q)}`);
        if (my !== seq) return;
        items = [...cmd, ...res.map((r) => ({ group: r.type + 's', title: r.title, subtitle: r.subtitle, icon: r.type === 'Lead' ? 'leads' : r.type === 'Approval' ? 'approvals' : r.type === 'Operation' ? 'activity' : r.type === 'Content' ? 'content' : 'command', run: () => navigate(r.href) })), ...nav];
        draw();
      } catch { /* keep local results */ }
    }
  };
  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    if (e.key === 'Enter' && items[sel]) { e.preventDefault(); run(items[sel]); }
  });
  update();
}

// ---------- notifications drawer ----------
async function openNotifications() {
  document.querySelector('.drawer')?.remove();
  const body = h('div', { class: 'drawer-body' });
  const drawer = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': 'Notifications' },
    h('div', { class: 'drawer-head' }, h('b', { text: 'Notifications' }), h('div', { class: 'spacer' }),
      h('button', { class: 'btn sm ghost', text: 'Mark all read', onclick: async () => { await api.post('/api/notifications/read-all'); refreshStatus(); load(); } }),
      h('button', { class: 'btn sm ghost', text: 'All', onclick: () => { drawer.remove(); navigate('#/notifications'); } }),
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => drawer.remove() }, icon('close'))),
    body);
  document.body.append(drawer);
  const esc = (e) => { if (e.key === 'Escape') { drawer.remove(); removeEventListener('keydown', esc); } };
  addEventListener('keydown', esc);
  async function load() {
    try {
      const { items } = await api.get('/api/notifications');
      clear(body);
      if (!items.length) return body.append(empty('No notifications yet', 'Approvals, replies, payments, hot leads and system errors will appear here.'));
      const { renderNotification } = await import('./views/notifications.js');
      body.append(h('div', { class: 'list' }, items.slice(0, 40).map((n) => renderNotification(n, () => { drawer.remove(); }, () => { refreshStatus(); }))));
    } catch (e) { body.replaceChildren(errorBox(e)); }
  }
  load();
}

// ---------- shortcuts ----------
const SHORTCUTS = [
  ['⌘K / Ctrl K', 'Search, navigate, or run a command'], ['/', 'Focus the command input'], ['g then a letter', 'Go to a page (hover nav items to see letters)'],
  ['[', 'Collapse / expand sidebar'], ['?', 'Show keyboard shortcuts'], ['Esc', 'Close dialogs and menus'],
];
export function showShortcuts() {
  modal(h('div', { class: 'dialog' }, h('h3', { text: 'Keyboard shortcuts' }),
    h('table', { class: 'data', style: { marginTop: '10px' } }, h('tbody', {}, SHORTCUTS.map(([k, d]) => h('tr', {}, h('td', {}, h('span', { class: 'kbd', text: k })), h('td', { class: 'dim', text: d }))),
      ALL.filter((i) => i.key).map((i) => h('tr', {}, h('td', {}, h('span', { class: 'kbd', text: `g ${i.key}` })), h('td', { class: 'dim', text: i.label })))))));
}
let gPending = 0;
addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!document.querySelector('.palette')) openPalette(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.overlay')) return;
  if (e.key === '/') { e.preventDefault(); const t = document.querySelector('[data-command-input]'); if (t) t.focus(); else { navigate('#/command'); } return; }
  if (e.key === '?') { showShortcuts(); return; }
  if (e.key === '[') { toggleSidebar(); return; }
  if (e.key === 'g') { gPending = Date.now(); return; }
  if (gPending && Date.now() - gPending < 1200) {
    const it = ALL.find((i) => i.key === e.key.toLowerCase());
    gPending = 0;
    if (it) navigate(`#/${it.id}`);
  }
});

// ---------- auth ----------
window.addEventListener('akumaru:auth', async () => {
  if (document.querySelector('[data-auth-dialog]')) return;
  const t = await promptDialog({ title: 'Admin token required', label: 'This AKUMARU server is protected. Enter the AKAMARU_ADMIN_TOKEN value from its .env file.', confirmLabel: 'Unlock', value: '' });
  if (t) { setToken(t.trim()); location.reload(); }
});

// ---------- boot ----------
(async function boot() {
  try {
    state.meta = await api.get('/api/meta');
    document.getElementById('brand-name').textContent = state.meta.brand;
  } catch { /* auth prompt or error shown by view */ }
  connectLive();
  refreshStatus();
  route();
})();

export { statusDot, fmt, getToken };
