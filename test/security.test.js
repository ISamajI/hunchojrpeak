// Regression tests for the Itachi security review findings.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, stub } from './helpers.js';
import * as crm from '../src/crm.js';
import * as decision from '../src/decision.js';
import { isBlockedIp, safeGet } from '../src/integrations/safeFetch.js';
import { researchBusiness } from '../src/branches/jiraiya-research.js';
import { buildDemo } from '../src/branches/orochimaru-demo.js';
import { deployPreview } from '../src/branches/deploy.js';
import { draftOutreach, handleInbound } from '../src/branches/kakashi-outreach.js';
import { processLead } from '../src/branches/tsunade-orchestrator.js';
import { contactViolations } from '../src/branches/ai-guard.js';
import { _setClient } from '../src/integrations/claude.js';

let resend;
beforeEach(async () => {
  freshDb();
  resend = await stub((c) => c.url === '/emails' && { json: { id: 'em_x' } });
  process.env.RESEND_API_URL = resend.url;
  process.env.RESEND_API_KEY = 'rk';
  process.env.OUTREACH_FROM_EMAIL = 'Henry <henry@ltgpeak.test>';
  process.env.OUTREACH_BUSINESS_ADDRESS = '1 Peak St';
});
afterEach(async () => {
  await resend.close();
  for (const k of ['RESEND_API_URL', 'RESEND_API_KEY', 'OUTREACH_FROM_EMAIL', 'OUTREACH_BUSINESS_ADDRESS', 'ANTHROPIC_API_KEY']) delete process.env[k];
  process.env.AKAMARU_ALLOW_PRIVATE_FETCH = '1';
  _setClient(null);
});

async function readyLead(extra = {}) {
  const { id } = crm.upsertBusiness({ name: 'Sec Barbers', category: 'hairdresser', email: 'boss@sec.test', phone: '7135550100', ...extra });
  await researchBusiness(id);
  await buildDemo(id);
  await deployPreview(id);
  return id;
}

test('SSRF: every IPv6 form embedding a private IPv4 is blocked; public IPs allowed', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '100.64.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255', '0.0.0.0',
    '::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', '::127.0.0.1', '64:ff9b::a9fe:a9fe', '2002:7f00:1::', 'fe90::1', 'fd00::1', 'ff02::1']) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111', '::ffff:8.8.8.8', '2002:0808:0808::']) {
    assert.equal(isBlockedIp(ip), false, ip);
  }
});

test('SSRF: the connect-time DNS check blocks hostnames resolving to private IPs', async () => {
  const s = await stub(() => ({ text: 'secret' }));
  delete process.env.AKAMARU_ALLOW_PRIVATE_FETCH;
  try {
    const port = new URL(s.url).port;
    await assert.rejects(safeGet(`http://localhost:${port}/`), /private\/internal/);
    assert.equal(s.calls.length, 0, 'no request reached the internal service');
  } finally { await s.close(); }
});

test('safeGet re-validates and caps redirects', async () => {
  const s = await stub((c) => (c.url === '/a' ? { status: 302, headers: { location: '/b' } } : c.url === '/b' ? { text: 'landed' } : { status: 302, headers: { location: '/loop' } }));
  try {
    const r = await safeGet(`${s.url}/a`);
    assert.equal(r.text, 'landed');
    assert.equal(r.url, `${s.url}/b`);
    await assert.rejects(safeGet(`${s.url}/loop`, { maxRedirects: 3 }), /Too many redirects/);
  } finally { await s.close(); }
});

test('re-processing a below-threshold lead never builds or pitches it', async () => {
  const { id } = crm.upsertBusiness({ name: 'Low', category: 'x', phone: '1' });
  const first = await processLead(id, { threshold: 101 });
  assert.match(first.stoppedAt, /below threshold/);
  const again = await processLead(id, { threshold: 101 });
  assert.match(again.stoppedAt, /below threshold/);
  assert.equal(crm.leadDetail(id).demos.length, 0);
});

