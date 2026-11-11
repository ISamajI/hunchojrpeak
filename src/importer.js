// CSV lead import (command-bar attachment). Accepts common header names.
import { upsertBusiness, slugify } from './crm.js';
import { log } from './activity.js';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

const ALIASES = {
  name: ['name', 'business', 'business name', 'company', 'company name'],
  category: ['category', 'type', 'industry', 'trade'],
  city: ['city', 'town'],
  address: ['address', 'street', 'location'],
  phone: ['phone', 'phone number', 'telephone', 'tel'],
  email: ['email', 'e-mail', 'email address'],
  website: ['website', 'url', 'site', 'web'],
};

export function importLeadsCsv(text) {
  if (String(text).length > 1_000_000) throw new Error('CSV is larger than 1MB');
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV needs a header row and at least one data row');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(Object.entries(ALIASES).map(([k, names]) => [k, header.findIndex((h) => names.includes(h))]));
  if (idx.name < 0) throw new Error(`No "name" column found. Columns seen: ${header.join(', ')}`);
  const out = { created: 0, updated: 0, skipped: 0, errors: [] };
  for (const [n, r] of rows.slice(1, 2001).entries()) {
    const get = (k) => (idx[k] >= 0 ? (r[idx[k]] || '').trim() : '');
    const name = get('name');
    if (!name) { out.skipped++; continue; }
    try {
      const res = upsertBusiness({
        name, category: get('category') || null, city: get('city') || null, address: get('address') || null,
        phone: get('phone') || null, email: get('email') || null, website: get('website') || null,
        source: 'import', source_ref: `import:${slugify(name)}:${slugify(get('website') || get('phone') || get('city') || '')}`,
      });
      res.created ? out.created++ : out.updated++;
    } catch (e) {
      out.errors.push(`Row ${n + 2}: ${e.message}`);
    }
  }
  log('akamaru', 'leads_imported', null, null, { created: out.created, updated: out.updated, skipped: out.skipped, errors: out.errors.length });
  return out;
}
