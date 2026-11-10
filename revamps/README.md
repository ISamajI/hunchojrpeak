---
tags: [index, revamps]
updated: 2026-11-10
---
# Revamps — the build library

Every website revamp, concept demo and Cowork build lives here, so each new revamp starts from the best of the old ones instead of from zero.

**Rule for every new revamp:** read this page and [`_kit/README.md`](_kit/README.md) first, borrow from what's here, then save the new work in `projects/<client-slug>/` and add a row to the tables below. See [[Revamp Library]] and [[Client Website Build Workflow]].

## Folder layout

| Folder | What's in it |
|---|---|
| `_kit/` | Reusable starter pieces: deploy workflow + wrangler configs, Playwright QA suites, photo upscale pipeline, the build checklist |
| `projects/` | Full source repos for revamps (multi-file, tests, deploy config). New revamps go here |
| `artifacts/` | Single-file revamp / concept sites published as claude.ai artifacts (snapshots of `index.html`) |
| `cowork/` | Everything else built in Cowork / claude.ai (dashboards, games, tools, school, personal), kept so nothing is lost and parts can be reused |
| `leads/` | Prospect lists of businesses with weak or no websites, i.e. the next revamps |
| `ARTIFACT-INDEX.md` | Every published artifact, with live links and local snapshot paths |

## Full-source revamps (`projects/`)

| Client | Folder | Stack | Reuse it for |
|---|---|---|---|
| Sean's Landscaping ([[Sean's Landscaping]]) | [`projects/seans-landscaping`](projects/seans-landscaping/README.md) | Static multi-page site generated from `src/data.mjs` by `src/build.mjs`; 24 project pages; Cloudflare Worker deploy | Bigger businesses with many services or projects. Content-as-data generator, project portfolio, filters, lightbox, scroll-spy, bid form, AI-upscaled photos (Real-ESRGAN), 30-page Playwright suite |
| J&B Automotive ([[J&B Automotive]]) | [`projects/jandbauto`](projects/jandbauto/JANDBAUTO.md) | Single page, plain HTML/CSS/JS, no build; proposal page bundled; Cloudflare Worker + GitHub Pages | Local shops. Opening animation, live open/closed badge, interactive hotspots, explorer tabs, review carousel, booking form → email, quick-action bar, JSON-LD, 96-check test suite |
| Client Tax Portal ([[Client Tax Portal]]) | [`projects/tax-portal`](projects/tax-portal/README.md) | Node.js 22.5+ server, encrypted SQLite storage, plain HTML/JS front end; needs a host with a persistent disk | Anything with logins, private uploads or e-signature. Multi-step autosaving form, encrypted file uploads, drawn signature, owner dashboard with status updates, CSRF + rate limiting |

## Single-file revamps and concepts (`artifacts/`)

Open the `index.html` straight in a browser. Live versions stay at the links in [ARTIFACT-INDEX.md](ARTIFACT-INDEX.md).

| Client / concept | Snapshot | Notes |
|---|---|---|
| J&B Automotive concept + proposal | [`jb-automotive-concept`](artifacts/jb-automotive-concept/index.html) · [`jb-website-proposal`](artifacts/jb-website-proposal/index.html) | Proposal template: today vs new table, pricing, next steps |
| Time Out On Pine | [`time-out-on-pine`](artifacts/time-out-on-pine/index.html) · [`time-out-on-pine-revamp`](artifacts/time-out-on-pine-revamp/index.html) | Restaurant / bar revamp |
| Chris Mormando | [`mormando-site-v1`](artifacts/mormando-site-v1/index.html) · [`mormando-site-v2`](artifacts/mormando-site-v2/index.html) · [`mormando-deploy-kit`](artifacts/mormando-deploy-kit/index.html) | Actor / creative portfolio; deploy-kit artifact |
| Glow Nail Studio | [`glow-nail-studio-v1`](artifacts/glow-nail-studio-v1/index.html) · [`glow-nail-studio-v2`](artifacts/glow-nail-studio-v2/index.html) | Before / after a client change request (page shells only) |
| Timbí | [`timbi-site`](artifacts/timbi-site/index.html) · [`timbi-brag-template`](artifacts/timbi-brag-template/index.html) · [`timbi-device-preview`](artifacts/timbi-device-preview/index.html) | Restaurant; phone/desktop preview frame |
| JMC Repair | [`jmc-site`](artifacts/jmc-site/index.html) | Repair shop (staff dashboard is in `cowork/jmc-staff-dashboard`) |
| JMB Lash | [`jmb-lash-booking`](artifacts/jmb-lash-booking/index.html) | Booking flow for a beauty business |
| Brothers Barbershop | [`brothers-barbershop-college-rewards`](artifacts/brothers-barbershop-college-rewards/index.html) | Rewards / loyalty page |
| Kaplan Properties | [`kaplan-properties`](artifacts/kaplan-properties/index.html) | Real-estate redesign |
| P's Barbershops | [`ps-barbershops`](artifacts/ps-barbershops/index.html) | Barbershop concept |
| Chicken Holiday Hamilton | [`chicken-holiday-hamilton`](artifacts/chicken-holiday-hamilton/index.html) | Restaurant concept |
| Rollito's Ice Cream Rolls | [`rollitos`](artifacts/rollitos/index.html) | Dessert shop concept |
| 2 The Edge Tint & Vinyl | [`2-the-edge-tint`](artifacts/2-the-edge-tint/index.html) | Auto tint / wrap concept |
| Full Depth Performance | [`full-depth-performance`](artifacts/full-depth-performance/index.html) | Performance / fitness concept |
| Danyera | [`danyera`](artifacts/danyera/index.html) | Brand concept |
| Alo Relay | [`alo-relay`](artifacts/alo-relay/index.html) | Concept demo |
| Mile Zero Sweatsuits | [`mile-zero-sweatsuits`](artifacts/mile-zero-sweatsuits/index.html) | Apparel concept |
| LTG PEAK | [`ltgpeak-site`](artifacts/ltgpeak-site/index.html) | The studio's own site ([[LTGPEAK]]) |

## Cowork builds (`cowork/`)

Not revamps, but full of parts worth reusing: dashboards, booking/rewards logic, 3D scenes, games, trackers. Highlights:

- **New 2026-11-07:** [`casa-la-brisa`](cowork/casa-la-brisa/index.html) (interactive 3D Dominican country house, three.js), [`casa-3d`](cowork/casa-3d/index.html) (3D house designer app, multi-file, three.js), [`bucks-legion`](cowork/bucks-legion/index.html) (team training app with coach/athlete roles).
- LTGPEAK ops: `ltgpeak-command-center`, `ltgpeak-crew-board`, `ltgpeak-pricing-*`, `ltgpeak-call-sheet`, `peak-uptime`, `site-pulse`.
- Full list with live links: [ARTIFACT-INDEX.md](ARTIFACT-INDEX.md).

## Leads (`leads/`)

- [`hamilton-nj-call-list.md`](leads/hamilton-nj-call-list.md) / [`.csv`](leads/hamilton-nj-call-list.csv) — 3+ star Hamilton NJ businesses with weak or no websites. See [[Cold Call Outreach Workflow]].

## Not in here (and why)

- **Cowork work that was never published as an artifact** stays on the computer that ran Cowork. To add it: publish it as an artifact (or paste the link) and ask Claude to snapshot it into `cowork/`.
- `editing-research` (viral editing trends) is on branch `claude/upbeat-lamport-07zf98`; it's content research, not a revamp.
