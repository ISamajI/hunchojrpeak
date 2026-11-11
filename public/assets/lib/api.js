// API client + live event stream. The admin token (when the server requires one)
// is kept in localStorage and sent as a bearer header; the CSRF header is always sent.
const TOKEN_KEY = 'akumaru_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
}

function headers(extra = {}) {
  const h = { 'x-akamaru': '1', ...extra };
  const t = getToken();
  if (t) h.authorization = `Bearer ${t}`;
  return h;
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function handle(res) {
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const msg = data?.error || res.statusText || `HTTP ${res.status}`;
    if (res.status === 401) window.dispatchEvent(new CustomEvent('akumaru:auth'));
    throw new ApiError(msg, res.status);
  }
  return data;
}

export const api = {
  get: (path) => fetch(path, { headers: headers() }).then(handle),
  post: (path, body = {}) => fetch(path, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) }).then(handle),
  postText: (path, text, type = 'text/csv') => fetch(path, { method: 'POST', headers: headers({ 'content-type': type }), body: text }).then(handle),
};

// ---------- Live stream (SSE over fetch so auth headers work) ----------
const listeners = new Set();
const statusListeners = new Set();
export const live = {
  status: 'connecting',
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  onStatus(fn) { statusListeners.add(fn); fn(this.status); return () => statusListeners.delete(fn); },
};

function setStatus(s) {
  live.status = s;
  for (const fn of statusListeners) fn(s);
}

export async function connectLive() {
  let delay = 1000;
  for (;;) {
    try {
      setStatus('connecting');
      const res = await fetch('/api/stream', { headers: headers() });
      if (!res.ok) throw new Error(`stream ${res.status}`);
      setStatus('live');
      delay = 1000;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          let type = 'message';
          let data = '';
          for (const line of chunk.split('\n')) {
            if (line.startsWith('event: ')) type = line.slice(7);
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (!data) continue;
          let parsed;
          try { parsed = JSON.parse(data); } catch { continue; }
          for (const fn of listeners) { try { fn(type, parsed); } catch (e) { console.error(e); } }
        }
      }
    } catch { /* fall through to reconnect */ }
    setStatus('reconnecting');
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(15000, delay * 2);
  }
}
