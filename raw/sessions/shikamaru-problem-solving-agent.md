---
title: Shikamaru problem-solving agent
session_id: session_01BcAtjAA8ed7V9m5thAQqHX
date: 2026-08-29
status: done
tags: [session, akamaru-system, agent, shikamaru, decision-analysis, slash-command]
---

# Shikamaru problem-solving agent

> Coverage note: full session read.

## Summary
Henry wanted Shikamaru as the deep-reasoning problem solver and strategist that creates decisions and evaluates them. No source project files existed, so Claude designed a user-level subagent (model opus, like Tsunade) that follows a fixed method: frame the real question, generate options, evaluate and red-team its own pick, and decide. After "use the context I added to my projects", a "Grounding yourself before you decide" section was added so Shikamaru reads `~/Documents/HunchoBrain/Projects/` instead of inventing facts. `/shikamaru` was then built as a skill that forks into the subagent.

## What was built / decided
- `~/.claude/agents/shikamaru.md` (model: opus).
- `~/.claude/skills/shikamaru/SKILL.md` (`context: fork`, `agent: shikamaru`) -> `/shikamaru <problem>`.
- Obsidian note in `HunchoBrain/Agents/`, `Brain.md` Agents index updated.
- Memory: `project_shikamaru_agent.md` + `MEMORY.md` line.

## Workflow / process used
- Same agent-creation pattern as [[etachi-qa-audit-agent|Etachi QA audit agent]]; slash command implemented as a skill with `context: fork` so the full agent context loads (pattern first used for `/malcomtolo`).

## Open items / next steps
- Business context in the vault was still placeholder at the time, so decisions depend on Henry filling in niche/offer/brand.

## Related
[[Akamaru System]] · [[Akamaru System|Agent Roster]] · [[Akamaru System|Tsunade]] · [[Akamaru System|Itachi]] · [[create-mainbrain-documents-directory|HunchoBrain]]
