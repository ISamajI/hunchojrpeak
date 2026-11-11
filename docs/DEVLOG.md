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
- 33 automated tests, all passing, including a full pipeline run (3 discovered
  businesses: no-site → demo, outdated Wix site → demo plus email scraped from the site,
  modern site → correctly not pitched).
- Dashboard and demos checked in headless Chromium (desktop + mobile): no console errors.

**Environment limits**
- The build sandbox blocks outbound traffic to OSM, Vercel, Resend and Google, so those
  adapters were verified against local contract stubs only. First live check:
  `npm run doctor -- --live` on the owner's machine.
