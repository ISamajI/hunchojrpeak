---
tags: [workflow, ltgpeak, web]
updated: 2026-11-07
---
# Client Website Build Workflow

How [[LTGPEAK]] goes from lead to a live client site. Used for [[J&B Automotive]], [[Sean's Landscaping]], [[Chris Mormando]], [[Timbí]] and the [[Concept Demos]].

## 1 · Research the business
- Pull their Google listing, reviews, current site and socials (Firecrawl). Note what's broken: no tap-to-call, no booking, stale hours, typos, dead analytics.
- Use their best review line as the headline.

## 2 · Build the demo
- Build in `ISamajI/hunchojrpeak` on a `claude/*` branch. Static site, phone-first.
- Standard pieces: animated intro, sticky Call / Directions / Book bar, booking request form, live open/closed badge, rotating reviews, LocalBusiness schema, phone + desktop preview frame.
- Label it "concept / demo by LTGPEAK" until the client signs.

## 3 · QA loop
- Serve locally and run automated checks at 320–1440px (Playwright).
- Agent A = functional QA, Agent B = visual / mobile / accessibility QA. They review only; fixes are patched after, with a regression test per bug. Run twice.
- Itachi does the final gate on anything going live ([[Lean Grind Playbook]] Tier 3).

## 4 · Proposal
- One-page proposal artifact: today vs. new site table, outcomes, flat pricing, next steps.
- Reference pricing: $650 one-time + $60/mo care plan (hosting, updates, backups, monthly check-in).

## 5 · Go live
- GitHub Pages: build a `live/` folder → push to `gh-pages` → check it returns 200 from outside with Firecrawl.
- Cloudflare Worker: deploy via GitHub Actions + `wrangler` (`wrangler.jsonc` + `.github/workflows/deploy.yml`).
  - **Without a `CLOUDFLARE_API_TOKEN` repo secret it deploys to a temporary account and the claim link expires in ~60 min.** Add the token as a secret to make deploys permanent.
- Older path: a "deploy kit"/"relay" artifact that hands files to the Cloudflare upload page (Mormando Deploy Kit, Hunchopeak Deploy Relay).

## 6 · After launch
- Track change requests on the Crew Board, uptime on Peak Uptime ([[LTGPEAK]]).

## Related
- [[Cold Call Outreach Workflow]] · [[Lean Grind Playbook]] · [[Home]]
