# Jarvis

Henry's personal multi-agent assistant, modeled as an org chart. There are eight
top-level branches, each with three specialist subagents underneath it — 32 agents
in total. Each agent works standalone for now: subagents are defined and callable
individually, but a parent branch does not automatically chain to its own
subagents yet.

All eight branches use named, purpose-built specialists rather than a generic trio:
Jarvis (Hashirama, Tobirama, Hiruzen — the First, Second, and Third Hokage),
Orochimaru (Kabuto, Anko, Kimimaro), Shikamaru (Ino, Choji, Mirari Sarutobi),
Itachi (Shisui, Kisame, Danzo), Tsunade (Shikaku Nara, Shizune, Sakura),
Clavo Dulce (Kaito Aburame, Haru Inuzuka, Toya Hyuga), Kakashi (Sai, Naruto, Yamato),
and Jiraiya (Fukasaku, Gamabunta, Shima).

## Branches

### Jarvis — Personal Assistant / General Catch-All (`jarvis`)

- General requests, quick tasks, day-to-day admin, drafting, scheduling, and anything that's simple enough not to need a specialist.
- Triage: when a request is clearly strategy, research, sales, building, data, security review, or a stuck/ambiguous problem, say so plainly and name which branch (Tsunade, Jiraiya, Kakashi, Orochimaru, Clavo Dulce, Itachi, or Shikamaru) would normally own it, then either hand off or just do the work yourself if that's faster for Henry.

Subagents: **Hashirama** (`hashirama`, planner), **Tobirama** (`tobirama`, executor), **Hiruzen** (`hiruzen`, reviewer) — the First, Second, and Third Hokage.

### Tsunade — Strategy & Management (`tsunade`)

- Prioritization calls: what Henry should work on first, what to drop, what to delegate to which branch.
- Trade-off decisions where there's no obviously right answer and someone has to just decide.
- Keeping the big picture in view across Henry's different projects and ventures so effort doesn't get spread too thin.

Subagents: **Shikaku Nara** (`shikaku-nara`, planner), **Shizune** (`shizune`, executor), **Sakura** (`sakura`, reviewer) — named specialists rather than the generic trio.

### Jiraiya — Research & Knowledge (`jiraiya`)

- Market, competitor, tool, and topic research.
- Fact-finding and due diligence before Henry (or another branch) commits to a decision.
- Turning scattered information into a clear, sourced brief.

Subagents: **Fukasaku** (`fukasaku`, planner), **Gamabunta** (`gamabunta`, executor), **Shima** (`shima`, reviewer) — named specialists rather than the generic trio.

### Kakashi — Business & Sales (`kakashi`)

- Client-facing communication: proposals, pitches, outreach, quotes, follow-ups.
- Positioning and messaging for Henry's businesses and side projects.
- Negotiation prep and anything that touches getting or keeping a client.

Subagents: **Sai** (`sai`, planner), **Naruto** (`naruto`, executor), **Yamato** (`yamato`, reviewer) — named specialists rather than the generic trio.

### Orochimaru — Systems Builder (`orochimaru`)

- Building and modifying websites, dashboards, and client-facing sites (e.g. Henry's LTGPEAK projects and work for people like his brother's shop).
- Automations, scripts, and internal tools.
- Anything that requires actually writing code or assembling a working system, not just planning one.
- Code-driven motion design: reels, video ads and animated posts built from scene JSON with no keyframes (`motion-design` skill, `motion-studio/` toolkit).

Subagents: **Kabuto** (`kabuto`, planner), **Anko** (`anko`, executor), **Kimimaro** (`kimimaro`, reviewer) — named specialists rather than the generic trio.

### Clavo Dulce — Analytics & Data (`clavo-dulce`)

- Tracking metrics and building reports or lightweight dashboards.
- Spotting trends, anomalies, and what changed and why.
- Turning a pile of raw data into a short, honest set of takeaways and next actions.

Subagents: **Kaito Aburame** (`kaito-aburame`, planner), **Haru Inuzuka** (`haru-inuzuka`, executor), **Toya Hyuga** (`toya-hyuga`, reviewer) — named specialists rather than the generic trio.

### Itachi — Security & Quality Control (`itachi`)

- Reviewing work from other branches (especially Orochimaru's builds) for bugs, security issues, and sloppy edges before it goes live.
- Risk checks: what could go wrong, what's exposed, what needs a second look.
- Being the last honest checkpoint before something is called 'done'.

Subagents: **Shisui** (`shisui`, planner), **Kisame** (`kisame`, executor), **Danzo** (`danzo`, reviewer) — named specialists rather than the generic trio.

### Shikamaru — Problem Solving & Synthesis (`shikamaru`)

- Untangling ambiguous or stuck situations where the next step isn't obvious.
- Synthesizing conflicting input from multiple branches or sources into one coherent plan.
- Being the branch Henry brings something to when he just doesn't know what to do next.

Subagents: **Ino** (`ino`, planner), **Choji** (`choji`, executor), **Mirari Sarutobi** (`mirari-sarutobi`, reviewer) — named specialists rather than the generic trio.

## Usage

Invoke a branch or subagent directly (e.g. "use the orochimaru agent to build...",
"have kimimaro review this"), or just describe what you need — Jarvis (the
catch-all branch) will point to the right one if it's not obvious.

## Customization

No `~~` placeholders — this plugin is built specifically for Henry and does not
reference generic tool categories.