test('re-drafting outreach supersedes the old draft: one pending send per lead', async () => {
  const id = await readyLead();
  const a = await draftOutreach(id);
  const b = await draftOutreach(id);
  assert.equal(decision.getApproval(a.approvalId).status, 'rejected');
  assert.equal(decision.listApprovals('pending').length, 1);
  assert.equal((await decision.approve(a.approvalId).catch((e) => e.message)).includes('already rejected'), true);
  assert.equal((await decision.approve(b.approvalId)).status, 'executed');
  assert.equal(resend.calls.length, 1);
  assert.equal(resend.calls[0].headers['idempotency-key'], `akamaru-campaign-${b.campaignId}`);
});

test('concurrent approvals execute exactly once', async () => {
  const id = await readyLead();
  const { approvalId } = await draftOutreach(id);
  const results = await Promise.allSettled([decision.approve(approvalId), decision.approve(approvalId)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(resend.calls.length, 1);
});

test('moving a lead to lost cancels its pending sends; terminal leads are never emailed', async () => {
  const id = await readyLead();
  const { approvalId, campaignId } = await draftOutreach(id);
  crm.setStage(id, 'lost', 'owner');
  assert.equal(decision.getApproval(approvalId).status, 'rejected');
  assert.equal(crm.leadDetail(id).campaigns.find((c) => c.id === campaignId).status, 'cancelled');
  assert.equal(resend.calls.length, 0);
});

test('"no thanks" reply suppresses the address, as the follow-up email promises', async () => {
  await readyLead();
  await handleInbound({ from: 'boss@sec.test', text: 'No thanks.' });
  assert.equal(crm.isSuppressed('boss@sec.test'), true);
});

test('spoofed reply (SPF/DKIM fail) cannot change lead state, but unsubscribe is honored', async () => {
  const id = await readyLead();
  const r = await handleInbound({ from: 'boss@sec.test', text: 'Love it, lets talk', spf: 'fail', dkim: 'none' });
  assert.equal(r.unauthenticated, true);
  assert.equal(r.approvalId, null);
  assert.equal(crm.leadDetail(id).lead.stage, 'preview_deployed');
  await handleInbound({ from: 'boss@sec.test', text: 'unsubscribe', spf: 'fail' });
  assert.equal(crm.isSuppressed('boss@sec.test'), true);
  assert.equal(crm.leadDetail(id).lead.stage, 'preview_deployed');
});

test('malformed or multi-recipient emails are never stored', () => {
  const { id } = crm.upsertBusiness({ name: 'Bad Mail', email: 'a@x.com;b@y.com' });
  assert.equal(crm.getBusiness(id).email, null);
  crm.updateBusiness(id, { email: 'mailto:Real@Shop.COM' });
  assert.equal(crm.getBusiness(id).email, 'real@shop.com');
  assert.equal(crm.normalizeEmail('x@y'), null);
});

test('AI guard: injected links/phones/emails are caught, trusted ones pass', () => {
  const trusted = { urls: ['https://ltgpeak.test', 'http://127.0.0.1:4317/preview/a/v1/'], phones: ['713-555-0100'], emails: ['boss@sec.test'] };
  assert.deepEqual(contactViolations('See http://127.0.0.1:4317/preview/a/v1/ or call (713) 555-0100. — ltgpeak.test', trusted), []);
  const bad = contactViolations('Visit evil.link/pay or call 800-555-9999 or mail scam@evil.test', trusted);
  assert.equal(bad.length, 3, bad.join(' | '));
});

test('AI outreach containing an injected link is rejected → safe template used', async () => {
  const id = await readyLead();
  process.env.ANTHROPIC_API_KEY = 'k';
  const preview = crm.leadDetail(id).demos[0].preview_url;
  _setClient({ beta: { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({
    subject: 'Your site', body: `Here: ${preview}. Also pay the deposit at https://evil.link/pay`, followups: [] }) }] }) } } });
  const d = await draftOutreach(id);
  assert.equal(d.source, 'template');
  assert.ok(!d.body.includes('evil.link'));
});
