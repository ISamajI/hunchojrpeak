// Business discovery: Google Places when connected, OpenStreetMap otherwise.
import { isConfigured } from '../config.js';
import { log } from '../activity.js';
import { upsertBusiness } from '../crm.js';
import * as places from '../integrations/googlePlaces.js';
import * as osm from '../integrations/osm.js';

export async function discoverBusinesses({ category, near, limit = 20, provider }) {
  if (!category || !near) throw new Error('discover needs a category and a location (e.g. "barber", "Houston, TX")');
  const chosen = provider || (isConfigured('google_places') ? 'google_places' : 'openstreetmap');
  const impl = chosen === 'google_places' ? places : osm;
  const found = await impl.discover({ category, near, limit });
  const results = found.map((b) => ({ ...upsertBusiness(b), name: b.name, website: b.website }));
  log('jiraiya', 'businesses_discovered', null, null, {
    category, near, provider: chosen, found: found.length, new: results.filter((r) => r.created).length,
  });
  return { provider: chosen, results };
}
