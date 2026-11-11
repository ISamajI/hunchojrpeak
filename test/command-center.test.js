// Backend for the command-center UI: jobs, live events, metrics, commands,
// notifications, scheduler, uptime monitor, import, search, system health.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, stub, osmStubHandler, OLD_SITE } from './helpers.js';
import * as crm from '../src/crm.js';
import '../src/index.js';
import { createServer } from '../src/server.js';
import { startJob, waitForJob, recoverInterruptedJobs, getJob } from '../src/jobs.js';
import { getDb } from '../src/db.js';
import * as metrics from '../src/metrics.js';
import * as finance from '../src/finance.js';
import { runCommand, parseCommand } from '../src/commands.js';
import { listNotifications, setPrefs, unreadCounts } from '../src/notify.js';
import { requestApproval } from '../src/decision.js';
import { createSchedule, tick, listSchedules } from '../src/scheduler.js';
import { addSite, checkSite } from '../src/monitor.js';
import { importLeadsCsv, parseCsv } from '../src/importer.js';
import { search } from '../src/search.js';
import { agentStatus } from '../src/agents.js';
import { log } from '../src/activity.js';

let server;
let base;
beforeEach(async () => {
  freshDb();
  server = createServer();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  server.closeAllConnections?.();
  await new Promise((ok) => server.close(ok));
  for (const k of ['NOMINATIM_URL', 'OVERPASS_URL', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'OWNER_PHONE', 'TWILIO_API_URL']) delete process.env[k];
});
const api = (path, body) => fetch(base + path, body === undefined ? { headers: { 'x-akamaru': '1' } } : { method: 'POST', headers: { 'content-type': 'application/json', 'x-akamaru': '1' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, data: await r.json() }));

