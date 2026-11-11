import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, stub } from './helpers.js';
import * as crm from '../src/crm.js';
import * as decision from '../src/decision.js';
import { getDb } from '../src/db.js';
import { researchBusiness } from '../src/branches/jiraiya-research.js';
import { buildDemo } from '../src/branches/orochimaru-demo.js';
import { deployPreview } from '../src/branches/deploy.js';
import { draftOutreach, handleInbound, markWon, queueCampaign, classifyHeuristic } from '../src/branches/kakashi-outreach.js';

let resend;
beforeEach(async () => {
  freshDb();
  resend = await stub((c) => c.url === '/emails' && { json: { id: `em_${Date.now()}` } });
  process.env.RESEND_API_URL = resend.url;
});
afterEach(async () => {
  await resend.close();
  for (const k of ['RESEND_API_KEY', 'OUTREACH_FROM_EMAIL', 'OUTREACH_BUSINESS_ADDRESS', 'RESEND_API_URL']) delete process.env[k];
});

function connectResend() {
  process.env.RESEND_API_KEY = 'rk';
  process.env.OUTREACH_FROM_EMAIL = 'Henry <henry@ltgpeak.test>';
  process.env.OUTREACH_BUSINESS_ADDRESS = '123 Peak St, Houston, TX';
}

async function readyLead(extra = {}) {
  const { id } = crm.upsertBusiness({ name: 'Fresh Fade', category: 'hairdresser', city: 'Houston', email: 'owner@freshfade.test', phone: '7135550142', ...extra });
  await researchBusiness(id);
  await buildDemo(id);
  await deployPreview(id);
  return id;
}

test('outreach is drafted from research and queued — never sent autonomously', async () => {
  const id = await readyLead();
  const d = await draftOutreach(id);
  assert.equal(d.channel, 'email');
  assert.ok(d.approvalId);
  assert.match(d.body, /\/preview\/fresh-fade-houston\/v1\//);
  assert.match(d.body, /no website listed/);
  assert.equal(d.followups.length, 2);
  assert.equal(resend.calls.length, 0, 'nothing sent without approval');
  assert.equal(crm.leadDetail(id).lead.stage, 'outreach_ready');
  const a = decision.getApproval(d.approvalId);
  assert.equal(a.action, 'send_outreach');
  assert.match(a.preview, /To: owner@freshfade.test/);
});

test('approval sends via Resend with CAN-SPAM footer and advances to contacted', async () => {
  connectResend();
  const id = await readyLead();
  const d = await draftOutreach(id);
  const r = await decision.approve(d.approvalId, 'owner:test');
  assert.equal(r.status, 'executed', JSON.stringify(r.result));
  assert.equal(resend.calls.length, 1);
  assert.match(resend.calls[0].body.text, /123 Peak St/);
  assert.match(resend.calls[0].body.text, /unsubscribe/);
  assert.equal(crm.leadDetail(id).lead.stage, 'contacted');
  assert.equal(crm.leadDetail(id).campaigns[0].status, 'sent');
});

test('approval with Resend disconnected fails loudly instead of pretending', async () => {
  const id = await readyLead();
  const d = await draftOutreach(id);
  const r = await decision.approve(d.approvalId);
  assert.equal(r.status, 'failed');
  assert.match(r.result.error, /Resend is not connected/);
  assert.equal(resend.calls.length, 0);
  assert.equal(crm.leadDetail(id).lead.stage, 'outreach_ready');
});

test('lead without email gets a phone script draft, no approval request', async () => {
  const id = await readyLead({ email: undefined, name: 'Call Only' });
  const d = await draftOutreach(id);
  assert.equal(d.channel, 'phone');
  assert.equal(d.approvalId, null);
});

test('reply classification heuristics', () => {
  assert.equal(classifyHeuristic('Please unsubscribe me'), 'unsubscribe');
  assert.equal(classifyHeuristic('Not interested, thanks'), 'not_interested');
  assert.equal(classifyHeuristic('Love it! Call me tomorrow'), 'interested');
  assert.equal(classifyHeuristic('How much does this cost?'), 'question');
  assert.equal(classifyHeuristic('I am out of the office until Monday'), 'out_of_office');
});

test('interested reply → stage interested + reply queued for approval', async () => {
  const id = await readyLead();
  await draftOutreach(id);
  const r = await handleInbound({ from: 'Owner <OWNER@freshfade.test>', subject: 'Re: concept', text: 'Love it, lets talk!' });
  assert.equal(r.businessId, id);
  assert.equal(r.intent, 'interested');
  assert.ok(r.approvalId);
  assert.equal(crm.leadDetail(id).lead.stage, 'interested');
  assert.equal(decision.getApproval(r.approvalId).action, 'send_reply');
});

test('question reply → draft needs owner edit; placeholder can never be queued', async () => {
  const id = await readyLead();
  const r = await handleInbound({ from: 'owner@freshfade.test', text: 'How much would this cost?' });
  assert.equal(r.intent, 'question');
  assert.equal(r.approvalId, null);
  assert.throws(() => queueCampaign(r.replyCampaignId), /OWNER/);
  const q = queueCampaign(r.replyCampaignId, { body: 'Sites start at a flat fee — happy to walk you through it on a call.' });
  assert.equal(decision.getApproval(q.id).action, 'send_reply');
  assert.equal(crm.leadDetail(id).lead.stage, 'replied');
});

test('unsubscribe → suppressed, pending sends cancelled, do_not_contact', async () => {
  connectResend();
  const id = await readyLead();
  const d = await draftOutreach(id);
  await handleInbound({ from: 'owner@freshfade.test', text: 'Stop emailing me. Unsubscribe.' });
  assert.equal(crm.isSuppressed('owner@freshfade.test'), true);
  assert.equal(decision.getApproval(d.approvalId).status, 'rejected');
  assert.equal(crm.leadDetail(id).lead.stage, 'do_not_contact');
  const again = await draftOutreach(id);
  assert.equal(again.approvalId, null, 'suppressed recipients are never queued');
  assert.equal(getDb().prepare('SELECT status FROM campaigns WHERE id = ?').get(again.campaignId).status, 'blocked');
  assert.equal(resend.calls.length, 0);
});

test('unknown sender is logged without touching any lead', async () => {
  const r = await handleInbound({ from: 'stranger@else.test', text: 'Who is this?' });
  assert.equal(r.businessId, null);
  assert.ok(r.messageId);
});

test('won deal → onboarding plan with owner-gated binding tasks', async () => {
  const id = await readyLead();
  const tasks = markWon(id);
  assert.equal(tasks.length, 12);
  assert.ok(tasks.filter((t) => t.requires_approval).some((t) => /contract/i.test(t.title)));
  assert.ok(tasks.filter((t) => t.requires_approval).some((t) => /payment|deposit/i.test(t.title)));
  assert.equal(crm.leadDetail(id).lead.stage, 'onboarding');
  assert.equal(markWon(id).length, 12, 'idempotent');
});
