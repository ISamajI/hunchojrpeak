// Creative director: three candidate directions per business → scored → strongest selected,
// with a written rationale. Also writes the photographic brief for every image slot.
import crypto from 'node:crypto';
import { DIRECTIONS } from './directions.js';
import { INDUSTRIES, industryOf } from './industry.js';

// ---------- WCAG contrast ----------
function rgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function lum(hex) {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Accessibility audit of a palette. Every pair used for text must pass. */
export function auditPalette(p) {
  const checks = [
    ['body text on background', contrast(p.ink, p.bg), 7],
    ['secondary text on background', contrast(p.muted, p.bg), 4.5],
    ['body text on surface', contrast(p.ink, p.surface), 4.5],
    ['button label on accent', contrast(p.onAccent, p.accent), 4.5],
    ['accent (large text/icons) on background', contrast(p.accent, p.bg), 3],
  ].map(([name, ratio, min]) => ({ name, ratio: Math.round(ratio * 100) / 100, min, ok: ratio >= min }));
  return { ok: checks.every((c) => c.ok), checks };
}

const seeded = (s) => parseInt(crypto.createHash('sha1').update(s).digest('hex').slice(0, 8), 16) / 0xffffffff;

/**
 * @param business  business row (with raw)
 * @param research  latest research data (site audit + optional AI tone)
 * @param photos    number of usable real/AI photos available
 */
export function directCreative(business, research, photos = 0) {
  const industry = industryOf(business.category);
  const toneWords = String(research?.ai?.tone || '').toLowerCase().split(/[^a-z-]+/).filter(Boolean);
  const scored = DIRECTIONS.map((d) => {
    const reasons = [];
    let score = 0;
    const fit = d.industries[industry] || 0;
    score += fit * 14;
    if (fit) reasons.push(`${fit >= 3 ? 'primary' : 'secondary'} fit for ${INDUSTRIES[industry].noun}s`);
    const toneHits = d.mood.filter((m) => toneWords.includes(m));
    if (toneHits.length) { score += toneHits.length * 6; reasons.push(`matches researched tone (${toneHits.join(', ')})`); }
    if (d.photoLed && photos >= 2) { score += 8; reasons.push('photo-led layout and real imagery available'); }
    if (d.photoLed && photos < 2) { score -= 6; reasons.push('photo-led but little imagery available'); }
    if (!d.photoLed && photos < 2) { score += 4; reasons.push('composed to stand without photography'); }
    const audit = auditPalette(d.palette);
    if (!audit.ok) { score -= 100; reasons.push('fails contrast audit'); }
    // Deterministic per-business variety, so two barbers in one city don't get the same site.
    const jitter = Math.round(seeded(`${business.slug}:${d.id}`) * 8);
    score += jitter;
    return { id: d.id, name: d.name, score, reasons, audit, direction: d };
  }).sort((a, b) => b.score - a.score);

  // Three DISTINCT candidates: different hero compositions where possible.
  const candidates = [];
  for (const s of scored) {
    if (candidates.length === 3) break;
    if (candidates.some((c) => c.direction.hero === s.direction.hero && c.direction.light === s.direction.light) && scored.filter((x) => !candidates.includes(x)).length > 3 - candidates.length) continue;
    candidates.push(s);
  }
  for (const s of scored) if (candidates.length < 3 && !candidates.includes(s)) candidates.push(s);
  const chosen = candidates[0];
  return {
    industry,
    chosen: chosen.direction,
    candidates: candidates.map((c) => ({ id: c.id, name: c.name, score: c.score, reasons: c.reasons, hero: c.direction.hero, light: !!c.direction.light, contrast: c.audit.checks })),
    rationale: `Selected “${chosen.name}” (${chosen.score} pts) over ${candidates.slice(1).map((c) => `“${c.name}” (${c.score})`).join(' and ')}: ${chosen.reasons.join('; ')}.`,
  };
}

/** Detailed photographic brief per image slot — used for AI generation and for the owner's own shoot. */
export function imageBriefs(business, direction, industryKey) {
  const ind = INDUSTRIES[industryKey];
  const p = direction.palette;
  const base = {
    grade: direction.grade,
    palette: `${p.bg} shadows, ${p.accent} accent, ${p.ink} highlights`,
    rules: 'photorealistic commercial photography, natural human proportions, no text, no logos, no signage, no watermarks, faces not identifiable',
  };
  const slot = (id, placement, subject, camera, lens, light, composition, aspect) => ({
    id, placement, aspect,
    prompt: `${subject}. Shot as ${camera}, ${lens}, ${light}. Composition: ${composition}. Colour grade: ${base.grade}; palette ${base.palette}. Atmosphere: ${direction.mood.slice(0, 3).join(', ')}. ${base.rules}.`,
  });
  return [
    slot('hero', 'Full-bleed hero behind the headline', ind.subjects.hero, 'a cinematic wide frame from slightly below eye level', '35mm lens at f/1.8 with shallow depth of field', 'motivated key light from frame right with soft falloff and gentle rim light', 'subject in the right third, generous dark negative space on the left for the headline', '16:9'),
    slot('story', 'Editorial image beside the brand introduction', ind.subjects.story, 'an editorial interior frame at eye level', '50mm lens at f/2.8', 'soft directional window light from the left', 'layered foreground detail with depth receding into the room', '4:5'),
    ...ind.subjects.services.slice(0, 3).map((s, i) => slot(`service-${i + 1}`, `Service showcase image ${i + 1}`, s, 'a tight detail shot', '85mm lens at f/2 macro-style', 'single soft key light with deep shadow', 'centered subject with clean background separation', '4:5')),
  ];
}
