// KAKASHI — Business & Sales.
// Drafts personalized outreach grounded in real research; queues every send for
// owner approval; classifies replies and routes the lead.
import { getDb, json, parse } from '../db.js';
import { log } from '../activity.js';
import { env, settings, isConfigured } from '../config.js';
import { getBusiness, advanceStage, setStage, findBusinessByEmail, isSuppressed, suppress, normalizeEmail, TERMINAL } from '../crm.js';
import { contactViolations, untrusted, UNTRUSTED_NOTE } from './ai-guard.js';
import { registerExecutor, requestApproval } from '../decision.js';
import { claudeAvailable, generateJson } from '../integrations/claude.js';
import { sendEmail } from '../integrations/resend.js';
import { createOnboardingPlan } from './onboarding.js';

const OUTREACH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'body', 'followups'],
  properties: {
    subject: { type: 'string' },
    body: { type: 'string' },
    followups: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['day', 'subject', 'body'], properties: { day: { type: 'integer' }, subject: { type: 'string' }, body: { type: 'string' } } },
    },
  },
};

function observations(research) {
  const s = research?.site;
  const out = [];
  if (!research) return out;
  if (research.site_error || (!s && research.score?.reasons?.some((r) => r.includes('no website')))) {
    out.push(research.site_error ? 'your current website didn\'t load when I checked it' : 'there\'s no website listed for you yet');
  }
  if (s) {
    if (!s.mobile_viewport) out.push('your site isn\'t set up for phones, which is where most customers search');
    if (!s.https) out.push('your site doesn\'t use HTTPS, so browsers flag it as "Not secure"');
    if (s.copyright_year && new Date().getFullYear() - s.copyright_year >= 3) out.push(`the site footer still says ${s.copyright_year}`);
    if (!s.has_booking && research.score?.reasons?.some((r) => r.includes('booking'))) out.push('there\'s no way to book online');
    if (!s.description) out.push('Google has no description to show for your site');
  }
  return out.slice(0, 3);
}

export function fallbackOutreach(business, research, previewUrl, agency = settings.agency) {
  const obs = observations(research);
  const hook = obs.length ? `I was looking at ${business.name} online and noticed ${obs.join(', and ')}.` : `I came across ${business.name} and wanted to reach out.`;
  const body = `Hi ${business.name} team,

${hook}

So I went ahead and built you a free concept of what a modern site could look like — no strings attached:
${previewUrl}

It's built to load fast on phones and make it one tap to call${/hair|barber|beauty|salon|nail/i.test(business.category || '') ? ' or book' : ''}. If you like it, I can make it yours and get it live quickly. If not, no worries at all.

Would you be open to a quick 10-minute call this week?

${agency.owner}
${agency.name}${agency.phone ? `\n${agency.phone}` : ''}${agency.site ? `\n${agency.site}` : ''}`;
  return {
    subject: `I built ${business.name} a free website concept`,
    body,
    followups: [
      { day: 3, subject: `Re: ${business.name} website concept`, body: `Hi again — just making sure this didn't get buried. Here's the concept I made for ${business.name}: ${previewUrl}\n\nHappy to tweak anything.\n\n${agency.owner}` },
      { day: 7, subject: `Last note about your website concept`, body: `I'll leave it here — the preview stays up for a little while if you want to take a look: ${previewUrl}\n\nIf the timing's not right, just reply "no thanks" and I won't follow up.\n\n${agency.owner}` },
    ],
  };
}

async function aiOutreach(business, research, previewUrl) {
  const agency = settings.agency;
  return generateJson({
    system: `${UNTRUSTED_NOTE}\n\nYou are Kakashi, the sales lead at ${agency.name}, a small web design agency run by ${agency.owner}. Write a short, human cold email (under 140 words) to a local business owner offering a free concept website you already built. Reference ONLY the specific observations provided — never invent facts, stats, competitors, or prices. No hype words, no fake urgency. Plain text. Include the preview URL exactly once in the first email. Sign as ${agency.owner}, ${agency.name}. Also write 2 shorter follow-ups for day 3 and day 7; the last one must offer to stop following up.`,
    prompt: `${untrusted('business', { name: business.name, category: business.category, city: business.city })}\nObservations (from our own audit): ${JSON.stringify(observations(research))}\n${untrusted('research_summary', research?.ai?.summary || 'n/a')}\nTrusted preview URL: ${previewUrl}`,
    schema: OUTREACH_SCHEMA,
    maxTokens: 3000,
    effort: 'low',
  });
}

