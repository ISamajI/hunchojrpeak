---
title: Business call list with bad/no websites
session_id: session_01TTo3ynJoUR981tVwFnQtPE
date: 2026-11-04
status: done
tags: [session, lead-generation, sales, firecrawl, hamilton-nj]
---

# Business call list with bad/no websites

> Coverage note: full session read.

## Summary
Henry asked for a call list of local businesses rated 3 stars or more that have a bad website or none, found with Firecrawl. Claude used Firecrawl's Alexandria `businesses/search` (Maps) capability around Hamilton, NJ, pulled 200 listings across 10 business types, removed chains and sub-3-star results, graded each independent website through Firecrawl JSON extraction (the sandbox blocks direct requests), and produced a tiered list of 90 businesses.

## What was built / decided
- `outputs/hamilton-nj-call-list.csv` (and companion output) on branch `claude/brave-einstein-4pjrd7` in `ISamajI/hunchojrpeak`; file also sent to Henry.
- 90 businesses, 87 with phone numbers (business numbers from Google Maps; not reproduced here, see the CSV).
- Tiers: Tier 1 broken website right now (e.g. a nail salon whose domain now shows gambling spam, a parked deli domain, a site that will not load), then no website, then weak website.

## Workflow / process used
1. Ask for location (AskUserQuestion) -> Hamilton NJ.
2. `firecrawl_find_tools` -> `businesses/search` with lat/long, several categories.
3. Filter: rating >= 3, independent (no chains).
4. Grade websites with `firecrawl_scrape` + JSON prompt (dead, no HTTPS, not mobile friendly, outdated, parked/hijacked).
5. Build CSV call list sorted by urgency, commit to a branch, send file.

## Open items / next steps
- Start calling Tier 1 leads; pitch a site rebuild (same pattern as J&B and Sean's demos).
- Numbers are from a single day's Maps data and may be stale.

## Related
[[Kakashi]] · [[Lead Generation]] · [[J&B Automotive]] · [[Sean's Landscaping]] · [[Website Design]]
