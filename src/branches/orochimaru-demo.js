// OROCHIMARU — Systems Builder.
// Generates a personalized, self-contained static website demo for a business.
import fs from 'node:fs';
import path from 'node:path';
import { dataDir, settings } from '../config.js';
import { getDb } from '../db.js';
import { log } from '../activity.js';
import { getBusiness, advanceStage } from '../crm.js';
import { claudeAvailable, generateJson } from '../integrations/claude.js';
import { qaDemo } from './itachi-qa.js';

export const PRESETS = [
  { match: /barber|hairdresser|hair/i, key: 'barber', palette: ['#111111', '#c8a14a', '#f5f1e8'], services: ['Classic Cut', 'Skin Fade', 'Beard Trim & Line-Up', 'Hot Towel Shave'], cta: 'Book a Cut', vibe: 'Sharp cuts. Clean fades. No guesswork.' },
  { match: /beauty|nail|salon|spa/i, key: 'beauty', palette: ['#2b1d2a', '#d48ca8', '#fbf4f6'], services: ['Manicure', 'Pedicure', 'Gel & Acrylic Sets', 'Brows & Lashes'], cta: 'Book an Appointment', vibe: 'Look good. Feel better.' },
  { match: /restaurant|fast_food|food|kitchen|grill|pizza|taco/i, key: 'restaurant', palette: ['#1e1410', '#e0672c', '#fff8f0'], services: ['Dine In', 'Takeout', 'Catering', 'Daily Specials'], cta: 'See the Menu', vibe: 'Made fresh, served with care.' },
  { match: /cafe|coffee|bakery/i, key: 'cafe', palette: ['#2a1f17', '#b9824d', '#fbf7f2'], services: ['Espresso Drinks', 'Fresh Pastries', 'Breakfast', 'Catering Orders'], cta: 'Visit Us Today', vibe: 'Your neighborhood spot.' },
  { match: /car_repair|auto|mechanic|tire/i, key: 'auto', palette: ['#0f1720', '#e63946', '#f1f4f8'], services: ['Diagnostics', 'Brakes', 'Oil Changes', 'General Repair'], cta: 'Request Service', vibe: 'Honest work. Back on the road fast.' },
  { match: /dentist|clinic|doctor|health/i, key: 'health', palette: ['#0b2a3c', '#2a9d8f', '#f2fbfa'], services: ['Checkups', 'Cleanings', 'Consultations', 'New Patients Welcome'], cta: 'Request an Appointment', vibe: 'Care you can count on.' },
  { match: /fitness|gym/i, key: 'fitness', palette: ['#0d0d0d', '#39d353', '#f4f4f4'], services: ['Open Gym', 'Personal Training', 'Group Classes', 'Memberships'], cta: 'Start Today', vibe: 'Show up. Get stronger.' },
  { match: /clothes|clothing|shoes|boutique|jewelry/i, key: 'retail', palette: ['#141414', '#7b61ff', '#f7f6fb'], services: ['New Arrivals', 'Best Sellers', 'In-Store Pickup', 'Gift Cards'], cta: 'Shop Now', vibe: 'Style that speaks for itself.' },
  { match: /plumber|electrician|contractor|craft|roof|hvac/i, key: 'trades', palette: ['#13213c', '#fca311', '#f6f7fb'], services: ['Repairs', 'Installations', 'Inspections', 'Emergency Calls'], cta: 'Get a Free Quote', vibe: 'Done right the first time.' },
];
const DEFAULT_PRESET = { key: 'general', palette: ['#14213d', '#2f80ed', '#f6f8fc'], services: ['Our Services', 'Consultations', 'Custom Orders', 'Local Delivery'], cta: 'Contact Us', vibe: 'Proudly serving our community.' };

export function presetFor(category) {
  return PRESETS.find((p) => p.match.test(category || '')) || DEFAULT_PRESET;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const COPY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'subheadline', 'about', 'services', 'cta_label'],
  properties: {
    headline: { type: 'string' },
    subheadline: { type: 'string' },
    about: { type: 'string' },
    services: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['name', 'description'], properties: { name: { type: 'string' }, description: { type: 'string' } } },
    },
    cta_label: { type: 'string' },
  },
};