/** CAN-SPAM footer appended at send time, so drafts stay clean. */
export function complianceFooter() {
  const addr = env('OUTREACH_BUSINESS_ADDRESS', '');
  return `\n\n--\n${settings.agency.name}${addr ? ` · ${addr}` : ''}\nReply "unsubscribe" and you won't hear from us again.`;
}

export async function draftOutreach(businessId) {
  const business = getBusiness(businessId);
  if (!business) throw new Error(`Business ${businessId} not found`);
  const db = getDb();
  const rRow = db.prepare('SELECT data FROM research WHERE business_id = ? ORDER BY id DESC LIMIT 1').get(businessId);
  const research = rRow ? parse(rRow.data) : null;
  const demo = db.prepare('SELECT * FROM demos WHERE business_id = ? AND preview_url IS NOT NULL ORDER BY version DESC LIMIT 1').get(businessId);
  if (!demo) throw new Error('Deploy a preview before drafting outreach');
  if (demo.deploy_provider === 'local' && !env('AKAMARU_PUBLIC_URL')) {
    log('kakashi', 'outreach_warning', 'business', businessId, { warning: 'Preview URL is local-only; the prospect cannot open it until Vercel or AKAMARU_PUBLIC_URL is configured.' });
  }
  let copy;
  let source = 'template';
  if (claudeAvailable()) {
    try {
      copy = await aiOutreach(business, research, demo.preview_url);
      if (!copy.body.includes(demo.preview_url)) throw new Error('AI draft omitted the preview URL');
      const agency = settings.agency;
      const all = [copy.subject, copy.body, ...copy.followups.flatMap((f) => [f.subject, f.body])].join('\n');
      const bad = contactViolations(all, { urls: [demo.preview_url, agency.site, business.website], phones: [agency.phone, business.phone], emails: [business.email] });
      if (bad.length) throw new Error(`AI draft rejected: ${bad.join('; ')}`);
      source = 'claude';
    } catch (e) {
      log('kakashi', 'ai_outreach_failed', 'business', businessId, { error: e.message });
      copy = null;
    }
  }
  if (!copy) copy = fallbackOutreach(business, research, demo.preview_url);
  // A new draft supersedes any earlier unsent outreach, so a recipient can never get duplicates.
  db.prepare("UPDATE approvals SET status = 'rejected', decided_by = 'akamaru', decided_at = datetime('now'), result = ? WHERE status = 'pending' AND action = 'send_outreach' AND json_extract(payload, '$.campaignId') IN (SELECT id FROM campaigns WHERE business_id = ? AND kind = 'outreach')")
    .run(json({ note: 'superseded by newer draft' }), businessId);
  db.prepare("UPDATE campaigns SET status = 'cancelled' WHERE business_id = ? AND kind = 'outreach' AND status IN ('draft','pending_approval')").run(businessId);
  const channel = business.email ? 'email' : business.phone ? 'phone' : 'manual';
  const r = db
    .prepare('INSERT INTO campaigns (business_id, channel, to_addr, subject, body, followups, copy_source, status) VALUES (?,?,?,?,?,?,?,?)')
    .run(businessId, channel, business.email || business.phone || null, copy.subject, copy.body, json(copy.followups), source, channel === 'email' ? 'pending_approval' : 'draft');
  const campaignId = Number(r.lastInsertRowid);
  log('kakashi', 'outreach_drafted', 'campaign', campaignId, { businessId, channel, source });
  let approval = null;
  if (channel === 'email') {
    if (isSuppressed(business.email)) {
      db.prepare("UPDATE campaigns SET status = 'blocked', error = 'recipient is on suppression list' WHERE id = ?").run(campaignId);
    } else {
      approval = requestApproval('send_outreach', { campaignId }, `Email "${copy.subject}" to ${business.name} <${business.email}>${source === 'claude' ? ' [AI-written — read before approving]' : ''}`);
    }
  }
  advanceStage(businessId, 'outreach_ready', 'kakashi');
  return { campaignId, channel, source, approvalId: approval?.id ?? null, ...copy };
}

