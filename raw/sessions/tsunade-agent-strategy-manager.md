---
title: Tsunade agent strategy manager
session_id: session_01FMwgptquHB1jYg4iPEzTXn
date: 2026-08-29
status: done
tags: [session, akamaru-system, agent, tsunade, strategy, orchestrator, slash-command]
---

# Tsunade agent strategy manager

> Coverage note: full session read.

## Summary
Tsunade was built as the leader of the agents: a strategist and portfolio manager that surveys opportunities, ranks them by impact/confidence/effort, writes strategy, and delegates execution to specialist agents. After Henry asked Claude to use the context in his projects, Claude found identity/soul/user/setup files in the vault root and synced Tsunade's roster (Malcomtolo, Kakashi, Shikamaru, Itachi, Jiraiya, Orochimaru). Henry stated a standing rule: "don't ask me if you can, do it at your own will", which was saved as an autonomy feedback memory. `/tsunade` was added as a skill.

## What was built / decided
- `~/.claude/agents/tsunade.md` (model opus).
- `~/.claude/skills/tsunade/SKILL.md` (`context: fork`, `agent: tsunade`, `disable-model-invocation: true`); bare `/tsunade` runs a portfolio-wide prioritization.
- Obsidian: `HunchoBrain/Agents/tsunade.md`, `HunchoBrain/Agents/malcomtolo.md`, command note, `Brain.md`.
- Memory: `project_tsunade_agent.md`; autonomy-preference feedback memory (act and report rather than propose first).

## Workflow / process used
- Agent-creation pattern; Tsunade is the coordinator the other agents report to.

## Open items / next steps
- None noted.

## Related
[[Akamaru System]] · [[Akamaru System|Agent Roster]] · [[Akamaru System|Shikamaru]] · [[Akamaru System|Kakashi]] · [[malcolm-tolo-project-agent|Malcolm Tolo]]
