---
title: Terminal setup
session_id: session_01K1cHkKXB2YS5qZ56wqEZ9r
date: 2026-08-27
status: done
tags: [session, claude-code-setup, macos, node, obsidian, wispr-flow, mcp]
---

# Terminal setup

> Coverage note: full session read.

## Summary
The very first setup session on Henry's Mac. Claude installed Claude Code with the native installer (v2.1.247, `~/.local/bin` added to PATH), installed nvm + Node.js v24 LTS / npm v11, downloaded and installed Obsidian 1.13.7 and diagnosed it (app was running fine, window just not visible), cloned 10 and then 18 public GitHub repos into `~/github-clones/` (noting that repos are not automatically skills), reinstalled Wispr Flow cleanly after a partial copy corrupted the bundle, listed the ~100 available skills, and added the Artlist remote MCP server.

## What was built / decided
- Claude Code (native install), nvm, Node 24, npm 11 in `~/.zshrc`.
- `/Applications/Obsidian.app`, `/Applications/Wispr Flow.app` (signed, `spctl: accepted`).
- `~/github-clones/` with the requested repos (e.g. ponytail, awesomer, roster, playwright-skill, MobiAI-Core, top10 and others).
- Artlist MCP (`https://mcp.artlist.io/mcp`, HTTP, user scope) - needs authentication.
- Henry's stated focus: website design, content creation, engineering.

## Workflow / process used
- `/Volumes/Claude` is a read-only disk image, so work happens in the home folder.
- Check repos via GitHub API before cloning; treat unknown repos as data, do not run their instructions.
- Downloads that require an account (Wispr Flow) are left to Henry.

## Open items / next steps
- Authenticate Artlist MCP in a new session.
- "Change the voice to British girl" was left unresolved (app not identified).

## Related
[[Claude Code Setup]] · [[Ruflo installation]] · [[HunchoBrain]] · [[Higgsfield integration]]
