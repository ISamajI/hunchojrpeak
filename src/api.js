// JSON API route table. Every handler validates input and calls real modules.
import { getDb } from './db.js';
import * as crm from './crm.js';
import * as activity from './activity.js';
import { settings } from './config.js';
import { listApprovals, approve, reject, getApproval, AUTONOMOUS, APPROVAL_REQUIRED } from './decision.js';
import { runDoctor } from './doctor.js';
import { processLead } from './branches/tsunade-orchestrator.js';
import { runPipeline } from './branches/tsunade-orchestrator.js';
import { markWon, queueCampaign, handleInbound } from './branches/kakashi-outreach.js';
import { requestProductionPublish } from './branches/deploy.js';
import { setTaskStatus } from './branches/onboarding.js';
import { listContent, CONTENT_KINDS } from './branches/marketing.js';
import { startJob, getJob, listJobs, jobKinds } from './jobs.js';
import * as metrics from './metrics.js';
import { agentStatus } from './agents.js';
import { runCommand, commandHistory, SUGGESTIONS } from './commands.js';
import * as notify from './notify.js';
import * as finance from './finance.js';
import * as scheduler from './scheduler.js';
import * as monitor from './monitor.js';
import { systemHealth } from './system.js';
import { importLeadsCsv } from './importer.js';
import { search } from './search.js';
import { cleanPipelineArgs } from './operations.js';

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const id = (m) => Number(m[1]);
const notFound = (what) => { throw bad(`${what} not found`, 404); };

const LEAD_FIELDS = ['name', 'category', 'city', 'address', 'phone', 'email', 'website'];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined && o[k] !== '').map((k) => [k, String(o[k]).slice(0, 300)]));

const JOB_KINDS_FROM_UI = ['pipeline', 'process_lead', 'build_demo', 'uptime', 'followup_scan', 'content', 'analysis'];

