import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, stub, OLD_SITE, MODERN_SITE } from './helpers.js';
import * as decision from '../src/decision.js';
import * as crm from '../src/crm.js';
import { analyzeHtml, researchBusiness, assertPublicUrl } from '../src/branches/jiraiya-research.js';
import { scoreOpportunity } from '../src/branches/clavo-score.js';
import { buildDemo } from '../src/branches/orochimaru-demo.js';
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

test('demo: art-directed multi-file site, passes QA, escapes hostile data', async () => {
  const { id } = crm.upsertBusiness({ name: 'Fade <script>alert(1)</script> Co', category: 'hairdresser', city: 'Houston', phone: '(713) 555-0142' });
  const out = await buildDemo(id);
  assert.equal(out.qa.passed, true, JSON.stringify(out.qa.failures));
  const fs = await import('node:fs');
  const html = fs.readFileSync(`${out.dir}/index.html`, 'utf8');
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('href="tel:7135550142"'));
  assert.ok(html.includes('Skin Fade'), 'barber service set used');
  for (const f of ['css/site.css', 'css/theme.css', 'js/motion.js', 'js/gsap.min.js', 'js/ScrollTrigger.min.js']) assert.ok(fs.existsSync(`${out.dir}/${f}`), f);
  assert.ok(fs.readdirSync(`${out.dir}/fonts`).length >= 2, 'self-hosted fonts bundled');
  assert.equal(out.design.candidates.length, 3, 'three visual directions considered');
  assert.equal(new Set(out.design.candidates.map((c) => c.id)).size, 3);
  assert.match(out.design.rationale, /Selected/);
  assert.equal(out.design.briefs.length, 5);
  assert.match(out.design.briefs[0].prompt, /lens/);
  assert.ok(!/<section[^>]*id="reviews"/.test(html), 'no reviews section without verified reviews');
  assert.ok(!/id="gallery"/.test(html), 'no gallery without real photos');
  assert.equal(crm.leadDetail(id).lead.stage, 'demo_built');
  const v2 = await buildDemo(id);
  assert.equal(v2.version, 2);
});

test('creative director: industry-appropriate, distinct, accessible choices', async () => {
  const { directCreative, auditPalette, contrast } = await import('../src/branches/design/director.js');
  const { DIRECTIONS } = await import('../src/branches/design/directions.js');
  for (const d of DIRECTIONS) assert.equal(auditPalette(d.palette).ok, true, d.id);
  assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);
  const pick = (category, slug = 'x') => directCreative({ category, slug }, null, 0);
  assert.ok(['ember-trattoria', 'market-fresh', 'roastery'].includes(pick('restaurant').chosen.id));
  assert.ok(['precision-garage', 'trade-trust'].includes(pick('car_repair').chosen.id));
  assert.ok(['noir-atelier', 'street-grade'].includes(pick('hairdresser').chosen.id));
  const tone = directCreative({ category: 'hairdresser', slug: 'y' }, { ai: { tone: 'bold urban energetic' } }, 0);
  assert.equal(tone.chosen.id, 'street-grade', 'researched tone steers the choice');
});

test('QA gate: fabricated proof, external scripts, hotlinks, unverified ratings, missing assets', async () => {
  const { qaDemo } = await import('../src/branches/itachi-qa.js');
  const fs = await import('node:fs');
  const { id } = crm.upsertBusiness({ name: 'Acme', category: 'bakery', phone: '5551234567' });
  const out = await buildDemo(id);
  const biz = crm.getBusiness(id);
  const good = fs.readFileSync(`${out.dir}/index.html`, 'utf8');
  assert.equal(qaDemo(good, biz, { dir: out.dir }).passed, true, JSON.stringify(qaDemo(good, biz, { dir: out.dir }).failures));
  const f = (html) => qaDemo(html, biz, { dir: out.dir }).failures;
  assert.ok(f(good.replace('</main>', '<p>Rated 5 stars with 300 reviews!</p></main>')).includes('no fabricated social proof'));
  assert.ok(f(good.replace('</main>', '<div data-verified="google"><b>4.9</b> ★</div></main>')).includes('verified ratings match Google data'), 'a "verified" rating must match real data');
  assert.ok(f(good.replace('</body>', '<script src="https://cdn.evil/x.js"></script></body>')).includes('no external scripts'));
  assert.ok(f(good.replace('</body>', '<script>alert(1)</script></body>')).includes('no inline scripts'));
  assert.ok(f(good.replace('</main>', '<img src="https://stock.example/x.jpg" alt=""></main>')).includes('no hotlinked images'));
  assert.ok(f(good.replace('</main>', '<img src="img/missing.jpg" alt="x"></main>')).includes('all local assets exist'));
  assert.ok(f(good.replace('</main>', '{{name}}</main>')).includes('no template placeholders'));
  assert.ok(f(good.replace('</main>', '<b>NaN</b></main>')).includes('no template placeholders'));
  assert.ok(!f(good.replace('</main>', '<p>Oil &amp; Maintenance, financing</p></main>')).includes('no template placeholders'), 'words containing "nan" are fine');
});

