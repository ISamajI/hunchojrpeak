// OROCHIMARU — Systems Builder.
// Art-directed demo pipeline: research → creative director (3 directions → best) →
// imagery (real photos > AI concept imagery > photo-free composition) → copy → render →
// Itachi QA (static + real-browser at 7 breakpoints). Failing demos are never deployed.
import fs from 'node:fs';
import path from 'node:path';
import { dataDir, env, settings } from '../config.js';
import { getDb, json } from '../db.js';
import { log } from '../activity.js';
import { getBusiness, advanceStage } from '../crm.js';
import { claudeAvailable, generateJson } from '../integrations/claude.js';
import { imagegenProvider } from '../integrations/imagegen.js';
import { isConfigured } from '../config.js';
import { qaDemo, browserQa } from './itachi-qa.js';
import { contactViolations, untrusted, UNTRUSTED_NOTE } from './ai-guard.js';
import { directCreative, imageBriefs } from './design/director.js';
import { INDUSTRIES, voiceOf } from './design/industry.js';
import { gatherImagery } from './design/assets.js';
import { renderSite, templateCopy, esc } from './design/render.js';

export { esc };

const COPY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'subheadline', 'statement', 'services', 'cta_label', 'steps'],
  properties: {
    headline: { type: 'string' },
    subheadline: { type: 'string' },
    statement: { type: 'string' },
    services: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'description'], properties: { name: { type: 'string' }, description: { type: 'string' } } } },
    cta_label: { type: 'string' },
    steps: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['k', 'title', 'text'], properties: { k: { type: 'string' }, title: { type: 'string' }, text: { type: 'string' } } } },
  },
};

async function aiCopy(business, research, direction, industryKey) {
  const ind = INDUSTRIES[industryKey];
  const voice = voiceOf(direction);
  return generateJson({
    system: `${UNTRUSTED_NOTE}\n\nYou are the creative director and copywriter at LTGPeak, an agency known for art-directed, award-level websites. Write homepage copy for a concept demo in the "${direction.name}" direction (voice: ${voice}; mood: ${direction.mood.join(', ')}). Rules: use ONLY facts provided; never invent reviews, testimonials, awards, prices, years in business, staff names, statistics or guarantees; services must be typical for the category and phrased generically. Headline: 2–5 words, memorable, no business name. Subheadline under 16 words. Statement: an editorial brand introduction, 25–45 words, may include the business name and city. 4–5 services with descriptions under 18 words. 3 steps (one-word label k, short title, one sentence) describing booking → visit → result.`,
    prompt: `${untrusted('business', { name: business.name, category: business.category, city: business.city, address: business.address })}\n${untrusted('research_summary', research?.ai?.summary || research?.score?.reasons?.join('; ') || 'n/a')}\nTypical services for this category: ${ind.services.map((s) => s[0]).join(', ')}\nDefault call to action: ${ind.cta}`,
    schema: COPY_SCHEMA,
    maxTokens: 4000,
    effort: 'low',
  });
}

const browserQaEnabled = () => env('AKAMARU_BROWSER_QA', 'auto') !== '0';

