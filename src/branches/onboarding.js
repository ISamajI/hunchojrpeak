// Customer onboarding checklist. Tasks that bind LTGPeak or move money are
// flagged requires_approval so the owner handles them.
import { getDb } from '../db.js';
import { log } from '../activity.js';

export const ONBOARDING_TEMPLATE = [
  { title: 'Send proposal & quote', owner: 'owner', approval: true },
  { title: 'Send contract for signature', owner: 'owner', approval: true },
  { title: 'Collect deposit / first payment', owner: 'owner', approval: true },
  { title: 'Collect brand assets (logo, photos, colors)', owner: 'akamaru', approval: false },
  { title: 'Confirm services, prices and hours with client', owner: 'akamaru', approval: false },
  { title: 'Domain: transfer or purchase', owner: 'owner', approval: true },
  { title: 'Build production site from approved demo', owner: 'akamaru', approval: false },
  { title: 'QA pass (Itachi) on production build', owner: 'akamaru', approval: false },
  { title: 'Client review & sign-off', owner: 'owner', approval: false },
  { title: 'Publish production site', owner: 'owner', approval: true },
  { title: 'Set up Google Business Profile link + analytics', owner: 'akamaru', approval: false },
  { title: 'Handoff + 30-day check-in scheduled', owner: 'akamaru', approval: false },
];

export function createOnboardingPlan(businessId) {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) AS n FROM onboarding_tasks WHERE business_id = ?').get(businessId).n;
  if (existing) return db.prepare('SELECT * FROM onboarding_tasks WHERE business_id = ? ORDER BY sort').all(businessId);
  const ins = db.prepare('INSERT INTO onboarding_tasks (business_id, sort, title, owner, requires_approval) VALUES (?, ?, ?, ?, ?)');
  ONBOARDING_TEMPLATE.forEach((t, i) => ins.run(businessId, i + 1, t.title, t.owner, t.approval ? 1 : 0));
  log('akamaru', 'onboarding_plan_created', 'business', businessId, { tasks: ONBOARDING_TEMPLATE.length });
  return db.prepare('SELECT * FROM onboarding_tasks WHERE business_id = ? ORDER BY sort').all(businessId);
}

export function setTaskStatus(taskId, status) {
  if (!['todo', 'doing', 'done', 'skipped'].includes(status)) throw new Error(`Bad task status ${status}`);
  const db = getDb();
  const t = db.prepare('SELECT * FROM onboarding_tasks WHERE id = ?').get(taskId);
  if (!t) throw new Error(`Task ${taskId} not found`);
  db.prepare('UPDATE onboarding_tasks SET status = ? WHERE id = ?').run(status, taskId);
  log('owner', 'onboarding_task_updated', 'business', t.business_id, { taskId, title: t.title, status });
}
