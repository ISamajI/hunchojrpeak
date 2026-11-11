# Pipeline modules

## Discovery (`branches/discovery.js`)
Uses Google Places when `GOOGLE_PLACES_API_KEY` is set, otherwise OpenStreetMap (a Nominatim
geocode, then an Overpass query). Category words map to OSM tags (`barber` → `shop=hairdresser`).
Results are upserted by `source_ref`, so re-running a search never duplicates leads.

## Research: Jiraiya (`branches/jiraiya-research.js`)
Fetches the business website (15s timeout, 3MB cap, SSRF guard rejects private/link-local
IPs, including after redirects) and extracts: title, meta description, emails, phones, socials,
platform (Wix/Squarespace/WordPress/…), mobile viewport, HTTPS, booking/ordering links,
analytics, schema.org data, copyright year and text length. It fills missing email/phone from the
site. With Claude connected it also writes a summary, pitch angles and tone, using only the audited facts.

## Scoring: Clavo Dulce (`branches/clavo-score.js`)
0–100 score. Every point carries a reason string (e.g. `+15 not mobile-friendly`).
Hot ≥ 60, warm ≥ 40, cold below. Leads below `AKAMARU_DEMO_THRESHOLD` (default 40) are not pitched.

## Demo: Orochimaru (`branches/orochimaru-demo.js`)
A self-contained `index.html` (inline CSS, no JS) personalized with name, city, phone, email,
address, hours and map link. Nine industry presets set palette, services and CTA. Each demo carries a
"Concept preview … not the official site" banner, `noindex`, and robots.txt. Versions are kept (`v1`, `v2`, …).

## QA: Itachi (`branches/itachi-qa.js`)
Hard gate before deploy. It fails on any script, template placeholder, fabricated social proof
(reviews/testimonials/awards/stars), missing CTA, missing noindex/label, or a page over 200KB.

## Deploy (`branches/deploy.js`)
Vercel preview deployment (inline base64 files, never `target: production`) when a token is set,
otherwise a local URL served at `/preview/<slug>/vN/`. Production publishing is `publish_production`, which needs approval.

## Outreach and replies: Kakashi (`branches/kakashi-outreach.js`)
Drafts cite only real observations. Email leads are queued for `send_outreach` approval; phone-only
leads get a call script. The CAN-SPAM footer is added at send time. Inbound replies are classified
(Claude or keywords) into interested / question / not_interested / unsubscribe / out_of_office / other:
- interested → stage `interested`, reply drafted and queued for approval
- question → reply drafted as an editable draft (has an owner placeholder; cannot be sent until edited)
- not_interested → `lost`; unsubscribe → suppression list, pending sends cancelled, `do_not_contact`

## Onboarding (`branches/onboarding.js`)
Marking a lead `won` creates a 12-step checklist. Proposal, contract, payment, domain purchase
and production publish are flagged owner-only.
