# Akamaru Roadmap

Status key: ✅ built and tested · 🟡 built, awaiting live credentials · ⬜ not started

## Milestone 1: Autonomous core (this release)
- ✅ SQLite persistence with versioned migrations (`src/db.js`)
- ✅ Decision engine: autonomous vs. owner-approval, fail-safe on unknown actions
- ✅ Approval queue with executors, dedupe, failure recording, owner previews
- ✅ Lead CRM: stages, forward-only auto-advance, notes, suppression list
- ✅ Discovery: OpenStreetMap (no key) 🟡 Google Places (needs key)
- ✅ Website research: HTML audit, contact extraction, SSRF guard
- ✅ Explainable opportunity scoring
- ✅ Demo builder: 9 industry presets, personalized from real data, clearly labeled concept, noindex
- ✅ Itachi QA gate: blocks scripts, placeholders, fabricated reviews/awards
- ✅ Local previews 🟡 Vercel preview deploys (needs token)
- ✅ Outreach drafts grounded in findings; 2-step follow-up sequence
- 🟡 Approved email send via Resend with CAN-SPAM footer (needs key + domain)
- ✅ Reply ingestion (webhook + CLI), intent classification, routing, unsubscribe handling, SPF/DKIM-aware
- ✅ Security hardening from independent review (SSRF, prompt-injection guard, idempotent sends)
- ✅ Won → onboarding plan with owner-gated binding tasks
- ✅ Dashboard + JSON API with token auth, CSRF and DNS-rebinding guards
- 🟡 Claude-written research/copy/outreach (needs `ANTHROPIC_API_KEY`; template fallback works today)

## Milestone 2: Command Center (this release)
- ✅ 20-page AI command center: overview core, live activity, command interface, Kanban, revenue, analytics, agents, workflows, schedules, approvals, studios, integrations, notifications, system health, settings
- ✅ Background job runner + real-time SSE stream
- ✅ Invoice ledger; revenue and projection computed from data only
- ✅ Natural-language commands (rules + optional Claude), CSV import, voice input (browser-supported)
- ✅ Notification center with Twilio SMS/call escalation 🟡 (needs Twilio)
- ✅ Scheduler (pipeline, follow-up scan, uptime) and uptime monitor
- 🟡 Marketing/Content Studio (needs Claude)

## Milestone 3: Follow-ups and batching
- ⬜ Send approved follow-ups on day 3 / day 7 (each still gated)
- ⬜ Batch approval ("approve all 8 outreach emails") with per-item preview
- ⬜ Reply threading by `In-Reply-To` / Resend message id, not just sender email
- ⬜ Owner notifications (email/SMS digest of pending approvals)

## Milestone 4: Better demos
- ⬜ Screenshot each demo (Playwright) for email thumbnails and dashboard cards
- ⬜ Pull real photos/logo from the business's existing site or Google Places (with attribution)
- ⬜ Multiple template layouts per industry; A/B which converts
- ⬜ Lighthouse score in QA

## Milestone 5: Close and onboard
- ⬜ Proposal/quote generator (PDF) → owner approval → send
- ⬜ E-signature integration (contract send = approval action)
- ⬜ Stripe payment links (charge = approval action), auto-recording paid invoices into the ledger
- ⬜ Production build pipeline: custom domain, Google Business Profile link, analytics

## Milestone 6: Hosting Akamaru
- ⬜ Deploy the dashboard (Fly.io/Render/VPS) with persistent volume + backups
- ⬜ Multi-user roles (owner vs. assistant)
