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
