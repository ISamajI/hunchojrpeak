// MARKETING INTELLIGENCE — drafts campaigns and content for LTGPeak itself.
// Requires Claude: there is no honest template fallback for original marketing strategy.
// Drafts are never published; publishing anything externally is a launch_campaign approval.
import { getDb, json, parse } from '../db.js';
import { log } from '../activity.js';
import { settings, INTEGRATIONS } from '../config.js';
import { claudeAvailable, generateJson } from '../integrations/claude.js';
import { pipeline, websiteOps } from '../metrics.js';

export const CONTENT_KINDS = {
  campaign: 'Marketing campaign',
  social: 'Social media posts',
  ad: 'Ad concepts',
  blog: 'Blog article',
  email: 'Email newsletter',
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'sections'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    sections: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['heading', 'content'], properties: { heading: { type: 'string' }, content: { type: 'string' } } },
    },
  },
};

export async function draftContent({ kind = 'campaign', brief = '' }, onStep = () => {}) {
  if (!CONTENT_KINDS[kind]) throw new Error(`kind must be one of ${Object.keys(CONTENT_KINDS).join(', ')}`);
  if (!claudeAvailable()) throw new Error(`Marketing Intelligence needs Claude. ${INTEGRATIONS.anthropic.connect}`);
  const agency = settings.agency;
  const p = pipeline('90d');
  const ops = websiteOps();
  onStep('Reviewing LTGPeak pipeline and portfolio data', 0.2);
  const facts = {
    agency: agency.name, owner: agency.owner, site: agency.site || null,
    offer: 'Custom websites for local small businesses, with a free personalized concept demo built before the first conversation.',
    demosBuiltToDate: ops.demosBuilt, clients: p.totals.clients, leadsInPipeline: p.totals.leads,
  };
  onStep(`Drafting ${CONTENT_KINDS[kind].toLowerCase()} with Claude`, 0.4);
  const out = await generateJson({
    system: `You are the marketing lead for ${agency.name}. Write ${CONTENT_KINDS[kind].toLowerCase()} content that is specific, practical and ready to use. Use ONLY the facts provided — never invent client names, testimonials, statistics, awards, prices or results. Where a real number or testimonial would help, write a clearly marked placeholder like [ADD REAL CLIENT RESULT].`,
    prompt: `Facts: ${JSON.stringify(facts)}\n\nOwner's brief: ${String(brief).slice(0, 2000) || '(none — propose the strongest angle)'}\n\nReturn a title, a 1-2 sentence summary, and sections (e.g. audience, positioning, channels, posts/ads/copy, schedule, success metrics to track).`,
    schema: SCHEMA,
    maxTokens: 8000,
    effort: 'medium',
  });
  onStep('Saving draft', 0.9);
  const r = getDb().prepare('INSERT INTO content_drafts (kind, title, brief, body, copy_source) VALUES (?,?,?,?,?)')
    .run(kind, out.title.slice(0, 200), brief, json(out), 'claude');
  const id = Number(r.lastInsertRowid);
  log('shikamaru', 'content_drafted', 'content', id, { kind, title: out.title });
  return { id, ...out };
}

export function listContent() {
  return getDb().prepare('SELECT * FROM content_drafts ORDER BY id DESC').all().map((r) => ({ ...r, body: parse(r.body) }));
}
