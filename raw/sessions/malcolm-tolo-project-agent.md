---
title: Malcolm tolo project agent
session_id: session_01G5MYe5FEWL79PGmRmqbkfq
date: 2026-08-28
status: done
tags: [session, akamaru-system, agent, malcomtolo, seo, analytics, slash-command]
---

# Malcolm tolo project agent (Malcomtolo)

> Coverage note: full session read.

## Summary
The first named agent. Claude found the Malcomtolo project in `~/Downloads/malcomtolo` (`SETUP_INSTRUCTIONS.md`, `identity.md`, `soul.md`, `user.md`) and followed Option C of those instructions to make it a real user-level Claude Code subagent for analytics, content/SEO strategy and web engineering. Because the business is pre-launch, Claude refused to invent a brand name, URL or competitors and marked the USER section "pre-launch" instead. A Website-Design project note was added in Obsidian, and `/malcomtolo` was created as a skill that forks into the agent; its first answer was "define the business fundamentals first".

## What was built / decided
- `~/.claude/agents/malcomtolo.md`.
- `~/.claude/skills/malcomtolo/SKILL.md` (first use of the skill-as-command pattern: `context: fork` + `agent:`).
- Obsidian project note under `HunchoBrain/Projects/Website-Design/` (Malcomtolo Agent.md).
- Memory: `project_malcomtolo_agent.md`, `feedback-autonomy-vs-facts` (act autonomously but never fabricate business facts).

## Workflow / process used
- Read the project's own setup instructions first, then follow them.
- Template that the later agents copied: identity / soul / user sections + vault note + memory + slash command.

## Open items / next steps
- Fill in business name, niche, offer, target audience and website URL; then revisit the USER section.

## Related
[[Akamaru System]] · [[Akamaru System|Agent Roster]] · [[Akamaru System|Tsunade]] · [[Client Website Build Workflow|Website Design]] · [[create-mainbrain-documents-directory|HunchoBrain]]
