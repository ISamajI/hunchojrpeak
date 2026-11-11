// The six operational agents. Each maps onto the Akamaru branches that do its
// work; status and performance are computed from the jobs table and activity log.
import { getDb, parse } from './db.js';
import { isConfigured } from './config.js';

export const AGENTS = [
  { id: 'sales', name: 'Sales Intelligence', codename: 'Jiraiya', actors: ['jiraiya'], mission: 'Finds businesses that need websites, audits their web presence and scores each opportunity.', requires: [] },
  { id: 'web', name: 'Web Development', codename: 'Orochimaru', actors: ['orochimaru'], mission: 'Builds personalized website demos and deploys previews and production sites.', requires: [] },
  { id: 'marketing', name: 'Marketing Intelligence', codename: 'Shikamaru', actors: ['shikamaru'], mission: 'Drafts campaigns, ad concepts and social content for LTGPeak.', requires: ['anthropic'] },
  { id: 'client', name: 'Client Relations', codename: 'Kakashi', actors: ['kakashi'], mission: 'Prepares outreach, classifies replies, tracks conversations and follow-ups.', requires: [] },
  { id: 'analytics', name: 'Business Analytics', codename: 'Clavo Dulce', actors: ['clavo-dulce'], mission: 'Tracks revenue, conversion and pipeline health from the ledger and CRM.', requires: [] },
  { id: 'security', name: 'System Security', codename: 'Itachi', actors: ['itachi', 'decision-engine'], mission: 'QA-gates every demo, enforces owner approval, monitors uptime and integrations.', requires: [] },
];

const ACTION_TEXT = {
  lead_created: 'Logged a new lead', businesses_discovered: 'Discovered businesses', business_researched: 'Researched a business',
  synthesis_failed: 'AI research summary failed', demo_built: 'Built a website demo', preview_deployed: 'Deployed a preview',
  vercel_deploy_failed: 'Vercel deploy failed', production_published: 'Published a production site', outreach_drafted: 'Drafted outreach',
  ai_outreach_failed: 'AI outreach draft rejected', email_sent: 'Sent an approved email', reply_received: 'Processed a reply',
  reply_unauthenticated: 'Quarantined an unauthenticated reply', demo_qa_passed: 'Passed demo QA', demo_qa_failed: 'Blocked a demo at QA',
  approval_requested: 'Requested owner approval', approval_granted: 'Approval granted', approval_executed: 'Executed an approved action',
  approval_failed: 'Approved action failed', invoice_paid: 'Recorded a payment', content_drafted: 'Drafted marketing content',
  site_down: 'Detected a site outage', site_recovered: 'Site recovered', uptime_sweep: 'Checked client site uptime',
  pending_sends_cancelled: 'Cancelled pending sends', analysis_run: 'Ran a business analysis', stage_changed: 'Moved a lead',
};

export function describeAction(action) {
  return ACTION_TEXT[action] || action.replace(/_/g, ' ');
}

export function agentForActor(actor) {
  return AGENTS.find((a) => a.actors.includes(actor))?.id || null;
}

export function agentStatus() {
  const db = getDb();
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const since24 = new Date(Date.now() - 86400000).toISOString().replace('T', ' ').slice(0, 19);
  const running = db.prepare("SELECT * FROM jobs WHERE status IN ('running','queued') ORDER BY id").all();
  return AGENTS.map((a) => {
    const ph = a.actors.map(() => '?').join(',');
    const recent = db.prepare(`SELECT * FROM activity WHERE actor IN (${ph}) ORDER BY id DESC LIMIT 8`).all(...a.actors).map((r) => ({ ...r, detail: parse(r.detail), text: describeAction(r.action) }));
    const week = db.prepare(`SELECT action, COUNT(*) n FROM activity WHERE actor IN (${ph}) AND ts >= ? GROUP BY action`).all(...a.actors, since7);
    const failures = week.filter((w) => /failed|rejected_by_qa/.test(w.action)).reduce((s, w) => s + w.n, 0);
    const total = week.reduce((s, w) => s + w.n, 0);
    const fail24 = db.prepare(`SELECT COUNT(*) n FROM activity WHERE actor IN (${ph}) AND ts >= ? AND action LIKE '%failed%'`).get(...a.actors, since24).n;
    const jobs = running.filter((j) => j.agent === a.id);
    // An orchestrated pipeline job runs every branch; whoever logged most recently holds the baton.
    const pipelineActive = running.some((j) => j.status === 'running' && j.agent === 'orchestrator') && recent[0] && Date.now() - new Date(recent[0].ts.replace(' ', 'T') + 'Z') < 30000;
    const missing = a.requires.filter((k) => !isConfigured(k));
    let status = 'standby';
    if (missing.length) status = 'offline';
    else if (jobs.some((j) => j.status === 'running') || pipelineActive) status = 'active';
    else if (jobs.length) status = 'queued';
    else if (fail24) status = 'attention';
    const current = jobs.find((j) => j.status === 'running');
    return {
      ...a,
      status,
      missing,
      currentTask: current ? current.step || current.label : pipelineActive ? recent[0].text : null,
      queued: jobs.filter((j) => j.status === 'queued').length,
      recent,
      performance: { actions7d: total, failures7d: failures, successRate: total ? (total - failures) / total : null },
    };
  });
}