async function sendCampaign({ campaignId }) {
  const db = getDb();
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!c) throw new Error(`Campaign ${campaignId} not found`);
  if (c.status !== 'pending_approval') throw new Error(`Campaign is ${c.status}; only pending campaigns can be sent`);
  if (c.channel !== 'email' || !normalizeEmail(c.to_addr)) throw new Error('Campaign has no valid email recipient');
  const lead = db.prepare('SELECT stage FROM leads WHERE business_id = ?').get(c.business_id);
  if (TERMINAL.includes(lead?.stage)) throw new Error(`Lead is ${lead.stage}; not sending`);
  if (isSuppressed(c.to_addr)) throw new Error('Recipient unsubscribed; not sending');
  if (!isConfigured('resend')) throw new Error('Resend is not connected (need RESEND_API_KEY, OUTREACH_FROM_EMAIL, OUTREACH_BUSINESS_ADDRESS)');
  try {
    const res = await sendEmail({ to: c.to_addr, subject: c.subject, text: c.body + complianceFooter(), replyTo: env('OUTREACH_REPLY_TO'), idempotencyKey: `akamaru-campaign-${c.id}` });
    db.prepare("UPDATE campaigns SET status = 'sent', provider_message_id = ?, sent_at = datetime('now') WHERE id = ?").run(res.id, campaignId);
    db.prepare("INSERT INTO messages (business_id, direction, channel, from_addr, subject, body) VALUES (?, 'outbound', 'email', ?, ?, ?)")
      .run(c.business_id, env('OUTREACH_FROM_EMAIL'), c.subject, c.body);
    if (c.kind === 'outreach') advanceStage(c.business_id, 'contacted', 'kakashi');
    log('kakashi', 'email_sent', 'campaign', campaignId, { to: c.to_addr, id: res.id });
    return { sent: true, providerMessageId: res.id };
  } catch (e) {
    db.prepare("UPDATE campaigns SET status = 'failed', error = ? WHERE id = ?").run(e.message, campaignId);
    throw e;
  }
}

registerExecutor('send_outreach', sendCampaign);
registerExecutor('send_reply', sendCampaign);

// ---------- Reply handling ----------

const OWNER_MARKER = '[OWNER:';
const INTENTS = ['interested', 'question', 'not_interested', 'unsubscribe', 'out_of_office', 'other'];

