// ITACHI — Security & Quality Control.
// Hard gate: a demo that fails QA is never deployed or pitched.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { auditPalette } from './design/director.js';

const stripTags = (html) => html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
/** Remove elements explicitly marked as verified (Google rating/reviews) before scanning for fabricated claims. */
function withoutVerified(html) {
  let out = html;
  for (let guard = 0; guard < 50; guard++) {
    const m = out.match(/<(\w+)\b[^>]*data-verified="google"[^>]*>/);
    if (!m) break;
    const tag = m[1];
    const start = m.index;
    let depth = 0;
    const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'g');
    re.lastIndex = start;
    let end = -1;
    for (let x; (x = re.exec(out));) {
      if (x[0].startsWith('</')) { depth--; if (depth === 0) { end = x.index + x[0].length; break; } } else depth++;
    }
    out = end > 0 ? out.slice(0, start) + out.slice(end) : out.slice(0, start) + out.slice(start + m[0].length);
  }
  return out;
}

/**
 * Static QA. `opts.dir` enables asset checks; `opts.palette` enables contrast audit.
 */
export function qaDemo(html, business, opts = {}) {
  const checks = [];
  const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });
  const body = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, '');
  check('has <title>', /<title>[^<]+<\/title>/i.test(html));
  check('mobile viewport', /<meta name="viewport"/i.test(html));
  check('noindex (demo must not be indexed)', /<meta name="robots" content="noindex/i.test(html));
  check('labeled as concept preview', /Concept preview/i.test(html));
  check('business name present', html.includes(String(business.name).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))), business.name);
  const scriptSrcs = [...body.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/gi)].map((m) => m[1]);
  check('no external scripts', scriptSrcs.every((s) => /^js\/[\w.-]+\.js$/.test(s)), scriptSrcs.join(', '));
  check('no inline scripts', ![...body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].some((m) => !/\ssrc=/.test(m[1]) && m[2].trim()));
  const visible = stripTags(body);
  check('no template placeholders', !/\{\{|\}\}|\bundefined\b|\bnull\b|lorem ipsum|\[object Object\]/i.test(visible) && !/\bNaN\b/.test(visible));
  const unverified = stripTags(withoutVerified(body));
  check('no fabricated social proof', !/\btestimonials?\b|★|5 stars|\breviews?\b|\bawards?\b|\baward-winning\b|best in|\b#1\b|voted/i.test(unverified));
  const verifiedRatings = [...html.matchAll(/data-verified="google"[\s\S]{0,400}?(\d\.\d)\s*(?:★|<\/b>)/g)].map((m) => Number(m[1]));
  check('verified ratings match Google data', verifiedRatings.every((r) => business.raw?.rating != null && Math.abs(r - business.raw.rating) < 0.05), verifiedRatings.join(','));
  check('has a working call to action', /class="btn btn-primary"[^>]*href="(tel:|mailto:|#book|https?:\/\/)/.test(html) || /href="(tel:|mailto:|#book|https?:\/\/)[^"]*"[^>]*class="btn btn-primary"/.test(html) || /<a class="btn btn-primary" href="(tel:|mailto:|#book|https?:\/\/)/.test(html));
  if (business.phone) check('phone link present', /href="tel:\+?\d{7,}/.test(html));
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  check('every image has alt text attribute', imgs.every((t) => /\salt="/.test(t)));
  check('no hotlinked images', imgs.every((t) => /\ssrc="img\//.test(t)));
  check('HTML under 150KB', Buffer.byteLength(html) < 150_000, `${Buffer.byteLength(html)} bytes`);
  if (opts.palette) {
    const a = auditPalette(opts.palette);
    check('palette meets WCAG contrast', a.ok, a.checks.filter((c) => !c.ok).map((c) => `${c.name} ${c.ratio}`).join('; '));
  }
  if (opts.dir) {
    const refs = [...html.matchAll(/\s(?:src|href)="([^"#][^"]*)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|tel:|mailto:|sms:|data:)/.test(u));
    const missing = refs.filter((r) => !fs.existsSync(path.join(opts.dir, r)));
    check('all local assets exist', !missing.length, missing.join(', '));
    const total = dirSize(opts.dir);
    check('total weight under 12MB', total < 12_000_000, `${Math.round(total / 1024)} KB`);
  }
  const failures = checks.filter((c) => !c.ok).map((c) => c.name);
  return { passed: failures.length === 0, failures, checks };
}

function dirSize(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? dirSize(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size;
  return n;
}

export const BREAKPOINTS = [375, 390, 430, 768, 1024, 1440, 1920];

/**
 * Real-browser QA at every breakpoint: no horizontal overflow, no script errors, headline and CTA
 * visible in the first viewport, mobile menu opens. Skips (honestly) when Playwright isn't installed.
 */
export async function browserQa(dir, { screenshotsDir } = {}) {
  let chromium;
  try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { return { ran: false, reason: 'Playwright not installed', results: [] }; }
  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(dir, rel);
    if (!file.startsWith(path.resolve(dir)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(fs.readFileSync(file));
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of BREAKPOINTS) {
      const page = await browser.newPage({ viewport: { width, height: width < 768 ? 844 : width < 1440 ? 900 : 1080 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
      await page.goto(base, { waitUntil: 'load' });
      await page.waitForTimeout(2600);
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const over = document.documentElement.scrollWidth > vw + 1;
        const h1 = document.querySelector('h1')?.getBoundingClientRect();
        const cta = [...document.querySelectorAll('.hero .btn-primary, .nav .btn-primary')].map((e) => e.getBoundingClientRect()).find((r) => r.width > 0 && r.top < innerHeight && r.bottom > 0);
        const smallTargets = [...document.querySelectorAll('a.btn, button, .menu-toggle')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 40 || r.width < 40); }).length;
        return { over, h1Visible: !!h1 && h1.top < innerHeight && h1.bottom > 0 && h1.width > 0, ctaVisible: !!cta, h1Overflow: !!h1 && h1.right > vw + 1, smallTargets };
      });
      if (screenshotsDir) { fs.mkdirSync(screenshotsDir, { recursive: true }); await page.screenshot({ path: path.join(screenshotsDir, `${width}.png`) }); }
      let menuOk = true;
      if (width < 860) {
        await page.click('.menu-toggle');
        await page.waitForTimeout(800);
        menuOk = await page.evaluate(() => document.body.classList.contains('menu-open') && getComputedStyle(document.querySelector('.mobile-menu')).visibility === 'visible');
      }
      const fails = [m.over && 'horizontal overflow', !m.h1Visible && 'headline not in first viewport', m.h1Overflow && 'headline overflows', !m.ctaVisible && 'no CTA in first viewport', !menuOk && 'mobile menu failed', width < 768 && m.smallTargets && `${m.smallTargets} touch targets < 40px`, errors.length && `errors: ${errors.slice(0, 3).join(' | ')}`].filter(Boolean);
      results.push({ width, ok: !fails.length, fails });
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return { ran: true, passed: results.every((r) => r.ok), results };
}
