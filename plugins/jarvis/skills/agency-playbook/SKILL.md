---
name: agency-playbook
description: Henry's LTGPEAK operating playbook, distilled from research on Nate Herk (AI automation educator) and his competitors (Nov 2026). Use when pricing or scoping client work, running a discovery call, writing a proposal, planning content or video titles, structuring agent/subagent work, reviewing builds for security and QA, verifying renders or websites, setting up KPI dashboards, or deciding LTGPEAK positioning and priorities. Triggers: "price this", "discovery call", "proposal", "retainer", "content plan", "video title", "positioning", "competitors", "Nate Herk", "playbook", "what should we work on". Not for the mechanics of rendering video (use motion-design).
---

# Agency playbook

The rules every branch works from. Each rule notes where it came from. **[REPO]** means it was read in his public GitHub repos and is exact. **[TRANSCRIPT]** means it came from his full talks. **[2ND]** means it came from third-party summaries, so treat it as "probably said". Full research is in `references/`. Load a reference file only when a task needs the detail.

## 1. Operating principles (everyone)

- **Workflows before agents.** Use deterministic steps first and add AI only where it earns its place. Use the lowest autonomy level that works: L0 manual, L1 suggested, L2 drafted, L3 supervised, L4 autonomous. [REPO]
- **60 / 30 / 10.** About 60% automated, 30% drafted by AI and reviewed by a person, 10% done by hand. [REPO]
- **Small blocks, each checked.** Each block has one input and one output, and each AI call has one job. Check a step's real output before adding the next step. Never build the whole pipeline and only test the full run. [REPO]
- **Instructions are not capabilities.** Limit what an agent can do through its tools and keys, not through prompt wording. **Intern Rule:** an agent has its own accounts, is read-only by default, uses scoped keys, never impersonates Henry, and leaves an audit trail. [REPO / 2ND]
- **Feedback becomes a rule.** When Henry gives a note, fix it, then add a rule, check or script to the relevant skill so the note never has to be given twice. Keep a note → rule table. [REPO]
- **Proof over claims.** "Never claim a lint result proves visual quality." Every deliverable ships with evidence (screenshots, stills, a VERIFY.md). [REPO]
- **Never invent numbers.** Client figures, prices and results come from Henry or from a source you can cite.

## 2. How the org chart should work

Based on Nate's roast-room council pattern [REPO]:
- The branch lead acts as **chair**. It suggests 3–7 agents for a task instead of using everyone, and never argues a side itself.
- Always include a **downside guard** (Itachi's branch, or the branch's reviewer) and the agent **most likely to disagree**.
- Planners and reviewers advise; only executors change files or send anything.
- Save decisions to `decisions/log.md` (append-only: what was decided and why) or a dated note in `raw/`.
- Long interviews or intake: write to disk after every answer (his "grill-me" rule), so nothing is lost if context is compacted.

## 3. Sales and pricing (Kakashi; Tsunade for approval)

From two full transcripts [TRANSCRIPT]:
1. **Discovery.** Ask one of these, then stay silent:
   - "If you had 10x the business tomorrow, what would break first?" (for a business limited by capacity)
   - "What would you do to 10x the business coming in?" (for a business limited by demand)
   Let them talk, then Listen, Repeat, Poke. What they ask for is often not what they need: a med spa asked for leads, and the real fix was no-show reminders and reactivation.
2. **Why this / why now / why me.** Raise the objection yourself: "Couldn't you vibe-code this?" Then: "Who watches it at 2 a.m. when the model updates?" Sometimes the honest answer is "don't use AI here".
3. **Lock one KPI before taking payment.** Example: 5 bookings a week → 10–12. Record the baseline.
4. **Price on value: 10–20% of first-year value**, so the client sees about a 10x return in year one. Show the maths:
   - Appointment setter: 20 leads a week × 1 hour × $40 = $41,600 a year. Priced at $5,500.
   - Count avoided errors and lost revenue, not only hours saved.
   - Be ready to answer "how did you get that number?".
5. **Proposal.** Open with 3 short paragraphs about the client (where they are now, where they want to be, why us). Then offer 3 tiers (for example 10% / 25% / 50% of value, with more scope at each step); the middle tier is meant to win. Payments go against measurable milestones about 30 days apart.
6. **When the budget pushes back, cut scope, never price.**
7. **Retainer.** A flat monthly maintenance fee (Nate used $400; Henry sets his own) covers "keeps doing what we agreed". New features are quoted separately. API and hosting costs go on the client's own account.
8. Report the KPI at months 1, 2 and 3 on a dashboard (Clavo Dulce), then pitch the retainer.
9. Hourly billing (about $100) is only acceptable for the first 2–3 jobs.

