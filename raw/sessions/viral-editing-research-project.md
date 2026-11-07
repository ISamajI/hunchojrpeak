---
title: Viral editing research project
session_id: session_01TTo3ymcbmT4RWgW2QXMsTN
date: 2026-11-06
status: done
tags: [session, research, video-editing, content-creation, obsidian-wiki, multi-agent]
---

# Viral editing research project

> Coverage note: transcript read from the newest 4 pages (2026-11-06 21:43 UTC onward). The opening request is older than what was read.

## Summary
Claude ran a multi-agent research project on what editing styles and tools are driving viral short-form video in mid/late 2026. Five research subagents (YouTube, TikTok, Instagram Reels, X/Snapchat/Pinterest/LinkedIn/Twitch/Kick, and editing tools/AI) each wrote a sourced raw note; then a source-vetting agent and a synthesizer agent turned them into an Obsidian-style wiki of ~75 notes plus a final trend report. On 2026-11-07 Henry pivoted the same session to asking for Mikonos marketing strategies (the `mikonos-post` skill loaded, then the request was interrupted).

## What was built / decided
- Repo `ISamajI/hunchojrpeak`, branch `claude/upbeat-lamport-07zf98`, folder `editing-research/`
  - `raw/2026-11-06 YouTube Editing Trends.md` (18 techniques, 27 sources)
  - `raw/2026-11-06 TikTok Editing Trends.md` (17 techniques, 29 sources)
  - `raw/2026-11-06 Instagram Reels Editing Trends.md` (27 techniques, 32 sources)
  - raw note for X / Snapchat / Pinterest / LinkedIn / Twitch / Kick
  - `raw/2026-11-06 Editing Tools ...` (18 tool entries, 65 sources)
  - `outputs/Source Vetting Report.md` (112 domains, 209 unique https URLs; 67 trusted, none failed; TLS not testable because the proxy blocked direct connections)
  - `wiki/` ~75 notes (e.g. Speed Ramp, Jump Cut, Text Overlay POV, Camera POV Reveals, Hook AB Testing, Stream Clip Highlights, Long-to-Short Clipping, CapCut, Veo and Gemini Omni, TikTok, Over-Editing Backlash) + `wiki/Editing Research Index.md`
  - `outputs/2026-11 Viral Editing Trends Report.md`
- Key findings: over-editing backlash (pacing that breathes), low-effort text-on-one-take posts, photo carousels, word-by-word captions, match cuts; Sora shut down (app April, API September 2026), AI video now mostly Veo/Gemini Omni, Kling, Runway, Seedance inside CapCut.
- Tools: Firecrawl search/scrape, background `Agent` subagents, git commits per note (stop hook forces commit+push).
- Unofficial sources (e.g. capcutguide.com) were labelled with a warning in the wiki.

## Workflow / process used
1. Fan out N research subagents in parallel, one per platform/topic, each writing a dated, sourced raw note into `raw/`.
2. Commit + push each note as it lands (repo stop hook requires it).
3. Run a source-vetting agent (https only, no shorteners/APK/crack links, spot-check low-reputation domains via Firecrawl).
4. Run a synthesizer agent that writes atomic wiki notes with frontmatter, aliases and `[[links]]`, then an index (map of content) and a final report.
5. Link-check that every `[[wiki link]]` resolves to a file or alias; flag notes that rely on caution-rated sources.

## Open items / next steps
- Mikonos marketing-strategy list was requested on 2026-11-07 but interrupted; not delivered.
- Site TLS/security could not be verified from the sandbox.
- A few minor unresolved wiki links were left and reported.

## Related
[[Mikonos]] · [[Content & Social Workflow]] · [[Video Captions and Mikonos Ad]] · [[HunchoBrain]] · [[Jiraiya]]
