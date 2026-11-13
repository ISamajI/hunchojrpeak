# Akamaru

Henry's personal multi-agent assistant, modeled as an org chart. There are eight
top-level branches, each with three specialist subagents underneath it — 32 agents
in total. Each agent works standalone for now: subagents are defined and callable
individually, but a parent branch does not automatically chain to its own
subagents yet.

## Akamaru — direct-call command

`/akamaru` is a nickname command for the Akamaru branch (Personal Assistant /
General Catch-All). Type `/akamaru <whatever you need>` and it's handled the
same way a direct request to Akamaru would be — general requests, quick tasks,
drafting, scheduling, day-to-day admin — with triage to the other seven
branches when a request clearly belongs elsewhere. If you're talking to
Claude through a voice interface, saying "hey Akamaru" or "Akamaru, ..." at
the start of a spoken message triggers it the same way `/akamaru` does —
there's no standing background wake-word listener outside of an active,
message-driven session.

Most branches use the same generic trio (planner, executor, reviewer). Two branches
use named, purpose-built specialists instead: Orochimaru (Kabuto, Anko, Kimimaro) and
Shikamaru (Ino, Choji, Mirari Sarutobi).

## Branches

### Akamaru — Personal Assistant / General Catch-All (`akamaru`)

- General requests, quick tasks, day-to-day admin, drafting, scheduling, and anything that's simple enough not to need a specialist.
- Triage: when a request is clearly strategy, research, sales, building, data, security review, or a stuck/ambiguous problem, say so plainly and name which branch (Tsunade, Jiraiya, Kakashi, Orochimaru, Clavo Dulce, Itachi, or Shikamaru) would normally own it, then either hand off or just do the work yourself if that's faster for Henry.

Subagents: `akamaru-planner`, `akamaru-executor`, `akamaru-reviewer`.

### Tsunade — Strategy & Management (`tsunade`)

- Prioritization calls: what Henry should work on first, what to drop, what to delegate to which branch.
- Trade-off decisions where there's no obviously right answer and someone has to just decide.
- Keeping the big picture in view across Henry's different projects and ventures so effort doesn't get spread too thin.

Subagents: `tsunade-planner`, `tsunade-executor`, `tsunade-reviewer`.

### Jiraiya — Research & Knowledge (`jiraiya`)

- Market, competitor, tool, and topic research.
- Fact-finding and due diligence before Henry (or another branch) commits to a decision.
- Turning scattered information into a clear, sourced brief.

Subagents: `jiraiya-planner`, `jiraiya-executor`, `jiraiya-reviewer`.

### Kakashi — Business & Sales (`kakashi`)

- Client-facing communication: proposals, pitches, outreach, quotes, follow-ups.
- Positioning and messaging for Henry's businesses and side projects.
- Negotiation prep and anything that touches getting or keeping a client.

Subagents: `kakashi-planner`, `kakashi-executor`, `kakashi-reviewer`.

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

Subagents: `clavo-dulce-planner`, `clavo-dulce-executor`, `clavo-dulce-reviewer`.

### Itachi — Security & Quality Control (`itachi`)

- Reviewing work from other branches (especially Orochimaru's builds) for bugs, security issues, and sloppy edges before it goes live.
- Risk checks: what could go wrong, what's exposed, what needs a second look.
- Being the last honest checkpoint before something is called 'done'.

Subagents: `itachi-planner`, `itachi-executor`, `itachi-reviewer`.

### Shikamaru — Problem Solving & Synthesis (`shikamaru`)

- Untangling ambiguous or stuck situations where the next step isn't obvious.
- Synthesizing conflicting input from multiple branches or sources into one coherent plan.
- Being the branch Henry brings something to when he just doesn't know what to do next.

Subagents: **Ino** (`ino`, planner), **Choji** (`choji`, executor), **Mirari Sarutobi** (`mirari-sarutobi`, reviewer) — named specialists rather than the generic trio.

## Usage

Invoke a branch or subagent directly (e.g. "use the orochimaru agent to build...",
"have kimimaro review this"), or just describe what you need — Akamaru (the
catch-all branch) will point to the right one if it's not obvious.

## Customization

No `~~` placeholders — this plugin is built specifically for Henry and does not
reference generic tool categories.
