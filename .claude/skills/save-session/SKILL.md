---
name: save-session
description: Save the current session into Henry's second brain — log to raw/, promote durable knowledge to wiki/, deliverables to outputs/, then commit and push. Use when asked to save, log, remember, or wrap up a session.
---

# Save session

1. **Log it.** Open or create `raw/<today YYYY-MM-DD>.md`. Append a section using `templates/session-log.md`: what we worked on, decisions, what got built, open threads, next steps. Link touched notes with `[[...]]`.
2. **Promote durable knowledge.** For each new fact about how Henry works, a project, a client, a tool, or a reusable process:
   - If a `wiki/` note already covers it, update that note.
   - Otherwise create one atomic note in `wiki/` (template: `templates/wiki-note.md`) and add it to `wiki/index.md`.
3. **File deliverables.** Finished artifacts (or links to them) go in `outputs/`, named `YYYY-MM-DD-short-name.ext`, and are listed in `outputs/README.md`.
4. **Check.** No secrets, emails, or private third-party details. Every new wiki note is linked from the index.
5. **Commit and push** with a message like `Save session: <topic>`.
6. Tell Henry in 2–3 lines what was saved and where.
