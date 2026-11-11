// Audit trail: every autonomous and approved action is recorded here.
import { getDb, json, parse } from './db.js';

export function log(actor, action, entity = null, entityId = null, detail = null) {
  getDb()
    .prepare('INSERT INTO activity (actor, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?)')
    .run(actor, action, entity, entityId, json(detail));
}

export function recent(limit = 100, entity = null, entityId = null) {
  const db = getDb();
  const rows = entity
    ? db.prepare('SELECT * FROM activity WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT ?').all(entity, entityId, limit)
    : db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT ?').all(limit);
  return rows.map((r) => ({ ...r, detail: parse(r.detail) }));
}
