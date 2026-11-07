---
title: Create MainBrain documents directory
session_id: session_01MpypHzhh7f44y8hvLxg5GT
date: 2026-08-28
status: done
tags: [session, obsidian, hunchobrain, dashboard, second-brain]
---

# Create MainBrain documents directory

> Coverage note: full session read.

## Summary
Started with `mkdir -p ~/Documents/MainBrain`, then "make me a main brain that's set up with organized projects and a dashboard where I can see and control all my work". Claude built a folder structure plus a single-file HTML dashboard, then, when Henry wanted it in Obsidian, migrated everything into the existing Obsidian vault as project notes with frontmatter properties and a native Obsidian **Bases** dashboard (Board by status, By Category, Active, Blocked, Idea, Done). The standalone MainBrain copy was removed, and the vault was renamed from `~/Documents/Obsidian Vault` to **`~/Documents/HunchoBrain`** with Obsidian's vault registry updated.

## What was built / decided
- `~/Documents/HunchoBrain/` (renamed vault): `Projects/` (Website-Design, Content-Creation, Engineering, Templates), `Projects/Templates/Project Template.md` (frontmatter: category, status, priority, started, link, path, tag `project`), `Projects Dashboard.base`, `Resources/`, `Archive/`, `Brain.md` index.
- Decision: use Obsidian Bases instead of embedded HTML (Obsidian notes cannot run scripts).

## Workflow / process used
- New project = copy the template note, fill frontmatter -> appears in the Base dashboard automatically.

## Open items / next steps
- None noted. This vault became the home for all agent notes (`Agents/`, `Commands/`).

## Related
[[HunchoBrain]] · [[Akamaru System]] · [[Ruflo installation]] · [[Malcolm Tolo]]
