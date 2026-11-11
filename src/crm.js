// Lead CRM: businesses, pipeline stages, notes.
import { getDb, json, parse } from './db.js';
import { log } from './activity.js';
import { cancelPendingSends } from './decision.js';

export const TERMINAL = ['lost', 'do_not_contact'];

export const STAGES = [
  'discovered',
  'researched',
  'demo_built',
  'preview_deployed',
  'outreach_ready',
  'contacted',
  'replied',
  'interested',
  'won',
  'onboarding',
  'active',
  'lost',
  'do_not_contact',
];

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'business';
}

function uniqueSlug(base) {
  const db = getDb();
  let slug = base;
  for (let i = 2; db.prepare('SELECT 1 FROM businesses WHERE slug = ?').get(slug); i++) slug = `${base}-${i}`;
  return slug;
}

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}$/i;

/** One syntactically valid address, lowercased, or null. */
export function normalizeEmail(v) {
  if (!v) return null;
  const e = String(v).trim().replace(/^mailto:/i, '').toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

export function normalizeWebsite(url) {
  if (!url) return null;
  let u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Insert or update a business by source_ref; always ensures a lead row. */
export function upsertBusiness(b) {
  const db = getDb();
  if (!b.name) throw new Error('Business name is required');
  const sourceRef = b.source_ref || null;
  const existing = sourceRef ? db.prepare('SELECT * FROM businesses WHERE source_ref = ?').get(sourceRef) : null;
  const fields = {
    name: b.name,
    category: b.category || null,
    address: b.address || null,
    city: b.city || null,
    phone: b.phone || null,
    email: normalizeEmail(b.email),
    website: normalizeWebsite(b.website),
    lat: b.lat ?? null,
    lon: b.lon ?? null,
    raw: json(b.raw),
  };
  let id;
  if (existing) {
    id = existing.id;
    db.prepare(
      `UPDATE businesses SET name=?, category=COALESCE(?,category), address=COALESCE(?,address), city=COALESCE(?,city),
       phone=COALESCE(?,phone), email=COALESCE(?,email), website=COALESCE(?,website), lat=COALESCE(?,lat), lon=COALESCE(?,lon),
       raw=COALESCE(?,raw) WHERE id=?`,
    ).run(fields.name, fields.category, fields.address, fields.city, fields.phone, fields.email, fields.website, fields.lat, fields.lon, fields.raw, id);
  } else {
    const slug = uniqueSlug(slugify(`${b.name}${b.city ? '-' + b.city : ''}`));
    const r = db
      .prepare(
        `INSERT INTO businesses (name, slug, category, address, city, phone, email, website, lat, lon, source, source_ref, raw)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(fields.name, slug, fields.category, fields.address, fields.city, fields.phone, fields.email, fields.website, fields.lat, fields.lon, b.source || 'manual', sourceRef, fields.raw);
    id = Number(r.lastInsertRowid);
    db.prepare('INSERT INTO leads (business_id) VALUES (?)').run(id);
    log('akamaru', 'lead_created', 'business', id, { name: b.name, source: b.source || 'manual' });
  }
  return { id, created: !existing };
}

export function updateBusiness(id, patch) {
  const allowed = ['name', 'category', 'address', 'city', 'phone', 'email', 'website'];
  const db = getDb();
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.includes(k) || v === undefined) continue;
    const val = k === 'website' ? normalizeWebsite(v) : k === 'email' ? normalizeEmail(v) : v;
    db.prepare(`UPDATE businesses SET ${k} = ? WHERE id = ?`).run(val, id);
  }
}

export function getBusiness(id) {
  const b = getDb().prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  return b ? { ...b, raw: parse(b.raw) } : null;
}

export function findBusinessByEmail(email) {
  if (!email) return null;
  return getDb().prepare('SELECT * FROM businesses WHERE email = ?').get(String(email).toLowerCase()) || null;
}

export function setStage(businessId, stage, actor = 'akamaru', note = null) {
  if (!STAGES.includes(stage)) throw new Error(`Unknown stage "${stage}". Valid: ${STAGES.join(', ')}`);
  const db = getDb();
  const lead = db.prepare('SELECT stage FROM leads WHERE business_id = ?').get(businessId);
  if (!lead) throw new Error(`No lead for business ${businessId}`);
  if (lead.stage === stage) return;
  db.prepare("UPDATE leads SET stage = ?, updated_at = datetime('now') WHERE business_id = ?").run(stage, businessId);
  log(actor, 'stage_changed', 'business', businessId, { from: lead.stage, to: stage, note });
  if (TERMINAL.includes(stage)) cancelPendingSends(businessId, `lead moved to ${stage}`);
}

/** Advance only forward along the sales pipeline (never regress automatically). */
export function advanceStage(businessId, stage, actor = 'akamaru') {
  const lead = getDb().prepare('SELECT stage FROM leads WHERE business_id = ?').get(businessId);
  if (!lead) return;
  const terminal = ['lost', 'do_not_contact'];
  if (terminal.includes(lead.stage)) return;
  if (STAGES.indexOf(stage) > STAGES.indexOf(lead.stage)) setStage(businessId, stage, actor);
}

export function setScore(businessId, score) {
  getDb().prepare("UPDATE leads SET score = ?, updated_at = datetime('now') WHERE business_id = ?").run(score, businessId);
}

export function addNote(businessId, note, actor = 'owner') {
  const db = getDb();
  const lead = db.prepare('SELECT notes FROM leads WHERE business_id = ?').get(businessId);
  const notes = [lead?.notes, `[${new Date().toISOString()}] ${note}`].filter(Boolean).join('\n');
  db.prepare("UPDATE leads SET notes = ?, updated_at = datetime('now') WHERE business_id = ?").run(notes, businessId);
  log(actor, 'note_added', 'business', businessId, { note });
}

export function listLeads({ stage, minScore, limit = 200 } = {}) {
  const where = [];
  const args = [];
  if (stage) { where.push('l.stage = ?'); args.push(stage); }
  if (minScore != null) { where.push('l.score >= ?'); args.push(minScore); }
  const sql = `
    SELECT b.id, b.name, b.slug, b.category, b.city, b.phone, b.email, b.website, b.source,
           l.stage, l.score, l.updated_at,
           (SELECT preview_url FROM demos d WHERE d.business_id = b.id ORDER BY version DESC LIMIT 1) AS preview_url
    FROM businesses b JOIN leads l ON l.business_id = b.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY COALESCE(l.score, -1) DESC, b.id DESC LIMIT ?`;
  return getDb().prepare(sql).all(...args, limit);
}

export function leadDetail(businessId) {
  const db = getDb();
  const business = getBusiness(businessId);
  if (!business) return null;
  const lead = db.prepare('SELECT * FROM leads WHERE business_id = ?').get(businessId);
  const research = db.prepare('SELECT * FROM research WHERE business_id = ? ORDER BY id DESC LIMIT 1').get(businessId);
  const demos = db.prepare('SELECT * FROM demos WHERE business_id = ? ORDER BY version DESC').all(businessId);
  const campaigns = db.prepare('SELECT * FROM campaigns WHERE business_id = ? ORDER BY id DESC').all(businessId);
  const messages = db.prepare('SELECT * FROM messages WHERE business_id = ? ORDER BY id DESC').all(businessId);
  const onboarding = db.prepare('SELECT * FROM onboarding_tasks WHERE business_id = ? ORDER BY sort').all(businessId);
  return {
    business,
    lead,
    research: research ? { ...research, data: parse(research.data) } : null,
    demos: demos.map((d) => ({ ...d, qa: parse(d.qa) })),
    campaigns: campaigns.map((c) => ({ ...c, followups: parse(c.followups) })),
    messages,
    onboarding,
  };
}

export function pipelineCounts() {
  const rows = getDb().prepare('SELECT stage, COUNT(*) AS n FROM leads GROUP BY stage').all();
  const out = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const r of rows) out[r.stage] = r.n;
  return out;
}

export function isSuppressed(email) {
  if (!email) return false;
  return !!getDb().prepare('SELECT 1 FROM suppressions WHERE email = ?').get(String(email).toLowerCase());
}

export function suppress(email, reason) {
  getDb().prepare('INSERT OR IGNORE INTO suppressions (email, reason) VALUES (?, ?)').run(String(email).toLowerCase(), reason);
  log('akamaru', 'email_suppressed', 'suppression', null, { email, reason });
}