export function fallbackCopy(business, preset) {
  const where = business.city ? ` in ${business.city}` : '';
  return {
    headline: business.name,
    subheadline: `${preset.vibe}${where ? ` Serving${where.replace(' in', '')}.` : ''}`,
    about: `${business.name} is a local ${String(business.category || 'business').replace(/_/g, ' ')}${where}. This concept site shows how ${business.name} could look online: fast on phones, easy to find on Google, and one tap away from a call or booking.`,
    services: preset.services.map((name) => ({ name, description: '' })),
    cta_label: preset.cta,
  };
}

async function aiCopy(business, research, preset) {
  return generateJson({
    system: 'You are Orochimaru, the website copywriter for LTGPeak. Write punchy, specific homepage copy for a small local business concept demo. Use ONLY facts given. Do NOT invent reviews, testimonials, awards, prices, years in business, staff names, or guarantees. Services must be typical for the business category and phrased generically. Keep headline under 8 words, subheadline under 20 words, about under 70 words, 4 services with descriptions under 18 words.',
    prompt: `Business: ${JSON.stringify({ name: business.name, category: business.category, city: business.city, address: business.address })}\nResearch summary: ${research?.ai?.summary || research?.score?.reasons?.join('; ') || 'n/a'}\nRecommended tone: ${research?.ai?.tone || preset.vibe}\nDefault services for this category: ${preset.services.join(', ')}`,
    schema: COPY_SCHEMA,
    maxTokens: 3000,
    effort: 'low',
  });
}

