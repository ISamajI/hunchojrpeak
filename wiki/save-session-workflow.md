# Save-session workflow

**What:** the routine that turns a session (Cowork, Claude Code, claude.ai) into permanent memory in this repo.

1. Log the session to `raw/YYYY-MM-DD.md` (template: `templates/session-log.md`).
2. Promote durable facts into atomic `wiki/` notes — update before you duplicate.
3. File finished deliverables in `outputs/`.
4. Commit + push.

- **Claude Code in this repo:** run `/save-session`.
- **Cowork / claude.ai:** paste the save prompt from the repo README, then file the result here.
- **Other repos & pipelines:** point their `CLAUDE.md` at this repo so they read [[how-i-work]] first.

## Related
- [[note-conventions]] · [[how-i-work]] · [[index]]
