---
tags: [clients, project, build]
updated: 2026-11-10
---
# Client Tax Portal

A secure intake site for a tax preparer. She sends clients one link. They create an account, fill out a 6-step tax questionnaire, upload W-2s, 1099s and ID, and e-sign. She gets an owner dashboard at `/admin` that shows each new submission.

- **Source:** [`revamps/projects/tax-portal/`](../revamps/projects/tax-portal/README.md). Node.js 22.5+, `server.js` + `lib/` (crypto, db) + `public/`.
- **Security:** answers, signatures and uploads are encrypted at rest (AES-256-GCM); passwords use scrypt; httpOnly cookies, CSRF protection, login rate limiting, strict CSP.
- **Status:** built 2026-11-09. Not deployed yet. It needs a Node host with a persistent disk (Render, Railway, Fly.io or a VPS) and HTTPS.

## Reuse it for
Any client who needs logins, private file uploads or e-signatures (intake forms, onboarding, document collection).

## Related
- [[Client Website Build Workflow]]
- [[Revamp Library]]
- [[LTGPEAK]]
- [[Home]]
