// OpenStreetMap discovery: Nominatim geocodes the area, Overpass finds businesses.
import { env } from '../config.js';
import { requestJson } from './http.js';

const CATEGORY_TAGS = {
  barber: [['shop', 'hairdresser']],
  'barber shop': [['shop', 'hairdresser']],
  hairdresser: [['shop', 'hairdresser']],
  salon: [['shop', 'hairdresser'], ['shop', 'beauty']],
  'nail salon': [['shop', 'beauty']],
  beauty: [['shop', 'beauty']],
  restaurant: [['amenity', 'restaurant']],
  cafe: [['amenity', 'cafe']],
  coffee: [['amenity', 'cafe']],
  bakery: [['shop', 'bakery']],
  bar: [['amenity', 'bar'], ['amenity', 'pub']],
  'auto repair': [['shop', 'car_repair']],
  mechanic: [['shop', 'car_repair']],
  dentist: [['amenity', 'dentist']],
  gym: [['leisure', 'fitness_centre']],
  florist: [['shop', 'florist']],
  plumber: [['craft', 'plumber']],
  electrician: [['craft', 'electrician']],
  tattoo: [['shop', 'tattoo']],
  laundry: [['shop', 'laundry'], ['shop', 'dry_cleaning']],
  'pet grooming': [['shop', 'pet_grooming']],
  clothing: [['shop', 'clothes']],
  'clothing store': [['shop', 'clothes']],
  shoes: [['shop', 'shoes']],
  jewelry: [['shop', 'jewelry']],
  'real estate': [['office', 'estate_agent']],
  lawyer: [['office', 'lawyer']],
  accountant: [['office', 'accountant']],
};

export function tagsForCategory(category) {
  const key = String(category).toLowerCase().trim().replace(/s$/, '');
  return CATEGORY_TAGS[key] || CATEGORY_TAGS[String(category).toLowerCase().trim()] || null;
}

export function buildOverpassQuery(category, bbox, limit) {
  const [south, west, north, east] = bbox;
  const box = `(${south},${west},${north},${east})`;
  const tags = tagsForCategory(category);
  const safe = String(category).replace(/["\\]/g, '');
  const parts = tags
    ? tags.map(([k, v]) => `nwr["${k}"="${v}"]["name"]${box};`)
    : [`nwr["name"~"${safe}",i]["shop"]${box};`, `nwr["name"~"${safe}",i]["amenity"]${box};`, `nwr["name"~"${safe}",i]["craft"]${box};`];
  return `[out:json][timeout:25];(${parts.join('')});out center tags ${Math.max(1, Math.min(200, limit))};`;
}

export function mapElement(el, category) {
  const t = el.tags || {};
  const addr = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  return {
    name: t.name,
    category: t.shop || t.amenity || t.craft || t.office || t.leisure || category,
    address: [addr, t['addr:city'], t['addr:state'], t['addr:postcode']].filter(Boolean).join(', ') || null,
    city: t['addr:city'] || null,
    phone: t.phone || t['contact:phone'] || null,
    email: t.email || t['contact:email'] || null,
    website: t.website || t['contact:website'] || t.url || null,
    lat: el.lat ?? el.center?.lat ?? null,
    lon: el.lon ?? el.center?.lon ?? null,
    source: 'openstreetmap',
    source_ref: `osm:${el.type}/${el.id}`,
    raw: { tags: t, osm_type: el.type, osm_id: el.id, instagram: t['contact:instagram'] || null, facebook: t['contact:facebook'] || null, opening_hours: t.opening_hours || null },
  };
}

export async function geocode(place) {
  const base = env('NOMINATIM_URL', 'https://nominatim.openstreetmap.org');
  const results = await requestJson(`${base}/search?format=json&limit=1&q=${encodeURIComponent(place)}`);
  if (!results?.length) throw new Error(`Could not geocode "${place}"`);
  const [south, north, west, east] = results[0].boundingbox.map(Number);
  return { display: results[0].display_name, bbox: [south, west, north, east] };
}

export async function discover({ category, near, limit = 20 }) {
  const area = await geocode(near);
  const base = env('OVERPASS_URL', 'https://overpass-api.de/api/interpreter');
  const query = buildOverpassQuery(category, area.bbox, limit * 2);
  const data = await requestJson(base, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    timeoutMs: 40000,
  });
  const city = area.display.split(',')[0].trim();
  return (data.elements || [])
    .filter((el) => el.tags?.name)
    .slice(0, limit)
    .map((el) => {
      const b = mapElement(el, category);
      b.city = b.city || city;
      return b;
    });
}
