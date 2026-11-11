import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, stub, OLD_SITE, MODERN_SITE } from './helpers.js';
import * as decision from '../src/decision.js';
import * as crm from '../src/crm.js';
import { analyzeHtml, researchBusiness, assertPublicUrl } from '../src/branches/jiraiya-research.js';
import { scoreOpportunity } from '../src/branches/clavo-score.js';
import { buildDemo, renderDemo, presetFor, fallbackCopy } from '../src/branches/orochimaru-demo.js';
import { qaDemo } from '../src/branches/itachi-qa.js';
import { _setClient } from '../src/integrations/claude.js';
import '../src/index.js';

beforeEach(() => { freshDb(); delete process.env.ANTHROPIC_API_KEY; _setClient(null); });

test('decision engine: autonomous vs owner approval, fail-safe on unknown', () => {
  for (const a of ['research_business', 'build_demo', 'deploy_preview', 'draft_outreach', 'classify_reply']) {
    assert.equal(decision.decide(a).mode, 'autonomous', a);
  }
  for (const a of ['send_outreach', 'publish_production', 'charge_payment', 'purchase', 'send_contract', 'launch_campaign']) {
    assert.equal(decision.decide(a).mode, 'approval', a);
  }
  assert.equal(decision.decide('delete_everything').mode, 'approval');
  assert.equal(decision.decide('deploy_preview', { production: true }).mode, 'approval');
});

test('approval queue: dedupe, approve runs executor, failures recorded, reject', async () => {
  let ran = 0;
  decision.registerExecutor('purchase', async (p) => { ran++; if (p.fail) throw new Error('card declined'); return { bought: p.item }; });
  const a = decision.requestApproval('purchase', { item: 'domain' }, 'Buy domain');
  assert.equal(decision.requestApproval('purchase', { item: 'domain' }, 'Buy domain').duplicate, true);
  const done = await decision.approve(a.id);
  assert.equal(done.status, 'executed');
  assert.deepEqual(done.result, { bought: 'domain' });
  await assert.rejects(decision.approve(a.id), /already executed/);
  const b = decision.requestApproval('purchase', { item: 'x', fail: true }, 'fail');
  const failed = await decision.approve(b.id);
  assert.equal(failed.status, 'failed');
  assert.match(failed.result.error, /card declined/);
  const c = decision.requestApproval('purchase', { item: 'y' }, 'nope');
  assert.equal(decision.reject(c.id, 'owner', 'too pricey').status, 'rejected');
  assert.equal(ran, 2);
});

test('crm: upsert by source_ref, unique slugs, forward-only stage advance', () => {
  const a = crm.upsertBusiness({ name: 'Joe Cuts', city: 'Houston', source: 'osm', source_ref: 'osm:1', website: 'joecuts.test' });
  const again = crm.upsertBusiness({ name: 'Joe Cuts', city: 'Houston', source: 'osm', source_ref: 'osm:1', phone: '555' });
  assert.equal(a.id, again.id);
  assert.equal(again.created, false);
  assert.equal(crm.getBusiness(a.id).website, 'https://joecuts.test/');
  assert.equal(crm.getBusiness(a.id).phone, '555');
  const b = crm.upsertBusiness({ name: 'Joe Cuts', city: 'Houston' });
  assert.equal(crm.getBusiness(b.id).slug, 'joe-cuts-houston-2');
  crm.advanceStage(a.id, 'demo_built');
  crm.advanceStage(a.id, 'researched');
  assert.equal(crm.leadDetail(a.id).lead.stage, 'demo_built');
  crm.setStage(a.id, 'lost');
  crm.advanceStage(a.id, 'contacted');
  assert.equal(crm.leadDetail(a.id).lead.stage, 'lost');
  assert.throws(() => crm.setStage(a.id, 'bogus'), /Unknown stage/);
  assert.equal(crm.normalizeWebsite('javascript:alert(1)'), null);
});

test('research: HTML audit extracts real signals', () => {
  const r = analyzeHtml(OLD_SITE, { url: 'http://joes.test/', status: 200 });
  assert.equal(r.title, "Joe's Barber Shop");
  assert.equal(r.platform, 'Wix');
  assert.equal(r.mobile_viewport, false);
  assert.equal(r.copyright_year, 2017);
  assert.deepEqual(r.emails, ['joe@joesbarber.test']);
  assert.equal(r.phones[0], '(713) 555-0199');
  assert.equal(r.socials.instagram, 'https://www.instagram.com/joesbarber');
  const m = analyzeHtml(MODERN_SITE, { url: 'https://elite.test/', status: 200 });
  assert.equal(m.mobile_viewport, true);
  assert.equal(m.has_booking, true);
  assert.equal(m.has_schema_org, true);
  assert.equal(m.has_contact_form, true);
});

