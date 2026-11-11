// Integration health check: what's connected, what's missing, how to fix it.
import { allIntegrationStatus, env } from './config.js';
import { request } from './integrations/http.js';

const PROBES = {
  anthropic: () => env('AKAMARU_ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
  google_places: () => env('GOOGLE_PLACES_URL', 'https://places.googleapis.com'),
  openstreetmap: () => env('NOMINATIM_URL', 'https://nominatim.openstreetmap.org') + '/status',
  vercel: () => env('VERCEL_API_URL', 'https://api.vercel.com'),
  resend: () => env('RESEND_API_URL', 'https://api.resend.com'),
};

export async function runDoctor({ live = false } = {}) {
  const out = [];
  for (const s of allIntegrationStatus()) {
    const row = { key: s.key, label: s.label, configured: s.configured, missing: s.missing, powers: s.powers, fallback: s.fallback, connect: s.connect };
    if (live && PROBES[s.key]) {
      try {
        const res = await request(PROBES[s.key](), { timeoutMs: 6000 });
        row.reachable = true;
        row.probe = `HTTP ${res.status}`;
      } catch (e) {
        row.reachable = false;
        row.probe = e.message;
      }
    }
    out.push(row);
  }
  return out;
}
