# CLAUDE.md — instructions for any Claude session in this repo

This repo is Henry's second brain / long-term memory. Treat it as the source of truth for how he works.

## On session start
1. Read `wiki/index.md`, then `wiki/how-i-work.md` and `wiki/agent-system.md`.
2. Skim the most recent 2–3 files in `raw/` for what was happening lately.
3. Follow those preferences without being re-told.

## Note rules (Obsidian)
- Daily notes and session logs → `raw/YYYY-MM-DD.md` (append if the day's file exists).
- Codified/reference knowledge → `wiki/` — **atomic: one idea per note**, kebab-case filenames.
- Published/finished artifacts → `outputs/`.
- Connect related notes with `[[wiki links]]` (use the note name without `.md`, e.g. `[[how-i-work]]`).
- Every new `wiki/` note must be linked from `wiki/index.md` and link back to at least one related note.
- Use the templates in `templates/`.

## Saving work
When asked to save / log / "remember this", or when running `/save-session`:
1. Write the session log to `raw/` (template: `templates/session-log.md`).
2. Promote anything durable (a preference, a decision, a project fact, a reusable process) into a `wiki/` note — update an existing note rather than duplicating.
3. Put finished deliverables in `outputs/`.
4. Commit with a clear message and push.

## Never store
Passwords, API keys, tokens, email addresses, phone numbers, payment info, or other people's private details. Reference where a secret lives, never its value.
