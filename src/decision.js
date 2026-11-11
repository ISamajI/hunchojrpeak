// Akamaru Decision Engine.
// Classifies every action as AUTONOMOUS (Akamaru just does it) or
// APPROVAL (queued for the owner). Unknown actions fail safe to APPROVAL.
import { getDb, json, parse } from './db.js';
import { log } from './activity.js';

export const AUTONOMOUS = new Set([
  'discover_businesses',
  'research_business',
  'score_lead',
  'build_demo',
  'qa_demo',
  'deploy_preview',
  'draft_outreach',
  'draft_proposal',
  'classify_reply',
  'organize_lead',
  'create_onboarding_plan',
]);

export const APPROVAL_REQUIRED = {
  send_outreach: 'Sends an email to a real business (external campaign).',
  send_reply: 'Sends an email reply to a prospect or client.',
  publish_production: 'Publishes an official live website.',
  send_contract: 'Sends a binding contract or client commitment.',
  charge_payment: 'Moves money.',
  purchase: 'Spends money (domains, hosting, tools).',
  launch_campaign: 'Starts a multi-recipient external campaign.',
};

/**
 * @returns {{mode: 'autonomous'|'approval', reason: string}}
 */
export function decide(action, ctx = {}) {
  if (action === 'deploy_preview' && ctx.production) {
    return { mode: 'approval', reason: 'Production deployment is an official publication.' };
  }
  if (AUTONOMOUS.has(action)) return { mode: 'autonomous', reason: 'Internal, reversible, non-binding work.' };
  if (APPROVAL_REQUIRED[action]) return { mode: 'approval', reason: APPROVAL_REQUIRED[action] };
  return { mode: 'approval', reason: `Unknown action "${action}" — defaulting to owner approval.` };
}

// Handlers that run once an approval is granted. Registered by branches.
const executors = new Map();

export function registerExecutor(action, fn) {
  executors.set(action, fn);
}

export function requestApproval(action, payload, summary) {
  const { reason } = decide(action, payload);
  const db = getDb();
  const dup = db
    .prepare("SELECT id FROM approvals WHERE action = ? AND payload = ? AND status = 'pending'")
    .get(action, json(payload));
  if (dup) return { id: dup.id, duplicate: true };
  const { lastInsertRowid } = db
    .prepare('INSERT INTO approvals (action, payload, reason, summary) VALUES (?, ?, ?, ?)')
    .run(action, json(payload), reason, summary);
  const id = Number(lastInsertRowid);
  log('decision-engine', 'approval_requested', 'approval', id, { action, summary });
  return { id, duplicate: false };
}

export function listApprovals(status = 'pending') {
  const db = getDb();
  const rows = status === 'all'
    ? db.prepare('SELECT * FROM approvals ORDER BY id DESC').all()
    : db.prepare('SELECT * FROM approvals WHERE status = ? ORDER BY id DESC').all(status);
  return rows.map(hydrate);
}

export function getApproval(id) {
  const row = getDb().prepare('SELECT * FROM approvals WHERE id = ?').get(id);
  return row ? hydrate(row) : null;
}

function hydrate(r) {
  const payload = parse(r.payload);
  let preview = null;
  if (payload?.campaignId) {
    const c = getDb().prepare('SELECT to_addr, subject, body FROM campaigns WHERE id = ?').get(payload.campaignId);
    if (c) preview = `To: ${c.to_addr}\nSubject: ${c.subject}\n\n${c.body}`;
  }
  return { ...r, payload, result: parse(r.result), preview };
}

export async function approve(id, by = 'owner') {
  const db = getDb();
  const a = getApproval(id);
  if (!a) throw new Error(`Approval ${id} not found`);
  if (a.status !== 'pending') throw new Error(`Approval ${id} is already ${a.status}`);
  const fn = executors.get(a.action);
  const claimed = db
    .prepare("UPDATE approvals SET status = 'approved', decided_at = datetime('now'), decided_by = ? WHERE id = ? AND status = 'pending'")
    .run(by, id);
  if (claimed.changes === 0) throw new Error(`Approval ${id} was already decided by another process`);
  log(by, 'approval_granted', 'approval', id, { action: a.action });
  if (!fn) {
    return { ...getApproval(id), note: `No executor registered for ${a.action}; marked approved for manual execution.` };
  }
  try {
    const result = await fn(a.payload);
    db.prepare("UPDATE approvals SET status = 'executed', result = ? WHERE id = ?").run(json(result), id);
    log('akamaru', 'approval_executed', 'approval', id, { action: a.action, result });
  } catch (e) {
    db.prepare("UPDATE approvals SET status = 'failed', result = ? WHERE id = ?").run(json({ error: e.message }), id);
    log('akamaru', 'approval_failed', 'approval', id, { action: a.action, error: e.message });
  }
  return getApproval(id);
}

/** Reject every pending send approval tied to a business's campaigns. */
export function cancelPendingSends(businessId, note) {
  const r = getDb()
    .prepare("UPDATE approvals SET status = 'rejected', decided_by = 'akamaru', decided_at = datetime('now'), result = ? WHERE status = 'pending' AND action IN ('send_outreach','send_reply') AND json_extract(payload, '$.campaignId') IN (SELECT id FROM campaigns WHERE business_id = ?)")
    .run(json({ note }), businessId);
  getDb().prepare("UPDATE campaigns SET status = 'cancelled' WHERE business_id = ? AND status IN ('draft','pending_approval')").run(businessId);
  if (r.changes) log('decision-engine', 'pending_sends_cancelled', 'business', businessId, { count: r.changes, note });
  return r.changes;
}

export function reject(id, by = 'owner', note = '') {
  const a = getApproval(id);
  if (!a) throw new Error(`Approval ${id} not found`);
  if (a.status !== 'pending') throw new Error(`Approval ${id} is already ${a.status}`);
  getDb()
    .prepare("UPDATE approvals SET status = 'rejected', decided_at = datetime('now'), decided_by = ?, result = ? WHERE id = ?")
    .run(by, json({ note }), id);
  log(by, 'approval_rejected', 'approval', id, { action: a.action, note });
  return getApproval(id);
}
