// Notification center. Listens to real activity events and turns the ones the
// owner must know about into prioritized notifications; escalates critical ones
// to SMS / phone call when Twilio is connected and preferences allow.
import { getDb, json, parse } from './db.js';
import { bus, emit } from './events.js';
import { isConfigured, settings } from './config.js';
import { sendSms, placeCall } from './integrations/twilio.js';

export const PRIORITIES = ['low', 'normal', 'high', 'critical'];

export const KINDS = {
  approval: 'Approval needed',
  reply: 'Client responded',
  lead: 'New leads discovered',
  demo: 'Demo completed',
  payment: 'Payment received',
  error: 'System error',
  opportunity: 'Important opportunity',
  site: 'Site monitoring',
};

const DEFAULT_PREFS = {
  enabled: Object.fromEntries(Object.keys(KINDS).map((k) => [k, true])),
  smsMinPriority: 'critical',
  callOnCritical: false,
};

export function getPrefs() {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'notifications'").get();
  const saved = parse(row?.value, {});
  return { ...DEFAULT_PREFS, ...saved, enabled: { ...DEFAULT_PREFS.enabled, ...(saved.enabled || {}) } };
}

export function setPrefs(patch) {
  const cur = getPrefs();
  const next = { ...cur };
  if (patch.enabled && typeof patch.enabled === 'object') {
    for (const [k, v] of Object.entries(patch.enabled)) if (k in KINDS) next.enabled[k] = !!v;
  }
  if (patch.smsMinPriority !== undefined) {
    if (![...PRIORITIES, 'off'].includes(patch.smsMinPriority)) throw new Error('smsMinPriority must be a priority or "off"');
    next.smsMinPriority = patch.smsMinPriority;
  }
  if (patch.callOnCritical !== undefined) next.callOnCritical = !!patch.callOnCritical;
  getDb().prepare("INSERT INTO settings (key, value) VALUES ('notifications', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(json(next));
  return next;
}

export function notify({ kind, priority = 'normal', title, body = null, entity = null, entityId = null, link = null }) {
  const prefs = getPrefs();
  if (prefs.enabled[kind] === false && priority !== 'critical') return null;
  const db = getDb();
  const r = db.prepare('INSERT INTO notifications (kind, priority, title, body, entity, entity_id, link) VALUES (?,?,?,?,?,?,?)')
    .run(kind, priority, title, body, entity, entityId, link);
  const id = Number(r.lastInsertRowid);
  const n = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  emit('notification', n);
  escalate(n, prefs);
  return n;
}

async function escalate(n, prefs) {
  if (prefs.smsMinPriority === 'off' || !isConfigured('twilio')) return;
  if (PRIORITIES.indexOf(n.priority) < PRIORITIES.indexOf(prefs.smsMinPriority)) return;
  const results = {};
  const text = `${settings.brand} [${n.priority.toUpperCase()}] ${n.title}${n.body ? ' — ' + n.body : ''}`;
  try { results.sms = await sendSms(text); } catch (e) { results.smsError = e.message; }
  if (n.priority === 'critical' && prefs.callOnCritical) {
    try { results.call = await placeCall(text); } catch (e) { results.callError = e.message; }
  }
  getDb().prepare('UPDATE notifications SET external = ? WHERE id = ?').run(json(results), n.id);
}

export function listNotifications({ unread = false, limit = 100, minPriority } = {}) {
  const rows = getDb().prepare(`SELECT * FROM notifications ${unread ? 'WHERE read_at IS NULL' : ''} ORDER BY id DESC LIMIT ?`).all(limit);
  const min = minPriority ? PRIORITIES.indexOf(minPriority) : 0;
  return rows.filter((r) => PRIORITIES.indexOf(r.priority) >= min).map((r) => ({ ...r, external: parse(r.external) }));
}

export function unreadCounts() {
  const rows = getDb().prepare('SELECT priority, COUNT(*) n FROM notifications WHERE read_at IS NULL GROUP BY priority').all();
  const out = Object.fromEntries(PRIORITIES.map((p) => [p, 0]));
  for (const r of rows) out[r.priority] = r.n;
  out.total = rows.reduce((s, r) => s + r.n, 0);
  return out;
}

export function markRead(id) {
  getDb().prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND read_at IS NULL").run(id);
}

export function markAllRead() {
  getDb().prepare("UPDATE notifications SET read_at = datetime('now') WHERE read_at IS NULL").run();
}

/** Map activity events → notifications. */
export function fromActivity(a) {
  const d = a.detail || {};
  switch (a.action) {
    case 'approval_requested':
      return notify({ kind: 'approval', priority: 'high', title: 'Akamaru needs your approval', body: d.summary, entity: 'approval', entityId: a.entity_id, link: '#/approvals' });
    case 'reply_received':
      if (!d.businessId) return notify({ kind: 'reply', priority: 'low', title: 'Reply from an unknown sender', body: `Intent: ${d.intent}`, entity: 'message', entityId: a.entity_id, link: '#/activity' });
      return notify({ kind: 'reply', priority: d.intent === 'interested' ? 'high' : 'normal', title: d.intent === 'interested' ? 'A prospect is interested' : 'A client responded', body: `Intent: ${String(d.intent).replace(/_/g, ' ')}`, entity: 'business', entityId: d.businessId, link: `#/projects/${d.businessId}` });
    case 'businesses_discovered':
      if (!d.new) return null;
      return notify({ kind: 'lead', priority: 'low', title: `${d.new} new lead${d.new > 1 ? 's' : ''} discovered`, body: `${d.category} near ${d.near} via ${d.provider}`, link: '#/leads' });
    case 'demo_qa_passed':
      return notify({ kind: 'demo', priority: 'normal', title: 'Website demo completed', body: 'Passed Itachi QA', entity: 'business', entityId: a.entity_id, link: `#/projects/${a.entity_id}` });
    case 'invoice_paid':
      return notify({ kind: 'payment', priority: 'high', title: 'Payment received', body: `$${Number(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, entity: 'invoice', entityId: a.entity_id, link: '#/revenue' });
    case 'business_researched':
      if ((d.score ?? 0) < 70) return null;
      return notify({ kind: 'opportunity', priority: 'high', title: 'Hot opportunity identified', body: `Opportunity score ${d.score}/100`, entity: 'business', entityId: a.entity_id, link: `#/projects/${a.entity_id}` });
    case 'site_down':
      return notify({ kind: 'site', priority: 'critical', title: 'Client website is down', body: `${d.url} — ${d.error || 'HTTP ' + d.status}`, entity: 'site', entityId: a.entity_id, link: '#/health' });
    case 'job_failed':
    case 'approval_failed':
    case 'pipeline_step_failed':
    case 'vercel_deploy_failed':
      return notify({ kind: 'error', priority: a.action === 'approval_failed' ? 'critical' : 'high', title: `Operation failed: ${a.action.replace(/_/g, ' ')}`, body: d.error || d.label || null, entity: a.entity, entityId: a.entity_id, link: a.entity === 'business' ? `#/projects/${a.entity_id}` : '#/health' });
    default:
      return null;
  }
}

let started = false;
export function startNotifier() {
  if (started) return;
  started = true;
  bus.on('event', (e) => {
    if (e.type !== 'activity') return;
    try { fromActivity(e.data); } catch (err) { console.error('notifier:', err.message); }
  });
}
