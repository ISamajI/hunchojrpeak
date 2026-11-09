'use strict';
process.removeAllListeners('warning'); // hide node:sqlite "experimental" notice
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const db = require('./lib/db');
const C = require('./lib/crypto');

const PORT = Number(process.env.PORT) || 3000;
const BUSINESS_NAME = process.env.BUSINESS_NAME || 'Peak Tax Services';
const TAX_YEAR = Number(process.env.TAX_YEAR) || new Date().getFullYear() - 1;
const SESSION_DAYS = 30;
const IS_PROD = process.env.NODE_ENV === 'production';
const UPLOAD_DIR = path.join(C.DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Owner account bootstrap ----------
if (process.env.OWNER_EMAIL && process.env.OWNER_PASSWORD) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(process.env.OWNER_EMAIL);
  if (!exists) {
    db.prepare("INSERT INTO users (email, name, pw_hash, role) VALUES (?, ?, ?, 'owner')")
      .run(process.env.OWNER_EMAIL, process.env.OWNER_NAME || 'Owner', C.hashPassword(process.env.OWNER_PASSWORD));
    console.log('[setup] Owner account created for', process.env.OWNER_EMAIL);
  }
}
if (!db.prepare("SELECT 1 FROM users WHERE role = 'owner'").get()) {
  console.warn('[setup] No owner account yet. Run: npm run create-owner -- you@email.com "StrongPassword"');
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ---------- Security headers ----------
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  if (IS_PROD) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '2mb' }));

// ---------- Sessions (remembered for 30 days, httpOnly cookie) ----------
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setSessionCookie(res, token, maxAgeSec) {
  const parts = [`sid=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (IS_PROD) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function createSession(res, userId) {
  const token = C.randomToken();
  const expires = Date.now() + SESSION_DAYS * 864e5;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(C.sha256(token), userId, expires);
  setSessionCookie(res, token, SESSION_DAYS * 86400);
}

app.use((req, res, next) => {
  const token = parseCookies(req).sid;
  if (!token) return next();
  const row = db.prepare(`SELECT s.token_hash, s.expires_at, u.id, u.email, u.name, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(C.sha256(token));
  if (!row || row.expires_at < Date.now()) {
    if (row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    setSessionCookie(res, '', 0);
    return next();
  }
  // Sliding expiry: refresh once a day of activity.
  if (row.expires_at - Date.now() < (SESSION_DAYS - 1) * 864e5) {
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(Date.now() + SESSION_DAYS * 864e5, row.token_hash);
    setSessionCookie(res, token, SESSION_DAYS * 86400);
  }
  req.user = { id: row.id, email: row.email, name: row.name, role: row.role };
  req.sessionHash = row.token_hash;
  next();
});

// CSRF: every state-changing API call must carry a custom header (cross-site forms can't set it).
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.get('X-Requested-With') !== 'portal') {
    return res.status(403).json({ error: 'Bad request origin.' });
  }
  res.set('Cache-Control', 'no-store');
  next();
});

const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Please sign in.' }));
const requireClient = (req, res, next) => (req.user?.role === 'client' ? next() : res.status(403).json({ error: 'Client account required.' }));
const requireOwner = (req, res, next) => (req.user?.role === 'owner' ? next() : res.status(403).json({ error: 'Owner access only.' }));

// ---------- Simple brute-force protection ----------
const attempts = new Map();
function tooMany(key) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter((t) => now - t < 15 * 60e3);
  attempts.set(key, a);
  return a.length >= 8;
}
const recordFail = (key) => attempts.get(key)?.push(Date.now()) ?? attempts.set(key, [Date.now()]);

const cleanEmail = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;

// ---------- Auth API ----------
app.get('/api/config', (req, res) => res.json({ businessName: BUSINESS_NAME, taxYear: TAX_YEAR }));

app.get('/api/me', (req, res) => res.json({ user: req.user || null }));

app.post('/api/register', (req, res) => {
  const email = cleanEmail(req.body.email);
  const name = String(req.body.name || '').trim().slice(0, 120);
  const password = String(req.body.password || '');
  if (!name) return res.status(400).json({ error: 'Enter your full name.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account with that email already exists. Sign in instead.' });
  }
  const { lastInsertRowid } = db.prepare("INSERT INTO users (email, name, pw_hash, role) VALUES (?, ?, ?, 'client')")
    .run(email, name, C.hashPassword(password));
  createSession(res, Number(lastInsertRowid));
  res.json({ ok: true, role: 'client' });
});

app.post('/api/login', (req, res) => {
  const email = cleanEmail(req.body.email);
  const key = `${req.ip}|${email}`;
  if (tooMany(key)) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes and try again.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !C.verifyPassword(String(req.body.password || ''), user.pw_hash)) {
    recordFail(key);
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  attempts.delete(key);
  createSession(res, user.id);
  res.json({ ok: true, role: user.role });
});

app.post('/api/logout', (req, res) => {
  if (req.sessionHash) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionHash);
  setSessionCookie(res, '', 0);
  res.json({ ok: true });
});

