---
title: Rochimaru systems builder agent
session_id: session_01BGAFeJdBaCbb7cprdfTfG7
date: 2026-08-29
status: done
tags: [session, akamaru-system, agent, orochimaru, automation, slash-command]
---

# Rochimaru systems builder agent (Orochimaru)

> Coverage note: full session read.

## Summary
Henry asked for "Rochimaru" (Orochimaru) to be the builder agent that creates tools, workflows, systems and automations. Claude asked scope questions (answers: existing project on his project list; build domain "all of the above, orchestrated"), found the HunchoBrain vault `Projects/` folders (Business Development, Content-Creation, Engineering, Templates, Website-Design), and created an `orochimaru` subagent that builds new subagents, skills, hooks, slash commands, scripts, integrations and scheduled automations with the narrowest tool scope needed. It initially recorded Kakashi/Itachi/Shikamaru as a missing-agent backlog; once those were found built by parallel sessions, the backlog was corrected and the roster recorded as eight agents. `/orochimaru` was added as a skill.

## What was built / decided
- `~/.claude/agents/orochimaru.md`.
- `~/.claude/skills/orochimaru/SKILL.md` (mirrors `/malcomtolo`: forks to the agent, `disable-model-invocation: true`, passes `$ARGUMENTS`).
- Obsidian: `HunchoBrain/Agents/orochimaru.md`, `HunchoBrain/Projects/Engineering/Orochimaru Agent.md`, `Brain.md` roster.
- Roster at the time: tsunade, shikamaru, malcomtolo, kakashi, jiraiya, itachi, orochimaru, code-improver.

## Workflow / process used
- Agent-creation pattern; clarify scope via AskUserQuestion first; re-sync roster awareness when parallel sessions change `Brain.md`.

## Open items / next steps
- Orochimaru is the agent to ask for new automations/agents going forward.

## Related
[[Akamaru System]] · [[Agent Roster]] · [[Tsunade]] · [[Jarvis]] · [[HunchoBrain]]
