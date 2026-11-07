---
tags: [system, project]
updated: 2026-11-07
---
# Akamaru System

Akamaru is Henry's multi-agent assistant system (also built as "Jarvis"): 8 Naruto-named branches, each with planner → executor → reviewer subagents. The council dashboards visualize the roster live.

## Key details

- Branches: Akamaru/Jarvis (personal assistant), Tsunade (strategy), Jiraiya (research), Kakashi (sales), Orochimaru (systems builder), Clavo Dulce (analytics), Itachi (QA/security), Shikamaru (problem solving). Malcolm appears as an extra agent in the Command Deck.
- Each branch has 3 stage agents (planner / executor / reviewer) = 24 subagents.
- Lean Grind Flow is the operating playbook: intake → route to cheapest tier that can win → run → quality gate → ship.
- Visuals: Akamaru Command Deck (voice "Hey [agent]"), Rooftop Council HQ (3D roof), Rooftop Council Live + Trap House Council (live simulated shifts), Crew Lineup, Huncho Flow (live workflow feed).

## How a new agent gets created
1. `~/.claude/agents/<name>.md` with identity / soul / user sections.
2. Note in `~/Documents/HunchoBrain/Agents/` and update the `Brain.md` index.
3. Memory file in `~/.claude/projects/-Volumes-Claude/memory/`.
4. `/name` command, either a skill with `context: fork` + `agent:` or a file in `~/.claude/commands/`.
- Rules: check `HunchoBrain/Projects/` first and never invent business facts. Act without asking. New named agents default to orchestrator.
- Malcomtolo was the first agent and is the template the others copy. Itachi was renamed from Etachi.

## Artifacts

| Updated | Artifact | Live | Local |
|---|---|---|---|
| 2026-10-31 | Trap House Council | [open](https://claude.ai/artifact/1AEhZm9Mwuae3Eha9t8hBC) | [snapshot](../outputs/trap-house-council/index.html) |
| 2026-10-25 | Rooftop Council Live | [open](https://claude.ai/artifact/X9H8W5aqKmR761cAr4tYyB) | [snapshot](../outputs/rooftop-council-live/index.html) |
| 2026-10-18 | Crew Lineup | [open](https://claude.ai/artifact/8f4KpiDw8AA2VyNQ7vJBf6) | [snapshot](../outputs/crew-lineup/index.html) |
| 2026-10-07 | Huncho Flow | [open](https://claude.ai/artifact/BwKthCc4RPWkuhb3a5FJbq) | [snapshot](../outputs/huncho-flow/index.html) |
| 2026-09-17 | Lean Grind Flow | [open](https://claude.ai/artifact/KRhdjoKUUS1n7XsvkohVnM) | [snapshot](../outputs/lean-grind-flow/index.html) |
| 2026-08-31 | Akamaru Command Deck | [open](https://claude.ai/artifact/KSbQrjBkUjH6L8ZU27i6vP) | [snapshot](../outputs/akamaru-command-deck/index.html) |
| 2026-08-29 | Rooftop Council HQ | [open](https://claude.ai/artifact/LQvE5kwPizLT7TT86sQX8t) | [snapshot](../outputs/rooftop-council-hq/index.html) |

## Related

- [[Lean Grind Playbook]]
- [[LTGPEAK]]
- [[Huncho Personal OS]]
- [[Home]]