export async function buildDemo(businessId, { onStep = () => {} } = {}) {
  const business = getBusiness(businessId);
  if (!business) throw new Error(`Business ${businessId} not found`);
  const db = getDb();
  const row = db.prepare('SELECT data FROM research WHERE business_id = ? ORDER BY id DESC LIMIT 1').get(businessId);
  const research = row ? JSON.parse(row.data) : null;
  const version = (db.prepare('SELECT MAX(version) AS v FROM demos WHERE business_id = ?').get(businessId).v || 0) + 1;
  const dir = path.join(dataDir(), 'demos', business.slug, `v${version}`);
  fs.mkdirSync(dir, { recursive: true });

  // 1. Creative direction (three candidates → strongest), anticipating available imagery.
  const potentialPhotos = (isConfigured('google_places') ? (business.raw?.photos || []).length : 0) + (research?.site?.images || []).length + (imagegenProvider() ? 3 : 0);
  onStep(`Developing three visual directions for ${business.name}`);
  const creative = directCreative(business, research, potentialPhotos);
  const direction = creative.chosen;
  const briefs = imageBriefs(business, direction, creative.industry);
  log('orochimaru', 'direction_selected', 'business', businessId, { direction: direction.id, rationale: creative.rationale });

  // 2. Imagery
  const { photos, log: imageLog } = await gatherImagery({ business, research, briefs, outDir: dir, onStep });

  // 3. Copy
  let copy = null;
  let copySource = 'template';
  if (claudeAvailable()) {
    onStep('Writing art-directed copy');
    try {
      copy = await aiCopy(business, research, direction, creative.industry);
      const bad = contactViolations(JSON.stringify(copy), { phones: [business.phone], emails: [business.email], urls: [] });
      if (bad.length) throw new Error(`AI copy rejected: ${bad.join('; ')}`);
      if (!copy.services?.length || copy.steps?.length !== 3) throw new Error('AI copy incomplete');
      copySource = 'claude';
    } catch (e) {
      log('orochimaru', 'ai_copy_failed', 'business', businessId, { error: e.message });
      copy = null;
    }
  }
  if (!copy) copy = templateCopy(business, direction, creative.industry);

  // 4. Render + static QA (AI copy that trips QA falls back to template copy)
  onStep(`Building the ${direction.name} site`);
  const render = () => renderSite({ business, direction, industryKey: creative.industry, copy, photos, agency: settings.agency, research, outDir: dir });
  let html = render();
  let qa = qaDemo(html, business, { dir, palette: direction.palette });
  if (!qa.passed && copySource === 'claude') {
    log('orochimaru', 'ai_copy_rejected_by_qa', 'business', businessId, { failures: qa.failures });
    copy = templateCopy(business, direction, creative.industry);
    copySource = 'template';
    html = render();
    qa = qaDemo(html, business, { dir, palette: direction.palette });
  }

  // 5. Real-browser QA at every breakpoint
  let browser = { ran: false, reason: 'disabled (AKAMARU_BROWSER_QA=0)', results: [] };
  if (qa.passed && browserQaEnabled()) {
    onStep('Itachi: testing at 375 → 1920px in a real browser');
    try {
      browser = await browserQa(dir);
    } catch (e) {
      browser = { ran: false, reason: `browser QA error: ${e.message}`, results: [] };
    }
    if (browser.ran && !browser.passed) {
      qa.passed = false;
      for (const r of browser.results.filter((x) => !x.ok)) qa.failures.push(`${r.width}px: ${r.fails.join(', ')}`);
    }
  }
  qa.browser = browser;

  const design = {
    direction: { id: direction.id, name: direction.name },
    industry: creative.industry,
    rationale: creative.rationale,
    candidates: creative.candidates,
    imagery: photos.map((p) => ({ file: p.file, source: p.source, credit: p.credit, width: p.width, height: p.height })),
    imageLog,
    briefs,
    copySource,
  };
  const r = db.prepare('INSERT INTO demos (business_id, version, dir, copy_source, qa, qa_passed, design) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(businessId, version, dir, copySource, json(qa), qa.passed ? 1 : 0, json(design));
  const demoId = Number(r.lastInsertRowid);
  log('orochimaru', 'demo_built', 'business', businessId, { demoId, version, copySource, direction: direction.name, photos: photos.length });
  log('itachi', qa.passed ? 'demo_qa_passed' : 'demo_qa_failed', 'business', businessId, { demoId, failures: qa.failures, browser: browser.ran ? `${browser.results.filter((x) => x.ok).length}/${browser.results.length} breakpoints` : browser.reason });
  if (qa.passed) advanceStage(businessId, 'demo_built', 'orochimaru');
  return { demoId, version, dir, copySource, qa, design };
}
