// ITACHI — Security & Quality Control.
// Hard gate: a demo that fails QA is never deployed or pitched.

export function qaDemo(html, business) {
  const checks = [];
  const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });
  check('has <title>', /<title>[^<]+<\/title>/i.test(html));
  check('mobile viewport', /<meta name="viewport"/i.test(html));
  check('noindex (demo must not be indexed)', /<meta name="robots" content="noindex/i.test(html));
  check('labeled as concept preview', /Concept preview/i.test(html));
  check('business name present', html.includes(escapeForCheck(business.name)), business.name);
  check('no external scripts', !/<script[^>]+src=/i.test(html));
  check('no inline scripts', !/<script/i.test(html));
  check('no template placeholders', !/\{\{|\}\}|undefined|\bnull\b|NaN|lorem ipsum/i.test(html.replace(/<style[\s\S]*?<\/style>/i, '')));
  check('no fabricated social proof', !/\btestimonials?\b|★|5 stars|\breviews?\b|\bawards?\b|best in/i.test(stripTags(html)));
  check('has a call to action link', /class="btn"[^>]*href="(tel:|mailto:|#contact)/.test(html) || /href="(tel:|mailto:|#contact)[^"]*"[^>]*class="btn"/.test(html) || /<a class="btn" href="(tel:|mailto:|#contact)/.test(html));
  check('size under 200KB', Buffer.byteLength(html) < 200_000, `${Buffer.byteLength(html)} bytes`);
  if (business.phone) check('phone link present', /href="tel:\+?\d{7,}/.test(html));
  const failures = checks.filter((c) => !c.ok).map((c) => c.name);
  return { passed: failures.length === 0, failures, checks };
}

function stripTags(html) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
}

function escapeForCheck(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
