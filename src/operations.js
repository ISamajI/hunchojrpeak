// Every background operation Akamaru can run. Each is a real call into the branches.
import { defineJob } from './jobs.js';
import { log } from './activity.js';
import { getDb } from './db.js';
import { getBusiness } from './crm.js';
import { runPipeline, processLead } from './branches/tsunade-orchestrator.js';
import { researchBusiness } from './branches/jiraiya-research.js';
import { buildDemo } from './branches/orochimaru-demo.js';
import { deployPreview } from './branches/deploy.js';
import { draftContent, CONTENT_KINDS } from './branches/marketing.js';
import { checkAllSites } from './monitor.js';
import { revenue, pipeline, unresponsive } from './metrics.js';

export const DEFAULT_SWEEP = ['restaurant', 'barber', 'beauty', 'auto repair', 'cafe', 'dentist'];

const money = (c) => `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

defineJob('pipeline', {
  agent: 'orchestrator',
  label: (a) => `Find ${a.limit || 10} ${a.categories?.length ? 'local businesses' : a.category} near ${a.near}`,
  run: (a, ctx) => runPipeline({ ...a, limit: Math.min(50, Number(a.limit) || 10), onStep: ctx.step }),
});

defineJob('process_lead', {
  agent: 'orchestrator',
  label: (a) => `Advance lead #${a.businessId}`,
  run: (a, ctx) => processLead(Number(a.businessId), { force: !!a.force, onStep: (t) => ctx.step(t) }),
});

defineJob('build_demo', {
  agent: 'web',
  label: (a) => `Build demo for ${getBusiness(Number(a.businessId))?.name || '#' + a.businessId}`,
  run: async (a, ctx) => {
    const id = Number(a.businessId);
    const b = getBusiness(id);
    if (!b) throw new Error(`Business ${id} not found`);
    if (!getDb().prepare('SELECT 1 FROM research WHERE business_id = ?').get(id)) {
      ctx.step(`Researching ${b.name} first`, 0.1);
      await researchBusiness(id);
    }
    ctx.step(`Generating personalized site for ${b.name}`, 0.4);
    const demo = await buildDemo(id);
    if (!demo.qa.passed) throw new Error(`Demo failed QA: ${demo.qa.failures.join(', ')}`);
    ctx.step('Itachi QA passed — deploying preview', 0.75);
    const dep = await deployPreview(id);
    return { version: demo.version, copy: demo.copySource, previewUrl: dep.url, provider: dep.provider, warning: dep.warning };
  },
});

defineJob('uptime', {
  agent: 'security',
  label: 'Uptime sweep of client sites',
  run: (a, ctx) => checkAllSites(ctx.step),
});

defineJob('followup_scan', {
  agent: 'client',
  label: 'Scan for prospects who haven\'t responded',
  run: (a, ctx) => {
    ctx.step('Checking contacted leads with no reply in 3+ days', 0.5);
    const rows = unresponsive(Number(a.days) || 3);
    log('kakashi', 'followup_scan', null, null, { found: rows.length });
    return { count: rows.length, leads: rows };
  },
});

defineJob('content', {
  agent: 'marketing',
  label: (a) => `Draft ${(CONTENT_KINDS[a.kind] || 'content').toLowerCase()}`,
  run: (a, ctx) => draftContent(a, ctx.step),
});

defineJob('analysis', {
  agent: 'analytics',
  label: (a) => `Analyze ${a.focus || 'business'} (${a.range || '30d'})`,
  run: (a, ctx) => {
    ctx.step('Reading invoice ledger', 0.3);
    const r = revenue(a.range || '30d');
    ctx.step('Reading pipeline', 0.6);
    const p = pipeline(a.range || '30d');
    const findings = [];
    if (!r.hasData) findings.push('No invoices recorded yet, so revenue cannot be analyzed. Record invoices under Revenue to enable this.');
    else {
      findings.push(`Revenue this period: ${money(r.period)}${r.growth == null ? '' : ` (${r.growth >= 0 ? '+' : ''}${Math.round(r.growth * 100)}% vs previous period)`}.`);
      findings.push(`MRR ${money(r.mrr)} from ${r.recurringClients} recurring client(s). Outstanding ${money(r.outstanding.cents)} across ${r.outstanding.count} invoice(s)${r.outstanding.overdueCount ? `, ${r.outstanding.overdueCount} overdue` : ''}.`);
    }
    findings.push(`${p.totals.newLeads} new leads this period; ${p.totals.contacted} contacted to date; ${p.totals.clients} won.`);
    if (p.totals.conversionRate != null) findings.push(`Contacted → won conversion: ${Math.round(p.totals.conversionRate * 100)}%.`);
    if (p.totals.followUps) findings.push(`${p.totals.followUps} prospect(s) haven't replied in 3+ days — follow-ups recommended.`);
    if (r.projected.dealsWithoutValue) findings.push(`${r.projected.dealsWithoutValue} open deal(s) have no value set, so the revenue projection undercounts them.`);
    log('clavo-dulce', 'analysis_run', null, null, { range: a.range || '30d' });
    return { findings, revenue: { period: r.period, growth: r.growth, mrr: r.mrr, outstanding: r.outstanding }, pipeline: p.totals };
  },
});
