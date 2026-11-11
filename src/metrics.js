// CLAVO DULCE analytics: every number on the dashboard is computed here from
// stored rows. Nothing is estimated unless it is explicitly labeled as a model.
import { getDb, parse } from './db.js';
import { STAGES } from './crm.js';

const DAY = 86400000;
const ymd = (d) => d.toISOString().slice(0, 10);

export const RANGES = { '7d': 7, '30d': 30, '90d': 90, '12m': 365, all: null };

/** Resolve a range key into [from, to) dates, the equal-length previous period, and a bucket size. */
export function resolveRange(key = '30d', now = new Date()) {
  if (!(key in RANGES)) key = '30d';
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY);
  let days = RANGES[key];
  if (days == null) {
    const first = getDb().prepare(`SELECT MIN(d) AS d FROM (
      SELECT MIN(created_at) AS d FROM businesses UNION ALL SELECT MIN(COALESCE(paid_at, issued_at)) FROM invoices)`).get().d;
    days = first ? Math.max(7, Math.ceil((to - new Date(first.slice(0, 10))) / DAY)) : 30;
  }
  const from = new Date(to - days * DAY);
  const prevFrom = new Date(from - days * DAY);
  const bucket = days <= 31 ? 'day' : days <= 120 ? 'week' : 'month';
  return { key, from: ymd(from), to: ymd(to), prevFrom: ymd(prevFrom), days, bucket };
}

function bucketKey(dateStr, bucket) {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00Z');
  if (bucket === 'month') return dateStr.slice(0, 7);
  if (bucket === 'week') {
    const dow = (d.getUTCDay() + 6) % 7; // Monday-start weeks
    return ymd(new Date(d - dow * DAY));
  }
  return ymd(d);
}