export function renderDemo(business, copy, preset, agency = settings.agency) {
  const [dark, accent, light] = preset.palette;
  const tel = business.phone ? business.phone.replace(/[^\d+]/g, '') : null;
  const hours = business.raw?.tags?.opening_hours || business.raw?.opening_hours || null;
  const mapUrl = business.lat != null && business.lon != null
    ? `https://www.openstreetmap.org/?mlat=${business.lat}&mlon=${business.lon}#map=18/${business.lat}/${business.lon}`
    : business.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${business.address}`)}` : null;
  const ctaHref = tel ? `tel:${tel}` : business.email ? `mailto:${business.email}` : '#contact';
  const services = (copy.services || []).slice(0, 6).map((s) => `
        <article class="card"><h3>${esc(s.name)}</h3>${s.description ? `<p>${esc(s.description)}</p>` : ''}</article>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(business.name)}${business.city ? ` | ${esc(business.city)}` : ''}</title>
<meta name="description" content="${esc(copy.subheadline)}">
<style>
:root{--dark:${dark};--accent:${accent};--light:${light}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--dark);background:var(--light);line-height:1.6}
.demo-bar{background:var(--accent);color:#fff;text-align:center;font-size:.85rem;padding:.4rem 1rem}
header{background:var(--dark);color:#fff;padding:1rem 1.25rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
header strong{font-size:1.15rem;letter-spacing:.02em}header a{color:#fff;text-decoration:none;font-weight:600}
.hero{background:linear-gradient(160deg,var(--dark) 0%,var(--dark) 55%,var(--accent) 140%);color:#fff;padding:5rem 1.25rem 4rem;text-align:center}
.hero h1{font-size:clamp(2rem,7vw,3.5rem);margin:0 0 .75rem;line-height:1.1}.hero p{font-size:1.15rem;max-width:40rem;margin:0 auto 2rem;opacity:.9}
.btn{display:inline-block;background:var(--accent);color:#fff;padding:.9rem 1.8rem;border-radius:999px;font-weight:700;text-decoration:none}
.btn:focus-visible,a:focus-visible{outline:3px solid #fff;outline-offset:3px}
section{padding:3.5rem 1.25rem;max-width:68rem;margin:0 auto}h2{font-size:1.8rem;margin:0 0 1.5rem}
.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}
.card{background:#fff;border-radius:14px;padding:1.4rem;box-shadow:0 2px 14px rgba(0,0,0,.06);border-top:4px solid var(--accent)}.card h3{margin:0 0 .4rem}.card p{margin:0;color:#444}
.contact{background:#fff;border-radius:14px;padding:1.5rem;box-shadow:0 2px 14px rgba(0,0,0,.06)}.contact a{color:var(--dark);font-weight:600}
footer{background:var(--dark);color:#ccc;text-align:center;padding:2rem 1rem;font-size:.85rem}footer a{color:#fff}
.sticky-cta{position:fixed;bottom:1rem;right:1rem;box-shadow:0 6px 20px rgba(0,0,0,.25)}@media(min-width:900px){.sticky-cta{display:none}}
</style>
</head>
<body>
<div class="demo-bar">Concept preview designed by ${esc(agency.name)} for ${esc(business.name)} — not the official site.</div>
<header><strong>${esc(business.name)}</strong>${tel ? `<a href="tel:${esc(tel)}">${esc(business.phone)}</a>` : ''}</header>
<main>
<div class="hero">
  <h1>${esc(copy.headline)}</h1>
  <p>${esc(copy.subheadline)}</p>
  <a class="btn" href="${esc(ctaHref)}">${esc(copy.cta_label)}</a>
</div>
<section id="services"><h2>What We Offer</h2><div class="grid">${services}
</div></section>
<section id="about"><h2>About ${esc(business.name)}</h2><p>${esc(copy.about)}</p></section>
<section id="contact"><h2>Visit &amp; Contact</h2><div class="contact">
  ${business.address ? `<p><strong>Address:</strong> ${esc(business.address)}</p>` : ''}
  ${tel ? `<p><strong>Phone:</strong> <a href="tel:${esc(tel)}">${esc(business.phone)}</a></p>` : ''}
  ${business.email ? `<p><strong>Email:</strong> <a href="mailto:${esc(business.email)}">${esc(business.email)}</a></p>` : ''}
  ${hours ? `<p><strong>Hours:</strong> ${esc(hours)}</p>` : ''}
  ${mapUrl ? `<p><a href="${esc(mapUrl)}" rel="noopener" target="_blank">Get directions</a></p>` : ''}
</div></section>
</main>
<a class="btn sticky-cta" href="${esc(ctaHref)}">${esc(copy.cta_label)}</a>
<footer>&copy; ${new Date().getFullYear()} ${esc(business.name)} · Concept by ${agency.site ? `<a href="${esc(agency.site)}">${esc(agency.name)}</a>` : esc(agency.name)}</footer>
</body>
</html>
`;
}

export async function buildDemo(businessId) {
  const business = getBusiness(businessId);
  if (!business) throw new Error(`Business ${businessId} not found`);
  const db = getDb();
  const row = db.prepare('SELECT data FROM research WHERE business_id = ? ORDER BY id DESC LIMIT 1').get(businessId);
  const research = row ? JSON.parse(row.data) : null;
  const preset = presetFor(business.category);
  let copy;
  let copySource = 'template';
  if (claudeAvailable()) {
    try {
      copy = await aiCopy(business, research, preset);
      copySource = 'claude';
    } catch (e) {
      log('orochimaru', 'ai_copy_failed', 'business', businessId, { error: e.message });
    }
  }
  if (!copy) copy = fallbackCopy(business, preset);
  let html = renderDemo(business, copy, preset);
  if (copySource === 'claude' && !qaDemo(html, business).passed) {
    log('orochimaru', 'ai_copy_rejected_by_qa', 'business', businessId, { failures: qaDemo(html, business).failures });
    copy = fallbackCopy(business, preset);
    copySource = 'template';
    html = renderDemo(business, copy, preset);
  }
  const version = (db.prepare('SELECT MAX(version) AS v FROM demos WHERE business_id = ?').get(businessId).v || 0) + 1;
  const dir = path.join(dataDir(), 'demos', business.slug, `v${version}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  const qa = qaDemo(html, business);
  const r = db
    .prepare('INSERT INTO demos (business_id, version, dir, copy_source, qa, qa_passed) VALUES (?, ?, ?, ?, ?, ?)')
    .run(businessId, version, dir, copySource, JSON.stringify(qa), qa.passed ? 1 : 0);
  const demoId = Number(r.lastInsertRowid);
  log('orochimaru', 'demo_built', 'business', businessId, { demoId, version, copySource });
  log('itachi', qa.passed ? 'demo_qa_passed' : 'demo_qa_failed', 'business', businessId, { demoId, failures: qa.failures });
  if (qa.passed) advanceStage(businessId, 'demo_built', 'orochimaru');
  return { demoId, version, dir, copySource, qa };
}
