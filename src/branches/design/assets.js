// Imagery for a demo, in strict priority order:
//   1. The business's own Google Places photos (real, attributed)
//   2. Photos from the business's own website (real; only large, non-logo images)
//   3. AI concept imagery from the art-direction briefs (labeled as concept imagery)
// No stock photography, ever. With none of the above, the demo is composed without photos.
import fs from 'node:fs';
import path from 'node:path';
import { env, isConfigured } from '../../config.js';
import { safeGet } from '../../integrations/safeFetch.js';
import { photoUri } from '../../integrations/googlePlaces.js';
import { generateImage, imagegenProvider } from '../../integrations/imagegen.js';

/** Read pixel dimensions from PNG / JPEG / WebP headers without decoding. */
export function imageSize(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf.readUInt32BE(0) === 0x89504e47) return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type: 'jpg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { type: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { type: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return { type: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}

const MIN_WIDTH = 900;

async function download(url) {
  const res = await safeGet(url, { binary: true, maxBytes: 8_000_000, timeoutMs: 20000 });
  if (!res.ok || res.truncated) throw new Error(`HTTP ${res.status}${res.truncated ? ' (too large)' : ''}`);
  const size = imageSize(res.buffer);
  if (!size) throw new Error('not a PNG/JPEG/WebP image');
  return { buffer: res.buffer, ...size };
}

/**
 * @returns {Promise<{photos: Array<{file, width, height, alt, source, credit, slot}>, log: string[]}>}
 */
export async function gatherImagery({ business, research, briefs, outDir, onStep = () => {} }) {
  const dir = path.join(outDir, 'img');
  fs.mkdirSync(dir, { recursive: true });
  const photos = [];
  const log = [];
  const save = (img, name, meta) => {
    const file = `img/${name}.${img.type}`;
    fs.writeFileSync(path.join(outDir, file), img.buffer);
    photos.push({ file, width: img.width, height: img.height, ...meta });
  };

  // 1. Google Places photos
  const placePhotos = business.raw?.photos || [];
  if (placePhotos.length && isConfigured('google_places')) {
    onStep(`Pulling ${business.name}'s Google photos`);
    for (const [i, ph] of placePhotos.slice(0, 6).entries()) {
      try {
        const img = await download(await photoUri(ph.name));
        if (img.width < MIN_WIDTH) { log.push(`google photo ${i}: ${img.width}px, too small`); continue; }
        save(img, `google-${i + 1}`, { alt: `${business.name}`, source: 'google', credit: ph.attributions?.map((a) => a.name).filter(Boolean).join(', ') || 'Google Maps contributor' });
      } catch (e) { log.push(`google photo ${i}: ${e.message}`); }
    }
  }

  // 2. Their own website's imagery
  const siteImages = research?.site?.images || [];
  if (photos.length < 4 && siteImages.length) {
    onStep(`Collecting photography from ${business.name}'s website`);
    for (const [i, im] of siteImages.entries()) {
      if (photos.length >= 6) break;
      try {
        const img = await download(im.src);
        if (img.width < MIN_WIDTH || img.width / img.height > 4 || img.height / img.width > 3) { log.push(`site image ${i}: ${img.width}×${img.height}, rejected`); continue; }
        save(img, `site-${i + 1}`, { alt: im.alt || business.name, source: 'website', credit: `${business.name}` });
      } catch (e) { log.push(`site image ${i}: ${e.message}`); }
    }
  }

  // 3. AI concept imagery, art-directed per slot
  const provider = imagegenProvider();
  const budget = Math.max(0, Math.min(8, Number(env('AKAMARU_IMAGEGEN_MAX', 4))));
  if (provider && photos.length < 3 && budget) {
    const slots = briefs.filter((b) => photos.length < 1 || b.id !== 'hero').slice(0, budget);
    for (const b of slots) {
      onStep(`Generating ${b.id} imagery (${provider})`);
      try {
        const g = await generateImage({ prompt: b.prompt, aspect: b.aspect });
        const size = imageSize(g.buffer);
        if (!size) throw new Error('provider returned an unreadable image');
        save({ buffer: g.buffer, ...size }, `ai-${b.id}`, { alt: b.placement, source: 'ai', credit: `AI concept imagery (${provider})`, slot: b.id });
      } catch (e) { log.push(`ai ${b.id}: ${e.message}`); }
    }
  }
  return { photos, log };
}
