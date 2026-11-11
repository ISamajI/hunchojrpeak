// Invoice ledger — the only source of revenue numbers. Akamaru never invents revenue:
// until invoices are recorded (manually, or by a future payments integration), revenue reads "no data".
import { getDb } from './db.js';
import { log } from './activity.js';

const STATUSES = ['draft', 'sent', 'paid', 'void'];
const isoDate = (v) => {
  if (v == null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date "${v}"`);
  return d.toISOString().slice(0, 10);
};

export function createInvoice({ businessId, description, amount, recurring = false, status = 'sent', issuedAt, dueAt, paidAt }) {
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(cents) || cents <= 0) throw new Error('Amount must be a positive number');
  if (!description || !String(description).trim()) throw new Error('Description is required');
  if (!STATUSES.includes(status)) throw new Error(`Status must be one of ${STATUSES.join(', ')}`);
  const db = getDb();
  if (businessId != null && !db.prepare('SELECT 1 FROM businesses WHERE id = ?').get(businessId)) throw new Error(`Business ${businessId} not found`);
  const issued = isoDate(issuedAt) || new Date().toISOString().slice(0, 10);
  const paid = status === 'paid' ? isoDate(paidAt) || issued : null;
  const r = db
    .prepare('INSERT INTO invoices (business_id, description, amount_cents, status, recurring, issued_at, due_at, paid_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(businessId ?? null, String(description).slice(0, 200), cents, status, recurring ? 1 : 0, issued, isoDate(dueAt), paid);
  const id = Number(r.lastInsertRowid);
  log('owner', 'invoice_recorded', 'invoice', id, { businessId, amount: cents / 100, status, recurring: !!recurring });
  if (status === 'paid') log('clavo-dulce', 'invoice_paid', 'invoice', id, { businessId, amount: cents / 100 });
  return getInvoice(id);
}

export function getInvoice(id) {
  return getDb().prepare('SELECT i.*, b.name AS business_name FROM invoices i LEFT JOIN businesses b ON b.id = i.business_id WHERE i.id = ?').get(id);
}

export function listInvoices({ businessId } = {}) {
  const db = getDb();
  const sql = `SELECT i.*, b.name AS business_name FROM invoices i LEFT JOIN businesses b ON b.id = i.business_id ${businessId ? 'WHERE i.business_id = ?' : ''} ORDER BY COALESCE(i.paid_at, i.issued_at) DESC, i.id DESC`;
  return businessId ? db.prepare(sql).all(businessId) : db.prepare(sql).all();
}

export function setInvoiceStatus(id, status, paidAt) {
  if (!STATUSES.includes(status)) throw new Error(`Status must be one of ${STATUSES.join(', ')}`);
  const inv = getInvoice(id);
  if (!inv) throw new Error(`Invoice ${id} not found`);
  const paid = status === 'paid' ? isoDate(paidAt) || new Date().toISOString().slice(0, 10) : null;
  getDb().prepare('UPDATE invoices SET status = ?, paid_at = ? WHERE id = ?').run(status, paid, id);
  if (status === 'paid' && inv.status !== 'paid') log('clavo-dulce', 'invoice_paid', 'invoice', id, { businessId: inv.business_id, amount: inv.amount_cents / 100 });
  else log('owner', 'invoice_updated', 'invoice', id, { status });
  return getInvoice(id);
}
