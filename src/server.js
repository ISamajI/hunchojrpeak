// Akamaru dashboard + JSON API + public demo previews + inbound webhook.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, dataDir, env } from './config.js';
import { routes, rawRoutes, handleInbound } from './api.js';
import { bus } from './events.js';
import { sse } from './system.js';
import { recoverInterruptedJobs } from './jobs.js';
import { startNotifier } from './notify.js';
import { startScheduler } from './scheduler.js';
import './operations.js';

const MIME = { '.woff2': 'font/woff2', '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'content-type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

async function readText(req, limit = 1_100_000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readBody(req, limit = 1_000_000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(c);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('Invalid JSON body'), { status: 400 }); }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function servePreview(res, rest) {
  const base = path.resolve(dataDir(), 'demos');
  let rel = decodeURIComponent(rest);
  if (rel.endsWith('/') || rel === '') rel += 'index.html';
  const file = path.resolve(base, rel);
  if (!file.startsWith(base + path.sep)) return send(res, 400, 'Bad path');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found');
  send(res, 200, fs.readFileSync(file), {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'x-robots-tag': 'noindex, nofollow',
    ...(path.extname(file) === '.woff2' ? { 'access-control-allow-origin': '*' } : {}), // fonts load in CORS mode; sandboxed iframes have a null origin
    'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
  });
}

function serveAsset(res, rest) {
  const base = path.resolve(ROOT, 'public', 'assets');
  const file = path.resolve(base, decodeURIComponent(rest));
  if (!file.startsWith(base + path.sep)) return send(res, 400, 'Bad path');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found');
  send(res, 200, fs.readFileSync(file), {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'cache-control': 'no-cache',
  });
}

const APP_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

const MAX_STREAMS = 20;
const MAX_BACKLOG = 1_000_000;

function streamEvents(req, res) {
  if (sse.count() >= MAX_STREAMS) return send(res, 503, { error: 'Too many live connections' });
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
  sse.inc();
  const onEvent = (e) => {
    if (res.writableLength > MAX_BACKLOG) { res.destroy(); return; } // slow client: drop, it will reconnect
    res.write(`event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`);
  };
  bus.on('event', onEvent);
  const ping = setInterval(() => res.write(`: ping\n\n`), 20000);
  req.on('close', () => { clearInterval(ping); bus.off('event', onEvent); sse.dec(); });
}

export function createServer({ host = '127.0.0.1' } = {}) {
  const adminToken = env('AKAMARU_ADMIN_TOKEN');
  const localOnly = !adminToken;

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    const p = url.pathname;
    try {
      if (req.method === 'GET' && p.startsWith('/preview/')) return servePreview(res, p.slice('/preview/'.length));
      if (req.method === 'GET' && p.startsWith('/assets/')) return serveAsset(res, p.slice('/assets/'.length));
      if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
        return send(res, 200, fs.readFileSync(path.join(ROOT, 'public', 'index.html')), {
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': APP_CSP,
          'cache-control': 'no-cache',
        });
      }
      if (req.method === 'GET' && p === '/healthz') return send(res, 200, { ok: true });

      if (p === '/api/inbound' && req.method === 'POST') {
        const secret = env('AKAMARU_WEBHOOK_SECRET');
        if (!secret) return send(res, 503, { error: 'Inbound webhook disabled: set AKAMARU_WEBHOOK_SECRET' });
        if (!safeEqual(req.headers['x-akamaru-secret'] || '', secret)) return send(res, 401, { error: 'Bad webhook secret' });
        const b = await readBody(req);
        return send(res, 200, await handleInbound({ from: b.from, subject: b.subject, text: b.text || b.body, spf: b.spf, dkim: b.dkim }));
      }

      if (p.startsWith('/api/')) {
        if (localOnly) {
          // DNS-rebinding guard for the unauthenticated localhost mode.
          const h = String(req.headers.host || '').replace(/:\d+$/, '');
          if (!['127.0.0.1', 'localhost', '[::1]'].includes(h)) return send(res, 403, { error: 'Set AKAMARU_ADMIN_TOKEN to access the API remotely' });
        } else {
          const auth = String(req.headers.authorization || '');
          if (!safeEqual(auth, `Bearer ${adminToken}`)) return send(res, 401, { error: 'Unauthorized' });
        }
        // CSRF guard: custom header forces a CORS preflight that we never approve.
        if (req.headers['x-akamaru'] !== '1' && (req.method !== 'GET' || p === '/api/stream')) return send(res, 403, { error: 'Missing x-akamaru header' });
        if (req.method === 'GET' && p === '/api/stream') return streamEvents(req, res);
        for (const [method, re, fn] of rawRoutes) {
          const m = p.match(re);
          if (m && method === req.method) return send(res, 200, await fn(url.searchParams, m, await readText(req)));
        }
        for (const [method, re, fn] of routes) {
          const m = p.match(re);
          if (m && method === req.method) {
            const body = method === 'POST' ? await readBody(req) : {};
            return send(res, 200, (await fn(url.searchParams, m, body)) ?? { ok: true });
          }
        }
        return send(res, 404, { error: 'No such endpoint' });
      }
      send(res, 404, 'Not found');
    } catch (e) {
      const status = e.status || (/not found/i.test(e.message) ? 404 : /required|must|invalid|unknown|needs/i.test(e.message) ? 400 : 500);
      if (status >= 500) console.error(`[${req.method} ${p}]`, e);
      send(res, status, { error: e.message });
    }
  });
}

export async function startServer({ port = Number(env('AKAMARU_PORT', 4317)), host = env('AKAMARU_HOST', '127.0.0.1') } = {}) {
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
  if (!loopback && !env('AKAMARU_ADMIN_TOKEN')) {
    throw new Error(`Refusing to bind ${host} without AKAMARU_ADMIN_TOKEN. Set a token or use 127.0.0.1.`);
  }
  const recovered = recoverInterruptedJobs();
  if (recovered) console.warn(`Marked ${recovered} interrupted job(s) as failed.`);
  startNotifier();
  startScheduler();
  const server = createServer({ host });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}
