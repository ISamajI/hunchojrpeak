// End-to-end UI test in a real browser. Skips automatically when Playwright isn't installed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { freshDb } from './helpers.js';
import '../src/index.js';
import { createServer } from '../src/server.js';
import * as crm from '../src/crm.js';
import { processLead } from '../src/branches/tsunade-orchestrator.js';

let chromium = null;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { /* not installed */ }
const skip = !chromium && 'playwright not installed';

let server, base, browser, page;
const errors = [];
before(async () => {
  if (skip) return;
  freshDb();
  const a = crm.upsertBusiness({ name: 'UI Barbers', category: 'hairdresser', city: 'Hamilton', email: 'boss@uibarbers.test', phone: '9055550100' });
  crm.upsertBusiness({ name: 'UI Bakery', category: 'bakery', city: 'Hamilton', phone: '9055550101' });
  await processLead(a.id);
  server = createServer();
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base + '/#/overview');
  await page.waitForSelector('.kpi');
});
after(async () => {
  if (skip) return;
  await browser?.close();
  server.closeAllConnections?.();
  await new Promise((ok) => server.close(ok));
});

const go = async (hash, sel) => { await page.evaluate((h) => (location.hash = h), hash); await page.waitForSelector(sel); };

test('every page renders without errors', { skip }, async () => {
  for (const r of ['overview', 'command', 'activity', 'leads', 'clients', 'projects', 'revenue', 'analytics', 'agents', 'workflows', 'schedules', 'approvals', 'builder', 'demos', 'marketing', 'content', 'integrations', 'notifications', 'health', 'settings']) {
    await go(`#/${r}`, '.view-inner > *');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.error-box').count(), 0, `error box on ${r}`);
  }
  assert.deepEqual(errors, []);
});

test('overview shows live status, the pending decision and real KPIs', { skip }, async () => {
  await go('#/overview', '.kpi');
  await page.waitForSelector('.core-viz svg');
  assert.match(await page.textContent('.view-head'), /1 decision needs you/);
  assert.match(await page.textContent('.kpis'), /No invoices recorded/, 'revenue never fabricated');
  assert.equal(await page.locator('.agent-card').count(), 6);
  assert.match(await page.textContent('.status-cluster'), /LINK LIVE/);
});

test('command palette runs a command in the Command Center', { skip }, async () => {
  await page.keyboard.press('Control+k');
  await page.fill('.palette input', 'Show me everything you accomplished today');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.msg.ai .grid');
  assert.match(await page.textContent('.thread-scroll'), /Leads discovered/);
});

test('approving requires confirmation that shows the exact email', { skip }, async () => {
  await go('#/approvals', '.list-item');
  await page.click('button:has-text("Approve & send")');
  await page.waitForSelector('.dialog pre');
  assert.match(await page.textContent('.dialog pre'), /To: boss@uibarbers.test/);
  await page.click('.dialog button:has-text("Cancel")');
  assert.equal(await page.locator('.overlay').count(), 0);
  assert.equal(await page.locator('.list-item button:has-text("Approve & send")').count(), 1, 'still pending after cancel');
});

test('kanban: move a project via context menu; Won asks for confirmation', { skip }, async () => {
  await go('#/projects', '.card');
  const card = page.locator('.card', { hasText: 'UI Bakery' });
  await card.click({ button: 'right' });
  await page.click('.ctx-menu button:has-text("Move to Negotiating")');
  await page.waitForFunction(() => document.querySelector('[aria-label="Negotiating"]')?.textContent.includes('UI Bakery'));
  await page.locator('.card', { hasText: 'UI Bakery' }).click({ button: 'right' });
  await page.click('.ctx-menu button:has-text("Move to Won")');
  await page.waitForSelector('.dialog');
  await page.click('.dialog button:has-text("Mark won")');
  await page.waitForFunction(() => document.querySelector('[aria-label="Won"]')?.textContent.includes('UI Bakery'));
});

test('project detail shows deliverables with a sandboxed live preview', { skip }, async () => {
  await page.locator('.card', { hasText: 'UI Barbers' }).click();
  await page.waitForSelector('.tabs');
  await page.click('.tabs button:has-text("Deliverables")');
  const frame = page.locator('iframe.iframe-full');
  assert.equal(await frame.getAttribute('sandbox'), 'allow-scripts', 'scripts run, but never with dashboard origin');
  assert.match(await page.frameLocator('iframe.iframe-full').locator('.brand').textContent(), /UI Barbers/);
});

test('recording an invoice updates revenue from the ledger', { skip }, async () => {
  await go('#/revenue', '.kpi');
  await page.click('button:has-text("Record invoice")');
  await page.fill('.dialog input[placeholder="Website build"]', 'Website build');
  await page.fill('.dialog input[type="number"]', '1500');
  await page.click('.dialog button:has-text("Record invoice")');
  await page.waitForFunction(() => document.querySelector('.kpis')?.textContent.includes('$1,500'));
  assert.equal(await page.locator('table.data tbody tr').count(), 1);
});

test('keyboard navigation: g then a letter', { skip }, async () => {
  await page.click('.page-title');
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await page.waitForSelector('.topology svg');
  assert.match(page.url(), /#\/health/);
  assert.deepEqual(errors, []);
});
