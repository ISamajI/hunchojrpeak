import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, stub, osmStubHandler } from './helpers.js';
import * as crm from '../src/crm.js';
import * as osm from '../src/integrations/osm.js';
import * as places from '../src/integrations/googlePlaces.js';
import { deployStatic } from '../src/integrations/vercel.js';
import { sendEmail } from '../src/integrations/resend.js';
import { buildDemo } from '../src/branches/orochimaru-demo.js';
import { deployPreview } from '../src/branches/deploy.js';
import { discoverBusinesses } from '../src/branches/discovery.js';
import { runDoctor } from '../src/doctor.js';

const ENV_KEYS = ['NOMINATIM_URL', 'OVERPASS_URL', 'GOOGLE_PLACES_URL', 'GOOGLE_PLACES_API_KEY', 'VERCEL_API_URL', 'VERCEL_TOKEN', 'VERCEL_TEAM_ID', 'RESEND_API_URL', 'RESEND_API_KEY', 'OUTREACH_FROM_EMAIL'];
beforeEach(() => freshDb());
afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });


test('OSM: overpass query uses category tags + bbox in S,W,N,E order', () => {
  const q = osm.buildOverpassQuery('barbers', [29.5, -95.8, 30.1, -95.0], 10);
  assert.match(q, /nwr\["shop"="hairdresser"\]\["name"\]\(29.5,-95.8,30.1,-95\)/);
  assert.match(q, /out center tags 10/);
  assert.match(osm.buildOverpassQuery('kombucha "bar', [0, 0, 1, 1], 5), /name"~"kombucha bar",i/);
});

test('OSM discovery → CRM leads (geocode, overpass, mapping, dedupe)', async () => {
  const s = await stub(osmStubHandler([
    { type: 'node', id: 11, lat: 29.7, lon: -95.3, tags: { name: 'Joe Cuts', shop: 'hairdresser', phone: '+1 713 555 0101', website: 'joecuts.test', 'addr:street': 'Main St', 'addr:housenumber': '12' } },
    { type: 'way', id: 22, center: { lat: 29.8, lon: -95.4 }, tags: { name: 'No Site Barbers', shop: 'hairdresser', 'contact:email': 'hi@nosite.test' } },
    { type: 'node', id: 33, tags: { shop: 'hairdresser' } },
  ]));
  process.env.NOMINATIM_URL = s.url;
  process.env.OVERPASS_URL = `${s.url}/api/interpreter`;
  try {
    const r = await discoverBusinesses({ category: 'barber', near: 'Houston, TX', limit: 10 });
    assert.equal(r.provider, 'openstreetmap');
    assert.equal(r.results.length, 2, 'unnamed element skipped');
    const overpassCall = s.calls.find((c) => c.url.startsWith('/api/interpreter'));
    assert.match(decodeURIComponent(overpassCall.raw), /shop"="hairdresser/);
    assert.match(s.calls[0].headers['user-agent'], /Akamaru/);
    const joe = crm.getBusiness(r.results[0].id);
    assert.equal(joe.website, 'https://joecuts.test/');
    assert.equal(joe.city, 'Houston');
    assert.equal(joe.address, '12 Main St');
    assert.equal(crm.getBusiness(r.results[1].id).lat, 29.8);
    const again = await discoverBusinesses({ category: 'barber', near: 'Houston, TX' });
    assert.equal(again.results.filter((x) => x.created).length, 0);
  } finally { await s.close(); }
});

test('Google Places adapter sends key + field mask and maps results', async () => {
  const s = await stub((c) => c.url === '/v1/places:searchText' && { json: { places: [
    { id: 'abc', displayName: { text: 'Elite Cuts' }, formattedAddress: '1 Main St, Houston, TX', nationalPhoneNumber: '(713) 555-0000', websiteUri: 'https://elite.test', location: { latitude: 1, longitude: 2 }, primaryType: 'barber_shop', rating: 4.8, userRatingCount: 210, businessStatus: 'OPERATIONAL', addressComponents: [{ longText: 'Houston', types: ['locality'] }] },
    { id: 'dead', displayName: { text: 'Closed Co' }, businessStatus: 'CLOSED_PERMANENTLY' },
  ] } });
  process.env.GOOGLE_PLACES_URL = s.url;
  process.env.GOOGLE_PLACES_API_KEY = 'gk';
  try {
    const r = await discoverBusinesses({ category: 'barber', near: 'Houston' });
    assert.equal(r.provider, 'google_places', 'auto-selected when key present');
    assert.equal(s.calls[0].headers['x-goog-api-key'], 'gk');
    assert.match(s.calls[0].headers['x-goog-fieldmask'], /places.websiteUri/);
    assert.equal(s.calls[0].body.textQuery, 'barber in Houston');
    assert.equal(r.results.length, 1);
    const b = crm.getBusiness(r.results[0].id);
    assert.equal(b.city, 'Houston');
    assert.equal(b.raw.rating, 4.8);
  } finally { await s.close(); }
  delete process.env.GOOGLE_PLACES_API_KEY;
  await assert.rejects(places.discover({ category: 'x', near: 'y' }), /GOOGLE_PLACES_API_KEY/);
});

test('Vercel adapter: inline base64 files, preview target, team id, bearer auth', async () => {
  const s = await stub((c) => c.url.startsWith('/v13/deployments') && { json: { id: 'dpl_1', url: 'ltgpeak-demo-x.vercel.app', readyState: 'QUEUED' } });
  process.env.VERCEL_API_URL = s.url;
  process.env.VERCEL_TOKEN = 'vt';
  process.env.VERCEL_TEAM_ID = 'team_9';
  try {
    const { id } = crm.upsertBusiness({ name: 'Vee', phone: '5551112222' });
    const demo = await buildDemo(id);
    const res = await deployStatic({ dir: demo.dir, name: 'ltgpeak-demo-vee' });
    assert.equal(res.url, 'https://ltgpeak-demo-x.vercel.app');
    const call = s.calls[0];
    assert.equal(call.url, '/v13/deployments?teamId=team_9');
    assert.equal(call.headers.authorization, 'Bearer vt');
    assert.equal(call.body.target, undefined, 'preview deploys never set production target');
    const index = call.body.files.find((f) => f.file === 'index.html');
    assert.equal(index.encoding, 'base64');
    assert.match(Buffer.from(index.data, 'base64').toString(), /Vee/);
    const out = await deployPreview(id);
    assert.equal(out.provider, 'vercel');
    assert.equal(out.public, true);
    assert.equal(crm.leadDetail(id).lead.stage, 'preview_deployed');
  } finally { await s.close(); }
});

test('Vercel failure falls back to local preview and records the warning', async () => {
  const s = await stub(() => ({ status: 403, json: { error: { message: 'Not authorized' } } }));
  process.env.VERCEL_API_URL = s.url;
  process.env.VERCEL_TOKEN = 'bad';
  try {
    const { id } = crm.upsertBusiness({ name: 'Fallback Co', phone: '5551112222' });
    await buildDemo(id);
    const out = await deployPreview(id);
    assert.equal(out.provider, 'local');
    assert.match(out.warning, /Not authorized/);
    assert.match(out.url, /\/preview\/fallback-co\/v1\/$/);
  } finally { await s.close(); }
});

test('Resend adapter contract', async () => {
  const s = await stub((c) => c.url === '/emails' && { json: { id: 'em_1' } });
  process.env.RESEND_API_URL = s.url;
  process.env.RESEND_API_KEY = 'rk';
  process.env.OUTREACH_FROM_EMAIL = 'Henry <henry@ltgpeak.test>';
  try {
    const r = await sendEmail({ to: 'a@b.test', subject: 'Hi', text: 'Body', replyTo: 'r@x.test' });
    assert.equal(r.id, 'em_1');
    assert.equal(s.calls[0].headers.authorization, 'Bearer rk');
    assert.deepEqual(s.calls[0].body, { from: 'Henry <henry@ltgpeak.test>', to: ['a@b.test'], subject: 'Hi', text: 'Body', reply_to: 'r@x.test' });
  } finally { await s.close(); }
});

test('doctor reports missing credentials and how to connect them', async () => {
  const rows = await runDoctor();
  const vercel = rows.find((r) => r.key === 'vercel');
  assert.equal(vercel.configured, false);
  assert.deepEqual(vercel.missing, ['VERCEL_TOKEN']);
  assert.match(vercel.connect, /vercel.com\/account\/tokens/);
  assert.equal(rows.find((r) => r.key === 'openstreetmap').configured, true);
});
