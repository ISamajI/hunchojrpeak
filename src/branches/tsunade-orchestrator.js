// TSUNADE — Strategy & Management.
// Runs the autonomous pipeline end to end. Each lead runs independently: one
// lead's failure is logged and reported, never hidden, and never stops the batch.
import { settings } from '../config.js';
import { log } from '../activity.js';
import { getDb } from '../db.js';
import { getBusiness } from '../crm.js';
import { decide } from '../decision.js';
import { discoverBusinesses } from './discovery.js';
import { researchBusiness } from './jiraiya-research.js';
import { buildDemo } from './orochimaru-demo.js';
import { deployPreview } from './deploy.js';
import { draftOutreach } from './kakashi-outreach.js';

const STEPS = [
  ['research_business', 'research'],
  ['build_demo', 'demo'],
  ['deploy_preview', 'deploy'],
  ['draft_outreach', 'outreach'],
];

/** Process one lead through every autonomous step it hasn't completed yet. */
export async function processLead(businessId, { threshold = settings.demoScoreThreshold, force = false } = {}) {
  const business = getBusiness(businessId);
  if (!business) throw new Error(`Business ${businessId} not found`);
  const db = getDb();
  const report = { businessId, name: business.name, steps: [], stoppedAt: null };
  const has = {
    research: () => !!db.prepare('SELECT 1 FROM research WHERE business_id = ?').get(businessId),
    demo: () => !!db.prepare('SELECT 1 FROM demos WHERE business_id = ? AND qa_passed = 1').get(businessId),
    deploy: () => !!db.prepare('SELECT 1 FROM demos WHERE business_id = ? AND preview_url IS NOT NULL').get(businessId),
    outreach: () => !!db.prepare("SELECT 1 FROM campaigns WHERE business_id = ? AND kind = 'outreach' AND status NOT IN ('cancelled','failed')").get(businessId),
  };
  const lead = db.prepare('SELECT stage FROM leads WHERE business_id = ?').get(businessId);
  if (['lost', 'do_not_contact'].includes(lead.stage)) {
    report.stoppedAt = `lead is ${lead.stage}`;
    return report;
  }
  for (const [action, key] of STEPS) {
    if (decide(action).mode !== 'autonomous') { report.stoppedAt = `${action} needs approval`; break; }
    if (!force && has[key]()) { report.steps.push({ step: key, status: 'already_done' }); continue; }
    try {
      let out;
      if (key === 'research') {
        out = await researchBusiness(businessId);
        report.score = out.score.value;
        report.steps.push({ step: key, status: 'ok', score: out.score.value, tier: out.score.tier });
        if (out.score.value < threshold) { report.stoppedAt = `score ${out.score.value} below threshold ${threshold}`; break; }
      } else if (key === 'demo') {
        out = await buildDemo(businessId);
        report.steps.push({ step: key, status: out.qa.passed ? 'ok' : 'qa_failed', version: out.version, copy: out.copySource, failures: out.qa.failures });
        if (!out.qa.passed) { report.stoppedAt = 'demo failed QA'; break; }
      } else if (key === 'deploy') {
        out = await deployPreview(businessId);
        report.previewUrl = out.url;
        report.steps.push({ step: key, status: 'ok', provider: out.provider, url: out.url, warning: out.warning });
      } else if (key === 'outreach') {
        out = await draftOutreach(businessId);
        report.steps.push({ step: key, status: 'ok', channel: out.channel, approvalId: out.approvalId, copy: out.source });
      }
    } catch (e) {
      report.steps.push({ step: key, status: 'error', error: e.message });
      report.stoppedAt = `${key} failed: ${e.message}`;
      log('tsunade', 'pipeline_step_failed', 'business', businessId, { step: key, error: e.message });
      break;
    }
  }
  return report;
}

/** Discover → research → demo → QA → preview → outreach draft (send queued for approval). */
export async function runPipeline({ category, near, limit = 10, threshold, provider } = {}) {
  const started = Date.now();
  const discovery = await discoverBusinesses({ category, near, limit, provider });
  const leads = [];
  for (const r of discovery.results) leads.push(await processLead(r.id, { threshold }));
  const summary = {
    provider: discovery.provider,
    discovered: discovery.results.length,
    new: discovery.results.filter((r) => r.created).length,
    demos: leads.filter((l) => l.steps.some((s) => s.step === 'demo' && s.status === 'ok')).length,
    previews: leads.filter((l) => l.previewUrl).length,
    queuedForApproval: leads.filter((l) => l.steps.some((s) => s.step === 'outreach' && s.approvalId)).length,
    errors: leads.filter((l) => l.steps.some((s) => s.status === 'error')).length,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
  log('tsunade', 'pipeline_run', null, null, { category, near, ...summary });
  return { summary, leads };
}
