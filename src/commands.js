// AKUMARU command interface: natural language → real operations.
// A deterministic parser handles the core command set; Claude (when connected)
// interprets anything else into the same fixed intent list. Commands can only
// trigger autonomous operations — approvals still require an explicit click.
import { getDb, json, parse } from './db.js';
import { log } from './activity.js';
import { startJob } from './jobs.js';
import { listLeads } from './crm.js';
import { listApprovals } from './decision.js';
import { unresponsive, today, businessHealth } from './metrics.js';
import { claudeAvailable, generateJson } from './integrations/claude.js';
import { DEFAULT_SWEEP } from './operations.js';
import { CONTENT_KINDS } from './branches/marketing.js';

export const INTENTS = ['find_businesses', 'build_demo', 'process_lead', 'unresponsive', 'accomplished', 'analyze', 'marketing', 'approvals', 'status', 'show_leads', 'uptime', 'help'];

export const SUGGESTIONS = [
  'Find 20 businesses around Hamilton that need websites',
  'Find 10 barbers in Houston, TX',
  'Build a demo for #1',
  'Show me all clients who haven\'t responded',
  'Show me everything you accomplished today',
  'Analyze this month\'s revenue',
  'Create a marketing campaign for LTGPeak',
  'What needs my approval?',
  'Show hot leads',
  'System status',
];

const GENERIC = /^(?:local\s+)?(?:small\s+)?(?:businesses|business|companies|shops|places|stores|clients)?$/i;

