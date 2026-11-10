---
title: Higgsfield integration
session_id: session_01TmKX5rjs6Bcu7LieUR3X8R
date: 2026-09-10
status: partial (logins pending)
tags: [session, claude-code-setup, mcp, higgsfield, perplexity, replit, ai-video]
---

# Higgsfield integration

> Coverage note: first and last pages read (2026-09-10 and 2026-09-14); a middle stretch may be missing.

## Summary
Henry asked to "add Higgsfield into my Claude". Claude researched Higgsfield's official MCP/CLI (hosted MCP at mcp.higgsfield.ai, OAuth, no API key; access to image/video models like Kling, Veo, Seedance, Flux, Soul), installed the Higgsfield CLI and its Claude Code skills, then also added Perplexity and Replit MCP servers at Henry's request. Logins needed Henry's browser approval: the Higgsfield OAuth login timed out, and Replit needs `/mcp` authentication. On 2026-09-14 Henry asked to "integrate FrameRate into Claude"; no matching product was found and Claude asked for clarification.

## What was built / decided
- `npm i -g @higgsfield/cli` (v1.1.24).
- `npx skills add higgsfield-ai/skills` -> 8 skills symlinked in `~/.agents/skills/higgsfield-*`: brandkit, generate, marketplace-cards, product-photoshoot, soul-id, video-explainer, websites, youtube-thumbnail.
- Perplexity MCP and Replit MCP added to Claude Code config. OAuth URLs: [redacted].
- Ran on Henry's Mac (Claude Code, Sonnet).

## Workflow / process used
1. WebSearch + WebFetch the vendor's official setup docs before installing.
2. Install CLI, install skills, register MCP servers (`claude mcp add`, user scope).
3. Hand OAuth/browser approvals back to Henry (`higgsfield auth login`, `/mcp` -> replit); new MCP servers load only in a fresh session.

## Open items / next steps
- Run `higgsfield auth login` and approve in browser.
- Run `/mcp` -> replit to finish authorization; restart Claude Code to load new servers.
- Clarify what "FrameRate" is (company, repo or MCP server).

## Related
[[terminal-setup|Claude Code Setup]] · [[Content & Social Workflow]] · [[Mikonos]] · [[terminal-setup|Terminal setup]] · [[ruflo-installation|Ruflo installation]]
