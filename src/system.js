// System telemetry for the health view: process, database, jobs, integrations, topology.
import fs from 'node:fs';
import os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { getDb } from './db.js';
import { allIntegrationStatus, env, dataDir } from './config.js';
import { schedulerRunning } from './scheduler.js';
import { agentStatus } from './agents.js';
import path from 'node:path';

const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();
const bootedAt = Date.now();
let sseClients = 0;
export const sse = { inc: () => sseClients++, dec: () => sseClients--, count: () => sseClients };

export function systemHealth() {
  const db = getDb();
  const since24 = new Date(Date.now() - 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const dbFile = env('AKAMARU_DB', path.join(dataDir(), 'akamaru.db'));
  let dbBytes = null;
  try { dbBytes = fs.statSync(dbFile).size + (fs.existsSync(dbFile + '-wal') ? fs.statSync(dbFile + '-wal').size : 0); } catch { /* in-memory */ }
  const t0 = performance.now();
  const integrity = db.prepare('PRAGMA quick_check').get();
  const dbLatencyMs = performance.now() - t0;
  const tables = ['businesses', 'leads', 'research', 'demos', 'campaigns', 'approvals', 'messages', 'jobs', 'notifications', 'invoices', 'activity'];
  const rows = Object.fromEntries(tables.map((t) => [t, db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n]));
  const jobs = Object.fromEntries(db.prepare('SELECT status, COUNT(*) n FROM jobs GROUP BY status').all().map((r) => [r.status, r.n]));
  const errors = db.prepare("SELECT * FROM activity WHERE ts >= ? AND (action LIKE '%failed%' OR action IN ('site_down','reply_unauthenticated')) ORDER BY id DESC LIMIT 50").all(since24);
  const mem = process.memoryUsage();
  const integrations = allIntegrationStatus().map((i) => ({ key: i.key, label: i.label, configured: i.configured, missing: i.missing }));
  const agents = agentStatus().map((a) => ({ id: a.id, name: a.name, status: a.status }));
  return {
    process: {
      uptimeSec: Math.round((Date.now() - bootedAt) / 1000),
      node: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      rssMb: Math.round(mem.rss / 1048576),
      heapUsedMb: Math.round(mem.heapUsed / 1048576),
      heapTotalMb: Math.round(mem.heapTotal / 1048576),
      loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
      cpus: os.cpus().length,
      eventLoopP99Ms: Math.round(loop.percentile(99) / 1e6 * 10) / 10,
      eventLoopMeanMs: Math.round(loop.mean / 1e6 * 10) / 10,
    },
    database: { ok: integrity.quick_check === 'ok', latencyMs: Math.round(dbLatencyMs * 100) / 100, bytes: dbBytes, rows, schemaVersion: db.prepare('PRAGMA user_version').get().user_version },
    jobs: { running: jobs.running || 0, queued: jobs.queued || 0, done: jobs.done || 0, failed: jobs.failed || 0 },
    scheduler: { running: schedulerRunning(), enabled: db.prepare('SELECT COUNT(*) n FROM schedules WHERE enabled = 1').get().n },
    realtime: { clients: sse.count() },
    errors24h: errors,
    integrations,
    agents,
  };
}
