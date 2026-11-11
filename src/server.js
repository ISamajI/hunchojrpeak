// Akamaru dashboard + JSON API + public demo previews + inbound webhook.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, dataDir, env } from './config.js';
import { getDb } from './db.js';
import * as crm from './crm.js';
import * as activity from './activity.js';
import { listApprovals, approve, reject } from './decision.js';
import { runDoctor } from './doctor.js';
import { runPipeline, processLead } from './branches/tsunade-orchestrator.js';
import { handleInbound, markWon, queueCampaign } from './branches/kakashi-outreach.js';
import { requestProductionPublish } from './branches/deploy.js';
import { setTaskStatus } from './branches/onboarding.js';

const MIME = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

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
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src * data:; frame-ancestors 'none'",
  });
}

export function createServer({ host = '127.0.0.1' } = {}) {
  const adminToken = env('AKAMARU_ADMIN_TOKEN');
  const localOnly = !adminToken;

  const routes = [
    ['GET', /^\/api\/status$/, () => ({
      pipeline: crm.pipelineCounts(),
      pendingApprovals: listApprovals('pending').length,
      leads: getDb().prepare('SELECT COUNT(*) AS n FROM leads').get().n,
    })],
    ['GET', /^\/api\/doctor$/, (q) => runDoctor({ live: q.get('live') === '1' })],
    ['GET', /^\/api\/leads$/, (q) => crm.listLeads({ stage: q.get('stage') || undefined, minScore: q.get('min') ? Number(q.get('min')) : undefined })],
    ['GET', /^\/api\/leads\/(\d+)$/, (q, m) => crm.leadDetail(Number(m[1])) || Promise.reject(Object.assign(new Error('Not found'), { status: 404 }))],
    ['POST', /^\/api\/leads$/, (q, m, b) => crm.upsertBusiness({ ...b, source: 'manual' })],
    ['POST', /^\/api\/leads\/(\d+)\/process$/, (q, m, b) => processLead(Number(m[1]), { force: !!b.force })],
    ['POST', /^\/api\/leads\/(\d+)\/stage$/, (q, m, b) => (b.stage === 'won' ? { tasks: markWon(Number(m[1])) } : (crm.setStage(Number(m[1]), b.stage, 'owner', b.note), { ok: true }))],
    ['POST', /^\/api\/leads\/(\d+)\/note$/, (q, m, b) => (crm.addNote(Number(m[1]), String(b.note || '')), { ok: true })],
    ['POST', /^\/api\/leads\/(\d+)\/publish$/, (q, m) => requestProductionPublish(Number(m[1]))],
    ['POST', /^\/api\/campaigns\/(\d+)\/queue$/, (q, m, b) => queueCampaign(Number(m[1]), { subject: b.subject, body: b.body })],
    ['POST', /^\/api\/tasks\/(\d+)$/, (q, m, b) => (setTaskStatus(Number(m[1]), b.status), { ok: true })],
    ['POST', /^\/api\/pipeline\/run$/, (q, m, b) => runPipeline({ category: b.category, near: b.near, limit: Math.min(50, Number(b.limit) || 10) })],
    ['GET', /^\/api\/approvals$/, (q) => listApprovals(q.get('status') || 'pending')],
    ['POST', /^\/api\/approvals\/(\d+)\/approve$/, (q, m) => approve(Number(m[1]), 'owner:dashboard')],
    ['POST', /^\/api\/approvals\/(\d+)\/reject$/, (q, m, b) => reject(Number(m[1]), 'owner:dashboard', b.note || '')],
    ['GET', /^\/api\/activity$/, (q) => activity.recent(Number(q.get('limit')) || 100)],
  ];

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    const p = url.pathname;
    try {
      if (req.method === 'GET' && p.startsWith('/preview/')) return servePreview(res, p.slice('/preview/'.length));
      if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
        return send(res, 200, fs.readFileSync(path.join(ROOT, 'public', 'index.html')), {
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'",
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
        if (req.method !== 'GET' && req.headers['x-akamaru'] !== '1') return send(res, 403, { error: 'Missing x-akamaru header' });
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
      send(res, e.status || 500, { error: e.message });
    }
  });
}

export async function startServer({ port = Number(env('AKAMARU_PORT', 4317)), host = env('AKAMARU_HOST', '127.0.0.1') } = {}) {
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
  if (!loopback && !env('AKAMARU_ADMIN_TOKEN')) {
    throw new Error(`Refusing to bind ${host} without AKAMARU_ADMIN_TOKEN. Set a token or use 127.0.0.1.`);
  }
  const server = createServer({ host });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}