/** Every bucket in range, so empty periods show as zero rather than disappearing. */
function buckets(range) {
  const out = [];
  const seen = new Set();
  for (let t = new Date(range.from + 'T00:00:00Z').getTime(); t < new Date(range.to + 'T00:00:00Z').getTime(); t += DAY) {
    const k = bucketKey(ymd(new Date(t)), range.bucket);
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

function series(range, rows, dateField, valueFn = () => 1) {
  const keys = buckets(range);
  const map = new Map(keys.map((k) => [k, 0]));
  for (const r of rows) {
    const d = r[dateField];
    if (!d || d < range.from || d >= range.to) continue;
    const k = bucketKey(d, range.bucket);
    if (map.has(k)) map.set(k, map.get(k) + valueFn(r));
  }
  return keys.map((k) => ({ x: k, value: map.get(k) }));
}

const sum = (rows, f) => rows.reduce((a, r) => a + f(r), 0);
const pct = (cur, prev) => (prev ? (cur - prev) / prev : null);

// ---------- Revenue ----------

/** Stage → close probability used ONLY for the labeled "projected" model. */
export const STAGE_PROBABILITY = {
  discovered: 0.02, researched: 0.03, demo_built: 0.05, preview_deployed: 0.05, outreach_ready: 0.08,
  contacted: 0.1, replied: 0.2, interested: 0.4, won: 0.9,
};

export function revenue(rangeKey) {
  const db = getDb();
  const range = resolveRange(rangeKey);
  const invoices = db.prepare("SELECT * FROM invoices WHERE status != 'void'").all();
  const paid = invoices.filter((i) => i.status === 'paid' && i.paid_at);
  const inRange = paid.filter((i) => i.paid_at >= range.from && i.paid_at < range.to);
  const inPrev = paid.filter((i) => i.paid_at >= range.prevFrom && i.paid_at < range.from);
  const today = ymd(new Date());
  const outstanding = invoices.filter((i) => i.status === 'sent');
  const overdue = outstanding.filter((i) => i.due_at && i.due_at < today);
  // MRR: latest recurring invoice per client, if issued within the last 45 days (i.e. still active).
  const cutoff = ymd(new Date(Date.now() - 45 * DAY));
  const latestRecurring = new Map();
  for (const i of invoices.filter((x) => x.recurring && x.issued_at >= cutoff)) {
    const k = i.business_id ?? `inv${i.id}`;
    if (!latestRecurring.has(k) || latestRecurring.get(k).issued_at < i.issued_at) latestRecurring.set(k, i);
  }
  const mrr = sum([...latestRecurring.values()], (i) => i.amount_cents);
  const weekAgo = ymd(new Date(Date.now() - 7 * DAY));
  const monthStart = today.slice(0, 7) + '-01';
  const open = db.prepare("SELECT l.stage, l.value_cents FROM leads l WHERE l.stage NOT IN ('lost','do_not_contact','onboarding','active')").all();
  const valued = open.filter((l) => l.value_cents > 0);
  const pipelineWeighted = sum(valued, (l) => l.value_cents * (STAGE_PROBABILITY[l.stage] ?? 0));
  return {
    range,
    hasData: invoices.length > 0,
    total: sum(paid, (i) => i.amount_cents),
    period: sum(inRange, (i) => i.amount_cents),
    previous: sum(inPrev, (i) => i.amount_cents),
    growth: pct(sum(inRange, (i) => i.amount_cents), sum(inPrev, (i) => i.amount_cents)),
    thisMonth: sum(paid.filter((i) => i.paid_at >= monthStart), (i) => i.amount_cents),
    thisWeek: sum(paid.filter((i) => i.paid_at >= weekAgo), (i) => i.amount_cents),
    mrr,
    recurringClients: latestRecurring.size,
    outstanding: { cents: sum(outstanding, (i) => i.amount_cents), count: outstanding.length, overdueCount: overdue.length, overdueCents: sum(overdue, (i) => i.amount_cents) },
    projected: {
      cents: mrr + sum(outstanding, (i) => i.amount_cents) + Math.round(pipelineWeighted),
      model: 'Next 30 days = MRR + outstanding invoices + Σ(open deal value × stage probability)',
      components: { mrr, outstanding: sum(outstanding, (i) => i.amount_cents), pipelineWeighted: Math.round(pipelineWeighted) },
      openDeals: open.length,
      dealsWithoutValue: open.length - valued.length,
      probabilities: STAGE_PROBABILITY,
    },
    series: series(range, paid, 'paid_at', (i) => i.amount_cents),
    previousSeries: series({ ...range, from: range.prevFrom, to: range.from }, paid, 'paid_at', (i) => i.amount_cents),
  };
}

// ---------- Pipeline & clients ----------

export const BOARD = [
  { id: 'new', label: 'New opportunities', stages: ['discovered'], drop: 'discovered', agent: 'sales' },
  { id: 'research', label: 'Researching', stages: ['researched'], drop: 'researched', agent: 'sales' },
  { id: 'build', label: 'Building demo', stages: ['demo_built', 'preview_deployed'], drop: 'demo_built', agent: 'web' },
  { id: 'review', label: 'Awaiting review', stages: ['outreach_ready'], drop: 'outreach_ready', agent: 'client' },
  { id: 'sent', label: 'Sent to client', stages: ['contacted', 'replied'], drop: 'contacted', agent: 'client' },
  { id: 'negotiating', label: 'Negotiating', stages: ['interested'], drop: 'interested', agent: 'client' },
  { id: 'won', label: 'Won', stages: ['won', 'onboarding', 'active'], drop: 'won', agent: 'web' },
  { id: 'lost', label: 'Lost', stages: ['lost', 'do_not_contact'], drop: 'lost', agent: null },
];

const STAGE_PROGRESS = { discovered: 5, researched: 15, demo_built: 30, preview_deployed: 40, outreach_ready: 50, contacted: 60, replied: 65, interested: 75, won: 85, onboarding: 85, active: 100 };

export function columnFor(stage) {
  return BOARD.find((c) => c.stages.includes(stage));
}

export function projects() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT b.id, b.name, b.category, b.city, b.email, b.phone, b.website, l.stage, l.score, l.value_cents, l.deadline, l.updated_at, l.created_at,
      (SELECT preview_url FROM demos d WHERE d.business_id = b.id ORDER BY version DESC LIMIT 1) AS preview_url,
      (SELECT COUNT(*) FROM demos d WHERE d.business_id = b.id) AS demo_count,
      (SELECT COUNT(*) FROM onboarding_tasks t WHERE t.business_id = b.id) AS tasks_total,
      (SELECT COUNT(*) FROM onboarding_tasks t WHERE t.business_id = b.id AND t.status IN ('done','skipped')) AS tasks_done,
      (SELECT COUNT(*) FROM approvals a WHERE a.status = 'pending' AND json_extract(a.payload,'$.campaignId') IN (SELECT id FROM campaigns c WHERE c.business_id = b.id)) AS pending_approvals,
      (SELECT COALESCE(SUM(amount_cents),0) FROM invoices i WHERE i.business_id = b.id AND i.status = 'paid') AS paid_cents
    FROM businesses b JOIN leads l ON l.business_id = b.id ORDER BY l.updated_at DESC`).all();
  return rows.map((r) => {
    const col = columnFor(r.stage);
    let progress = STAGE_PROGRESS[r.stage] ?? null;
    if (r.stage === 'onboarding' && r.tasks_total) progress = 85 + Math.round((15 * r.tasks_done) / r.tasks_total);
    return { ...r, column: col?.id, agent: col?.agent, progress };
  });
}

export function pipeline(rangeKey) {
  const db = getDb();
  const range = resolveRange(rangeKey);
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const r of db.prepare('SELECT stage, COUNT(*) n FROM leads GROUP BY stage').all()) counts[r.stage] = r.n;
  const board = BOARD.map((c) => ({ id: c.id, label: c.label, count: sum(c.stages, (s) => counts[s] || 0) }));
  const businesses = db.prepare('SELECT created_at FROM businesses').all();
  const outbound = db.prepare("SELECT created_at, business_id FROM messages WHERE direction = 'outbound'").all();
  const inbound = db.prepare("SELECT created_at, business_id FROM messages WHERE direction = 'inbound' AND business_id IS NOT NULL").all();
  const contacted = new Set(outbound.map((m) => m.business_id));
  const won = new Set(db.prepare("SELECT business_id FROM leads WHERE stage IN ('won','onboarding','active')").all().map((r) => r.business_id));
  const wonContacted = [...won].filter((id) => contacted.has(id)).length;
  const newLeads = businesses.filter((b) => b.created_at >= range.from && b.created_at < range.to).length;
  const prevLeads = businesses.filter((b) => b.created_at >= range.prevFrom && b.created_at < range.from).length;
  const proposals = db.prepare("SELECT COUNT(*) n FROM approvals WHERE status = 'pending' AND action IN ('send_outreach','send_reply','send_contract')").get().n;
  return {
    range,
    stages: counts,
    board,
    totals: {
      leads: businesses.length,
      newLeads,
      newLeadsGrowth: pct(newLeads, prevLeads),
      contacted: contacted.size,
      replied: new Set(inbound.map((m) => m.business_id)).size,
      clients: won.size,
      activeClients: counts.active + counts.onboarding,
      conversionRate: contacted.size ? wonContacted / contacted.size : null,
      pendingProposals: proposals,
      followUps: unresponsive().length,
    },
    series: {
      discovered: series(range, businesses, 'created_at'),
      contacted: series(range, outbound, 'created_at'),
      replies: series(range, inbound, 'created_at'),
    },
  };
}

/** Contacted more than `days` ago with no reply since. */
export function unresponsive(days = 3) {
  const cutoff = new Date(Date.now() - days * DAY).toISOString().replace('T', ' ').slice(0, 19);
  return getDb().prepare(`
    SELECT b.id, b.name, b.email, b.city, l.stage, MAX(m.created_at) AS last_contacted
    FROM businesses b JOIN leads l ON l.business_id = b.id JOIN messages m ON m.business_id = b.id AND m.direction = 'outbound'
    WHERE l.stage IN ('contacted') AND NOT EXISTS (SELECT 1 FROM messages r WHERE r.business_id = b.id AND r.direction = 'inbound' AND r.created_at > m.created_at)
    GROUP BY b.id HAVING last_contacted <= ? ORDER BY last_contacted`).all(cutoff);
}

// ---------- Website operations ----------

export function websiteOps() {
  const db = getDb();
  const since30 = new Date(Date.now() - 30 * DAY).toISOString().replace('T', ' ').slice(0, 19);
  const since24 = new Date(Date.now() - DAY).toISOString().replace('T', ' ').slice(0, 19);
  const sites = db.prepare('SELECT s.*, b.name AS business_name FROM sites s LEFT JOIN businesses b ON b.id = s.business_id').all().map((s) => {
    const checks = db.prepare('SELECT ok, status, ms, checked_at, error FROM site_checks WHERE site_id = ? AND checked_at >= ? ORDER BY id DESC').all(s.id, since30);
    return {
      ...s,
      checks: checks.length,
      uptime: checks.length ? checks.filter((c) => c.ok).length / checks.length : null,
      last: checks[0] || null,
      recent: checks.slice(0, 48).reverse().map((c) => ({ ok: !!c.ok, at: c.checked_at, ms: c.ms, status: c.status })),
    };
  });
  const checked = sites.filter((s) => s.checks);
  return {
    demosBuilt: db.prepare('SELECT COUNT(*) n FROM demos').get().n,
    leadsWithDemos: db.prepare('SELECT COUNT(DISTINCT business_id) n FROM demos WHERE qa_passed = 1').get().n,
    activeDemos: db.prepare("SELECT COUNT(DISTINCT d.business_id) n FROM demos d JOIN leads l ON l.business_id = d.business_id WHERE d.preview_url IS NOT NULL AND l.stage NOT IN ('lost','do_not_contact')").get().n,
    inDevelopment: db.prepare("SELECT COUNT(*) n FROM leads WHERE stage IN ('researched','demo_built') OR (stage = 'onboarding')").get().n,
    qaFailures30d: db.prepare("SELECT COUNT(*) n FROM activity WHERE action = 'demo_qa_failed' AND ts >= ?").get(since30).n,
    awaitingPublishApproval: db.prepare("SELECT COUNT(*) n FROM approvals WHERE status = 'pending' AND action = 'publish_production'").get().n,
    maintenanceClients: db.prepare("SELECT COUNT(*) n FROM leads WHERE stage = 'active'").get().n,
    productionSites: sites.length,
    sites,
    uptime: checked.length ? sum(checked, (s) => s.uptime) / checked.length : null,
    sitesDown: sites.filter((s) => s.last && !s.last.ok).length,
    alerts24h: db.prepare("SELECT COUNT(*) n FROM activity WHERE ts >= ? AND (action LIKE '%failed%' OR action IN ('site_down'))").get(since24).n,
  };
}

// ---------- Overview / health ----------

export function businessHealth() {
  const db = getDb();
  const since24 = new Date(Date.now() - DAY).toISOString().replace('T', ' ').slice(0, 19);
  const signals = [];
  const pending = db.prepare("SELECT COUNT(*) n FROM approvals WHERE status = 'pending'").get().n;
  const failed = db.prepare("SELECT COUNT(*) n FROM jobs WHERE status = 'failed' AND finished_at >= ?").get(since24).n;
  const overdue = db.prepare("SELECT COUNT(*) n FROM invoices WHERE status = 'sent' AND due_at < date('now')").get().n;
  const down = websiteOps().sitesDown;
  if (down) signals.push({ level: 'critical', text: `${down} client site${down > 1 ? 's' : ''} down` });
  if (failed) signals.push({ level: 'serious', text: `${failed} failed job${failed > 1 ? 's' : ''} in 24h` });
  if (overdue) signals.push({ level: 'warning', text: `${overdue} overdue invoice${overdue > 1 ? 's' : ''}` });
  if (pending) signals.push({ level: 'warning', text: `${pending} decision${pending > 1 ? 's' : ''} waiting on you` });
  const level = signals.some((s) => s.level === 'critical') ? 'critical' : signals.some((s) => s.level === 'serious') ? 'serious' : signals.length ? 'attention' : 'nominal';
  return { level, signals };
}

export function today() {
  const db = getDb();
  const start = new Date().toISOString().slice(0, 10);
  const rows = db.prepare('SELECT actor, action, COUNT(*) n FROM activity WHERE ts >= ? GROUP BY actor, action ORDER BY n DESC').all(start);
  const count = (a) => sum(rows.filter((r) => r.action === a), (r) => r.n);
  return {
    date: start,
    discovered: sum(db.prepare("SELECT 1 FROM activity WHERE ts >= ? AND action = 'lead_created'").all(start), () => 1),
    researched: count('business_researched'),
    demos: count('demo_built'),
    previews: count('preview_deployed'),
    drafts: count('outreach_drafted'),
    emailsSent: count('email_sent'),
    replies: count('reply_received'),
    approvalsRequested: count('approval_requested'),
    approvalsDecided: count('approval_granted') + count('approval_rejected'),
    failures: sum(rows.filter((r) => /failed/.test(r.action)), (r) => r.n),
    breakdown: rows,
  };
}

export function leadHistory(businessId) {
  const db = getDb();
  const campaigns = db.prepare('SELECT id FROM campaigns WHERE business_id = ?').all(businessId).map((c) => c.id);
  const messages = db.prepare('SELECT id FROM messages WHERE business_id = ?').all(businessId).map((m) => m.id);
  const invoices = db.prepare('SELECT id FROM invoices WHERE business_id = ?').all(businessId).map((i) => i.id);
  const approvalIds = campaigns.length
    ? db.prepare(`SELECT id FROM approvals WHERE json_extract(payload,'$.campaignId') IN (${campaigns.map(() => '?').join(',')}) OR json_extract(payload,'$.businessId') = ?`).all(...campaigns, businessId).map((a) => a.id)
    : db.prepare("SELECT id FROM approvals WHERE json_extract(payload,'$.businessId') = ?").all(businessId).map((a) => a.id);
  const clauses = [['business', [businessId]], ['campaign', campaigns], ['message', messages], ['invoice', invoices], ['approval', approvalIds]]
    .filter(([, ids]) => ids.length)
    .map(([e, ids]) => ({ sql: `(entity = '${e}' AND entity_id IN (${ids.map(() => '?').join(',')}))`, ids }));
  return db.prepare(`SELECT * FROM activity WHERE ${clauses.map((c) => c.sql).join(' OR ')} ORDER BY id DESC LIMIT 300`)
    .all(...clauses.flatMap((c) => c.ids))
    .map((r) => ({ ...r, detail: parse(r.detail) }));
}
