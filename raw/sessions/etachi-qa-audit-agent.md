---
title: Etachi QA audit agent
session_id: session_01PiQ5jVQD9e3QpEykk9Xw8a
date: 2026-08-29
status: done
tags: [session, akamaru-system, agent, itachi, qa, audit, slash-command]
---

# Etachi QA audit agent (renamed Itachi)

> Coverage note: full session read.

## Summary
Henry asked to turn his "Etachi" project into the QA/audit/security agent that checks all outputs. Claude created a user-level Claude Code subagent, then renamed it to **Itachi** when Henry corrected the spelling, updating every reference (agent file, Obsidian vault note, `Brain.md` index, memory files). Itachi is an independent review gate: it reviews and reports, it does not execute or fix, and it grounds itself in `~/Documents/HunchoBrain/Projects/` before judging. Finally `/itachi [target]` was added as a slash command (bare `/itachi` audits the most recent work).

## What was built / decided
- `~/.claude/agents/itachi.md` (subagent definition; includes "Working with the rest of the roster": Tsunade, Malcomtolo, Kakashi, Shikamaru).
- `~/.claude/commands/itachi.md` (slash command delegating to the subagent).
- Obsidian: `~/Documents/HunchoBrain/Agents/itachi.md`, a command note under Commands, `Brain.md` Agents + Commands sections updated.
- Memory: `~/.claude/projects/-Volumes-Claude/memory/project_itachi_agent.md` + `MEMORY.md` index line.

## Workflow / process used
(Standard agent-creation pattern used for every agent on 2026-08-28/29.)
1. Search the disk/vault for existing project material; copy the pattern from Malcomtolo/Tsunade.
2. Write `~/.claude/agents/<name>.md` with frontmatter (name, description, tools, model) and identity/soul/user style sections.
3. Add an Obsidian tracking note in `HunchoBrain/Agents/` and update `Brain.md`.
4. Save a project memory file + `MEMORY.md` line.
5. When asked, add `/name` as a command (`~/.claude/commands/` or a `context: fork` skill).

## Open items / next steps
- None noted; parallel sessions were creating sibling agents at the same time.

## Related
[[Akamaru System]] · [[Akamaru System|Agent Roster]] · [[Akamaru System|Tsunade]] · [[Akamaru System|Shikamaru]] · [[Akamaru System|Kakashi]] · [[create-mainbrain-documents-directory|HunchoBrain]]
