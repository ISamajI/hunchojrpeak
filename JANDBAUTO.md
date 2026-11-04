# J&B Automotive — website redesign

Modern, single-page redesign of jandbauto.com (Mercerville, NJ). Plain HTML/CSS/JS — no build step.

## Live on Cloudflare Pages
Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → repo `hunchojrpeak`:
- Production branch: `claude/laughing-feynman-kkbasz` (or `main` after merging)
- Framework preset: **None** · Build command: *(empty)* · Build output directory: **`jandbauto`**

Every push to that branch redeploys automatically. The preview is `noindex`; remove that line in `jandbauto/index.html` when it moves to jandbauto.com.

## Run locally
```bash
cd jandbauto && python3 -m http.server 8765
```
Open http://localhost:8765 (add `?intro` to replay the opening animation).

## Features
- **Opening animation** — garage door + tachometer rev, skippable (click / Esc), plays once per session, skipped for reduced-motion users.
- **Live open/closed badge** — computed in shop time (America/New_York), "closing soon" in the last hour.
- **Interactive vehicle scan** — hotspots on the hero car jump to the matching repair category.
- **Repair explorer** — 7 categories, keyboard-accessible tabs.
- **Dashboard warning-light decoder** — 8 lights with meaning, urgency and next steps.
- **Mileage maintenance planner** — slider shows what's typically due and what's next.
- **Reviews carousel**, **appointment form** (validates, pre-fills an email to the shop), lazy Google Map, mobile quick-action bar.
- SEO: AutoRepair JSON-LD, meta/OG tags. Works without JS.

## Tests
```bash
node tests/jandbauto.test.js run   # from repo root; needs the local server above + Playwright
```
96 checks across desktop, tablet, mobile, reduced-motion and no-JS.
