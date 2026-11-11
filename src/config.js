// Configuration + integration registry.
// Every external integration is declared here with the env vars it needs,
// why it is needed, and how the owner connects it. `doctor` reads this.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let envLoaded = false;
export function loadEnv() {
  if (envLoaded) return;
  envLoaded = true;
  const envFile = process.env.AKAMARU_ENV_FILE || path.join(ROOT, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
}

export function env(name, fallback = undefined) {
  loadEnv();
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export function dataDir() {
  const dir = env('AKAMARU_DATA_DIR', path.join(ROOT, 'data'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const INTEGRATIONS = {
  anthropic: {
    label: 'Claude API (Anthropic)',
    vars: ['ANTHROPIC_API_KEY'],
    powers: 'AI research synthesis, personalized demo copy, outreach drafting, reply intent classification.',
    fallback: 'Deterministic rule-based copy and keyword reply classification built only from real research data.',
    connect: 'Create a key at https://console.anthropic.com/settings/keys and set ANTHROPIC_API_KEY in .env.',
  },
  google_places: {
    label: 'Google Places API (New)',
    vars: ['GOOGLE_PLACES_API_KEY'],
    powers: 'High-quality business discovery with phone, website, rating and hours.',
    fallback: 'OpenStreetMap (Overpass + Nominatim) discovery, which needs no key.',
    connect: 'Enable "Places API (New)" in Google Cloud Console, create an API key, set GOOGLE_PLACES_API_KEY.',
  },
  openstreetmap: {
    label: 'OpenStreetMap (Nominatim + Overpass)',
    vars: [],
    powers: 'Free business discovery by category + location.',
    fallback: 'Manual lead entry (`akamaru add`).',
    connect: 'No key needed. Requires outbound access to nominatim.openstreetmap.org and overpass-api.de.',
  },
  vercel: {
    label: 'Vercel deployments',
    vars: ['VERCEL_TOKEN'],
    optional: ['VERCEL_TEAM_ID'],
    powers: 'Public preview URLs for generated demos (preview target only; production needs approval).',
    fallback: 'Local preview served by the Akamaru dashboard at /preview/<slug>/.',
    connect: 'Create a token at https://vercel.com/account/tokens and set VERCEL_TOKEN (and VERCEL_TEAM_ID for team accounts).',
  },
  resend: {
    label: 'Resend email',
    vars: ['RESEND_API_KEY', 'OUTREACH_FROM_EMAIL', 'OUTREACH_BUSINESS_ADDRESS'],
    powers: 'Sending owner-approved outreach emails and replies.',
    fallback: 'Campaigns are drafted and queued; nothing is sent.',
    connect: 'Verify a sending domain at https://resend.com/domains, create an API key, set RESEND_API_KEY, OUTREACH_FROM_EMAIL (e.g. "Henry <henry@ltgpeak.com>") and OUTREACH_BUSINESS_ADDRESS (CAN-SPAM postal address).',
  },
  inbound: {
    label: 'Inbound reply webhook',
    vars: ['AKAMARU_WEBHOOK_SECRET'],
    powers: 'Accepting replies at POST /api/inbound so Akamaru can classify and route responses.',
    fallback: 'Log replies manually with `akamaru inbound`.',
    connect: 'Set AKAMARU_WEBHOOK_SECRET and point your email provider\'s inbound webhook at https://<host>/api/inbound with header x-akamaru-secret.',
  },
  dashboard_auth: {
    label: 'Dashboard admin token',
    vars: ['AKAMARU_ADMIN_TOKEN'],
    powers: 'Protects the dashboard/API. Required to bind to anything other than localhost.',
    fallback: 'Dashboard only binds to 127.0.0.1.',
    connect: 'Set AKAMARU_ADMIN_TOKEN to a long random string (e.g. `openssl rand -hex 32`).',
  },
};

export function integrationStatus(key) {
  const def = INTEGRATIONS[key];
  const missing = def.vars.filter((v) => !env(v));
  return { key, ...def, configured: missing.length === 0, missing };
}

export function allIntegrationStatus() {
  return Object.keys(INTEGRATIONS).map(integrationStatus);
}

export function isConfigured(key) {
  return integrationStatus(key).configured;
}

export const settings = {
  get demoScoreThreshold() { return Number(env('AKAMARU_DEMO_THRESHOLD', 40)); },
  get publicUrl() { return env('AKAMARU_PUBLIC_URL', `http://127.0.0.1:${env('AKAMARU_PORT', 4317)}`); },
  get agency() {
    return {
      name: env('AGENCY_NAME', 'LTGPeak'),
      owner: env('AGENCY_OWNER', 'Henry'),
      site: env('AGENCY_SITE', ''),
      phone: env('AGENCY_PHONE', ''),
    };
  },
  get model() { return env('AKAMARU_MODEL', 'claude-opus-5-5'); },
};
