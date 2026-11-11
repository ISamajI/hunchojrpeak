// Background job runner. Long operations (pipeline runs, lead processing,
// uptime sweeps, AI drafting) run here so the dashboard can show exactly what
// Akamaru is doing, step by step, in real time.
import { getDb, json, parse } from './db.js';
import { emit } from './events.js';
import { log } from './activity.js';

const MAX_CONCURRENT = 2;
const handlers = new Map();
const queue = [];
let running = 0;

/** Register a job kind: fn(args, ctx) → result. ctx.step(text, progress0to1). */
export function defineJob(kind, { agent, label, run }) {
  handlers.set(kind, { agent, label, run });
}

export function jobKinds() {
  return [...handlers.keys()];
}

function hydrate(r) {
  return r && { ...r, steps: parse(r.steps, []), args: parse(r.args), result: parse(r.result) };
}

export function getJob(id) {
  return hydrate(getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id));
}

export function listJobs({ status, limit = 50 } = {}) {
  const db = getDb();
  const rows = status
    ? db.prepare(`SELECT * FROM jobs WHERE status IN (${status.split(',').map(() => '?').join(',')}) ORDER BY id DESC LIMIT ?`).all(...status.split(','), limit)
    : db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT ?').all(limit);
  return rows.map(hydrate);
}

function publish(id) {
  emit('job', getJob(id));
}

/** Enqueue a job; returns the job row immediately. */
export function startJob(kind, args = {}, { source = 'dashboard', label } = {}) {
  const h = handlers.get(kind);
  if (!h) throw new Error(`Unknown job kind "${kind}"`);
  const text = label || (typeof h.label === 'function' ? h.label(args) : h.label);
  const r = getDb()
    .prepare('INSERT INTO jobs (kind, label, agent, source, args, steps) VALUES (?, ?, ?, ?, ?, ?)')
    .run(kind, text, h.agent, source, json(args), '[]');
  const id = Number(r.lastInsertRowid);
  publish(id);
  queue.push(id);
  setImmediate(pump);
  return getJob(id);
}

function pump() {
  while (running < MAX_CONCURRENT && queue.length) {
    const id = queue.shift();
    running++;
    execute(id).catch((e) => console.error(`job ${id}:`, e.message)).finally(() => {
      running--;
      setImmediate(pump);
    });
  }
}

async function execute(id) {
  const db = getDb();
  const job = getJob(id);
  if (!job || job.status !== 'queued') return; // deleted or already handled
  const h = handlers.get(job.kind);
  const steps = [];
  db.prepare("UPDATE jobs SET status = 'running', started_at = datetime('now') WHERE id = ?").run(id);
  publish(id);
  const ctx = {
    jobId: id,
    step(text, progress) {
      steps.push({ at: new Date().toISOString(), text });
      db.prepare('UPDATE jobs SET step = ?, steps = ?, progress = COALESCE(?, progress) WHERE id = ?')
        .run(text, json(steps.slice(-200)), progress == null ? null : Math.max(0, Math.min(1, progress)), id);
      publish(id);
    },
  };
  try {
    const result = await h.run(job.args || {}, ctx);
    db.prepare("UPDATE jobs SET status = 'done', progress = 1, result = ?, finished_at = datetime('now') WHERE id = ?").run(json(result ?? null), id);
  } catch (e) {
    db.prepare("UPDATE jobs SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?").run(e.message, id);
    log('tsunade', 'job_failed', 'job', id, { kind: job.kind, label: job.label, error: e.message });
  }
  publish(id);
}

/** On boot, anything left running by a crashed process is marked interrupted — never silently lost. */
export function recoverInterruptedJobs() {
  const r = getDb()
    .prepare("UPDATE jobs SET status = 'failed', error = 'Interrupted: Akamaru restarted while this job was running', finished_at = datetime('now') WHERE status IN ('running','queued')")
    .run();
  return r.changes;
}

/** Test helper: resolve when the job finishes. */
export async function waitForJob(id, timeoutMs = 20000) {
  const start = Date.now();
  for (;;) {
    const j = getJob(id);
    if (['done', 'failed'].includes(j.status)) return j;
    if (Date.now() - start > timeoutMs) throw new Error(`Job ${id} did not finish in time`);
    await new Promise((r) => setTimeout(r, 20));
  }
}