## 4. Building and verifying (Orochimaru)

- **Video** (adds to the motion-design skill), from herk-edit-kit [REPO]:
  - One paused, deterministic timeline per scene; animate transforms only.
  - Select exact frames in one pass. Encoding segments separately and joining them makes A/V sync drift.
  - Anchor each beat to an exact transcript phrase and validate it.
  - Every render gets a preflight, a contact sheet of hero and transition frames, and a `VERIFY.md` with evidence. Measure loudness on the stereo master.
- **Websites**, from scroll-craft [REPO]:
  - Start from a brief and a "feeling curve" with one peak and one signature move.
  - Hero in layers: background, subject, foreground, atmosphere.
  - Verify by serving over HTTP (not file://) and screenshotting at desktop width, at 390×844 and with reduced motion. The reviewer reads the contact sheet before sign-off.
- **AI OS repo layout** for client or internal systems [REPO]: `CLAUDE.md` (under about 200 lines), `context/`, `references/`, `decisions/log.md`, `.claude/skills/`. No `misc/`, `inbox/` or `tmp/` folders, which become graveyards.

## 5. Security and QA (Itachi), our main differentiator

The audience's loudest complaints are that demos break in production, security gets ignored, and multi-agent hype doesn't deliver. The business-side educators cover these least. For every build, check:
- Secrets: no keys in code, workflows or exports. Keys are scoped and read-only by default.
- Prompt injection: any webhook, email or form text reaching an AI step is untrusted. The AI step has no send/delete tools unless it truly needs them.
- n8n: patched past CVE-2026-25049 and CVE-2026-21858. Not exposed publicly without auth.
- Messy-data tests: duplicates, blanks, wrong formats, the "5th edge case".
- Rollout: start at 10% of volume. High-confidence outputs send automatically, medium go to a draft queue, low go to a person. Have a kill switch.
- Write up what was caught. Catch logs are content (see §7).

## 6. Data and dashboards (Clavo Dulce)

- One KPI per client, tied to one of: get more customers, make each customer worth more, cut costs.
- Show the baseline, a 30/60/90-day trend, and a short "what changed" note. The dashboard is the retainer pitch.
- `/audit`-style scoring counts only evidence: points for things that actually run, not for folders or plans. [REPO]

## 7. Content and growth (Kakashi + Orochimaru, with Tsunade approving)

Title formulas taken from Nate's actual titles [REPO-metadata]:
- "I Tested X. What You Need to Know."
- "I Tried 100+ X. These N Are the Best"
- "I Told Claude to 'X' 100 Times"
- "Build & Sell X (N-Hour Course)"
- "How I'd Learn X if I Had to Start Over"
- Dollar proof in the title, and parentheses that answer an objection, like "(as a beginner)".

Hook: a proof stat in the first 15 seconds, then a mistake he made, then the promised outcome.

Funnel: every video points to ONE free resource hub. Every client deal becomes content, with permission.

## 8. Positioning: where LTGPEAK wins (Tsunade owns this)

The business-side teachers (Nate, Nick Saraev, Liam Ottley, Jono Catliff) teach selling. The engineers (Cole Medin, IndyDevDan) teach reliability. Nobody does both for people selling to small businesses. **LTGPEAK = agents that pass review, and real results instead of demos.** Ranked bets:
1. Security and QA teardowns of public n8n and Claude Code templates (run by Itachi).
2. Measured multi-agent design: 1 vs 2 vs 3 agents on one real build, with cost, time and defects compared.
3. A code-driven ad factory: "10 ads in 48 hours" pilots for local shops.
4. Public build logs with real local clients: scope, price, what the reviewer caught, the 30-day KPI.
5. A free 3-branch starter kit instead of another paid Skool community.

30-day plan:
- Week 1: agents (councils, read-only reviewers, decision log).
- Week 2: motion (VERIFY.md, beat-sync check, 10 LTGPEAK ads).
- Week 3: sales (discovery script, 3-tier proposal, pitch 3 shops).
- Week 4: content (benchmark video, QA teardown, starter kit).

## References

- `references/nate-herk-technical.md`: his 15 techniques, a video table, the repos read, and what to adopt.
- `references/nate-herk-business.md`: pricing, discovery, proposals, funnel, title formulas, with sources.
- `references/competitors.md`: profiles, a comparison matrix, audience pain points, ranked opportunities.

Deck: https://claude.ai/artifact/K282aaZsJcL52TegMztbR6. Wiki hub: `wiki/nate-herk-playbook.md`.
