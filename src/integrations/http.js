// Small fetch wrapper: timeouts, size caps, consistent errors.
export const USER_AGENT = 'Akamaru/1.0 (business-research bot)';

export class HttpError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function request(url, { method = 'GET', headers = {}, body, timeoutMs = 15000, maxBytes = 3_000_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: { 'user-agent': USER_AGENT, ...headers },
      body: body && typeof body !== 'string' ? JSON.stringify(body) : body,
      signal: ctrl.signal,
      redirect: 'follow',
    });
    const reader = res.body?.getReader();
    const chunks = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) { ctrl.abort(); break; }
        chunks.push(value);
      }
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return { status: res.status, ok: res.ok, headers: res.headers, url: res.url, text, bytes: size, ms: Date.now() - started };
  } catch (e) {
    const reason = e.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : e.cause?.code || e.message;
    throw new HttpError(`Request to ${new URL(url).host} failed: ${reason}`, 0, null);
  } finally {
    clearTimeout(timer);
  }
}

export async function requestJson(url, opts = {}) {
  const res = await request(url, {
    ...opts,
    headers: { accept: 'application/json', ...(opts.body ? { 'content-type': 'application/json' } : {}), ...opts.headers },
  });
  let data = null;
  try { data = res.text ? JSON.parse(res.text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || res.text.slice(0, 300);
    throw new HttpError(`HTTP ${res.status} from ${new URL(url).host}: ${msg}`, res.status, data);
  }
  return data;
}