test('scoring: no website > outdated site > modern site; unreachable leads penalized', () => {
  const biz = { category: 'hairdresser', phone: '1' };
  const none = scoreOpportunity({ ...biz, website: null }, null, null);
  const old = scoreOpportunity({ ...biz, website: 'x' }, analyzeHtml(OLD_SITE, { url: 'http://x/', status: 200 }), null);
  const modern = scoreOpportunity({ ...biz, website: 'x' }, analyzeHtml(MODERN_SITE, { url: 'https://x/', status: 200, ms: 100 }), null);
  assert.ok(none.value > modern.value && old.value > modern.value, JSON.stringify({ none, old, modern }));
  assert.ok(modern.value < 40);
  assert.ok(old.reasons.some((r) => r.includes('stale')));
  const unreachable = scoreOpportunity({ category: 'x', website: null }, null, null);
  assert.ok(unreachable.value < none.value);
});

test('research: fetches the live site, fills contact gaps, advances stage', async () => {
  const site = await stub(() => ({ text: OLD_SITE }));
  try {
    const { id } = crm.upsertBusiness({ name: "Joe's Barber Shop", category: 'hairdresser', website: `${site.url}/` });
    const data = await researchBusiness(id);
    assert.equal(data.site.platform, 'Wix');
    assert.ok(data.score.value >= 40);
    const b = crm.getBusiness(id);
    assert.equal(b.email, 'joe@joesbarber.test');
    assert.equal(b.phone, '(713) 555-0199');
    assert.equal(crm.leadDetail(id).lead.stage, 'researched');
  } finally { await site.close(); }
});

test('research: unreachable website is recorded, not hidden', async () => {
  const { id } = crm.upsertBusiness({ name: 'Ghost', phone: '1', website: 'http://127.0.0.1:1/' });
  const data = await researchBusiness(id);
  assert.ok(data.site_error);
  assert.ok(data.score.reasons.some((r) => r.includes('unreachable')));
});

test('SSRF guard blocks internal addresses unless explicitly allowed', async () => {
  delete process.env.AKAMARU_ALLOW_PRIVATE_FETCH;
  try {
    await assert.rejects(assertPublicUrl('http://127.0.0.1/'), /private/);
    await assert.rejects(assertPublicUrl('http://169.254.169.254/latest/meta-data'), /private/);
    await assert.rejects(assertPublicUrl('http://[::1]/'), /private/);
    await assert.rejects(assertPublicUrl('http://10.0.0.5/'), /private/);
    await assert.rejects(assertPublicUrl('file:///etc/passwd'), /non-http/);
  } finally { process.env.AKAMARU_ALLOW_PRIVATE_FETCH = '1'; }
});

test('demo: builds personalized site, passes QA, escapes hostile data', async () => {
  const { id } = crm.upsertBusiness({ name: 'Fade <script>alert(1)</script> Co', category: 'hairdresser', city: 'Houston', phone: '(713) 555-0142' });
  const out = await buildDemo(id);
  assert.equal(out.qa.passed, true, JSON.stringify(out.qa.failures));
  const fs = await import('node:fs');
  const html = fs.readFileSync(`${out.dir}/index.html`, 'utf8');
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('href="tel:7135550142"'));
  assert.ok(html.includes('Skin Fade'), 'barber preset used');
  assert.equal(crm.leadDetail(id).lead.stage, 'demo_built');
  const v2 = await buildDemo(id);
  assert.equal(v2.version, 2);
});

test('QA gate rejects fabricated social proof, scripts, and placeholders', () => {
  const biz = { name: 'Acme', phone: '5551234567' };
  const preset = presetFor('');
  const good = renderDemo(biz, fallbackCopy(biz, preset), preset);
  assert.equal(qaDemo(good, biz).passed, true);
  const fake = renderDemo(biz, { ...fallbackCopy(biz, preset), about: 'Rated 5 stars with 300 reviews!' }, preset);
  assert.deepEqual(qaDemo(fake, biz).failures, ['no fabricated social proof']);
  assert.ok(qaDemo(good.replace('</body>', '<script src="x.js"></script></body>'), biz).failures.includes('no external scripts'));
  assert.ok(qaDemo(good.replace('</main>', '{{name}}</main>'), biz).failures.includes('no template placeholders'));
});

test('demo: Claude copy path is used when connected, and rejected by QA if it fabricates', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const requests = [];
  let about = 'A neighborhood barbershop focused on clean fades.';
  _setClient({ beta: { messages: { create: async (req) => {
    requests.push(req);
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ headline: 'Clean Fades, Houston', subheadline: 'Walk in sharp.', about, services: [{ name: 'Fade', description: 'Tight and clean.' }], cta_label: 'Call Now' }) }] };
  } } } });
  const { id } = crm.upsertBusiness({ name: 'Sharp Line', category: 'hairdresser', phone: '7135550000' });
  const ok = await buildDemo(id);
  assert.equal(ok.copySource, 'claude');
  assert.equal(requests[0].model, 'claude-opus-5-5');
  assert.equal(requests[0].output_config.format.type, 'json_schema');
  assert.deepEqual(requests[0].betas, ['server-side-fallback-2026-07-01']);
  about = 'Voted best in Houston with 500 reviews.';
  const bad = await buildDemo(id);
  assert.equal(bad.copySource, 'template');
  assert.equal(bad.qa.passed, true);
});
