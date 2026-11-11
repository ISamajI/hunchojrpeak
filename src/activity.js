// Audit trail: every autonomous and approved action is recorded here.
import { getDb, json, parse } from './db.js';
import { emit } from './events.js';
import { describeAction, agentForActor } from './agents.js';

export function log(actor, action, entity = null, entityId = null, detail = null) {
  const r = getDb()
    .prepare('INSERT INTO activity (actor, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?)')
    .run(actor, action, entity, entityId, json(detail));
  const entry = decorate({ id: Number(r.lastInsertRowid), ts: new Date().toISOString().replace('T', ' ').slice(0, 19), actor, action, entity, entity_id: entityId, detail });
  emit('activity', entry);
  return entry;
}

function decorate(e) {
  return { ...e, text: describeAction(e.action), agent: agentForActor(e.actor) };
}

export function since(isoDate, limit = 500) {
  return getDb().prepare('SELECT * FROM activity WHERE ts >= ? ORDER BY id DESC LIMIT ?').all(isoDate, limit)
    .map((r) => decorate({ ...r, detail: parse(r.detail) }));
}

export function recent(limit = 100, entity = null, entityId = null) {
  const db = getDb();
  const rows = entity
    ? db.prepare('SELECT * FROM activity WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT ?').all(entity, entityId, limit)
    : db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT ?').all(limit);
  return rows.map((r) => decorate({ ...r, detail: parse(r.detail) }));
}
