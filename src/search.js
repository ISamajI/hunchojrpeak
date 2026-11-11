// Global search across leads, approvals, jobs, content and commands.
import { getDb } from './db.js';

export function search(q, limit = 8) {
  const term = String(q || '').trim();
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const db = getDb();
  const out = [];
  for (const r of db.prepare('SELECT b.id, b.name, b.city, l.stage FROM businesses b JOIN leads l ON l.business_id = b.id WHERE b.name LIKE ? OR b.city LIKE ? OR b.email LIKE ? OR b.website LIKE ? OR b.category LIKE ? LIMIT ?').all(like, like, like, like, like, limit)) {
    out.push({ type: 'Lead', title: r.name, subtitle: [r.city, r.stage].filter(Boolean).join(' · '), href: `#/projects/${r.id}` });
  }
  for (const r of db.prepare("SELECT id, summary, status FROM approvals WHERE summary LIKE ? ORDER BY id DESC LIMIT ?").all(like, limit)) {
    out.push({ type: 'Approval', title: r.summary, subtitle: r.status, href: '#/approvals' });
  }
  for (const r of db.prepare('SELECT id, label, status FROM jobs WHERE label LIKE ? ORDER BY id DESC LIMIT ?').all(like, limit)) {
    out.push({ type: 'Operation', title: r.label, subtitle: r.status, href: `#/activity?job=${r.id}` });
  }
  for (const r of db.prepare('SELECT id, title, kind FROM content_drafts WHERE title LIKE ? OR brief LIKE ? ORDER BY id DESC LIMIT ?').all(like, like, limit)) {
    out.push({ type: 'Content', title: r.title, subtitle: r.kind, href: '#/marketing' });
  }
  for (const r of db.prepare('SELECT id, text, intent FROM commands WHERE text LIKE ? ORDER BY id DESC LIMIT ?').all(like, 4)) {
    out.push({ type: 'Command', title: r.text, subtitle: r.intent || 'unparsed', href: '#/command' });
  }
  return out;
}
