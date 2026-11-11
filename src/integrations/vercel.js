// Vercel Deployments API: uploads static demo files inline as a PREVIEW deployment.
// Production target is never set here; production publishing requires owner approval.
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config.js';
import { requestJson } from './http.js';

function collectFiles(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.posix.join(prefix, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full, rel));
    else out.push({ file: rel, data: fs.readFileSync(full).toString('base64'), encoding: 'base64' });
  }
  return out;
}

export async function deployStatic({ dir, name, production = false }) {
  const token = env('VERCEL_TOKEN');
  if (!token) throw new Error('VERCEL_TOKEN is not set');
  const base = env('VERCEL_API_URL', 'https://api.vercel.com');
  const team = env('VERCEL_TEAM_ID');
  const qs = team ? `?teamId=${encodeURIComponent(team)}` : '';
  const body = {
    name: name.slice(0, 52),
    files: collectFiles(dir),
    projectSettings: { framework: null },
    ...(production ? { target: 'production' } : {}),
  };
  const data = await requestJson(`${base}/v13/deployments${qs}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body,
    timeoutMs: 60000,
  });
  if (!data?.url) throw new Error('Vercel response did not include a deployment URL');
  return { url: `https://${data.url}`, id: data.id, readyState: data.readyState || null };
}
