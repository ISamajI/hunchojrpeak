# Nate Herk: what he teaches technically (Claude Code, agents, skills, subagents, MCP, n8n)

Research date: 2026-11-15. Researcher: Claude (subagent). Scope: his recent 2026 videos plus his most-viewed technical videos.

## How this was researched, and how far to trust it

**Source-type tags used below:**
- **[REPO]**: primary source. Files from Nate's own public GitHub repos (`github.com/nateherkai/*`), cloned and read in full where cited. These are the most reliable sources in this document. Several are the "free resource" that goes with a video.
- **[META]**: YouTube metadata (title, video ID, displayed views, relative publish time) pulled from YouTube's InnerTube API through the Firecrawl/Alexandria `youtube-com` provider on 2026-11-15.
- **[3P]**: third-party summary found through web search: Skool post snippets, X/LinkedIn post snippets, Glimpse, Murmurcast, Substack, and similar. These are secondhand and some are AI-generated. Treat them as "probably said", not as quotes.
- **[INFER]**: my own inference, labelled as such.

**What was blocked (be aware):**
- **No transcripts were obtained.** youtube.com, skool.com, assets.skool.com and most transcript sites are blocked by this session's network proxy (CONNECT 403 / DNS failure) for `yt-dlp`, `youtube-transcript-api`, curl and WebFetch alike.
- The Firecrawl `video_transcript` capability would have worked, but the Firecrawl account ran out of credits right after the channel listing was pulled. The daily credits refresh in about 23h.
- So none of the video content below is quoted from a transcript. Video-level claims are **[3P]**. Repo-level claims are **[REPO]** and are exact.
- To get transcripts later, re-run the `youtube-com` / `videos/video_transcript` capability on the video IDs in table (a). You could also allow `www.youtube.com` in the environment's network settings and use `yt-dlp --write-auto-subs --skip-download`.

**Channel facts [META]:**
- Channel "Nate Herk | AI Automation", handle `@nateherk`, ID `UC2ojq-nuP8ceeHqiroeKhBA`.
- 1.13M subscribers and 591 videos as displayed.
- His bio says he exited his consultancy in December 2025 and founded AI Automation Society (450,000+ members).

**Naming note:** model and product names in his 2026 titles (Claude "2.0", Opus 5.5, Sonnet 5.5, Fable 5.1, GPT-6 Astra/Sol, Duet, Claude Code "mods") are reported as he uses them. Several postdate my training data and I have not verified them independently.

---

## (a) Videos covered

Dates for recent videos are relative to 2026-11-15 as YouTube displayed them. An exact date appears only where a source stated one. Views are YouTube's displayed text on 2026-11-15.

### Recent technical videos (2026), newest first

