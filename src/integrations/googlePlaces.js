// Google Places API (New) — Text Search.
import { env } from '../config.js';
import { requestJson } from './http.js';

const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.nationalPhoneNumber',
  'places.websiteUri', 'places.location', 'places.primaryType', 'places.rating',
  'places.userRatingCount', 'places.businessStatus', 'places.googleMapsUri', 'places.addressComponents', 'places.photos', 'places.reviews', 'places.regularOpeningHours',
].join(',');

export function mapPlace(p, category) {
  const city = p.addressComponents?.find((c) => c.types?.includes('locality'))?.longText || null;
  return {
    name: p.displayName?.text,
    category: p.primaryType || category,
    address: p.formattedAddress || null,
    city,
    phone: p.nationalPhoneNumber || null,
    email: null,
    website: p.websiteUri || null,
    lat: p.location?.latitude ?? null,
    lon: p.location?.longitude ?? null,
    source: 'google_places',
    source_ref: `gplaces:${p.id}`,
    raw: {
      rating: p.rating ?? null, review_count: p.userRatingCount ?? null, status: p.businessStatus || null, maps_url: p.googleMapsUri || null,
      photos: (p.photos || []).slice(0, 8).map((ph) => ({ name: ph.name, width: ph.widthPx, height: ph.heightPx, attributions: (ph.authorAttributions || []).map((a) => ({ name: a.displayName, uri: a.uri })) })),
      reviews: (p.reviews || []).filter((r) => r.text?.text).slice(0, 5).map((r) => ({ rating: r.rating, text: r.text.text.slice(0, 600), author: r.authorAttribution?.displayName || 'Google user', authorUri: r.authorAttribution?.uri || null, when: r.relativePublishTimeDescription || null })),
      hours: p.regularOpeningHours?.weekdayDescriptions || null,
    },
  };
}

export async function discover({ category, near, limit = 20 }) {
  const key = env('GOOGLE_PLACES_API_KEY');
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  const base = env('GOOGLE_PLACES_URL', 'https://places.googleapis.com');
  const data = await requestJson(`${base}/v1/places:searchText`, {
    method: 'POST',
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: { textQuery: `${category} in ${near}`, pageSize: Math.min(20, limit) },
  });
  return (data?.places || [])
    .filter((p) => p.displayName?.text && p.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((p) => mapPlace(p, category));
}

/** Resolve a Places photo resource name to a downloadable URL (Places API New, photo media). */
export async function photoUri(name, maxWidthPx = 1800) {
  const key = env('GOOGLE_PLACES_API_KEY');
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  const base = env('GOOGLE_PLACES_URL', 'https://places.googleapis.com');
  const data = await requestJson(`${base}/v1/${name}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true&key=${encodeURIComponent(key)}`);
  if (!data?.photoUri) throw new Error('Places photo response had no photoUri');
  return data.photoUri;
}
