'use strict';
// Usage: npm run create-owner -- owner@email.com "StrongPassword" "Owner Name"
process.removeAllListeners('warning');
const db = require('../lib/db');
const { hashPassword } = require('../lib/crypto');

const [email, password, name = 'Veronica'] = process.argv.slice(2);
if (!email || !password || password.length < 10) {
  console.error('Usage: npm run create-owner -- owner@email.com "StrongPassword(10+ chars)" "Owner Name"');
  process.exit(1);
}
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
if (existing) {
  db.prepare("UPDATE users SET pw_hash = ?, role = 'owner', name = ? WHERE id = ?").run(hashPassword(password), name, existing.id);
  console.log('Updated existing account to owner:', email);
} else {
  db.prepare("INSERT INTO users (email, name, pw_hash, role) VALUES (?, ?, ?, 'owner')").run(email.toLowerCase(), name, hashPassword(password));
  console.log('Owner account created:', email);
}
