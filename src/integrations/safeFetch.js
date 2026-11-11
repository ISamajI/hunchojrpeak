// SSRF-safe GET for fetching untrusted URLs (business websites).
// - Validates the IP actually connected to (custom DNS lookup) → defeats DNS rebinding.
// - Decodes every IPv6 form that embeds IPv4 (mapped, compatible, NAT64, 6to4).
// - Follows redirects manually, re-validating each hop.
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { env } from '../config.js';
import { USER_AGENT } from './http.js';

const V4_BLOCKED = new net.BlockList();
for (const [a, p] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) V4_BLOCKED.addSubnet(a, p, 'ipv4');

const V6_BLOCKED = new net.BlockList();
for (const [a, p] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8], ['2001:db8::', 32], ['100::', 64]]) {
  V6_BLOCKED.addSubnet(a, p, 'ipv6');
}

/** Expand an IPv6 string to 8 numeric hextets. */
function hextets(ip) {
  let s = ip.toLowerCase().split('%')[0];
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const [a, b, c, d] = v4[1].split('.').map(Number);
    s = s.slice(0, -v4[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = s.includes('::') ? s.split('::') : [s, null];
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const fill = tail === null ? [] : Array(8 - h.length - t.length).fill('0');
  return [...h, ...fill, ...t].map((x) => parseInt(x || '0', 16));
}

const v4From = (hi, lo) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

export function isBlockedIp(ip) {
  if (net.isIPv4(ip)) return V4_BLOCKED.check(ip, 'ipv4');
  if (!net.isIPv6(ip)) return true;
  const h = hextets(ip);
  const zero = (from, to) => h.slice(from, to).every((x) => x === 0);
  if (zero(0, 5) && (h[5] === 0xffff || h[5] === 0)) return isBlockedIp(v4From(h[6], h[7])); // mapped / compatible
  if (h[0] === 0x64 && h[1] === 0xff9b && zero(2, 6)) return isBlockedIp(v4From(h[6], h[7])); // NAT64
  if (h[0] === 0x2002) return isBlockedIp(v4From(h[1], h[2])); // 6to4
  return V6_BLOCKED.check(ip, 'ipv6');
}

const allowPrivate = () => env('AKAMARU_ALLOW_PRIVATE_FETCH') === '1';

function guardedLookup(hostname, options, cb) {
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return cb(err);
    const bad = !allowPrivate() && addrs.find((a) => isBlockedIp(a.address));
    if (bad) return cb(new Error(`Refusing to connect to private/internal address ${bad.address} for ${hostname}`));
    if (options?.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

export async function assertPublicUrl(url) {
  const u = new URL(url);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error(`Refusing non-http URL ${url}`);
  if (allowPrivate()) return;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new Error(`Refusing to fetch private/internal address ${host}`);
    return;
  }
  await new Promise((ok, bad) => guardedLookup(host, {}, (e) => (e ? bad(e) : ok())));
}

function getOnce(url, { timeoutMs, maxBytes }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(u, {
      lookup: guardedLookup,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > maxBytes) { res.destroy(); return; }
        chunks.push(c);
      });
      res.on('close', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8'), bytes: size }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
  });
}

export async function safeGet(url, { timeoutMs = 15000, maxBytes = 3_000_000, maxRedirects = 5 } = {}) {
  const started = Date.now();
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current);
    const res = await getOnce(current, { timeoutMs, maxBytes });
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      current = new URL(res.headers.location, current).toString();
      continue;
    }
    return { ...res, url: current, ms: Date.now() - started, ok: res.status < 400 };
  }
  throw new Error(`Too many redirects (>${maxRedirects}) starting at ${url}`);
}
