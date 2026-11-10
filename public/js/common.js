// Shared helpers.
window.api = async function (url, opts = {}) {
  const o = { credentials: 'same-origin', ...opts, headers: { 'X-Requested-With': 'portal', ...(opts.headers || {}) } };
  if (o.body && !(o.body instanceof FormData)) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(o.body); }
  const res = await fetch(url, o);
  let json = {};
  try { json = await res.json(); } catch { /* non-JSON */ }
  if (res.status === 401 && !url.includes('/login')) { location.href = '/'; throw new Error('Signed out'); }
  if (!res.ok) throw new Error(json.error || 'Request failed.');
  return json;
};

window.el = function (tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
};

window.toast = function (msg, ms = 2600) {
  const t = el('div', { class: 'toast', text: msg });
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
};

window.fmtDate = function (s) {
  if (!s) return '—';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
window.fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.ceil(b / 1024) + ' KB');

window.loadConfig = async function () {
  const cfg = await api('/api/config');
  document.querySelectorAll('[data-biz]').forEach((n) => (n.textContent = cfg.businessName));
  document.querySelectorAll('[data-preparer]').forEach((n) => (n.textContent = cfg.preparerName));
  document.querySelectorAll('[data-year]').forEach((n) => (n.textContent = cfg.taxYear));
  document.title = document.title.replace('{biz}', cfg.businessName);
  return cfg;
};

window.logout = async function () {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  location.href = '/';
};

// Format answers as human-readable value.
window.displayValue = function (field, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return null;
  if (field.type === 'yesno') return v === 'yes' ? 'Yes' : 'No';
  if (field.type === 'money') return '$' + Number(String(v).replace(/[^\d.]/g, '') || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (field.type === 'checkboxes') return v.join('; ');
  if (field.type === 'date') { const [y, m, d] = String(v).split('-'); return m ? `${m}/${d}/${y}` : v; }
  return String(v);
};