| # | Title | URL | Published | Views | Source of content notes |
|---|---|---|---|---|---|
| 1 | I Studied 10,000 AI Websites... Here's what I learned | https://www.youtube.com/watch?v=mImbbszCjCI | ~Nov 9, 2026 [3P] | 73K | [3P] chapter list only |
| 2 | Every Claude 2.0 Concept Explained for Normal People | https://www.youtube.com/watch?v=tcb5q_6jwvY | ~2 wks ago | 281K | [3P] Skool post snippet |
| 3 | I Told Claude to "Make it better" 100 Times (It Went Too Far) | https://www.youtube.com/watch?v=DByAR5Su1Yw | Oct 30, 2026 [3P] | 804K | [3P] description summary |
| 4 | 4 Claude Systems That Sell For $3000+ Right Now (With PROOF) | https://www.youtube.com/watch?v=BQJRLZ2q_Ns | ~2 wks ago | 108K | [3P] thin, business-focused |
| 5 | /roast-room: How I Use Claude to Think Like the Top 1% | https://www.youtube.com/watch?v=DSS1Yqb6-qE | ~3 wks ago | 55K | **[REPO] nateherkai/roast-room** |
| 6 | Matt Pocock: The Most Valuable Skill to Learn in the Age of AI | https://www.youtube.com/watch?v=Z8lf5oWKfj0 | ~4 wks ago | 539K | [3P] description + LinkedIn snippet |
| 7 | AI Agents Just Became Multiplayer. Here's How to Build Them. | https://www.youtube.com/watch?v=KZiF2J83zaY | ~Oct 15 [3P] | 108K | [3P] X article snippet (sponsored by Kylon) |
| 8 | I Tested the Viral Reverse Engineer Anything Skill. What You Need to Know. | https://www.youtube.com/watch?v=rL5tw6h78zo | ~Oct 13 [3P] | 257K | [3P]. One web result gave a different video ID (fCSNcSHLyWc); the channel listing ID is used here. |
| 9 | This ONE Claude Skill Helps You Think Clearer Than 99% of People | https://www.youtube.com/watch?v=nRXHWckVxoM | ~Oct 13 [3P] | 102K | [3P]. Likely Roast Room (an X post ties the two); **unconfirmed** |
| 10 | I Tried 100+ Github Repos for Claude. These 6 Are the Best | https://www.youtube.com/watch?v=HhZdNYI4pJs | ~1 mo | 436K | [3P]. Sources disagree on the picks (6 vs 10) |
| 11 | Anthropic Engineers Just 10x'd Everyone's Claude Code | https://www.youtube.com/watch?v=oz2CwrPV2Rg | ~1 mo | 127K | **No content found.** May relate to his prompt-caching article "How Anthropic Engineers Actually Save Tokens"; **unconfirmed** |
| 12 | I Built Another Andrej Karpathy Using Claude | https://www.youtube.com/watch?v=bvGptCLDhyo | ~1 mo | 77K | [3P] Skool post + third-party tutorial repo |
| 13 | Claude Code Mods Are Game Changers. Set Up These 5 NOW. | https://www.youtube.com/watch?v=9hetShMMp2s | ~Oct 2 [3P] | 262K | **[REPO] nateherkai/claude-code-mods** (the repo ships 4 mods; the title says 5) |
| 14 | No, Seriously. Claude Code is Starting To Get Dangerous | https://www.youtube.com/watch?v=Ktnwygcnd8U | ~1 mo | 71K | Content unknown. Possibly the "Instructions are not capabilities" incident; **unconfirmed** |
| 15 | Opus 5.5 Just Changed Video Editing Forever (free skills) | https://www.youtube.com/watch?v=7jHXoPGnA4c | ~1 mo | 322K | **[REPO] nateherkai/herk-edit-kit** (likely the free skills; [INFER]) |
| 16 | I Had Opus 5.5 Build me the Same App at Every Effort Level | https://www.youtube.com/watch?v=QCkHIyEPIYo | Sep 24, 2026 [3P] | 599K | [3P] his X article snippet |
| 17 | I Tested Sonnet 5.5 vs Opus 5.5. What You Need to Know. | https://www.youtube.com/watch?v=7eo-11K2e3c | ~1 mo | 167K | Not researched in depth |
| 18 | How to Build Codex Skills Better than 99% of People | https://www.youtube.com/watch?v=9KOtMsZ9I28 | ~1 mo | 60K | Skill-authoring patterns read from [REPO] |
| 19 | How to Build AI Automations (that don't eat your usage limit) | https://www.youtube.com/watch?v=FqnNL8fnUWo | ~1 mo | 72K | [3P] Skool snippet |
| 20 | Anthropic Engineer Explains: What to Build Instead of AI Agents | https://www.youtube.com/watch?v=HIRDzMtuWFk | ~2 mo | 401K | [3P]. Topic is "build skills, not agents" (Anthropic's Barry Zhang / Mahesh Murag talk) |
| 21 | How to Actually Choose the Right AI Agent | https://www.youtube.com/watch?v=6LNlCpQPYFc | ~2 mo | 76K | [3P]. Only adjacent posts found |
| 22 | Fable 5.1 FINALLY Kills AI Website Slop | https://www.youtube.com/watch?v=FFWtxjvW2ts | ~2 mo | 222K | [3P] + [REPO] nateherkai/scroll-craft |
| 23 | How Anthropic ACTUALLY Prompts Fable 5.1 | https://www.youtube.com/watch?v=FBVNS1l5Vb8 | ~2 mo | 81K | Not researched |
| 24 | I Tested Claude Code vs. Codex on Design. It Wasn't Even Close. | https://www.youtube.com/watch?v=bg0C-2iUUqM | ~2 mo | 93K | Not researched |
| 25 | 100 Hours Testing Deepseek Harness vs. Claude Code | https://www.youtube.com/watch?v=UsfCe5fJK6A | ~2 mo | 251K | Not researched |

Also on the channel in this window but non-technical or off-scope: Hormozi, AI business rankings, "7 best AI tools", GPT-6 Astra series, Grok Bot series, a 5h Codex course (`X-pbJWKmwi0`), and a 2h Grok Bots course (`4hKJ9X6rGFo`).

### Most-viewed technical videos (all time)

**Caveat:** I could not sort the full channel by views (Firecrawl credits ran out). These are the highest-view technical videos returned by YouTube search for "Nate Herk n8n AI agent" and "Nate Herk Claude Code" [META]. Exact view counts were taken on 2026-11-15.

| Title | URL | Age | Views | Content notes |
|---|---|---|---|---|
| Build & Sell n8n AI Agents (8+ Hour Course, No Code) | https://www.youtube.com/watch?v=Ey18PDiaAYI | ~1 yr | 2,044,065 | not researched in depth |
| Build & Sell with Claude Code (10+ Hour Course) | https://www.youtube.com/watch?v=mpALXah_PBg | ~8 mo | 1,248,411 | [3P]. Note: some third-party "learning vault" pages attribute a course with this exact title to Nick Saraev. YouTube search lists this video on @nateherk. Possibly two courses with the same name. |
| I Built the Ultimate Team of AI Agents in n8n With No Code (Free Template) | https://www.youtube.com/watch?v=9FuNtfsnRNo | ~1 yr (Feb 2025 per 3P) | 1,121,726 | [3P] |
| I Built a Marketing Team with 1 AI Agent and No Code (free n8n template) | https://www.youtube.com/watch?v=ldETapkr8Hg | ~1 yr | 971,385 | not researched |
| Build & Sell Claude Code Operating Systems (2+ Hour Course) | https://www.youtube.com/watch?v=bCljOfCH8Ms | ~6 mo (~May 1, 2026 per 3P) | 556,867 | **[REPO] nateherkai/AIS-OS** (the course's free repo) |
| 32 Tricks to Level Up Claude Code in 16 Mins | https://www.youtube.com/watch?v=jqoFP9QapXI | Apr 27, 2026 [3P] | 492,977 | [3P] |
| Master 95% of Claude Code in 36 Mins (as a beginner) | https://www.youtube.com/watch?v=saggDHHnmtQ | ~9 mo | 464,566 | [3P] |
| I Turned Claude Into the Ultimate Second Brain | https://www.youtube.com/watch?v=8QQ_INxAhRs | ~5 mo | 396,045 | not researched |
| From Zero to Your First Agentic AI Workflow in 26 Minutes (Claude Code) | https://www.youtube.com/watch?v=tDGiWn0flK8 | ~8 mo | 308,947 | [3P] WAT framework |
| Master 95% of Claude Code Skills in 28 Minutes | https://www.youtube.com/watch?v=zKBPwDpBfhs | ~Feb 27, 2026 [3P] | 253,589 | [3P] |
| Claude Code is Better at n8n than I am (Beginner's Guide) | https://www.youtube.com/watch?v=B6k_vAjndMo | ~Jan 2026 | 250,433 | [3P] |

### Nate's public GitHub repos read for this report [REPO]

All cloned from `github.com/nateherkai`. Last-commit dates are shown. A search snippet says the account has 18 repos; only these 6 were found and read.

- `AIS-OS` (2026-09-06): the AI OS starter kit for the "Claude Code Operating Systems" course.
- `claude-code-mods` (2026-10-02): Cache Keeper, Recording Mode, Goal Meter, Collision Guard.
- `herk-edit-kit` (2026-10-14): 15 video-editing skills on HyperFrames + GSAP.
- `roast-room` (2026-10-21): an expert-advisor council built from subagents.
- `scroll-craft` (2026-09-30): a skill for scroll-driven premium websites, shipped as a plugin marketplace.
- `human-speak` (2026-10-05): a skill that removes AI writing patterns.

---

## (b) The core skills and techniques he teaches

### 1. Build an "AI Operating System" as a structured repo [REPO AIS-OS; video bCljOfCH8Ms]

**Exact layout (from the AIS-OS README):**

```
CLAUDE.md            # shared operating manual (Claude Code)
AGENTS.md            # identical manual for Codex. "Update both together."
aios-intake.md       # source of truth for /onboard; edit and re-run
connections.md       # registry of every system the OS can reach
context/             # about-me.md, about-business.md, priorities.md (filled by /onboard)
references/          # frameworks, voice.md, {tool}-api.md, sops/
decisions/log.md     # append-only "what was decided and why"
brainstorms/         # /grill-me captures (gitignored)
audits/              # dated /audit reports (gitignored)
archives/            # "Don't delete. Move here."
.claude/skills/{onboard,audit,level-up,grill-me,3d-brain,link}/SKILL.md
.agents/skills/      # generated Codex mirror (scripts/sync-codex-skills.sh)
```

**Steps:**
1. Clone the repo.
2. Run `/onboard`, a 7-question interview with a hard cap. The one hard rule: voice samples must be *pasted raw*, never typed during the conversation.
3. Use it for a week, logging decisions to `decisions/log.md`.
4. Day 7: run `/audit`.
5. Day 14: run `/level-up` and ship one automation.
6. Repeat weekly.

**What NOT to add (his anti-patterns in `EXPANSIONS.md`):**
- No `notes/`, `misc/`, `tmp/` or `inbox/` folders. He calls them "graveyards".
- No raw email or Slack dumps in `references/` ("interpreted facts only").
- No empty pre-created folders.
- No forked operating manual. There is one root `CLAUDE.md`; sub-OS folders such as `youtube-os/` may have their own scoped CLAUDE.md.

**His "add a folder" test:**
1. Is it conceptually new?
2. Will I touch it 3+ times next month?
3. Could `/level-up` route a future skill into it?

Two yeses means add it.

### 2. The Four Cs build order, plus an evidence-based audit [REPO AIS-OS]

The four layers, in dependency order:
- **Context**: knows your business.
- **Connections**: reaches your stuff.
- **Capabilities**: knows how to do the work.
- **Cadence**: runs without being asked.

Context is non-skippable. Connections and Capabilities can be built in parallel. Cadence comes last: "don't automate workflows that don't work manually."

Each layer has a pass test. For Context: "a fresh session answers 'what does this business do and who works here?' without browsing". For Cadence: "laptop closed, a brief lands in the inbox".

**The `/audit` rubric v2:**
- 5 criteria per C, 5 points each. Only 0, 1, 3 or 5 may be awarded.
- Points are awarded "for evidence, not folder counts, API keys, or skills named 'daily'".
- Five retrieval probes are run.
- Caps: any C below 10 caps the total at 49. Any C below 15, or fewer than two verified automatic successes, caps it at 69. A manual-only Cadence is capped at 10.
- Each report is saved dated in `audits/` and compared with earlier ones. Finding IDs persist and are tracked as new, open, resolved, reopened, and so on.

### 3. "Workflows beat agents": the Three Ms operator framework [REPO references/3ms-framework.md]

**Mindset:**
- **Default Shift**: ask "to what extent can AI be leveraged here?"
- **Function Breakdown**: automate one tiny task, then chain.
- **Curiosity Rule**: never accept output you can't explain, because unexplained code ("dark code") is a liability.

**Method:**
- **Find the constraint** with two questions: "If 500 new clients showed up tomorrow, what would break first?" and "What would give you 500 more?"
- **EAD**: Eliminate, then Automate, then Delegate.
- **The 60/30/10 rule**: about 60% automated, 30% AI-assisted with human review, 10% manual.
- **Map every process** as Trigger, Data Sources, Transformations, Decision Points, Destination.
- **Autonomy Spectrum**: L0 Manual, L1 Suggested, L2 Drafted, L3 Supervised, L4 Autonomous. "Default to the LOWEST level that works."
- **Tie it to a KPI** in one of three buckets: get more customers, make each customer worth more, or cut costs.

**Machine:**
- **Lego Principle**: one input and one output per block, zero-AI steps first.
- **Assembly Line**: one specialized AI call per job ("don't build a generalist").
- **Validation Chain**: validate each step's real output before chaining. Never build the whole pipeline and test end to end.
- **Bike Method**: training wheels, then guided, then watched, then hands-off. Roll out 10% of volume first. Confidence thresholds: high auto-sends, medium goes to a draft queue, low escalates.
- **Intern Rule**: own identity and accounts, read-only by default, never impersonates you, scoped keys, full audit trail.
- **Kill Switch**: tear down automations that keep needing patches.

**Governing principles:**
- "Boring is beautiful."
- Deterministic steps can be finished; AI steps are always evolving.
- Fail fast, learn faster.

### 4. The WAT framework for agentic workflows in Claude Code [3P; videos tDGiWn0flK8, mpALXah_PBg]

- **W**orkflows: Markdown SOPs in `/workflows`. Each one states the objective, inputs, which tools to use, outputs, and edge cases.
- **A**gent: Claude Code, governed by `claude.md`. It reads the workflow, runs tools in sequence and handles failures.
- **T**ools: small deterministic Python scripts in `/tools`.

The purpose is to separate probabilistic reasoning from deterministic execution.

**Steps reported:**
1. Write a claude.md that explains the framework and the file structure.
2. Use Plan Mode and let Claude ask clarifying questions.
3. Build the tools, then test, optimize and deploy.
4. When a step fails, Claude updates both the tool and the workflow.

### 5. CLAUDE.md hygiene and session habits ("32 tricks") [3P; video jqoFP9QapXI; plus REPO]

Items reported across summaries (the full numbered list was not recoverable):
- Run `/init` on every project.
- Keep CLAUDE.md under about 200 lines.
- Set up `/statusline` to show model, context %, cost and branch.
- Use `/context` to find token bloat. Compact at about 60% context.
- Start in plan mode and let Claude ask questions until it is confident. Build self-checks into the to-do list.
- Run subagents on Haiku for cheap parallel research.
- Use git worktrees to run 4 or 5 sessions on one project.
- **Edit your permissions instead of using `--dangerously-skip-permissions`.**
- Use the "ultrathink" keyword for hard architecture problems.
- Use remote control, or a VPS for always-on sessions.
- Use the Context7 MCP for current library docs.
- Wire up CLIs such as BigQuery.

In his own repos [REPO], he pairs `CLAUDE.md` with an identical `AGENTS.md` and states "keep them synchronized".

### 6. Authoring skills (SKILL.md) [REPO all repos; 3P video zKBPwDpBfhs]

**Structure:**
- `.claude/skills/<name>/SKILL.md` with YAML `name` + `description`.
- Optional `references/`, `scripts/`, `assets/` and `templates/` folders.
- Optional `agents/openai.yaml` for Codex metadata.

**Rules reported [3P]:**
- Only the roughly 100-token frontmatter is always loaded.
- Keep SKILL.md under 500 lines; put reference docs in separate files.
- When the agent keeps repeating the same lookup, hard-code the answer into SKILL.md. His example: pasting ClickUp list IDs cut a lookup from 500 to 50 tokens.

**What his own skills show [REPO]:**
- **Descriptions are long and trigger-phrase heavy.** For example, roast-room lists "roast room", "founder council", "what would Hormozi... say". They also say what the skill is *not* for: "Not /roast".
- They use `argument-hint:` for flag syntax and `allowed-tools:` to restrict tools (scroll-craft).
- They name mode flags inside the skill: `--quick`, `--seats`, `--all`, `ask <seat>`.
- There is a "Read once before the first run" list of reference files.
- `.claude/skills/` is the canonical authoring source. A sync script generates the Codex `.agents/skills/` copy.
- Skills ship as plugins through `.claude-plugin/marketplace.json`, installed with `claude plugin marketplace add nateherkai/<repo>`.

### 7. The feedback-to-rule loop (how his skills improve) [REPO herk-edit-kit/docs/EDITING-PLAYBOOK.md]

"Every note Nate gave became a permanent rule in a skill. He never had to give the same note twice."

**The loop:**
1. The agent renders a draft.
2. You give plain-words notes.
3. Tell it: "Fix it, then add this to the skill so it never happens again." The fix becomes a rule, a check, or a script change.
4. The next run starts from the improved skill.

**Examples from his table:**
- "Captions unreadable on bright site" now means every caption sits in a dark box, and a pixel contrast check measures what is behind it.
- "Lips behind the voice" now means exact frames are selected in one pass, and a sync check compares every cut frame against the raw.

### 8. Expert "brain" subagents and a Chair-orchestrated council [REPO roast-room; videos DSS1Yqb6-qE, bvGptCLDhyo]

**Agent files:**
- Each seat is `.claude/agents/council-<key>.md` with frontmatter `tools: Read, Grep, Glob` and `maxTurns: 12`. The agents are read-only and turn-capped.
- Body sections: "Your brain", "Your lens", "How you talk", "How you debate".
- Instruction: "Never look outside your brain folder."
- Every framework must be cited with a source ID. Only verbatim lines may be quoted.

**Brain spec:** each seat has a brain folder `brains/<slug>/`:
- `_hot.md` (600 to 800 words), read on every call.
- Then at most 3 of: `frameworks.md`, `principles.md`, `positions.md`, `voice.md`, `stories.md`, `books.md`.
- `sources.md` holds `id | title | url | date | words`.
- `check_quotes.mjs` must pass, verifying quotes are verbatim.
- A mandatory "Where this lens misfires" section.
- Confidence levels by source count.

**Orchestration:**
- The main session acts as **Chair**. It never argues a side.
- It recommends 5 to 7 seats per decision, confirmed through AskUserQuestion.
- It always includes one downside-guard seat and the seat most likely to disagree, "so the room argues instead of nodding".
- Three rounds: open, debate, vote. Then a scored verdict.
- Output goes to `sessions/<date>-<slug>/` (brief, round-N, verdict.md/json, cruxes).
- `/newroaster <name>` builds a new seat from fetched public sources.

**The Karpathy video [3P]** applies the same pattern to roughly 700K words of Karpathy's work, packaged as a `karpathy` subagent plus a `karpathy-teach` skill (per a third-party tutorial repo, az9713/karpathy-claude-workflow-tutorial).

### 9. "Grill me" interviews that checkpoint to disk [REPO AIS-OS/.claude/skills/grill-me]

- Ask **one question at a time**.
- Create `brainstorms/{YYYY-MM-DD}-{slug}.md` *before* Q1, and append after **every** answer. "The file, not your context, is the source of truth."
- Read back the saved entry, then ask the next question.
- Mark superseded answers rather than deleting them.
- If a file or the codebase can answer a question, read it instead of asking.
- Keep confirmed facts, tentative ideas, and assistant suggestions visibly separate.

The Matt Pocock video [3P] echoes this: have the agent interview you before building, so unknown unknowns such as security and deployment surface early.

### 10. Context and prompt-cache economics [REPO claude-code-mods; 3P his article "How Anthropic Engineers Actually Save Tokens"]

**Claims:**
- Cached input costs about a tenth of normal input. A cold rewrite costs up to 2x on a big chat.
- `/compact`, `/clear` and switching models break the cache [3P].
- He claims subscription Claude Code uses a 1-hour TTL versus 5 minutes on the API and in subagents [3P]. **I could not verify this against official docs.**

**Tooling (Cache Keeper):**
- A status line showing cache warm/cold, context size, estimated rewrite cost, and plan limits.
- `/keepwarm`.
- A cold-send guard above 150k tokens: send anyway, compact first, or cancel.
- `/board`, a view of every local chat.
- `/handoff`: runs a `session-handoff` skill, then clears the chat and seeds the fresh one.

**The handoff template [REPO]:**
- Sections: "Where it started", "Decisions locked + what shipped", "Key files for next session", plus running state, verification, deferrals, and open questions.
- Its rule: synthesize only this session, with "no git log, no broad Glob sweeps".

### 11. Running parallel agents safely [REPO claude-code-mods]

**Collision Guard:**
- Before an edit, it checks whether another open chat changed that file in the last 30 minutes.
- If so, it offers: Proceed, Move to a worktree, or Cancel.

**Goal Meter:**
- With `/goal`, Claude writes its plan as tasks sized S, M or L (worth 1, 2 and 3).
- Progress percent and ETA are based on the goal's own pace.
- `/goals strict on` blocks file edits until the plan exists.

**Recording Mode:** `/rec` masks keys, `.env` values, PII and business figures on screen, and blocks private paths.

**Requirements:** Claude Code 2.1.287+, with mods enabled for the account. `claude plugin test` checks this.

### 12. "Instructions are not capabilities": permissions over prompts [3P his X posts; REPO Intern Rule]

His incident: a team agent mailed 150,000+ inboxes after reading a to-do item. His rule: "never send emails" in a prompt is "a wish" if the agent holds a send tool. The fix is access, not the prompt: draft permission with no technical ability to send.

**Related rules:**
- Separate API keys per agent.
- Read-only by default.
- Least privilege per agent (for example, a marketing agent gets no QuickBooks access).

### 13. Code-driven video editing (HyperFrames + GSAP) [REPO herk-edit-kit; video 7jHXoPGnA4c]

**Stack:** Node 22+, FFmpeg/ffprobe, Chrome. HyperFrames (HeyGen's HTML-to-MP4 framework; skills from `heygen-com/hyperframes`). ElevenLabs Scribe for word-level transcripts (Whisper is allowed).

**Pipeline:**
1. Transcribe.
2. `cut-silences`.
3. `cut-mistakes` on the *retimed* transcript. "Never mix original timestamps with edited footage."
4. Plan the story: hook, proof, items, payoff, CTA.
5. B-roll, one visual per noun phrase.
6. Build the composition, with each beat anchored to the spoken word.
7. Mix.
8. Draft render, check, final render.

**Composition rules:**
- Timed elements carry `data-start`, `data-duration`, `data-track-index`; clips on the same track must not overlap.
- Register one paused, synchronous GSAP timeline per composition in `window.__timelines[compositionId]`.
- Use deterministic animation and local assets.
- Mute videos and use sibling audio for the mix.

**Verification:**
- `node scripts/preflight.mjs <project>`, `npx hyperframes lint`, `validate-beat-sync.mjs`. Each beat needs a `data-anchor` with an exact transcript phrase.
- Inspect hero frames and transition boundaries.
- Save evidence in `VERIFY.md`.
- "Never claim a lint result proves visual quality."

**Lessons:**
- Encoding segments separately and concatenating drifts lip sync. Select exact frames in one pass.
- Animate transforms, not `top` or `left`.
- Measure loudness on the stereo delivery.

### 14. Premium websites that verify themselves [REPO scroll-craft; 3P videos FFWtxjvW2ts, mImbbszCjCI]

**Deliverables:** a brief, a page grammar, a journey map, a "feeling curve" with one engineered peak, one signature move, assets, HTML on a token-driven design floor, and screenshot proof.

**Rules:**
- At least 4 device families, never the same device twice in a row.
- A photographic world by default; the clay diorama is banned.
- No continuous camera chain.
- Structure is a separate axis from look.
- A dimensional layered hero: background, subject, foreground and atmosphere planes.

**Verify:**
- Serve over HTTP, never `file://`.
- Use real Chrome, not bundled Chromium, which lacks h264.
- `shoot.mjs` at desktop, at `--width 390 --height 844`, and with `--reduced-motion`.
- Read the contact `sheet.png`.
- Sample within each act rather than uniformly down the page.

**The "10,000 websites" video [3P]:** only the chapter titles were found (Mirror test, highlighter, 60-30-10, why it's cheap, 3 layers, movie vs customers). A Brazilian critique notes the cited statistics trace to 2009 to 2018 CRO studies.

### 15. n8n multi-agent systems, and Claude Code building n8n [3P; videos 9FuNtfsnRNo, Ey18PDiaAYI, B6k_vAjndMo]

**Orchestrator pattern:**
- One "ultimate assistant" agent with sub-agent *workflows called as tools*: email, calendar, content creator, contacts.
- Tool parameters are filled with `$fromAI`.
- A Telegram trigger accepts voice or text.
- The demo chains a contact lookup, then runs calendar and email in parallel.

**Claude Code + n8n:**
- Install the n8n MCP server, which creates and edits workflows, plus the n8n skill files, which hold node and expression know-how. Connect with the instance URL and API key.
- Official route [3P]: `/plugin marketplace add n8n-io/skills` then `/plugin install n8n-skills@n8n-io`.

**A related 2026 shift [3P, video FqnNL8fnUWo]:** move scheduled and webhook jobs off the subscription into Trigger.dev, and use AI only for the judgment step (in his example, only the recommendation and draft needed AI).

**Model/effort selection [3P]:**
- Test on your own real task rather than trusting benchmarks.
- In his effort-level test, "Extra" gave the best starting point and "Max" was "more work, but a weaker result".
- In "Make it better ×100", Opus grew a site to about 21,000 lines and broke it, while Sonnet made small careful edits. Neither model searched the web.

---

## (c) His recurring frameworks and mental models

| Model | One line | Source |
|---|---|---|
| Three Ms (Mindset, Method, Machine) | How you think, how you decide, how you build and operate | [REPO] |
| Four Cs (Context, Connections, Capabilities, Cadence) | AI OS architecture with a strict build order | [REPO] |
| Autonomy Spectrum L0 to L4 | Default to the lowest level that works | [REPO] |
| "Boring is beautiful" / "Workflows beat agents" | Deterministic first, AI only where judgment is needed | [REPO] + [3P] |
| 60/30/10 | Automated / AI-assisted / manual. Full automation is rarely the goal. | [REPO] |
| EAD | Eliminate before you automate; "don't automate waste" | [REPO] |
| Lego / Assembly Line / Validation Chain | Small single-purpose blocks, validated one at a time | [REPO] |
| Bike Method | Phased rollout, starting at 10% of volume, with confidence thresholds | [REPO] |
| Intern Rule / "Instructions are not capabilities" | Constrain tools and scopes, not prose | [REPO] + [3P] |
| Kill Switch | Delete automations that cost more than they save | [REPO] |
| WAT (Workflows, Agent, Tools) | Markdown SOPs + Claude + Python scripts | [3P] |
| Feedback-to-rule loop | Every correction becomes a rule, check, or script in the skill | [REPO] |
| Litmus test | "While you're not at your desk, your AIS-OS observes one real-world event and produces an output that's faster and more accurate than what you'd produce yourself." | [REPO] |
| "Skills over agents" | One generic agent plus many skills beats many bespoke agents | [3P] |
| Researched once, saved forever | `references/{tool}-api.md` so future skills don't re-research | [REPO] |

Branch frameworks he names as future work in the repo, not yet published as far as I found: Data Retrieval Hierarchy (filters, SQL, full context, RAG), Integration Ladder (API, CLI, browser automation, scraping), Error Handling Playbook, Model Selection Guide, Context Engineering Framework, Discovery Playbook, and Security and Permissions Playbook.

---

## (d) What the user should adopt, and how

These are mapped to the user's setup: a 32-agent org-chart plugin (branch, then planner/executor/reviewer), SKILL.md skills, the JSON scenes → headless Chromium → ffmpeg motion toolkit, LTGPEAK and client websites/dashboards, and the Obsidian `raw/ wiki/ outputs/` vault. All recommendations are [INFER] unless they quote a repo.

1. **Use the roast-room agent pattern for the 32-agent org chart (high value).**
   - Give reviewer and planner agents `tools: Read, Grep, Glob` and a `maxTurns` cap in their `.claude/agents/*.md` frontmatter. Only executors get Write/Edit/Bash.
   - Give each agent a short always-read `_hot.md`-style brief: role, the one question it owns, its rules, and "where this lens misfires". Keep longer references on demand.
   - Have the branch lead act as a **Chair** that *recommends* which 3 to 7 agents to seat per task instead of fanning out to all 32. Always seat one downside guard (a reviewer) and one likely dissenter.
   - Persist each run to `sessions/<date>-<slug>/` (brief, rounds, verdict.json) so reviews are auditable.

2. **Add the feedback-to-rule loop to the motion-design branch (high value).**
   - When the reviewer (Kimimaro) flags a defect, the fix PR must also add a rule, check or script to the motion-design SKILL.md or its validators. Keep a "note → rule" table like his EDITING-PLAYBOOK so the knowledge is legible.

3. **Borrow herk-edit-kit's video-verification discipline for the JSON → Chromium → ffmpeg toolkit.** Concretely:
   - One deterministic, paused timeline per scene, driven by frame and seek, never wall-clock.
   - Select exact frames in one pass rather than encoding segments separately and concatenating, which drifts A/V sync.
   - Animate transforms only.
   - Add a `beat-sync` style validator that anchors scene starts to transcript phrases.
   - Add a preflight script, a contact sheet of hero and transition frames, and a `VERIFY.md` evidence file per render.
   - Measure loudness on the stereo master.
   - Also look at HyperFrames itself (HTML → MP4, GSAP, by HeyGen) as either a competitor to benchmark against or a renderer to interoperate with. Its schema (`data-start`, `data-duration`, `data-track-index`, `window.__timelines`) is close to a JSON-scene model.

4. **The Obsidian vault already matches his "Karpathy LLM wiki" setup:** `raw/` sources ingested into linked `wiki/` pages, with a CLAUDE.md, index and log [3P]. To harden it, add:
   - an `index.md` and an append-only `log.md` (like his `decisions/log.md`);
   - an "ingest raw → wiki" skill;
   - a weekly `/audit`-style retrieval probe ("can a fresh session answer X from wiki/ alone?");
   - his anti-patterns: no `misc/` or `inbox/`, no raw dumps in wiki, interpreted facts only.

5. **Adopt the grill-me checkpoint rule for any long planning or intake work,** such as a client discovery for a local-business site: write after every answer to `brainstorms/` or `raw/`, and read back before the next question. This survives context compaction.

6. **Manage context and cache cost in a 32-agent system.**
   - Add a session-handoff skill using his template, then `/clear`.
   - Avoid switching models mid-session.
   - Install `collision-guard` (or use worktrees) if parallel branch sessions touch the same repo.
   - The mods need Claude Code 2.1.287+ and mods enabled for the account; check with `claude plugin test`. Read the hook code before enabling it.

7. **Use scroll-craft's ideas for LTGPEAK and client sites.**
   - Its verify harness: served build, real Chrome, desktop + 390×844 + reduced-motion screenshots, and a contact sheet that a reviewer agent must read before sign-off.
   - The "variety" rules (4+ device families, no repeated device in a row).
   - It installs with `claude plugin marketplace add nateherkai/scroll-craft`.

8. **Apply "instructions are not capabilities" plus the Intern Rule to client automations and dashboards:** scoped, read-only API keys per agent, no send or publish tools unless required, and an audit trail.

9. **Skill hygiene for the plugin:**
   - Trigger-phrase-rich descriptions that also say what the skill is *not* for (to avoid overlap between 32 agents' skills).
   - `argument-hint` for flags.
   - SKILL.md under about 500 lines, with `references/` loaded on demand.
   - A marketplace.json for distribution.
   - If you also use Codex: one canonical `.claude/skills/` plus a sync script, and paired CLAUDE.md/AGENTS.md.

10. **Lower priority:**
    - The n8n content (largely superseded in his own 2026 framing by Claude Code; see "Stop Learning n8n in 2026..." `ZeJXI2MAhj0`, 529K views, not researched).
    - The Grok Bot and GPT-6 Astra series.

**Suggested next step:** when Firecrawl credits refresh, pull transcripts for these IDs to confirm or upgrade the [3P] items: `jqoFP9QapXI`, `zKBPwDpBfhs`, `tDGiWn0flK8`, `bCljOfCH8Ms`, `9hetShMMp2s`, `7jHXoPGnA4c`, `DSS1Yqb6-qE`, `bvGptCLDhyo`, `oz2CwrPV2Rg`, `Ktnwygcnd8U`.
