// AI image generation for concept imagery. Two providers; whichever is configured is used.
// Images are labeled "concept imagery" on the demo — never passed off as the business's own photos.
import { env } from '../config.js';
import { requestJson, request } from './http.js';

export function imagegenProvider() {
  const p = env('IMAGE_PROVIDER', '');
  if (p === 'openai' && env('OPENAI_API_KEY')) return 'openai';
  if (p === 'replicate' && env('REPLICATE_API_TOKEN')) return 'replicate';
  return null;
}

const SIZES = { '16:9': '1536x1024', '4:5': '1024x1536', '1:1': '1024x1024' };

/** @returns {Promise<{buffer: Buffer, ext: string, provider: string}>} */
export async function generateImage({ prompt, aspect = '16:9' }) {
  const provider = imagegenProvider();
  if (!provider) throw new Error('No image provider configured (set OPENAI_API_KEY or REPLICATE_API_TOKEN)');
  if (provider === 'openai') {
    const base = env('OPENAI_API_URL', 'https://api.openai.com');
    const data = await requestJson(`${base}/v1/images/generations`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env('OPENAI_API_KEY')}` },
      body: { model: env('OPENAI_IMAGE_MODEL', 'gpt-image-1'), prompt, size: SIZES[aspect] || SIZES['16:9'], quality: 'high', n: 1 },
      timeoutMs: 180000,
    });
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI response contained no image');
    return { buffer: Buffer.from(b64, 'base64'), ext: 'png', provider };
  }
  const base = env('REPLICATE_API_URL', 'https://api.replicate.com');
  const model = env('REPLICATE_IMAGE_MODEL', 'black-forest-labs/flux-1.1-pro');
  const pred = await requestJson(`${base}/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env('REPLICATE_API_TOKEN')}`, prefer: 'wait' },
    body: { input: { prompt, aspect_ratio: aspect === '4:5' ? '4:5' : aspect === '1:1' ? '1:1' : '16:9', output_format: 'webp', output_quality: 90 } },
    timeoutMs: 180000,
  });
  const url = Array.isArray(pred?.output) ? pred.output[0] : pred?.output;
  if (!url) throw new Error(`Replicate prediction ${pred?.status || 'failed'}${pred?.error ? ': ' + pred.error : ''}`);
  const img = await request(url, { timeoutMs: 60000, maxBytes: 15_000_000, binary: true });
  if (!img.ok) throw new Error(`Could not download generated image (HTTP ${img.status})`);
  return { buffer: img.buffer, ext: 'webp', provider };
}
