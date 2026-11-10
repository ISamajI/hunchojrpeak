---
title: Ruflo installation
session_id: session_01Xe8H21BsWiJgX7JRV4q3kv
date: 2026-08-27
status: done
tags: [session, claude-code-setup, ruflo, skills, mcp, obsidian]
---

# Ruflo installation

> Coverage note: newest 4 pages read (2026-08-27 ~05:49 UTC onward). The actual Ruflo install step is older than what was read; the session's later recap confirms `ruflo` was set up.

## Summary
A long Claude Code setup session on Henry's Mac. After Ruflo was set up, it covered connecting GitHub on claude.ai (organization settings need a Team/Enterprise plan; personal Connectors is the route), building custom skills (`bg-remove`, offline background removal, tested; `instagram-post`, caption + hashtags), setting up a FastMCP `internal-tool` server (uv + Python 3.12 because system Python was 3.9, `mcp<2` pinned), adding the `claude-code-docs` HTTP MCP server, creating the read-only `code-improver` subagent (Sonnet), and seeding the first Obsidian "brain" (Brain.md index, notes for each skill/agent/MCP server, Local REST API plugin enabled).

## What was built / decided
- `~/.claude/skills/bg-remove/SKILL.md`, `~/.claude/skills/instagram-post/SKILL.md`.
- `~/mcp-servers/internal-tool/` (`server.py`, `pyproject.toml`), registered user-scope; `claude-code-docs` MCP (HTTP, user scope).
- `~/.claude/agents/code-improver.md` (Read/Grep/Glob only).
- Obsidian vault (then `~/Documents/Obsidian Vault`): `Brain.md`, skill/agent/mcp-server notes, `obsidian-local-rest-api` plugin enabled.
- Decision: do not re-add `internal-tool` with bare `python` (would break the working uv setup).

## Workflow / process used
- Narrow broad requests ("unlimited skills") into concrete skills via AskUserQuestion, build, then verify end to end before calling it done.
- MCP servers added mid-session only load in a new session.

## Open items / next steps
- Generate the Obsidian Local REST API key in the Obsidian UI to finish the Obsidian MCP connection.

## Related
[[terminal-setup|Claude Code Setup]] · [[terminal-setup|Terminal setup]] · [[create-mainbrain-documents-directory|HunchoBrain]] · [[higgsfield-integration|Higgsfield integration]]
