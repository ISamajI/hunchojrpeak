// Scheduled operations: recurring pipeline runs and uptime sweeps.
// Scheduling only triggers autonomous work; anything needing approval still queues for the owner.
import { getDb, json, parse } from './db.js';
import { log } from './activity.js';
import { startJob } from './jobs.js';
import { cleanPipelineArgs } from './operations.js';

export const SCHEDULE_KINDS = {
  pipeline: { job: 'pipeline', describe: (a) => `Find ${a.limit || 10} ${a.category || 'businesses'} near ${a.near}` },
  uptime: { job: 'uptime', describe: () => 'Check uptime of all monitored client sites' },
  followups: { job: 'followup_scan', describe: () => 'Scan for prospects who haven\'t responded' },
};

const sqlTime = (d) => d.toISOString().replace('T', ' ').slice(0, 19);

function validate(kind, args) {
  if (!SCHEDULE_KINDS[kind]) throw new Error(`Schedule kind must be one of ${Object.keys(SCHEDULE_KINDS).join(', ')}`);
  if (kind === 'pipeline') {
    if (!args?.near) throw new Error('Pipeline schedules need "near" and a category');
    return cleanPipelineArgs(args);
  }
  return {};
}

export function createSchedule({ name, kind, args = {}, everyHours, startAt }) {
  args = validate(kind, args);
  const hours = Number(everyHours);
  if (!(hours >= 1 && hours <= 24 * 30)) throw new Error('everyHours must be between 1 and 720');
  const first = startAt ? new Date(startAt) : new Date(Date.now() + 60000);
  if (Number.isNaN(first.getTime())) throw new Error('Invalid start time');
  const r = getDb().prepare('INSERT INTO schedules (name, kind, args, every_hours, next_run_at) VALUES (?,?,?,?,?)')
    .run(name || SCHEDULE_KINDS[kind].describe(args), kind, json(args), hours, sqlTime(first));
  log('owner', 'schedule_created', 'schedule', Number(r.lastInsertRowid), { kind, everyHours: hours });
  return getSchedule(Number(r.lastInsertRowid));
}

export function getSchedule(id) {
  const s = getDb().prepare('SELECT * FROM schedules WHERE id = ?').get(id);
  return s && { ...s, args: parse(s.args, {}), describe: SCHEDULE_KINDS[s.kind]?.describe(parse(s.args, {})) };
}

export function listSchedules() {
  return getDb().prepare('SELECT id FROM schedules ORDER BY next_run_at').all().map((r) => getSchedule(r.id));
}

export function updateSchedule(id, { enabled }) {
  if (!getSchedule(id)) throw new Error(`Schedule ${id} not found`);
  if (enabled !== undefined) getDb().prepare('UPDATE schedules SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  return getSchedule(id);
}

export function deleteSchedule(id) {
  getDb().prepare('DELETE FROM schedules WHERE id = ?').run(id);
}

export function runScheduleNow(id, source = 'schedule') {
  const s = getSchedule(id);
  if (!s) throw new Error(`Schedule ${id} not found`);
  const job = startJob(SCHEDULE_KINDS[s.kind].job, s.args, { source, label: s.name });
  const next = new Date(Date.now() + s.every_hours * 3600000);
  getDb().prepare("UPDATE schedules SET last_run_at = datetime('now'), last_job_id = ?, next_run_at = ? WHERE id = ?").run(job.id, sqlTime(next), id);
  return job;
}

export function tick(now = new Date()) {
  const due = getDb().prepare('SELECT id FROM schedules WHERE enabled = 1 AND next_run_at <= ?').all(sqlTime(now));
  return due.map((d) => runScheduleNow(d.id));
}

let timer = null;
export function startScheduler(intervalMs = 60000) {
  if (timer) return;
  timer = setInterval(() => { try { tick(); } catch (e) { console.error('scheduler:', e.message); } }, intervalMs);
  timer.unref();
}

export function schedulerRunning() {
  return !!timer;
}
