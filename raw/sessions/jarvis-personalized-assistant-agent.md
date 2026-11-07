---
title: Jarvis personalized assistant agent
session_id: session_01CqfuNTLGCKp4e9MFPqh9bh
date: 2026-08-28
status: done (macOS permissions pending)
tags: [session, akamaru-system, agent, jarvis, mcp, desktop-control, slash-command]
---

# Jarvis personalized assistant agent

> Coverage note: full session read.

## Summary
Henry wanted Jarvis as a personal assistant that can see and control everything he does and change anything he has worked on. After plan mode and clarifying questions, Claude built a concept folder (identity, soul, user, setup docs), a custom desktop-control MCP server (Node MCP server + Python Quartz CGEvent controller for mouse/keyboard and screenshots), a `jarvis` subagent with full-machine reach, and a `/jarvis` skill. Jarvis was made aware of the whole sibling agent team with Tsunade as coordinator. Test: `/jarvis how many bots do i have running` reported 8 active Claude sessions; a skill count reported 7 custom skills.

## What was built / decided
- `~/Developer/jarvis/` with `identity.md`, `soul.md`, `user.md`, `SETUP_INSTRUCTIONS.md`, and the `jarvis-desktop-control` MCP server (`package.json`, `index.js`, `control.py`).
- pyobjc (Cocoa/Quartz) installed using a `CFLAGS="-Wno-error=default-const-init-var-unsafe"` workaround.
- MCP server registered with Claude Code (connects cleanly).
- `~/.claude/agents/jarvis.md`, `~/.claude/skills/jarvis/SKILL.md`.
- Obsidian: Engineering project note (priority High), `Brain.md`.
- Memory: `project-jarvis-agent` + `MEMORY.md` line.
- Custom skills at the time: bg-remove, instagram-post, jarvis, malcomtolo, tsunade, shikamaru, orochimaru.

## Workflow / process used
1. Plan mode -> confirm scope and paths -> ExitPlanMode.
2. Write concept docs -> build MCP server -> install deps -> syntax/smoke test -> `claude mcp add` -> skill wrapper -> vault note -> memory.

## Open items / next steps
- Grant macOS Screen Recording (and Accessibility) permissions so screenshot and input control fully work.
- Kakashi and Itachi lacked skill wrappers at that moment (they use `~/.claude/commands/` instead).

## Related
[[Akamaru System]] · [[Agent Roster]] · [[Tsunade]] · [[Orochimaru]] · [[HunchoBrain]]