app.post('/api/change-password', requireUser, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!C.verifyPassword(String(req.body.current || ''), user.pw_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  const next = String(req.body.next || '');
  if (next.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  db.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').run(C.hashPassword(next), user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(user.id, req.sessionHash);
  res.json({ ok: true });
});

// ---------- Client return API ----------
function getOrCreateReturn(userId) {
  let r = db.prepare('SELECT * FROM returns WHERE user_id = ? AND tax_year = ?').get(userId, TAX_YEAR);
  if (!r) {
    db.prepare('INSERT INTO returns (user_id, tax_year) VALUES (?, ?)').run(userId, TAX_YEAR);
    r = db.prepare('SELECT * FROM returns WHERE user_id = ? AND tax_year = ?').get(userId, TAX_YEAR);
  }
  return r;
}
const editable = (r) => r.status === 'draft' || r.status === 'needs_info';
const listFiles = (returnId) => db.prepare('SELECT id, category, orig_name, mime, size, created_at FROM files WHERE return_id = ? ORDER BY id').all(returnId);
const log = (returnId, message) => db.prepare('INSERT INTO activity (return_id, message) VALUES (?, ?)').run(returnId, message);

app.get('/api/return', requireUser, requireClient, (req, res) => {
  const r = getOrCreateReturn(req.user.id);
  res.json({
    id: r.id, taxYear: r.tax_year, status: r.status, data: C.decryptJSON(r.data_enc) || {},
    signedName: r.signed_name, signedAt: r.signed_at, submittedAt: r.submitted_at,
    ownerNote: r.owner_note, editable: editable(r), files: listFiles(r.id),
  });
});

// Autosave draft answers.
app.put('/api/return', requireUser, requireClient, (req, res) => {
  const r = getOrCreateReturn(req.user.id);
  if (!editable(r)) return res.status(409).json({ error: 'This return was already submitted and is locked.' });
  const data = req.body.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'Invalid data.' });
  db.prepare("UPDATE returns SET data_enc = ?, updated_at = datetime('now') WHERE id = ?").run(C.encryptJSON(data), r.id);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});

// Final sign + submit.
app.post('/api/return/submit', requireUser, requireClient, (req, res) => {
  const r = getOrCreateReturn(req.user.id);
  if (!editable(r)) return res.status(409).json({ error: 'This return was already submitted.' });
  const { data, signature, signedName, agree } = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Questionnaire is missing.' });
  if (!agree) return res.status(400).json({ error: 'You must agree to the authorization statement.' });
  const name = String(signedName || '').trim();
  if (name.length < 3) return res.status(400).json({ error: 'Type your full legal name to sign.' });
  if (typeof signature !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) || signature.length < 1500) {
    return res.status(400).json({ error: 'Please draw your signature in the box.' });
  }
  const wasResubmit = r.status === 'needs_info';
  db.prepare(`UPDATE returns SET data_enc = ?, signature_enc = ?, signed_name = ?, signed_at = datetime('now'),
    signed_ip = ?, submitted_at = datetime('now'), status = 'submitted', seen_by_owner = 0, updated_at = datetime('now')
    WHERE id = ?`).run(C.encryptJSON(data), C.encryptJSON(signature), name.slice(0, 150), req.ip, r.id);
  log(r.id, wasResubmit ? 'Client re-submitted with requested info' : 'Client signed and submitted questionnaire');
  res.json({ ok: true });
});

// ---------- Document uploads (encrypted on disk) ----------
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED.has(file.mimetype)),
});

app.post('/api/return/files', requireUser, requireClient, (req, res) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be under 15 MB.' : 'Upload failed.' });
    const r = getOrCreateReturn(req.user.id);
    if (r.status === 'completed') return res.status(409).json({ error: 'This return is completed.' });
    if (!req.files?.length) return res.status(400).json({ error: 'Only PDF or image files (JPG, PNG, HEIC) are accepted.' });
    const category = String(req.body.category || 'Other').slice(0, 60);
    const insert = db.prepare('INSERT INTO files (return_id, category, orig_name, mime, size, stored_name) VALUES (?, ?, ?, ?, ?, ?)');
    for (const f of req.files) {
      const stored = C.randomToken(18) + '.bin';
      fs.writeFileSync(path.join(UPLOAD_DIR, stored), C.encryptBuffer(f.buffer), { mode: 0o600 });
      insert.run(r.id, category, path.basename(f.originalname).slice(0, 150), f.mimetype, f.size, stored);
    }
    if (!editable(r)) {
      db.prepare('UPDATE returns SET seen_by_owner = 0 WHERE id = ?').run(r.id);
      log(r.id, `Client uploaded ${req.files.length} new document(s) after submitting`);
    }
    res.json({ ok: true, files: listFiles(r.id) });
  });
});