export const routes = [
  // ---- original endpoints (unchanged behavior) ----
  ['GET', /^\/api\/status$/, () => ({
    pipeline: crm.pipelineCounts(),
    pendingApprovals: listApprovals('pending').length,
    leads: getDb().prepare('SELECT COUNT(*) AS n FROM leads').get().n,
  })],
  ['GET', /^\/api\/doctor$/, (q) => runDoctor({ live: q.get('live') === '1' })],
  ['GET', /^\/api\/leads$/, (q) => crm.listLeads({ stage: q.get('stage') || undefined, minScore: q.get('min') ? Number(q.get('min')) : undefined })],
  ['GET', /^\/api\/leads\/(\d+)$/, (q, m) => crm.leadDetail(id(m)) || notFound('Lead')],
  ['POST', /^\/api\/leads$/, (q, m, b) => {
    const f = pick(b, LEAD_FIELDS);
    if (!f.name) throw bad('Business name is required');
    return crm.upsertBusiness({ ...f, source: 'manual' });
  }],
  ['POST', /^\/api\/leads\/(\d+)\/process$/, (q, m, b) => processLead(id(m), { force: !!b.force })],
  ['POST', /^\/api\/leads\/(\d+)\/stage$/, (q, m, b) => (b.stage === 'won' ? { tasks: markWon(id(m)) } : (crm.setStage(id(m), b.stage, 'owner', b.note), { ok: true }))],
  ['POST', /^\/api\/leads\/(\d+)\/note$/, (q, m, b) => (crm.addNote(id(m), String(b.note || '').slice(0, 2000)), { ok: true })],
  ['POST', /^\/api\/leads\/(\d+)\/publish$/, (q, m) => requestProductionPublish(id(m))],
  ['POST', /^\/api\/campaigns\/(\d+)\/queue$/, (q, m, b) => queueCampaign(id(m), { subject: b.subject, body: b.body })],
  ['POST', /^\/api\/tasks\/(\d+)$/, (q, m, b) => (setTaskStatus(id(m), b.status), { ok: true })],
  ['POST', /^\/api\/pipeline\/run$/, (q, m, b) => runPipeline({ category: b.category, near: b.near, limit: Math.min(50, Number(b.limit) || 10) })],
  ['GET', /^\/api\/approvals$/, (q) => listApprovals(q.get('status') || 'pending')],
  ['GET', /^\/api\/approvals\/(\d+)$/, (q, m) => getApproval(id(m)) || notFound('Approval')],
  ['POST', /^\/api\/approvals\/(\d+)\/approve$/, (q, m) => approve(id(m), 'owner:dashboard')],
  ['POST', /^\/api\/approvals\/(\d+)\/reject$/, (q, m, b) => reject(id(m), 'owner:dashboard', String(b.note || '').slice(0, 500))],
  ['GET', /^\/api\/activity$/, (q) => activity.recent(Math.min(500, Number(q.get('limit')) || 100))],

  // ---- command center ----
  ['GET', /^\/api\/meta$/, () => ({ brand: settings.brand, agency: settings.agency, threshold: settings.demoScoreThreshold, jobKinds: jobKinds(), contentKinds: CONTENT_KINDS, suggestions: SUGGESTIONS, now: new Date().toISOString() })],
  ['GET', /^\/api\/overview$/, (q) => {
    const range = q.get('range') || '30d';
    return {
      revenue: metrics.revenue(range),
      pipeline: metrics.pipeline(range),
      ops: metrics.websiteOps(),
      health: metrics.businessHealth(),
      today: metrics.today(),
      approvals: listApprovals('pending').slice(0, 6),
      jobs: listJobs({ status: 'running,queued' }),
      recentJobs: listJobs({ limit: 8 }),
      notifications: notify.unreadCounts(),
      agents: agentStatus(),
    };
  }],
  ['POST', /^\/api\/commands$/, (q, m, b) => runCommand(b.text, { businessId: b.context?.businessId })],
  ['GET', /^\/api\/commands$/, (q) => commandHistory(Math.min(200, Number(q.get('limit')) || 50))],
  ['GET', /^\/api\/search$/, (q) => search(q.get('q'))],

  // ---- jobs / live activity ----
  ['GET', /^\/api\/jobs$/, (q) => listJobs({ status: q.get('status') || undefined, limit: Math.min(200, Number(q.get('limit')) || 50) })],
  ['GET', /^\/api\/jobs\/(\d+)$/, (q, m) => getJob(id(m)) || notFound('Job')],
  ['POST', /^\/api\/jobs$/, (q, m, b) => {
    if (!JOB_KINDS_FROM_UI.includes(b.kind)) throw bad(`kind must be one of ${JOB_KINDS_FROM_UI.join(', ')}`);
    const args = b.args && typeof b.args === 'object' ? b.args : {};
    let clean;
    if (b.kind === 'pipeline') clean = cleanPipelineArgs(args);
    else if (['process_lead', 'build_demo'].includes(b.kind)) {
      if (!crm.getBusiness(Number(args.businessId))) throw bad('Unknown businessId');
      clean = { businessId: Number(args.businessId), ...(b.kind === 'process_lead' && args.force ? { force: true } : {}) };
    } else if (b.kind === 'content') {
      if (!CONTENT_KINDS[args.kind]) throw bad('Unknown content kind');
      clean = { kind: args.kind, brief: String(args.brief || '').slice(0, 2000) };
    } else if (b.kind === 'analysis') clean = { range: ['7d', '30d', '90d', '12m', 'all'].includes(args.range) ? args.range : '30d' };
    else clean = {};
    return startJob(b.kind, clean, { source: 'dashboard' });
  }],

  // ---- analytics ----
  ['GET', /^\/api\/metrics\/revenue$/, (q) => metrics.revenue(q.get('range') || '30d')],
  ['GET', /^\/api\/metrics\/pipeline$/, (q) => metrics.pipeline(q.get('range') || '30d')],
  ['GET', /^\/api\/metrics\/ops$/, () => metrics.websiteOps()],
  ['GET', /^\/api\/metrics\/today$/, () => metrics.today()],
  ['GET', /^\/api\/followups$/, () => metrics.unresponsive(3)],

  // ---- projects ----
  ['GET', /^\/api\/projects$/, () => ({ board: metrics.BOARD, projects: metrics.projects() })],
  ['GET', /^\/api\/projects\/(\d+)$/, (q, m) => {
    const d = crm.leadDetail(id(m)) || notFound('Project');
    const p = metrics.projects().find((x) => x.id === id(m));
    return { ...d, project: p, history: metrics.leadHistory(id(m)), invoices: finance.listInvoices({ businessId: id(m) }) };
  }],
  ['POST', /^\/api\/projects\/(\d+)\/meta$/, (q, m, b) => {
    const db = getDb();
    if (!crm.getBusiness(id(m))) notFound('Project');
    if (b.value !== undefined) {
      const v = b.value === null || b.value === '' ? null : Math.round(Number(b.value) * 100);
      if (v !== null && !(v >= 0)) throw bad('Value must be a positive number');
      db.prepare('UPDATE leads SET value_cents = ? WHERE business_id = ?').run(v, id(m));
    }
    if (b.deadline !== undefined) {
      const d = b.deadline ? new Date(b.deadline) : null;
      if (d && Number.isNaN(d.getTime())) throw bad('Invalid deadline');
      db.prepare('UPDATE leads SET deadline = ? WHERE business_id = ?').run(d ? d.toISOString().slice(0, 10) : null, id(m));
    }
    activity.log('owner', 'project_updated', 'business', id(m), { value: b.value, deadline: b.deadline });
    return { ok: true };
  }],
  ['POST', /^\/api\/projects\/(\d+)\/move$/, (q, m, b) => {
    const col = metrics.BOARD.find((c) => c.id === b.column) || bad('Unknown column');
    if (col.id === 'won') return { tasks: markWon(id(m)) };
    crm.setStage(id(m), col.drop, 'owner', 'moved on project board');
    return { ok: true };
  }],

  // ---- revenue ledger ----
  ['GET', /^\/api\/invoices$/, () => finance.listInvoices()],
  ['POST', /^\/api\/invoices$/, (q, m, b) => finance.createInvoice({ businessId: b.businessId ? Number(b.businessId) : null, description: b.description, amount: b.amount, recurring: !!b.recurring, status: b.status || 'sent', issuedAt: b.issuedAt, dueAt: b.dueAt, paidAt: b.paidAt })],
  ['POST', /^\/api\/invoices\/(\d+)$/, (q, m, b) => finance.setInvoiceStatus(id(m), b.status, b.paidAt)],

  // ---- agents & workflow ----
  ['GET', /^\/api\/agents$/, () => agentStatus()],
  ['GET', /^\/api\/workflow$/, () => ({
    steps: [
      { id: 'discover', agent: 'sales', label: 'Discover', detail: 'Google Places or OpenStreetMap', gate: 'autonomous' },
      { id: 'research', agent: 'sales', label: 'Research & score', detail: `Audit website · score 0–100 · threshold ${settings.demoScoreThreshold}`, gate: 'autonomous' },
      { id: 'demo', agent: 'web', label: 'Build demo', detail: 'Personalized static site, 9 industry presets', gate: 'autonomous' },
      { id: 'qa', agent: 'security', label: 'Itachi QA gate', detail: 'Blocks scripts, placeholders, fabricated claims', gate: 'gate' },
      { id: 'deploy', agent: 'web', label: 'Deploy preview', detail: 'Vercel preview or local', gate: 'autonomous' },
      { id: 'outreach', agent: 'client', label: 'Draft outreach', detail: 'Grounded in audit findings', gate: 'autonomous' },
      { id: 'send', agent: 'client', label: 'Send email', detail: 'Resend · CAN-SPAM footer · idempotent', gate: 'approval' },
      { id: 'reply', agent: 'client', label: 'Classify replies', detail: 'Interested · question · not interested · unsubscribe', gate: 'autonomous' },
      { id: 'won', agent: 'web', label: 'Onboard', detail: '12-step plan; binding steps owner-only', gate: 'approval' },
    ],
    autonomous: [...AUTONOMOUS],
    approval: APPROVAL_REQUIRED,
  })],

  // ---- schedules ----
  ['GET', /^\/api\/schedules$/, () => ({ kinds: Object.fromEntries(Object.entries(scheduler.SCHEDULE_KINDS).map(([k, v]) => [k, v.job])), schedules: scheduler.listSchedules(), running: scheduler.schedulerRunning() })],
  ['POST', /^\/api\/schedules$/, (q, m, b) => scheduler.createSchedule({ name: b.name, kind: b.kind, args: b.args || {}, everyHours: b.everyHours, startAt: b.startAt })],
  ['POST', /^\/api\/schedules\/(\d+)$/, (q, m, b) => scheduler.updateSchedule(id(m), { enabled: b.enabled })],
  ['POST', /^\/api\/schedules\/(\d+)\/run$/, (q, m) => scheduler.runScheduleNow(id(m), 'dashboard')],
  ['POST', /^\/api\/schedules\/(\d+)\/delete$/, (q, m) => (scheduler.deleteSchedule(id(m)), { ok: true })],

  // ---- sites / uptime ----
  ['GET', /^\/api\/sites$/, () => metrics.websiteOps().sites],
  ['POST', /^\/api\/sites$/, (q, m, b) => monitor.addSite({ url: b.url, businessId: b.businessId ? Number(b.businessId) : null, label: b.label })],
  ['POST', /^\/api\/sites\/(\d+)\/delete$/, (q, m) => (monitor.removeSite(id(m)), { ok: true })],

  // ---- content ----
  ['GET', /^\/api\/content$/, () => ({ kinds: CONTENT_KINDS, items: listContent() })],

  // ---- notifications ----
  ['GET', /^\/api\/notifications$/, (q) => ({ items: notify.listNotifications({ unread: q.get('unread') === '1', minPriority: q.get('min') || undefined }), counts: notify.unreadCounts() })],
  ['POST', /^\/api\/notifications\/(\d+)\/read$/, (q, m) => (notify.markRead(id(m)), { ok: true })],
  ['POST', /^\/api\/notifications\/read-all$/, () => (notify.markAllRead(), { ok: true })],
  ['GET', /^\/api\/settings\/notifications$/, () => ({ prefs: notify.getPrefs(), kinds: notify.KINDS, priorities: notify.PRIORITIES })],
  ['POST', /^\/api\/settings\/notifications$/, (q, m, b) => notify.setPrefs(b)],

  // ---- system ----
  ['GET', /^\/api\/system$/, () => systemHealth()],
];

// Raw-body routes (not JSON).
export const rawRoutes = [
  ['POST', /^\/api\/import\/leads$/, (q, m, text) => importLeadsCsv(text)],
];

export { handleInbound };
