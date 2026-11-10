'use strict';
// Encryption-at-rest (AES-256-GCM) and password hashing (scrypt).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

function loadKey() {
  if (process.env.ENCRYPTION_KEY) {
    const k = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    if (k.length !== 32) throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes).');
    return k;
  }
  // No key supplied: generate one and keep it next to the data (owner-only perms).
  const keyFile = path.join(DATA_DIR, 'secret.key');
  if (!fs.existsSync(keyFile)) {
    fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    console.warn('[security] Generated a new encryption key at', keyFile,
      '- back it up! Without it, stored client data cannot be decrypted.');
  }
  return Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');
}

const KEY = loadKey();

function encryptBuffer(buf) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]); // [12 iv][16 tag][data]
}

function decryptBuffer(buf) {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

const encryptJSON = (obj) => encryptBuffer(Buffer.from(JSON.stringify(obj))).toString('base64');
const decryptJSON = (str) => (str ? JSON.parse(decryptBuffer(Buffer.from(str, 'base64')).toString()) : null);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(pw, stored) {
  const [, saltHex, hashHex] = String(stored).split('$');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

module.exports = { DATA_DIR, encryptBuffer, decryptBuffer, encryptJSON, decryptJSON, hashPassword, verifyPassword, randomToken, sha256 };