app.delete('/api/return/files/:id', requireUser, requireClient, (req, res) => {
  const r = getOrCreateReturn(req.user.id);
  if (!editable(r)) return res.status(409).json({ error: 'Documents are locked after submitting.' });
  const f = db.prepare('SELECT * FROM files WHERE id = ? AND return_id = ?').get(Number(req.params.id), r.id);
  if (!f) return res.status(404).json({ error: 'Not found.' });
  fs.rmSync(path.join(UPLOAD_DIR, f.stored_name), { force: true });
  db.prepare('DELETE FROM files WHERE id = ?').run(f.id);
  res.json({ ok: true, files: listFiles(r.id) });
});

function sendFile(res, f, inline) {
  const buf = C.decryptBuffer(fs.readFileSync(path.join(UPLOAD_DIR, f.stored_name)));
  res.set({
    'Content-Type': f.mime,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${f.orig_name.replace(/[^\w.\- ]/g, '_')}"`,
    'Cache-Control': 'no-store',
  });
  res.send(buf);
}

app.get('/api/return/files/:id', requireUser, requireClient, (req, res) => {
  const r = getOrCreateReturn(req.user.id);
  const f = db.prepare('SELECT * FROM files WHERE id = ? AND return_id = ?').get(Number(req.params.id), r.id);
  if (!f) return res.status(404).json({ error: 'Not found.' });
  sendFile(res, f, true);
});

// ---------- Owner dashboard API ----------
app.get('/api/admin/returns', requireUser, requireOwner, (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, r.tax_year, r.status, r.submitted_at, r.updated_at, r.seen_by_owner, r.signed_name,
           u.name, u.email, u.created_at AS joined,
           (SELECT COUNT(*) FROM files f WHERE f.return_id = r.id) AS file_count
    FROM returns r JOIN users u ON u.id = r.user_id
    ORDER BY CASE r.status WHEN 'submitted' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'needs_info' THEN 2 WHEN 'draft' THEN 3 ELSE 4 END,
             COALESCE(r.submitted_at, r.updated_at) DESC`).all();
  res.json({ returns: rows });
});

app.get('/api/admin/returns/:id', requireUser, requireOwner, (req, res) => {
  const r = db.prepare(`SELECT r.*, u.name, u.email FROM returns r JOIN users u ON u.id = r.user_id WHERE r.id = ?`).get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'Not found.' });
  if (!r.seen_by_owner && r.status !== 'draft') db.prepare('UPDATE returns SET seen_by_owner = 1 WHERE id = ?').run(r.id);
  res.json({
    id: r.id, taxYear: r.tax_year, status: r.status, client: { name: r.name, email: r.email, userId: r.user_id },
    data: C.decryptJSON(r.data_enc) || {}, signature: C.decryptJSON(r.signature_enc),
    signedName: r.signed_name, signedAt: r.signed_at, signedIp: r.signed_ip, submittedAt: r.submitted_at,
    ownerNote: r.owner_note, files: listFiles(r.id),
    activity: db.prepare('SELECT message, created_at FROM activity WHERE return_id = ? ORDER BY id DESC').all(r.id),
  });
});

app.post('/api/admin/returns/:id/status', requireUser, requireOwner, (req, res) => {
  const r = db.prepare('SELECT * FROM returns WHERE id = ?').get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'Not found.' });
  const status = String(req.body.status);
  if (!['submitted', 'in_progress', 'needs_info', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const note = String(req.body.note || '').trim().slice(0, 2000);
  if (status === 'needs_info' && !note) return res.status(400).json({ error: 'Tell the client what you need.' });
  db.prepare("UPDATE returns SET status = ?, owner_note = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, status === 'needs_info' ? note : (note || r.owner_note), r.id);
  const labels = { submitted: 'Submitted', in_progress: 'In progress', needs_info: 'Needs info', completed: 'Completed' };
  log(r.id, `Status changed to "${labels[status]}"${note ? ` — note: ${note}` : ''}`);
  res.json({ ok: true });
});

app.get('/api/admin/files/:id', requireUser, requireOwner, (req, res) => {
  const f = db.prepare('SELECT * FROM files WHERE id = ?').get(Number(req.params.id));
  if (!f) return res.status(404).json({ error: 'Not found.' });
  sendFile(res, f, req.query.dl !== '1');
});

app.post('/api/admin/users/:id/reset-password', requireUser, requireOwner, (req, res) => {
  const u = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'client'").get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Client not found.' });
  const temp = C.randomToken(9);
  db.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').run(C.hashPassword(temp), u.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  res.json({ ok: true, tempPassword: temp });
});

// ---------- Pages ----------
const page = (f) => (req, res) => res.sendFile(path.join(__dirname, 'public', f));
app.get('/', (req, res) => {
  if (req.user) return res.redirect(req.user.role === 'owner' ? '/admin' : '/portal');
  page('index.html')(req, res);
});
app.get('/portal', (req, res) => (req.user?.role === 'client' ? page('portal.html')(req, res) : res.redirect('/')));
app.get('/admin', (req, res) => (req.user?.role === 'owner' ? page('admin.html')(req, res) : res.redirect('/')));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// Clean expired sessions hourly.
setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 3600e3).unref();

app.listen(PORT, () => console.log(`${BUSINESS_NAME} portal running on http://localhost:${PORT}`));
