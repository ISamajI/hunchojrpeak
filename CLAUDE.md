# hunchojrpeak — instructions for Claude

This repo is Henry's work vault (Obsidian) and build library.

## Revamps: always build off past work

- Any website revamp, redesign, concept demo or client site goes in `revamps/projects/<client-slug>/`.
- Before starting one, read `revamps/README.md` and `revamps/_kit/README.md`, look at the closest past revamp in `revamps/projects/` and `revamps/artifacts/`, and reuse its code, deploy setup and tests instead of starting from scratch.
- When a revamp is done (or paused), add or update its row in `revamps/README.md`, write a `README.md` inside its folder, and link it from the client's note in `wiki/`.
- Work done in Cowork or claude.ai: publish it as an artifact (or get the link), then save a snapshot under `revamps/cowork/<slug>/` (or `revamps/artifacts/<slug>/` if it's a site) and add it to `revamps/ARTIFACT-INDEX.md`.
- Leads for future revamps go in `revamps/leads/`.

## Notes

- Use `[[wiki links]]` between notes. Daily notes in `raw/`, reference notes in `wiki/` (one idea per note), finished builds in `revamps/`.
- GitHub Actions workflows only run from the repo-root `.github/workflows/`; copies inside project folders are reference only.