export function classifyHeuristic(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(unsubscribe|remove me|stop emailing|do not contact|don't contact)\b/.test(t)) return 'unsubscribe';
  if (/\b(out of (the )?office|on vacation|auto-?reply|automatic reply)\b/.test(t)) return 'out_of_office';
  if (/\b(not interested|no thanks|no thank you|we're good|we are good|pass)\b/.test(t)) return 'not_interested';
  if (/\b(interested|love it|looks great|let's talk|lets talk|call me|sounds good|yes|how much|price|pricing|cost)\b/.test(t)) {
    return /\b(how much|price|pricing|cost)\b/.test(t) && !/\b(interested|love|yes|let's talk)\b/.test(t) ? 'question' : 'interested';
  }
  if (t.includes('?')) return 'question';
  return 'other';
}

async function classify(text) {
  if (claudeAvailable()) {
    try {
      const r = await generateJson({
        system: 'Classify a reply to a cold outreach email from a web design agency. Return the single best intent.',
        prompt: `Reply:\n"""${String(text).slice(0, 4000)}"""`,
        schema: { type: 'object', additionalProperties: false, required: ['intent'], properties: { intent: { type: 'string', enum: INTENTS } } },
        maxTokens: 1000,
        effort: 'low',
      });
      if (INTENTS.includes(r.intent)) return { intent: r.intent, source: 'claude' };
    } catch { /* fall through */ }
  }
  return { intent: classifyHeuristic(text), source: 'heuristic' };
}

function draftReply(business, intent, agency = settings.agency) {
  if (intent === 'interested') {
    return {
      subject: `Re: ${business.name} website`,
      body: `Great to hear from you! Here are a couple of times that work for a quick 10-minute call — or just send me a time that's good for you and the best number to reach you.\n\nOn the call I'll walk through the concept, take your feedback, and give you a clear quote with no obligation.\n\n${agency.owner}\n${agency.name}`,
    };
  }
  if (intent === 'question') {
    return {
      subject: `Re: ${business.name} website`,
      body: `Thanks for the question! Happy to answer — [OWNER: answer their question here]. The easiest next step is a quick 10-minute call so I can give you an exact quote for what you need.\n\n${agency.owner}\n${agency.name}`,
    };
  }
  return null;
}

/** Ingest an inbound reply (from webhook or CLI). */
export async function handleInbound({ from, subject = '', text = '', spf, dkim }) {
  const email = String(from || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || null;
  const business = findBusinessByEmail(email);
  const { intent, source } = await classify(`${subject}\n${text}`);
  const db = getDb();
  const r = db
    .prepare("INSERT INTO messages (business_id, direction, channel, from_addr, subject, body, intent, intent_source) VALUES (?, 'inbound', 'email', ?, ?, ?, ?, ?)")
    .run(business?.id ?? null, email, subject, text, intent, source);
  const messageId = Number(r.lastInsertRowid);
  log('kakashi', 'reply_received', 'message', messageId, { businessId: business?.id ?? null, intent, source });
  const outcome = { messageId, businessId: business?.id ?? null, intent, intentSource: source, approvalId: null };
  if ((intent === 'unsubscribe' || intent === 'not_interested') && email) {
    suppress(email, `replied ${intent}`);
    db.prepare("UPDATE campaigns SET status = 'cancelled' WHERE to_addr = ? AND status IN ('draft','pending_approval')").run(email);
    db.prepare("UPDATE approvals SET status = 'rejected', decided_by = 'akamaru', decided_at = datetime('now'), result = ? WHERE status = 'pending' AND action IN ('send_outreach','send_reply') AND json_extract(payload, '$.campaignId') IN (SELECT id FROM campaigns WHERE to_addr = ?)")
      .run(json({ note: 'recipient unsubscribed' }), email);
  }
  // Sender authentication: if the provider reports SPF/DKIM failure, suppression is still honored (safe direction),
  // but a forged From must not change lead state or trigger a reply.
  const authFailed = [spf, dkim].some((v) => v != null && !/^pass$/i.test(String(v)));
  if (authFailed) {
    outcome.unauthenticated = true;
    log('kakashi', 'reply_unauthenticated', 'message', messageId, { spf, dkim });
    return outcome;
  }
  if (!business) return outcome;
  if (intent === 'unsubscribe') setStage(business.id, 'do_not_contact', 'kakashi', 'unsubscribed');
  else if (intent === 'not_interested') setStage(business.id, 'lost', 'kakashi', 'replied not interested');
  else if (intent === 'interested') advanceStage(business.id, 'interested', 'kakashi');
  else if (intent !== 'out_of_office') advanceStage(business.id, 'replied', 'kakashi');
  const reply = draftReply(business, intent);
  if (reply && business.email) {
    const needsOwner = reply.body.includes(OWNER_MARKER);
    const c = db
      .prepare("INSERT INTO campaigns (business_id, kind, channel, to_addr, subject, body, copy_source, status) VALUES (?, 'reply', 'email', ?, ?, ?, 'template', ?)")
      .run(business.id, business.email, reply.subject, reply.body, needsOwner ? 'draft' : 'pending_approval');
    outcome.replyCampaignId = Number(c.lastInsertRowid);
    if (!needsOwner) {
      outcome.approvalId = requestApproval('send_reply', { campaignId: outcome.replyCampaignId }, `Reply to ${business.name} (${intent})`).id;
    }
  }
  return outcome;
}

/** Owner edits a draft campaign and queues it for send approval. */
export function queueCampaign(campaignId, { subject, body } = {}) {
  const db = getDb();
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!c) throw new Error(`Campaign ${campaignId} not found`);
  if (!['draft', 'pending_approval'].includes(c.status)) throw new Error(`Campaign is ${c.status}; cannot queue`);
  const newSubject = subject ?? c.subject;
  const newBody = body ?? c.body;
  if (newBody.includes(OWNER_MARKER)) throw new Error('Draft still contains an [OWNER: ...] placeholder; edit it first');
  if (c.channel !== 'email' || !c.to_addr) throw new Error('Only email campaigns can be queued for sending');
  if (isSuppressed(c.to_addr)) throw new Error('Recipient is on the suppression list');
  db.prepare("UPDATE campaigns SET subject = ?, body = ?, status = 'pending_approval' WHERE id = ?").run(newSubject, newBody, campaignId);
  db.prepare("UPDATE approvals SET status = 'rejected', decided_by = 'akamaru', decided_at = datetime('now'), result = ? WHERE status = 'pending' AND json_extract(payload, '$.campaignId') = ?")
    .run(json({ note: 'superseded by edited draft' }), campaignId);
  const action = c.kind === 'reply' ? 'send_reply' : 'send_outreach';
  log('owner', 'campaign_edited', 'campaign', campaignId, {});
  return requestApproval(action, { campaignId, rev: Date.now() }, `Email "${newSubject}" to ${c.to_addr}`);
}

/** Owner marks a deal won → onboarding plan is generated autonomously. */
export function markWon(businessId) {
  setStage(businessId, 'won', 'owner');
  const tasks = createOnboardingPlan(businessId);
  setStage(businessId, 'onboarding', 'akamaru');
  return tasks;
}
