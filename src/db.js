// SQLite persistence (node:sqlite, zero native deps). Schema is versioned
// with PRAGMA user_version so later milestones can migrate forward.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { dataDir, env } from './config.js';

const MIGRATIONS = [
  `
  CREATE TABLE businesses (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT,
    address TEXT,
    city TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    lat REAL, lon REAL,
    source TEXT NOT NULL,
    source_ref TEXT UNIQUE,
    raw TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE leads (
    id INTEGER PRIMARY KEY,
    business_id INTEGER NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
    stage TEXT NOT NULL DEFAULT 'discovered',
    score INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE research (
    id INTEGER PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    score INTEGER,
    summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE demos (
    id INTEGER PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    dir TEXT NOT NULL,
    copy_source TEXT,
    qa TEXT,
    qa_passed INTEGER NOT NULL DEFAULT 0,
    preview_url TEXT,
    deploy_provider TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE campaigns (
    id INTEGER PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'outreach',
    channel TEXT NOT NULL,
    to_addr TEXT,
    subject TEXT,
    body TEXT NOT NULL,
    followups TEXT,
    copy_source TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    provider_message_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT
  );
  CREATE TABLE approvals (
    id INTEGER PRIMARY KEY,
    action TEXT NOT NULL,
    payload TEXT NOT NULL,
    reason TEXT,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    result TEXT,
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT,
    decided_by TEXT
  );
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
    direction TEXT NOT NULL,
    channel TEXT NOT NULL,
    from_addr TEXT,
    subject TEXT,
    body TEXT,
    intent TEXT,
    intent_source TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE onboarding_tasks (
    id INTEGER PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sort INTEGER NOT NULL,
    title TEXT NOT NULL,
    owner TEXT NOT NULL DEFAULT 'akamaru',
    requires_approval INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'todo'
  );
  CREATE TABLE suppressions (
    email TEXT PRIMARY KEY,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE activity (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL DEFAULT (datetime('now')),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id INTEGER,
    detail TEXT
  );
  CREATE INDEX idx_activity_entity ON activity(entity, entity_id);
  CREATE INDEX idx_approvals_status ON approvals(status);
  `,
  `
  ALTER TABLE leads ADD COLUMN value_cents INTEGER;
  ALTER TABLE leads ADD COLUMN deadline TEXT;
  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    agent TEXT,
    source TEXT NOT NULL DEFAULT 'dashboard',
    status TEXT NOT NULL DEFAULT 'queued',
    progress REAL NOT NULL DEFAULT 0,
    step TEXT,
    steps TEXT,
    args TEXT,
    result TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    finished_at TEXT
  );
  CREATE INDEX idx_jobs_status ON jobs(status);
  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    title TEXT NOT NULL,
    body TEXT,
    entity TEXT,
    entity_id INTEGER,
    link TEXT,
    external TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_notifications_unread ON notifications(read_at);
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE invoices (
    id INTEGER PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'draft',
    recurring INTEGER NOT NULL DEFAULT 0,
    issued_at TEXT,
    due_at TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE commands (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    intent TEXT,
    args TEXT,
    parser TEXT,
    response TEXT,
    job_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE schedules (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    args TEXT,
    every_hours REAL NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    next_run_at TEXT NOT NULL,
    last_run_at TEXT,
    last_job_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE content_drafts (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    brief TEXT,
    body TEXT NOT NULL,
    copy_source TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE sites (
    id INTEGER PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
    url TEXT NOT NULL UNIQUE,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE site_checks (
    id INTEGER PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    ok INTEGER NOT NULL,
    status INTEGER,
    ms INTEGER,
    error TEXT,
    checked_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_site_checks ON site_checks(site_id, checked_at);
  CREATE INDEX idx_activity_ts ON activity(ts);
  `,
  `ALTER TABLE demos ADD COLUMN design TEXT;`,
];

let instance = null;

export function openDb(file) {
  const target = file || env('AKAMARU_DB', path.join(dataDir(), 'akamaru.db'));
  const db = new DatabaseSync(target);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const { user_version: current } = db.prepare('PRAGMA user_version').get();
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

export function getDb() {
  if (!instance) instance = openDb();
  return instance;
}

/** Replace the shared instance (tests use an in-memory DB). */
export function setDb(db) {
  instance = db;
}

export function json(v) {
  return v === undefined ? null : JSON.stringify(v);
}

export function parse(v, fallback = null) {
  if (v == null) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}
