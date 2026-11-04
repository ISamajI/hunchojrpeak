# J&B Automotive — website redesign

Modern, single-page redesign of jandbauto.com (Mercerville, NJ). Plain HTML/CSS/JS — no build step.

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
node tests/site.test.js run   # needs the local server above + Playwright
```
96 checks across desktop, tablet, mobile, reduced-motion and no-JS.
