// Uptime monitoring for client production sites (SSRF-safe fetcher).
import { getDb } from './db.js';
import { log } from './activity.js';
import { normalizeWebsite } from './crm.js';
import { safeGet } from './integrations/safeFetch.js';

export function addSite({ url, businessId = null, label = null }) {
  const clean = normalizeWebsite(url);
  if (!clean) throw new Error('A valid http(s) URL is required');
  const db = getDb();
  db.prepare('INSERT INTO sites (url, business_id, label) VALUES (?, ?, ?) ON CONFLICT(url) DO UPDATE SET business_id = COALESCE(excluded.business_id, business_id), label = COALESCE(excluded.label, label)')
    .run(clean, businessId, label);
  const site = db.prepare('SELECT * FROM sites WHERE url = ?').get(clean);
  log('itachi', 'site_monitored', 'site', site.id, { url: clean });
  return site;
}

export function removeSite(id) {
  getDb().prepare('DELETE FROM sites WHERE id = ?').run(id);
}

export async function checkSite(site) {
  const db = getDb();
  const prev = db.prepare('SELECT ok FROM site_checks WHERE site_id = ? ORDER BY id DESC LIMIT 1').get(site.id);
  let ok = false;
  let status = null;
  let ms = null;
  let error = null;
  try {
    const res = await safeGet(site.url, { timeoutMs: 15000, maxBytes: 500_000 });
    status = res.status;
    ms = res.ms;
    ok = res.status < 400;
  } catch (e) {
    error = e.message;
  }
  db.prepare('INSERT INTO site_checks (site_id, ok, status, ms, error) VALUES (?,?,?,?,?)').run(site.id, ok ? 1 : 0, status, ms, error);
  if (!ok && (!prev || prev.ok)) log('itachi', 'site_down', 'site', site.id, { url: site.url, status, error });
  if (ok && prev && !prev.ok) log('itachi', 'site_recovered', 'site', site.id, { url: site.url, ms });
  return { siteId: site.id, url: site.url, ok, status, ms, error };
}

export async function checkAllSites(onStep = () => {}) {
  const sites = getDb().prepare('SELECT * FROM sites').all();
  const results = [];
  for (const [i, s] of sites.entries()) {
    onStep(`Checking ${s.url}`, i / Math.max(1, sites.length));
    results.push(await checkSite(s));
  }
  log('itachi', 'uptime_sweep', null, null, { checked: results.length, down: results.filter((r) => !r.ok).length });
  return { checked: results.length, down: results.filter((r) => !r.ok).length, results };
}