/** Deterministic parser. Returns {intent, args} or null. */
export function parseCommand(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if (!t) return null;
  let m;
  if ((m = t.match(/^(?:please\s+)?(?:find|discover|search(?: for)?|look for|get me|scout)\s+(?:(\d+)\s+)?(.*?)\s*(?:businesses|companies|shops|places|stores)?\s+(?:around|in|near|by|within)\s+(.+?)(?:\s+(?:that|which|who|with|without|needing)\b.*)?[.!?]?$/i))) {
    const category = m[2].trim();
    return { intent: 'find_businesses', args: { limit: Math.min(50, Number(m[1]) || 10), near: m[3].trim(), ...(GENERIC.test(category) ? { categories: DEFAULT_SWEEP } : { category }) } };
  }
  if ((m = t.match(/^(?:please\s+)?(?:build|create|make|generate)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:website\s+)?(?:demo|site|website)\s+for\s+(.+?)[.!?]?$/i))) return { intent: 'build_demo', args: { target: m[1] } };
  if ((m = t.match(/^(?:research|process|advance|work on)\s+(.+?)[.!?]?$/i))) return { intent: 'process_lead', args: { target: m[1] } };
  if (/(haven'?t|have not|not|never)\s+(responded|replied|answered)|no (response|reply)|unresponsive|follow[- ]?ups?\b/i.test(t)) return { intent: 'unresponsive', args: {} };
  if (/accomplish|what (did|have) you (do|done)|done today|today'?s? (work|summary|report)|what happened today|daily (summary|report)/i.test(t)) return { intent: 'accomplished', args: {} };
  if (/(market|campaign|social|ad concept|advert|blog|newsletter|content)/i.test(t) && /(create|make|draft|write|plan|build|generate)/i.test(t)) {
    const kind = /social/i.test(t) ? 'social' : /\bads?\b|advert/i.test(t) ? 'ad' : /blog|article/i.test(t) ? 'blog' : /newsletter|email/i.test(t) ? 'email' : 'campaign';
    return { intent: 'marketing', args: { kind, brief: t } };
  }
  if (/revenue|money|income|sales|analy[sz]e|performance|how('?s| is) (the )?business/i.test(t)) {
    const range = /week/i.test(t) ? '7d' : /quarter|90/i.test(t) ? '90d' : /year|12/i.test(t) ? '12m' : '30d';
    return { intent: 'analyze', args: { range, focus: /revenue|money|income/i.test(t) ? 'revenue' : 'business' } };
  }
  if (/approv|decision|waiting on me|need(s)? me/i.test(t)) return { intent: 'approvals', args: {} };
  if (/uptime|sites? (down|up)|check (the )?sites/i.test(t)) return { intent: 'uptime', args: {} };
  if (/status|health|systems?\b|are you (ok|working)/i.test(t)) return { intent: 'status', args: {} };
  if ((m = t.match(/(?:show|list|see)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(hot|warm|cold|new)?\s*(?:leads|prospects|opportunities|clients)/i))) return { intent: 'show_leads', args: { tier: m[1]?.toLowerCase() || null, clients: /clients/i.test(t) } };
  if (/^(help|\?|what can you do)/i.test(t)) return { intent: 'help', args: {} };
  return null;
}

const AI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'category', 'near', 'limit', 'target', 'kind', 'range'],
  properties: {
    intent: { type: 'string', enum: INTENTS },
    category: { type: 'string', description: 'business category, or "" for any' },
    near: { type: 'string' },
    limit: { type: 'integer' },
    target: { type: 'string', description: 'business name or #id for build_demo/process_lead' },
    kind: { type: 'string', enum: Object.keys(CONTENT_KINDS) },
    range: { type: 'string', enum: ['7d', '30d', '90d', '12m'] },
  },
};

async function aiParse(text) {
  const r = await generateJson({
    system: 'You route commands for AKUMARU, the operating system of LTGPeak (a web design agency). Map the owner\'s command to exactly one intent. Use "help" if nothing fits. Never invent targets.',
    prompt: `Command: """${String(text).slice(0, 1000)}"""`,
    schema: AI_SCHEMA,
    maxTokens: 1500,
    effort: 'low',
  });
  const args = {
    find_businesses: { limit: Math.min(50, r.limit || 10), near: r.near, ...(r.category ? { category: r.category } : { categories: DEFAULT_SWEEP }) },
    build_demo: { target: r.target }, process_lead: { target: r.target },
    marketing: { kind: r.kind, brief: text }, analyze: { range: r.range, focus: 'business' },
  }[r.intent] || {};
  return { intent: r.intent, args };
}

function resolveTarget(target, context) {
  const db = getDb();
  const t = String(target || '').trim();
  if (/^(this|that|the)\b/i.test(t) && context?.businessId) return { ids: [Number(context.businessId)] };
  const idm = t.match(/^#?(\d+)$/);
  if (idm) return db.prepare('SELECT id FROM businesses WHERE id = ?').get(Number(idm[1])) ? { ids: [Number(idm[1])] } : { ids: [] };
  const name = t.replace(/^(this|that|the)\s+/i, '');
  const rows = db.prepare('SELECT id, name, city, category FROM businesses WHERE name LIKE ? ORDER BY id DESC LIMIT 10').all(`%${name}%`);
  return { ids: rows.map((r) => r.id), rows };
}

const cols = (...c) => c;

/** Execute a parsed intent. Returns a structured response for the UI. */
async function execute({ intent, args }, context) {
  switch (intent) {
    case 'find_businesses': {
      if (!args.near) return { kind: 'error', text: 'Tell me where to look — e.g. "Find 20 businesses around Hamilton".' };
      const job = startJob('pipeline', args, { source: 'command' });
      return { kind: 'job', jobId: job.id, title: job.label, text: `Sales Intelligence is on it. I'll discover ${args.limit} ${args.category || 'businesses across ' + args.categories.length + ' trades'} near ${args.near}, research each one, build demos for the strongest opportunities, and queue outreach for your approval.` };
    }
    case 'build_demo':
    case 'process_lead': {
      const r = resolveTarget(args.target, context);
      if (!r.ids.length) return { kind: 'error', text: `I couldn't find a business matching "${args.target}". Try its #id, or open it from Projects and run the command from there.` };
      if (r.ids.length > 1) return { kind: 'table', title: `"${args.target}" matches ${r.ids.length} businesses — which one?`, columns: cols('id', 'name', 'city', 'category'), rows: r.rows, hint: 'Re-run with the #id, e.g. "Build a demo for #' + r.rows[0].id + '"' };
      const job = startJob(intent === 'build_demo' ? 'build_demo' : 'process_lead', { businessId: r.ids[0] }, { source: 'command' });
      return { kind: 'job', jobId: job.id, title: job.label, text: intent === 'build_demo' ? 'Web Development is building the demo. Itachi QA runs before anything is deployed.' : 'Running every remaining autonomous step for this lead.', link: `#/projects/${r.ids[0]}` };
    }
    case 'unresponsive': {
      const rows = unresponsive(3);
      return rows.length
        ? { kind: 'table', title: `${rows.length} prospect${rows.length > 1 ? 's' : ''} haven't responded in 3+ days`, columns: cols('id', 'name', 'email', 'city', 'last_contacted'), rows, linkBase: '#/projects/' }
        : { kind: 'text', text: 'Nobody is waiting on a follow-up: every contacted prospect has either replied or was contacted less than 3 days ago.' };
    }
    case 'accomplished': {
      const d = today();
      const lines = [
        ['Leads discovered', d.discovered], ['Businesses researched', d.researched], ['Demos built', d.demos], ['Previews deployed', d.previews],
        ['Outreach drafted', d.drafts], ['Emails sent (approved)', d.emailsSent], ['Replies processed', d.replies], ['Approvals requested', d.approvalsRequested], ['Failures', d.failures],
      ];
      const total = lines.slice(0, 8).reduce((s, [, n]) => s + n, 0);
      return { kind: 'summary', title: `Today (${d.date})`, text: total ? 'Here is everything I completed today, straight from the activity log.' : 'No operations have run yet today.', items: lines.map(([label, value]) => ({ label, value })) };
    }
    case 'analyze': {
      const job = startJob('analysis', args, { source: 'command' });
      return { kind: 'job', jobId: job.id, title: job.label, text: 'Business Analytics is reading the invoice ledger and pipeline.' };
    }
    case 'marketing': {
      if (!claudeAvailable()) return { kind: 'error', text: 'Marketing Intelligence needs Claude to write original campaigns. Add ANTHROPIC_API_KEY to .env, then run this again.', link: '#/integrations' };
      const job = startJob('content', args, { source: 'command' });
      return { kind: 'job', jobId: job.id, title: job.label, text: 'Marketing Intelligence is drafting. Nothing is published — drafts land in Marketing Studio.', link: '#/marketing' };
    }
    case 'approvals': {
      const rows = listApprovals('pending').map((a) => ({ id: a.id, action: a.action, summary: a.summary }));
      return rows.length ? { kind: 'table', title: `${rows.length} decision${rows.length > 1 ? 's' : ''} waiting on you`, columns: cols('id', 'action', 'summary'), rows, link: '#/approvals' } : { kind: 'text', text: 'Nothing is waiting for your approval.' };
    }
    case 'uptime': {
      const job = startJob('uptime', {}, { source: 'command' });
      return { kind: 'job', jobId: job.id, title: job.label, text: 'System Security is checking every monitored client site.' };
    }
    case 'status': {
      const h = businessHealth();
      return { kind: 'text', title: `Status: ${h.level.toUpperCase()}`, text: h.signals.length ? h.signals.map((s) => `• ${s.text}`).join('\n') : 'All systems nominal. No failures, outages, overdue invoices or pending decisions.', link: '#/health' };
    }
    case 'show_leads': {
      const min = { hot: 60, warm: 40, cold: 0 }[args.tier] ?? undefined;
      let rows = listLeads({ minScore: min });
      if (args.tier === 'warm') rows = rows.filter((r) => r.score < 60);
      if (args.tier === 'cold') rows = rows.filter((r) => r.score < 40);
      if (args.tier === 'new') rows = rows.filter((r) => r.stage === 'discovered');
      if (args.clients) rows = rows.filter((r) => ['won', 'onboarding', 'active'].includes(r.stage));
      return { kind: 'table', title: `${rows.length} ${args.tier || ''} ${args.clients ? 'clients' : 'leads'}`.replace(/\s+/g, ' '), columns: cols('id', 'name', 'score', 'stage', 'city'), rows: rows.slice(0, 50), linkBase: '#/projects/' };
    }
    default:
      return { kind: 'text', title: 'Here\'s what I can do', text: 'I can discover and research businesses, build demos, show who hasn\'t responded, summarize today, analyze revenue, draft marketing (with Claude), check site uptime and report system status.', suggestions: SUGGESTIONS };
  }
}

export async function runCommand(text, context = {}) {
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean) throw new Error('Command is empty');
  let parsed = parseCommand(clean);
  let parser = 'rules';
  if (!parsed && claudeAvailable()) {
    try { parsed = await aiParse(clean); parser = 'claude'; } catch (e) { log('akamaru', 'command_parse_failed', null, null, { error: e.message }); }
  }
  let response;
  if (!parsed) {
    parser = 'none';
    response = { kind: 'text', title: 'I didn\'t catch that', text: claudeAvailable() ? 'I couldn\'t map that to an operation.' : 'I couldn\'t map that to an operation. (Connect Claude to let me interpret free-form commands.) Try one of these:', suggestions: SUGGESTIONS.slice(0, 6) };
  } else {
    try { response = await execute(parsed, context); } catch (e) { response = { kind: 'error', text: e.message }; }
  }
  const r = getDb().prepare('INSERT INTO commands (text, intent, args, parser, response, job_id) VALUES (?,?,?,?,?,?)')
    .run(clean, parsed?.intent || null, json(parsed?.args || null), parser, json(response), response.jobId || null);
  log('akamaru', 'command_received', 'command', Number(r.lastInsertRowid), { text: clean.slice(0, 120), intent: parsed?.intent || null });
  return { id: Number(r.lastInsertRowid), text: clean, intent: parsed?.intent || null, parser, response };
}

export function commandHistory(limit = 50) {
  return getDb().prepare('SELECT * FROM commands ORDER BY id DESC LIMIT ?').all(limit).map((c) => ({ ...c, args: parse(c.args), response: parse(c.response) }));
}
