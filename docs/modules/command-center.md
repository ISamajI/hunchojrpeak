# Command Center (dashboard)

Open it with `npm start`, then go to http://127.0.0.1:4317. It is vanilla ES modules with no build step. The CSP allows only same-origin scripts, and all dynamic text goes in through `textContent`.

## Layout
| Group | Pages |
|---|---|
| Command | Overview · AI Command Center · Live Activity |
| Business | Leads · Clients · Projects (Kanban + detail) · Revenue · Analytics |
| Automation | AI Agents · Workflows · Scheduled Tasks · Approvals |
| Creation | Website Builder · Demo Generator · Marketing Studio · Content Studio |
| System | Integrations · Notifications · System Health · Settings |

## Where every number comes from
| Surface | Source |
|---|---|
| Revenue, MRR, outstanding, overdue | `invoices` table only (`src/finance.js`). Empty ledger shows "no data", never $0 dressed up as a trend |
| Projected revenue | Labeled **MODEL**: MRR + outstanding + Σ(deal value × stage probability). Probabilities are shown on the page, and deals without a value are counted and called out |
| Leads, conversion, funnel, lead flow | `businesses`, `leads`, `messages` (`src/metrics.js`). Conversion = won ÷ prospects actually emailed |
| Agent status and performance | Live `jobs` queue + `activity` log (`src/agents.js`) |
| Live activity | Server-Sent Events from the in-process event bus (`/api/stream`) |
| Uptime | `site_checks` written by the SSRF-safe monitor (`src/monitor.js`) |
| System health | Process, event loop, SQLite integrity/latency, job counts (`src/system.js`) |

## Agents
| Agent | Codename | Branch modules | Needs |
|---|---|---|---|
| Sales Intelligence | Jiraiya | discovery, research, scoring | — |
| Web Development | Orochimaru | demo builder, deploys | — (Vercel for public previews) |
| Marketing Intelligence | Shikamaru | `branches/marketing.js` | Claude API (no fake template fallback) |
| Client Relations | Kakashi | outreach, replies | — (Resend to send) |
| Business Analytics | Clavo Dulce | `metrics.js`, analysis job | — |
| System Security | Itachi | QA gate, decision engine, uptime | — |

## Commands
The rules parser in `src/commands.js` handles these. When `ANTHROPIC_API_KEY` is set, Claude interprets other phrasings into the same fixed intent list.
- `Find 20 businesses around Hamilton that need websites`: discovery pipeline job (no category means sweeping six common trades)
- `Find 10 barbers in Houston, TX` · `Build a demo for #12` / `…for this restaurant` (from a project page) · `Research Joe's Pizza`
- `Show me all clients who haven't responded` · `Show me everything you accomplished today` · `Analyze this month's revenue`
- `Create a marketing campaign for LTGPeak` (needs Claude) · `What needs my approval?` · `Show hot leads` · `Check site uptime` · `System status`

Commands can only start autonomous operations. Approvals always take an explicit click with a confirmation that shows the exact content.

## Notifications
They are generated from real events: approval requested, client replied, leads discovered, demo completed, payment recorded, hot lead (score ≥ 70), site down, and operation failed. Priorities are low/normal/high/critical. Per-kind preferences live on the Notifications page. When Twilio is configured, notifications at or above your threshold are texted to `OWNER_PHONE`, and critical ones can also place a call.

## Keyboard
`⌘K`/`Ctrl K` palette (search, navigate, run command) · `/` command input · `g` + letter to jump · `[` collapse sidebar · `?` help.

## Tests
`test/command-center.test.js` covers the APIs. `test/ui.test.js` drives a real Chromium through every page and the key interactions, and skips when Playwright isn't installed.