test('verified Google reviews and real photos render, attributed', async () => {
  const fs = await import('node:fs');
  const zlib = await import('node:zlib');
  // a real 1200×800 PNG served as the business's own website photo
  const png = (w, hgt) => { const raw = Buffer.alloc((w * 3 + 1) * hgt, 90); const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(hgt, 4); ihdr[8] = 8; ihdr[9] = 2; const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(t), d])) >>> 0); return Buffer.concat([len, Buffer.from(t), d, crc]); }; return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); };
  const http = await import('node:http');
  const big = png(1200, 800), small = png(120, 120);
  const srv = http.createServer((req, res) => { if (req.url.startsWith('/p')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(req.url === '/p-small.png' ? small : big); } res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html><head><title>Joe</title></head><body><a href="https://booksy.com/en-us/123_joe">Book</a><img src="/p1.png" alt="Our chair"><img src="/p-small.png"><img src="/p2.png"><img src="/p3.png"><img src="/logo.png"></body></html>'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const { id } = crm.upsertBusiness({ name: 'Joe Barbers', category: 'hairdresser', website: `http://127.0.0.1:${srv.address().port}/`, phone: '7135550000',
      raw: { rating: 4.8, review_count: 212, maps_url: 'https://maps.google.com/?cid=1', reviews: [{ rating: 5, text: 'Best fade in town, every time.', author: 'Sam R.', when: '2 weeks ago' }] } });
    await researchBusiness(id);
    const out = await buildDemo(id);
    assert.equal(out.qa.passed, true, JSON.stringify(out.qa.failures));
    const html = fs.readFileSync(`${out.dir}/index.html`, 'utf8');
    assert.equal(out.design.imagery.filter((i) => i.source === 'website').length, 3, 'small images and logos rejected');
    assert.match(html, /id="gallery"/);
    assert.match(html, /id="reviews" data-verified="google"/);
    assert.match(html, /Best fade in town/);
    assert.match(html, /Sam R\./);
    assert.match(html, /href="https:\/\/booksy\.com\/en-us\/123_joe"/, 'their real booking link is the primary CTA');
    assert.match(html, /4\.8/);
  } finally { srv.close(); }
});

test('demo: Claude copy path is used when connected, and rejected by QA if it fabricates', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  const requests = [];
  let statement = 'A neighbourhood barbershop focused on clean fades and easy conversation.';
  _setClient({ beta: { messages: { create: async (req) => {
    requests.push(req);
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ headline: 'Clean Lines Only', subheadline: 'Walk in sharp.', statement, services: [{ name: 'Fade', description: 'Tight and clean.' }], cta_label: 'Book a Chair', steps: [{ k: 'Book', title: 'a', text: 'b' }, { k: 'Sit', title: 'c', text: 'd' }, { k: 'Go', title: 'e', text: 'f' }] }) }] };
  } } } });
  const { id } = crm.upsertBusiness({ name: 'Sharp Line', category: 'hairdresser', phone: '7135550000' });
  const ok = await buildDemo(id);
  assert.equal(ok.copySource, 'claude');
  assert.equal(requests[0].model, 'claude-opus-5-5');
  assert.equal(requests[0].output_config.format.type, 'json_schema');
  assert.deepEqual(requests[0].betas, ['server-side-fallback-2026-07-01']);
  statement = 'Voted best in Houston with 500 reviews.';
  const bad = await buildDemo(id);
  assert.equal(bad.copySource, 'template');
  assert.equal(bad.qa.passed, true);
});
