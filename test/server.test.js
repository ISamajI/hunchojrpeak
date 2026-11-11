import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, stub, OLD_SITE, MODERN_SITE, osmStubHandler } from './helpers.js';
import { createServer, startServer } from '../src/server.js';
import { runPipeline } from '../src/branches/tsunade-orchestrator.js';
import * as crm from '../src/crm.js';

let server;
let base;
async function boot() {
  server = createServer();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
}
beforeEach(async () => { freshDb(); await boot(); });
afterEach(async () => {
  await new Promise((ok) => server.close(ok));
  for (const k of ['AKAMARU_ADMIN_TOKEN', 'AKAMARU_WEBHOOK_SECRET', 'NOMINATIM_URL', 'OVERPASS_URL']) delete process.env[k];
});

const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-akamaru': '1', ...headers }, body: JSON.stringify(body) });

test('dashboard + API: add lead, process it, see approval, preview is served', async () => {
  assert.equal((await fetch(base + '/')).status, 200);
  const add = await (await post('/api/leads', { name: 'API Barbers', category: 'barber', email: 'a@api.test', phone: '7135550000' })).json();
  const report = await (await post(`/api/leads/${add.id}/process`, {})).json();
  assert.equal(report.stoppedAt, null, JSON.stringify(report));
  const approvals = await (await fetch(base + '/api/approvals')).json();
  assert.equal(approvals.length, 1);
  assert.match(approvals[0].preview, /a@api.test/);
  const previewPath = new URL(report.previewUrl).pathname;
  const page = await fetch(base + previewPath);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(await page.text(), /API Barbers/);
  const status = await (await fetch(base + '/api/status')).json();
  assert.equal(status.pendingApprovals, 1);
  assert.equal(status.pipeline.outreach_ready, 1);
  const rej = await (await post(`/api/approvals/${approvals[0].id}/reject`, { note: 'not yet' })).json();
  assert.equal(rej.status, 'rejected');
});

test('security: CSRF header, path traversal, host check', async () => {
  const noHeader = await fetch(base + '/api/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"x"}' });
  assert.equal(noHeader.status, 403);
  assert.equal((await fetch(base + '/preview/..%2f..%2fakamaru.db')).status, 400);
  const http = await import('node:http');
  const status = await new Promise((ok, bad) => http.get(base + '/api/status', { headers: { host: 'evil.test' } }, (r) => { r.resume(); ok(r.statusCode); }).on('error', bad));
  assert.equal(status, 403, 'DNS-rebinding host rejected');
});

test('admin token required when configured', async () => {
  process.env.AKAMARU_ADMIN_TOKEN = 'secret-token';
  await new Promise((ok) => server.close(ok));
  await boot();
  assert.equal((await fetch(base + '/api/status')).status, 401);
  assert.equal((await fetch(base + '/api/status', { headers: { authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await fetch(base + '/api/status', { headers: { authorization: 'Bearer secret-token' } })).status, 200);
  await assert.rejects(startServer({ port: 0, host: '0.0.0.0', ...(delete process.env.AKAMARU_ADMIN_TOKEN, {}) }), /Refusing to bind/);
});

test('inbound webhook requires secret and routes replies', async () => {
  assert.equal((await post('/api/inbound', { from: 'x@y.test', text: 'hi' })).status, 503);
  process.env.AKAMARU_WEBHOOK_SECRET = 'whsec';
  assert.equal((await post('/api/inbound', { from: 'x@y.test', text: 'hi' }, { 'x-akamaru-secret': 'nope' })).status, 401);
  const { id } = crm.upsertBusiness({ name: 'Hook Co', email: 'boss@hook.test' });
  const r = await (await post('/api/inbound', { from: 'boss@hook.test', text: 'Not interested.' }, { 'x-akamaru-secret': 'whsec' })).json();
  assert.equal(r.intent, 'not_interested');
  assert.equal(crm.leadDetail(id).lead.stage, 'lost');
});

test('FULL PIPELINE: discover → research → demo → QA → preview → outreach queued', async () => {
  const sites = await stub((c) => (c.url === '/old' ? { text: OLD_SITE } : c.url === '/modern' ? { text: MODERN_SITE } : { status: 404 }));
  const osm = await stub(osmStubHandler([
    { type: 'node', id: 1, tags: { name: 'No Site Barbers', shop: 'hairdresser', email: 'hi@nosite.test', phone: '713-555-0001' } },
    { type: 'node', id: 2, tags: { name: "Joe's Barber Shop", shop: 'hairdresser', website: `${sites.url}/old` } },
    { type: 'node', id: 3, tags: { name: 'Elite Cuts', shop: 'hairdresser', website: `${sites.url}/modern`, phone: '713-555-0003' } },
  ]));
  process.env.NOMINATIM_URL = osm.url;
  process.env.OVERPASS_URL = `${osm.url}/api/interpreter`;
  try {
    const { summary, leads } = await runPipeline({ category: 'barber', near: 'Houston, TX', limit: 5 });
    assert.equal(summary.discovered, 3);
    assert.equal(summary.errors, 0, JSON.stringify(leads, null, 1));
    const byName = Object.fromEntries(leads.map((l) => [l.name, l]));
    assert.ok(byName['No Site Barbers'].previewUrl);
    assert.ok(byName["Joe's Barber Shop"].previewUrl, 'outdated site gets a demo');
    assert.match(byName['Elite Cuts'].stoppedAt, /below threshold/, 'modern site is not pitched');
    assert.equal(summary.queuedForApproval, 2, 'email found on Joe\'s site is used for outreach');
    const joe = crm.getBusiness(byName["Joe's Barber Shop"].businessId);
    assert.equal(joe.email, 'joe@joesbarber.test');
    const res = await (await fetch(base + '/api/approvals')).json();
    assert.equal(res.length, 2);
    assert.ok(res.some((a) => /copyright|2017|phones/.test(a.preview)), 'pitch cites real findings');
  } finally { await sites.close(); await osm.close(); }
});
