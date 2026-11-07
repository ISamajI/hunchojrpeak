---
tags: [kit, revamps, workflow]
updated: 2026-11-07
---
# Revamp starter kit

Copy from here instead of rebuilding. Everything below was pulled from the Sean's Landscaping and J&B Automotive revamps, which both shipped and passed QA. Full process: [[Client Website Build Workflow]].

## Start a new revamp

1. `mkdir revamps/projects/<client-slug>` and work there.
2. Pick a base:
   - **Small local business, one page** → start from `projects/jandbauto/jandbauto/` (index.html, styles.css, app.js).
   - **Many services or projects** → start from `projects/seans-landscaping/` and edit `src/data.mjs`; `node src/build.mjs` writes the pages.
   - **Look and feel** → browse `artifacts/` for a matching industry (restaurant, barber, auto, beauty, real estate).
3. Research the business first (Google listing, reviews, current site, socials). Use their best review line as the headline.
4. Standard pieces every revamp should have: animated intro (skippable, reduced-motion safe), sticky Call / Directions / Book bar, booking or quote form, live open/closed badge, rotating reviews, LocalBusiness JSON-LD, phone-first layout, "concept by LTGPEAK" label until the client signs.
5. Write `revamps/projects/<client-slug>/README.md` (what's there, how to run, how to deploy) and add a row to [`../README.md`](../README.md).

## What's in the kit

| File | Use |
|---|---|
| `deploy/deploy.yml` | GitHub Actions → Cloudflare Worker. Copy to `.github/workflows/deploy-<client>.yml` at the **repo root** (workflows don't run from subfolders) and replace `CLIENT` |
| `deploy/wrangler.jsonc` | Worker config for `<client>.hunchopeak.dev`, used when the `CLOUDFLARE_API_TOKEN` secret is set |
| `deploy/wrangler.temporary.jsonc` | Fallback with no token: a throwaway preview whose claim link expires in about 60 minutes |
| `deploy/build_preview.py` | Bundles the site + proposal into `dist/` (from J&B) |
| `tests/single-page-site.test.js` | Playwright suite for a one-page site: desktop, tablet, phone, reduced motion, no-JS (96 checks on J&B) |
| `tests/multi-page-site.test.mjs` | Playwright suite for multi-page sites: JS errors, overflow, headings, alt text, broken links, duplicate IDs, menus, forms |
| `photos/photos.py` + `photos.yml` | Downloads a client's photos, AI-upscales small ones with Real-ESRGAN, writes WebP variants; runs in Actions across 6 shards |

## QA before calling it done

- Serve locally (`python3 -m http.server 8765`) and run the matching test suite at 320–1440 px.
- Two review passes: functional, then visual / mobile / accessibility. Add a regression test for each bug fixed.
- Final gate before going live: Itachi review ([[Lean Grind Playbook]]).

## Go live

- Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repo secrets so deploys are permanent. Without them, previews are temporary and expire.
- Pricing reference: $650 one-time + $60/mo care plan. The proposal template is `artifacts/jb-website-proposal/`.
