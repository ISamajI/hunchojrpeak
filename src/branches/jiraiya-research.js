// JIRAIYA — Research & Knowledge.
// Audits a business's real web presence and records verifiable findings only.
import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '../config.js';
import { getDb, json } from '../db.js';
import { log } from '../activity.js';
import { getBusiness, advanceStage, setScore, updateBusiness } from '../crm.js';
import { request } from '../integrations/http.js';
import { claudeAvailable, generateJson } from '../integrations/claude.js';
import { scoreOpportunity } from './clavo-score.js';

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** SSRF guard: research only fetches public internet hosts. */
export async function assertPublicUrl(url) {
  const u = new URL(url);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error(`Refusing non-http URL ${url}`);
  if (env('AKAMARU_ALLOW_PRIVATE_FETCH') === '1') return;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error(`Refusing to fetch private/internal address for ${u.hostname}`);
}

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Pure HTML analysis — exported for tests. */
export function analyzeHtml(html, { url, status, ms, bytes } = {}) {
  const lower = html.toLowerCase();
  const m = (re) => html.match(re)?.[1]?.trim() || null;
  const title = m(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = m(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || m(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const h1 = m(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const emails = [...new Set((html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
    .map((e) => e.toLowerCase())
    .filter((e) => !/\.(png|jpe?g|gif|webp|svg)$/.test(e) && !e.includes('example.') && !e.includes('sentry') && !e.includes('wixpress')))].slice(0, 5);
  const phones = [...new Set((strip(html).match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) || []).map((p) => p.trim()))].slice(0, 3);
  const socials = {};
  for (const [k, re] of Object.entries({
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+/i,
    facebook: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\-/]+/i,
    tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+/i,
    yelp: /https?:\/\/(?:www\.)?yelp\.com\/biz\/[A-Za-z0-9_\-]+/i,
  })) {
    const hit = html.match(re);
    if (hit) socials[k] = hit[0];
  }
  const generator = m(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*)["']/i);
  let platform = null;
  if (/wix\.com|wixstatic/.test(lower)) platform = 'Wix';
  else if (/squarespace/.test(lower)) platform = 'Squarespace';
  else if (/wp-content|wordpress/.test(lower)) platform = 'WordPress';
  else if (/cdn\.shopify|shopify/.test(lower)) platform = 'Shopify';
  else if (/godaddy|websitebuilder/.test(lower)) platform = 'GoDaddy Builder';
  else if (/weebly/.test(lower)) platform = 'Weebly';
  const years = (strip(html).match(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi) || [])
    .map((s) => Number(s.match(/(\d{4})(?!.*\d{4})/)?.[1]))
    .filter((y) => y > 1995 && y <= new Date().getFullYear() + 1);
  const textLength = strip(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')).length;
  return {
    url,
    status,
    response_ms: ms ?? null,
    page_bytes: bytes ?? html.length,
    https: url ? url.startsWith('https://') : null,
    title: title ? strip(title).slice(0, 200) : null,
    description: description ? description.slice(0, 300) : null,
    h1: h1 ? strip(h1).slice(0, 200) : null,
    emails,
    phones,
    socials,
    platform: platform || (generator ? generator.split(' ')[0] : null),
    mobile_viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    has_contact_form: /<form[\s\S]*?(email|message|contact)/i.test(html),
    has_booking: /(book now|book online|schedule|appointment|booksy|vagaro|square\.site|calendly|squareup\.com\/appointments|styleseat|fresha)/i.test(html),
    has_online_ordering: /(order online|doordash|ubereats|grubhub|toasttab|chownow)/i.test(html),
    has_analytics: /(googletagmanager|google-analytics|gtag\(|fbq\()/i.test(html),
    has_schema_org: /application\/ld\+json/i.test(html),
    copyright_year: years.length ? Math.max(...years) : null,
    text_length: textLength,
  };
}

async function fetchSite(url) {
  await assertPublicUrl(url);
  const res = await request(url, { timeoutMs: 15000, headers: { accept: 'text/html,*/*' } });
  if (res.url && res.url !== url) await assertPublicUrl(res.url);
  return analyzeHtml(res.text, { url: res.url || url, status: res.status, ms: res.ms, bytes: res.bytes });
}

const SYNTHESIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'pitch_angles', 'recommended_sections', 'tone'],
  properties: {
    summary: { type: 'string' },
    pitch_angles: { type: 'array', items: { type: 'string' } },
    recommended_sections: { type: 'array', items: { type: 'string' } },
    tone: { type: 'string' },
  },
};

async function synthesize(business, site, score) {
  if (!claudeAvailable()) return null;
  try {
    return await generateJson({
      system: 'You are Jiraiya, the research analyst for LTGPeak, a web design agency. Use ONLY the facts provided. Never invent reviews, awards, years in business, or services that are not in the data. Keep it concise.',
      prompt: `Business: ${JSON.stringify({ name: business.name, category: business.category, city: business.city, address: business.address, phone: business.phone, website: business.website, extra: business.raw })}\n\nWebsite audit: ${JSON.stringify(site)}\n\nOpportunity score: ${JSON.stringify(score)}\n\nWrite: a 2-3 sentence summary of their current web presence, 3 specific pitch angles grounded in the audit findings, the website sections a demo should include, and the brand tone to use.`,
      schema: SYNTHESIS_SCHEMA,
      maxTokens: 4000,
      effort: 'low',
    });
  } catch (e) {
    log('jiraiya', 'synthesis_failed', 'business', business.id, { error: e.message });
    return null;
  }
}

export async function researchBusiness(businessId) {
  const business = getBusiness(businessId);
  if (!business) throw new Error(`Business ${businessId} not found`);
  let site = null;
  let siteError = null;
  if (business.website) {
    try {
      site = await fetchSite(business.website);
    } catch (e) {
      siteError = e.message;
    }
  }
  // Fill contact gaps from what the site itself publishes.
  if (site) {
    const patch = {};
    if (!business.email && site.emails[0]) patch.email = site.emails[0];
    if (!business.phone && site.phones[0]) patch.phone = site.phones[0];
    if (Object.keys(patch).length) updateBusiness(businessId, patch);
  }
  const fresh = getBusiness(businessId);
  const score = scoreOpportunity(fresh, site, siteError);
  const ai = await synthesize(fresh, site, score);
  const data = { site, site_error: siteError, score, ai, researched_at: new Date().toISOString() };
  const summary = ai?.summary || score.reasons.slice(0, 3).join('; ');
  getDb()
    .prepare('INSERT INTO research (business_id, data, score, summary) VALUES (?, ?, ?, ?)')
    .run(businessId, json(data), score.value, summary);
  setScore(businessId, score.value);
  advanceStage(businessId, 'researched', 'jiraiya');
  log('jiraiya', 'business_researched', 'business', businessId, { score: score.value, site_error: siteError, ai: !!ai });
  return data;
}
