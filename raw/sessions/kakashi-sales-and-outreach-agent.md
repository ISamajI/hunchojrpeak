---
title: Kakashi sales and outreach agent
session_id: session_01RzvbdLLrV8bAonKqH2RbmD
date: 2026-08-29
status: done
tags: [session, akamaru-system, agent, kakashi, sales, lead-generation, slash-command]
---

# Kakashi sales and outreach agent

> Coverage note: full session read.

## Summary
Henry asked to make Kakashi the sales, lead generation, outreach and client acquisition agent ("I want Kakashi to get me clients"). Claude built a user-level subagent with the Malcomtolo-style IDENTITY/SOUL/USER structure and a Business Development project note. Henry clarified that Kakashi should be a **main/lead agent** that will get its own subagents later, and showed a screenshot of a claude.ai Project "Kakashi (sales/client Acquisition)" whose brief is find potential clients, research their websites, analyze problems/opportunities. Claude added the `Agent` tool, a Team & Delegation section, sharpened prospecting to match that brief, saved a feedback memory that new named agents default to orchestrator, and added `/kakashi`.

## What was built / decided
- `~/.claude/agents/kakashi.md` (lead sales agent; drafts outreach freely but never sends without per-batch approval).
- `~/.claude/commands/kakashi.md` -> `/kakashi find 10 prospects in local landscaping`.
- Obsidian: `HunchoBrain/Agents/kakashi.md`, `HunchoBrain/Projects/Business Development/Kakashi Agent.md`, `HunchoBrain/Commands/kakashi-command.md`, `Brain.md` Agents + new Commands section.
- Memory: `project_kakashi_agent.md`, `feedback-agent-orchestrator-default`.
- Note: claude.ai Projects (web) and `~/.claude/agents` (Claude Code) are separate systems; Claude cannot edit the web Project.

## Workflow / process used
- Agent-creation pattern (see [[Etachi QA audit agent]]); for leads, grounding in the claude.ai Project brief Henry screenshotted.
- Kakashi's real-world pipeline later showed up in [[Business call list with bad/no websites]] -> demo site -> proposal ([[J&B Automotive]], [[Sean's Landscaping]]).

## Open items / next steps
- Add specialist sales subagents under Kakashi.
- Fill in business fundamentals (brand, niche, services, target client) still placeholder in the vault.

## Related
[[Akamaru System]] · [[Agent Roster]] · [[Lead Generation]] · [[Cold Call Outreach Workflow]] · [[Tsunade]]
