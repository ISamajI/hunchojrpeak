---
title: Session transcripts index
date: 2026-11-07
tags: [index, sessions]
---

# Session transcripts index

One summary per past Claude session (20 sessions, 2026-08-27 to 2026-11-07). Secrets, claim links, OAuth URLs, emails and private phone numbers are redacted.

## Setup and second brain
- [[terminal-setup]] - First Mac setup: Claude Code native install, nvm/Node, Obsidian, Wispr Flow, repo clones, Artlist MCP.
- [[ruflo-installation]] - Ruflo plus first custom skills (bg-remove, instagram-post), internal-tool and claude-code-docs MCP servers, code-improver agent, first Obsidian brain.
- [[create-mainbrain-documents-directory]] - MainBrain folders and dashboard, migrated into Obsidian Bases; vault renamed to HunchoBrain.
- [[higgsfield-integration]] - Higgsfield CLI + 8 skills, Perplexity and Replit MCP servers; logins still pending.

## Akamaru agent system (Naruto-named agents)
- [[malcolm-tolo-project-agent]] - Malcomtolo analytics/content/web-engineering agent and the first `/malcomtolo` skill-command; source of the pattern the others copy.
- [[jarvis-personalized-assistant-agent]] - Jarvis full-machine assistant with a custom desktop-control MCP server.
- [[tsunade-agent-strategy-manager]] - Tsunade, strategist and leader of all agents; `/tsunade`; "act, don't ask" rule.
- [[jiraiya-agent-information-discovery]] - Jiraiya research, competitor and trend scout; `/jiraiya`.
- [[kakashi-sales-and-outreach-agent]] - Kakashi lead sales and client acquisition agent (orchestrator); `/kakashi`.
- [[shikamaru-problem-solving-agent]] - Shikamaru deep-reasoning decision analyst (opus); `/shikamaru`.
- [[etachi-qa-audit-agent]] - Itachi (renamed from Etachi) QA, audit and security gate; `/itachi`.
- [[rochimaru-systems-builder-agent]] - Orochimaru systems, tools and automation builder; `/orochimaru`.
- [[live-council-rooftop-trap-house-graphics]] - "Trap House Council" 3D game artifact where the agents appear in Naruto style.

## Client websites and lead generation
- [[business-call-list-with-bad-no-websites]] - Firecrawl Maps search: 90 businesses in Hamilton NJ rated 3 stars or more with broken, weak or no websites.
- [[jandbauto-website-redesign]] - J&B Automotive demo site and proposal, live on GitHub Pages and a temporary Cloudflare Worker.
- [[seans-landscaping-website-revamp]] - Sean's Landscaping demo with an intro animation and AI-upscaled photos, on a temporary Cloudflare Worker.

## Mikonos and content creation
- [[video-captions-advertisement-edit-mikonos-website]] - Captioned Mikonos vertical ad, QA'd and upscaled to 4K with Real-ESRGAN.
- [[viral-editing-research-project]] - Multi-agent research into 2026 viral editing trends, turned into a ~75-note wiki and a report; Mikonos marketing request at the end.

## School
- [[deviance-theory-assignment]] - Chapter 6 deviance quiz answers (1-c, 2-b, 3-b, 4-a); Kortext not reachable.
- [[deviance-theories-and-crime-analysis]] - Deviance discussion post, a four-sentence version and peer replies.

## Recurring workflows (cross-session)
- **Agent creation:** `~/.claude/agents/<name>.md` -> HunchoBrain `Agents/` note + `Brain.md` index -> memory file in `~/.claude/projects/-Volumes-Claude/memory/` -> `/name` via a `context: fork` skill or `~/.claude/commands/`. Each agent is grounded in `~/Documents/HunchoBrain/Projects/` and must not invent business facts.
- **Website build/deploy:** build in `ISamajI/hunchojrpeak` on a `claude/*` branch -> QA subagents + regression tests at 320-1440px -> proposal page -> GitHub Pages (`gh-pages`) and/or a Cloudflare Worker deployed by GitHub Actions with wrangler (a temporary account with a claim link when there is no `CLOUDFLARE_API_TOKEN`) -> check from outside with Firecrawl.
- **Research:** run parallel research subagents -> sourced raw notes -> a source-vetting agent -> a synthesizer that writes the wiki and report -> link check.
- **Media:** ffmpeg + Playwright graphics + ASR-based QA; Real-ESRGAN upscaling (ONNX locally, or on GitHub runners).
