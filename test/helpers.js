// Test harness: isolated temp data dir + in-memory DB + local stub HTTP servers.
// Stubs mirror each provider's real request/response contract so adapter code
// is exercised exactly as it would run against the live API.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akamaru-test-'));
process.env.AKAMARU_DATA_DIR = dir;
process.env.AKAMARU_ENV_FILE = path.join(dir, 'none.env');
process.env.AKAMARU_ALLOW_PRIVATE_FETCH = '1';
process.env.AKAMARU_BROWSER_QA = process.env.AKAMARU_BROWSER_QA || '0';
for (const k of ['ANTHROPIC_API_KEY', 'GOOGLE_PLACES_API_KEY', 'VERCEL_TOKEN', 'RESEND_API_KEY', 'OUTREACH_FROM_EMAIL', 'OUTREACH_BUSINESS_ADDRESS', 'AKAMARU_ADMIN_TOKEN', 'AKAMARU_WEBHOOK_SECRET', 'AKAMARU_PUBLIC_URL']) delete process.env[k];

const { openDb, setDb } = await import('../src/db.js');

export function freshDb() {
  const db = openDb(':memory:');
  setDb(db);
  return db;
}

/** Start a stub server. handler(req, body) → {status, json|text, headers}. Records calls. */
export async function stub(handler) {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    let body = raw;
    try { body = raw ? JSON.parse(raw) : null; } catch { /* keep raw */ }
    const call = { method: req.method, url: req.url, headers: req.headers, body, raw };
    calls.push(call);
    const r = (await handler(call)) || { status: 404, text: 'no route' };
    res.writeHead(r.status || 200, { 'content-type': r.json !== undefined ? 'application/json' : 'text/html', ...(r.headers || {}) });
    res.end(r.json !== undefined ? JSON.stringify(r.json) : r.text || '');
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, calls, close: () => new Promise((ok) => server.close(ok)) };
}

export const OLD_SITE = `<!doctype html><html><head><title>Joe's Barber Shop</title>
<meta name="generator" content="Wix.com Website Builder"></head>
<body><h1>Welcome to Joe's</h1><p>Call us at (713) 555-0199 or email joe@joesbarber.test</p>
<a href="https://www.instagram.com/joesbarber">IG</a><footer>&copy; 2017 Joe's Barber Shop</footer></body></html>`;

export const MODERN_SITE = `<!doctype html><html><head><title>Elite Cuts</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Houston's precision barbershop.">
<script type="application/ld+json">{}</script>
<script async src="https://www.googletagmanager.com/gtag/js"></script></head>
<body><h1>Elite Cuts</h1><a href="https://booksy.com/elite">Book now</a>
<form><input name="email"><textarea name="message"></textarea></form>
<p>${'Precision cuts and fades in a modern studio. '.repeat(20)}</p>
<footer>&copy; ${new Date().getFullYear()} Elite Cuts</footer></body></html>`;

export function osmStubHandler(elements) {
  return (c) => {
    if (c.url.startsWith('/search')) return { json: [{ display_name: 'Houston, Harris County, Texas', boundingbox: ['29.5', '30.1', '-95.8', '-95.0'] }] };
    if (c.url.startsWith('/api/interpreter')) return { json: { elements } };
  };
}
