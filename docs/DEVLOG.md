# Development Log

## 2026-11-11 — Milestone 1: autonomous core

**Starting point.** The repo held only a README. "Akamaru" existed as a Claude plugin of
agent prompts (8 branches, each with a planner, executor and reviewer) with no running
system behind it. Those branches are now the system's modules.

**Architecture decisions**
- Node 22 + built-in `node:sqlite`/`node:http`/`node:test`. The only dependency is
  `@anthropic-ai/sdk`, so there are no native builds and nothing to break on install.
- Every integration has a deterministic fallback, so the pipeline runs end to end with zero keys.
- The Claude client pins its base URL (`AKAMARU_ANTHROPIC_BASE_URL`, default
  api.anthropic.com), so a host-level `ANTHROPIC_BASE_URL` can't silently reroute business data.
- Claude calls use structured outputs (JSON schema), `claude-opus-5-5`, and server-side
  refusal fallbacks (`fallbacks: "default"`).

**Bugs found and fixed during the build**
- The QA "fabricated social proof" check matched "p*review*" in the demo banner, which
  blocked every demo. Fixed with word boundaries.
- A "question" reply draft contained an `[OWNER: …]` placeholder and was one-click
  sendable. It is now held as a draft, and `queueCampaign` refuses any body containing the marker.
- AI copy that fails QA now falls back to template copy instead of halting the lead.
- The dashboard showed score reasons twice when no AI summary existed.

**Verification**
- 33 automated tests at milestone time (45 after hardening), all passing, including a full pipeline run (3 discovered
  businesses: no-site → demo, outdated Wix site → demo plus email scraped from the site,
  modern site → correctly not pitched).
- Dashboard and demos checked in headless Chromium (desktop + mobile): no console errors.

**Environment limits**
- The build sandbox blocks outbound traffic to OSM, Vercel, Resend and Google, so those
  adapters were verified against local contract stubs only. First live check:
  `npm run doctor -- --live` on the owner's machine.

## 2026-11-11 — Security review (Itachi) and hardening

An independent review agent found **no way to bypass owner approval**. It did find these real issues, all now fixed with regression tests in `test/security.test.js`:

| Severity | Finding | Fix |
|---|---|---|
| HIGH | SSRF guard bypassed by IPv6 forms of private IPv4 (`::ffff:127.0.0.1`, NAT64, 6to4, `fe90::`), plus multicast | New `src/integrations/safeFetch.js`: `net.BlockList` ranges, decodes every embedded-IPv4 form |
| HIGH | Redirect hops and DNS rebinding skipped the guard | IP checked at connect time via a custom DNS `lookup`; redirects followed manually and re-checked, capped at 5 |
| MED | Re-processing ignored the score threshold | The stored score is enforced when research is skipped |
| MED | "Rebuild all" stacked duplicate send approvals; cross-process double approve | New draft supersedes old ones; atomic `UPDATE … WHERE status='pending'`; Resend `Idempotency-Key` |
| MED | Send ignored lead/campaign state; "no thanks" didn't suppress | Send requires `pending_approval` + non-terminal lead; terminal stage cancels pending sends; not_interested → suppression |
| MED | Scraped text could steer AI copy (prompt injection) | Untrusted data wrapped in `<untrusted_*>` tags; AI output with any unknown URL/phone/email is rejected and falls back to template; AI drafts flagged in the approval card |
| LOW | Unvalidated / multi-recipient emails | `normalizeEmail` on store and send |
| LOW | Spoofed inbound `From:` | Webhook accepts `spf`/`dkim`; failures can't change lead state or trigger replies (unsubscribes still honored) |

## 2026-11-11: Milestone 2, AKUMARU Command Center

**Goal:** a premium operating interface where every element shows real data, or says plainly that the data doesn't exist.

**Backend added:**
- Job runner with step-by-step progress and crash recovery.
- SSE event bus.
- Invoice ledger.
- Metrics engine.
- Command engine.
- Notification center with Twilio escalation.
- Scheduler, uptime monitor, Claude marketing drafts, CSV import, global search, system telemetry, and six agent identities.
- Schema migration v2.
- Routes moved to `src/api.js`. Every original endpoint still behaves the same.

**Frontend:** rebuilt as 20 views on a shared component and chart kit. Chart colors were validated with the dataviz palette validator on the dark surface `#10141b`: all checks pass, worst adjacent CVD ΔE 9.4. Every chart has hover tooltips, a legend for two or more series, and a table view.

**Honesty rules enforced in code:**
- Revenue comes only from the ledger.
- The projection is labeled as a model, with its inputs shown.
- Marketing is offline without Claude, with no template fakery.
- Uptime reads "not monitored" until checks exist.
- Failures stay in the activity feed and notifications.

**Bugs found by looking at real renders:**
- The quick-command icon rendered unsized.
- The mobile menu button showed on desktop.
- The chart crosshair was visible at rest.
- The command thread didn't scroll to the newest message.
- Finished jobs showed their last step instead of "Completed".
- Preview iframes broke when the dashboard port differed from the configured public URL.
- Preview CSP `frame-ancestors 'none'` blocked in-app previews (now `'self'`).
- A sandboxed queued job crashed the runner when its row was gone.

**Verification:** 68 tests, all passing: 15 command-center API tests and 8 real-browser UI tests (every page, palette → command, approval confirmation, Kanban moves, sandboxed preview, invoice recording, keyboard navigation). A manual Chromium sweep of all 20 routes showed no console errors. Mobile was checked at iPhone 13 size.