test('jobs run in the background with live step reporting', async () => {
  const { id } = crm.upsertBusiness({ name: 'Job Barbers', category: 'hairdresser', phone: '7135550000' });
  const job = startJob('build_demo', { businessId: id });
  assert.equal(job.status, 'queued');
  const done = await waitForJob(job.id);
  assert.equal(done.status, 'done', done.error);
  assert.ok(done.steps.some((s) => /Generating personalized site/.test(s.text)));
  assert.match(done.result.previewUrl, /\/preview\//);
  assert.equal(done.progress, 1);
});

test('failed jobs are recorded (not hidden) and interrupted jobs recovered', async () => {
  const job = startJob('build_demo', { businessId: 9999 });
  const done = await waitForJob(job.id);
  assert.equal(done.status, 'failed');
  assert.match(done.error, /not found/);
  getDb().prepare("INSERT INTO jobs (kind, label, status) VALUES ('uptime', 'stuck', 'running')").run();
  assert.equal(recoverInterruptedJobs(), 1);
  assert.match(getDb().prepare("SELECT error FROM jobs WHERE label = 'stuck'").get().error, /Interrupted/);
});

test('SSE stream delivers activity and job events in real time', async () => {
  const ctrl = new AbortController();
  const res = await fetch(base + '/api/stream', { headers: { 'x-akamaru': '1' }, signal: ctrl.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const reader = res.body.getReader();
  let buf = '';
  const read = async (pattern) => {
    const start = Date.now();
    while (!pattern.test(buf)) {
      if (Date.now() - start > 5000) throw new Error('timeout: ' + buf);
      const { value } = await reader.read();
      buf += new TextDecoder().decode(value);
    }
  };
  await read(/event: hello/);
  log('jiraiya', 'business_researched', 'business', 1, { score: 10 });
  await read(/event: activity[\s\S]*business_researched/);
  ctrl.abort();
  assert.equal((await fetch(base + '/api/stream')).status, 403, 'stream requires x-akamaru header');
});

test('revenue never fabricates: empty ledger reports no data; invoices drive every number', async () => {
  const empty = metrics.revenue('30d');
  assert.equal(empty.hasData, false);
  assert.equal(empty.period, 0);
  assert.ok(empty.series.every((p) => p.value === 0));
  const { id } = crm.upsertBusiness({ name: 'Paying Client' });
  const today = new Date().toISOString().slice(0, 10);
  finance.createInvoice({ businessId: id, description: 'Website build', amount: 1500, status: 'paid', paidAt: today });
  finance.createInvoice({ businessId: id, description: 'Hosting & care', amount: 99, status: 'paid', recurring: true, paidAt: today });
  finance.createInvoice({ businessId: id, description: 'Phase 2', amount: 800, status: 'sent', dueAt: '2020-01-01' });
  const r = metrics.revenue('30d');
  assert.equal(r.hasData, true);
  assert.equal(r.period, 159900);
  assert.equal(r.mrr, 9900);
  assert.equal(r.outstanding.cents, 80000);
  assert.equal(r.outstanding.overdueCount, 1);
  assert.equal(r.series.reduce((s, p) => s + p.value, 0), 159900);
  assert.equal(r.projected.components.outstanding, 80000);
  assert.throws(() => finance.createInvoice({ description: 'x', amount: -5 }), /positive/);
  assert.equal(metrics.businessHealth().signals.some((s) => /overdue/.test(s.text)), true);
});

test('projected revenue only counts deals with a value, and says how many lack one', async () => {
  const a = crm.upsertBusiness({ name: 'Valued' });
  crm.upsertBusiness({ name: 'Unvalued' });
  crm.setStage(a.id, 'interested');
  getDb().prepare('UPDATE leads SET value_cents = 200000 WHERE business_id = ?').run(a.id);
  const r = metrics.revenue('30d');
  assert.equal(r.projected.components.pipelineWeighted, 80000); // $2,000 × 0.4
  assert.equal(r.projected.dealsWithoutValue, 1);
});

test('project board: columns map real stages; moving to Won creates onboarding', async () => {
  const { id } = crm.upsertBusiness({ name: 'Board Co' });
  let { data } = await api('/api/projects');
  assert.equal(data.board.length, 8);
  assert.equal(data.projects[0].column, 'new');
  await api(`/api/projects/${id}/move`, { column: 'negotiating' });
  assert.equal(crm.leadDetail(id).lead.stage, 'interested');
  const won = await api(`/api/projects/${id}/move`, { column: 'won' });
  assert.equal(won.data.tasks.length, 12);
  ({ data } = await api(`/api/projects/${id}`));
  assert.equal(data.project.column, 'won');
  assert.ok(data.history.some((h) => h.action === 'stage_changed'));
  await api(`/api/projects/${id}/meta`, { value: 2500, deadline: '2026-12-31' });
  ({ data } = await api(`/api/projects/${id}`));
  assert.equal(data.project.value_cents, 250000);
  assert.equal(data.project.deadline, '2026-12-31');
  assert.equal((await api(`/api/projects/${id}/move`, { column: 'nope' })).status, 400);
});

test('command: "Find N businesses around X" launches a real discovery pipeline job', async () => {
  const site = await stub(() => ({ text: OLD_SITE }));
  const osm = await stub(osmStubHandler([{ type: 'node', id: 7, tags: { name: 'Hamilton Grill', amenity: 'restaurant', website: `${site.url}/`, phone: '905-555-0100' } }]));
  process.env.NOMINATIM_URL = osm.url;
  process.env.OVERPASS_URL = `${osm.url}/api/interpreter`;
  try {
    const { data } = await api('/api/commands', { text: 'Find 3 restaurants around Hamilton that need websites' });
    assert.equal(data.intent, 'find_businesses');
    assert.equal(data.response.kind, 'job');
    const job = await waitForJob(data.response.jobId);
    assert.equal(job.status, 'done', job.error);
    assert.equal(job.result.summary.discovered, 1);
    assert.ok(job.steps.some((s) => /Researching Hamilton Grill/.test(s.text)));
    const hist = await api('/api/commands');
    assert.equal(hist.data[0].text, 'Find 3 restaurants around Hamilton that need websites');
  } finally { await site.close(); await osm.close(); }
});

test('command: unresponsive, today summary, approvals, status, unknown', async () => {
  const { id } = crm.upsertBusiness({ name: 'Silent Co', email: 's@silent.test' });
  crm.setStage(id, 'contacted');
  getDb().prepare("INSERT INTO messages (business_id, direction, channel, created_at) VALUES (?, 'outbound', 'email', datetime('now','-5 days'))").run(id);
  const u = await runCommand("Show me all clients who haven't responded");
  assert.equal(u.response.kind, 'table');
  assert.equal(u.response.rows[0].name, 'Silent Co');
  const t = await runCommand('Show me everything you accomplished today');
  assert.equal(t.response.kind, 'summary');
  assert.equal(t.response.items.find((i) => i.label === 'Leads discovered').value, 1);
  const a = await runCommand('What needs my approval?');
  assert.match(a.response.text, /Nothing is waiting/);
  const m = await runCommand('Create a marketing campaign for LTGPeak');
  assert.equal(m.response.kind, 'error', 'marketing is honest about needing Claude');
  assert.match(m.response.text, /ANTHROPIC_API_KEY/);
  const x = await runCommand('make me a sandwich');
  assert.equal(x.intent, null);
  assert.ok(x.response.suggestions.length);
  const b = await runCommand('Build a demo for this restaurant', { businessId: id });
  assert.equal(b.response.kind, 'job');
  await waitForJob(b.response.jobId);
  assert.equal(parseCommand('Build a demo for #12').args.target, '#12');
});

test('notifications: generated from real events, prioritized, prefs respected', () => {
  crm.upsertBusiness({ name: 'N Co' });
  requestApproval('send_outreach', { campaignId: 999 }, 'Email to N Co');
  log('jiraiya', 'business_researched', 'business', 1, { score: 85 });
  log('jiraiya', 'business_researched', 'business', 1, { score: 30 });
  const items = listNotifications();
  assert.ok(items.some((n) => n.kind === 'approval' && n.priority === 'high'));
  assert.equal(items.filter((n) => n.kind === 'opportunity').length, 1, 'only hot leads notify');
  setPrefs({ enabled: { opportunity: false } });
  log('jiraiya', 'business_researched', 'business', 1, { score: 90 });
  assert.equal(listNotifications().filter((n) => n.kind === 'opportunity').length, 1);
  assert.ok(unreadCounts().total >= 2);
  assert.throws(() => setPrefs({ smsMinPriority: 'loud' }), /smsMinPriority/);
});

test('critical notifications escalate to Twilio SMS + call when configured', async () => {
  const tw = await stub((c) => ({ json: { sid: c.url.includes('Calls') ? 'CA1' : 'SM1' } }));
  Object.assign(process.env, { TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 'tok', TWILIO_FROM_NUMBER: '+15550001', OWNER_PHONE: '+15550002', TWILIO_API_URL: tw.url });
  try {
    setPrefs({ smsMinPriority: 'critical', callOnCritical: true });
    log('itachi', 'site_down', 'site', 1, { url: 'https://client.test', error: 'timeout' });
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(tw.calls.length, 2);
    const sms = tw.calls.find((c) => c.url.endsWith('/Messages.json'));
    assert.equal(sms.headers.authorization, 'Basic ' + Buffer.from('AC1:tok').toString('base64'));
    assert.match(new URLSearchParams(sms.raw).get('Body'), /client website is down/i);
    assert.match(sms.url, /\/2010-04-01\/Accounts\/AC1\//);
    log('jiraiya', 'business_researched', 'business', 1, { score: 99 });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(tw.calls.length, 2, 'high priority does not page when threshold is critical');
  } finally { await tw.close(); }
});

test('scheduler runs due schedules as jobs and reschedules', async () => {
  const s = createSchedule({ kind: 'followups', everyHours: 24, startAt: new Date(Date.now() - 1000).toISOString() });
  const jobs = tick();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].kind, 'followup_scan');
  await waitForJob(jobs[0].id);
  const after = listSchedules().find((x) => x.id === s.id);
  assert.ok(after.next_run_at > new Date().toISOString().replace('T', ' ').slice(0, 19));
  assert.equal(tick().length, 0);
  assert.throws(() => createSchedule({ kind: 'pipeline', everyHours: 24, args: {} }), /near/);
  assert.throws(() => createSchedule({ kind: 'followups', everyHours: 0.1 }), /everyHours/);
});

test('uptime monitor records checks, detects outage and recovery', async () => {
  let up = true;
  const s = await stub(() => (up ? { text: 'ok' } : { status: 503, text: 'down' }));
  try {
    const site = addSite({ url: s.url + '/' });
    assert.equal((await checkSite(site)).ok, true);
    up = false;
    assert.equal((await checkSite(site)).ok, false);
    up = true;
    await checkSite(site);
    const acts = getDb().prepare("SELECT action FROM activity WHERE action IN ('site_down','site_recovered') ORDER BY id").all().map((a) => a.action);
    assert.deepEqual(acts, ['site_down', 'site_recovered']);
    const ops = metrics.websiteOps();
    assert.equal(ops.sites[0].checks, 3);
    assert.ok(Math.abs(ops.uptime - 2 / 3) < 1e-9);
    assert.ok(listNotifications().some((n) => n.priority === 'critical' && n.kind === 'site'));
  } finally { await s.close(); }
});

test('CSV import (quoted fields, aliases) and global search', async () => {
  assert.deepEqual(parseCsv('a,"b, c","d ""q"""\n1,2,3'), [['a', 'b, c', 'd "q"'], ['1', '2', '3']]);
  const csv = 'Business Name,Type,City,Phone,Email,URL\n"Joe\'s Pizza, Inc",restaurant,Hamilton,905-555-0101,joe@pizza.test,joespizza.test\nNo Contact Cafe,cafe,Hamilton,,,\n,,,,,\n';
  const r = await fetch(base + '/api/import/leads', { method: 'POST', headers: { 'x-akamaru': '1', 'content-type': 'text/csv' }, body: csv }).then((x) => x.json());
  assert.deepEqual({ created: r.created, skipped: r.skipped }, { created: 2, skipped: 0 });
  const again = importLeadsCsv(csv);
  assert.equal(again.updated, 2, 're-import does not duplicate');
  assert.throws(() => importLeadsCsv('foo,bar\n1,2'), /No "name" column/);
  const hits = search('pizza');
  assert.equal(hits[0].type, 'Lead');
  assert.equal(hits[0].title, "Joe's Pizza, Inc");
  assert.deepEqual(search('a'), []);
});

test('agents reflect real activity; marketing offline without Claude', () => {
  log('orochimaru', 'demo_built', 'business', 1, {});
  log('orochimaru', 'vercel_deploy_failed', 'business', 1, { error: 'x' });
  const agents = Object.fromEntries(agentStatus().map((a) => [a.id, a]));
  assert.equal(agents.marketing.status, 'offline');
  assert.deepEqual(agents.marketing.missing, ['anthropic']);
  assert.equal(agents.web.status, 'attention');
  assert.equal(agents.web.performance.actions7d, 2);
  assert.equal(agents.web.performance.successRate, 0.5);
  assert.equal(agents.web.recent[0].text, 'Vercel deploy failed');
});

test('overview, system and app shell endpoints', async () => {
  const o = await api('/api/overview?range=7d');
  assert.equal(o.status, 200);
  assert.equal(o.data.revenue.range.key, '7d');
  assert.equal(o.data.agents.length, 6);
  const s = await api('/api/system');
  assert.equal(s.data.database.ok, true);
  assert.ok(s.data.process.rssMb > 0);
  const page = await fetch(base + '/');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self';/);
  const js = await fetch(base + '/assets/app.js');
  assert.equal(js.status, 200);
  assert.equal(js.headers.get('content-type'), 'text/javascript');
  assert.equal((await fetch(base + '/assets/..%2f..%2fpackage.json')).status, 400);
  const bad = await api('/api/jobs', { kind: 'rm_rf', args: {} });
  assert.equal(bad.status, 400);
});

test('review fix: drafts never count as MRR; projection counts each dollar once', () => {
  const a = crm.upsertBusiness({ name: 'Retainer Co' });
  finance.createInvoice({ businessId: a.id, description: 'draft retainer', amount: 500, status: 'draft', recurring: true });
  assert.equal(metrics.revenue('30d').mrr, 0, 'draft recurring invoice is not revenue');
  const b = crm.upsertBusiness({ name: 'Won Co' });
  crm.setStage(b.id, 'won');
  getDb().prepare('UPDATE leads SET value_cents = 300000 WHERE business_id = ?').run(b.id);
  finance.createInvoice({ businessId: b.id, description: 'care plan', amount: 300, status: 'sent', recurring: true });
  const r = metrics.revenue('30d');
  assert.equal(r.mrr, 0, 'unpaid recurring invoice is not MRR');
  assert.equal(r.projected.cents, 30000, 'only the $300 outstanding — no MRR double count, no invoiced won deal');
  // Paid plan + next cycle already billed → renewal not counted twice
  const c = crm.upsertBusiness({ name: 'Plan Co' });
  const today = new Date().toISOString().slice(0, 10);
  finance.createInvoice({ businessId: c.id, description: 'plan m1', amount: 100, status: 'paid', recurring: true, paidAt: today });
  assert.equal(metrics.revenue('30d').projected.components.renewals, 10000);
  finance.createInvoice({ businessId: c.id, description: 'plan m2', amount: 100, status: 'sent', recurring: true });
  const r2 = metrics.revenue('30d');
  assert.equal(r2.mrr, 10000);
  assert.equal(r2.projected.components.renewals, 0, 'next renewal already in outstanding');
  assert.equal(r2.projected.cents, 30000 + 10000);
});

test('review fix: conversion label uses the same population as the rate', () => {
  const { id } = crm.upsertBusiness({ name: 'Walk-in Win' });
  crm.setStage(id, 'won');
  const p = metrics.pipeline('30d');
  assert.equal(p.totals.clients, 1);
  assert.equal(p.totals.wonContacted, 0);
  assert.equal(p.totals.conversionRate, null);
});

test('review fix: oversized CSV rejected, long fields capped, job args whitelisted', async () => {
  const big = 'name\n' + Array.from({ length: 2001 }, (_, i) => `Biz ${i}`).join('\n');
  assert.throws(() => importLeadsCsv(big), /limit is 2000/);
  importLeadsCsv(`name,city\n${'x'.repeat(5000)},Hamilton`);
  assert.equal(getDb().prepare('SELECT MAX(LENGTH(name)) n FROM businesses').get().n, 300);
  const res = await api('/api/jobs', { kind: 'pipeline', args: { near: 'Hamilton', categories: Array(50).fill('cafe'), threshold: 0, provider: 'evil', limit: 999 } });
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.data.args).sort(), ['categories', 'limit', 'near']);
  assert.equal(res.data.args.categories.length, 10);
  assert.equal(res.data.args.limit, 50);
  await waitForJob(res.data.id).catch(() => {});
});
