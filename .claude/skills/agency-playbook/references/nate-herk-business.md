# Nate Herk: business, content and n8n playbook (research for LTGPEAK)

Researched 2026-11-15. How sure each item is:
- **[P]** primary: his own pages, a transcript I read in full, or a live page I scraped.
- **[S]** secondary: a third-party summary I saw only as a search snippet. I could not open these to check them.
- **[?]** uncertain, or sources conflict.

**Access limits:** this session's network proxy blocks youtube.com, so yt-dlp and youtube-transcript-api both failed. I got full transcripts of **two** key videos through Firecrawl's YouTube provider before the Firecrawl credits ran out. Other hosts were also blocked for WebFetch/curl: recapio, sozai, apify blog, skool assets and the transcript sites. Everything after that point comes from WebSearch snippets and is marked [S].

---

## (a) Sources used

**Primary (scraped live or read in full)**
- Free Skool "About" page: https://www.skool.com/ai-automation-society/about
- Paid Skool "About" page: https://www.skool.com/ai-automation-society-plus/about
- His site: https://nateherk.com/ and https://www.nateherk.com/about
- Uppit AI: https://uppitai.com/
- Inc. profile (Oct 30 2026): https://www.inc.com/tobi-opeyemi-amure/goldman-sachs-youtube-ai-skills-get-ahead-work/91428479
- Channel data (description, 1.13M subscribers, 591 videos, last 30 uploads with views) via the Firecrawl youtube-com provider for @nateherk (channel id UC2ojq-nuP8ceeHqiroeKhBA)
- Video search results, with titles, view counts and description CTAs, via the same provider
- **Full transcript:** "18 Months of Pricing AI Automations in 21 Mins": https://www.youtube.com/watch?v=Lg5TYWPSg6M
- **Full transcript:** "The 3-Step System Behind My $20K/Month AI Agency Retainers" (a stage talk at Workless AI, Montenegro): https://www.youtube.com/watch?v=DoHPZf7jEQ4

**Secondary (search snippets only)**
- AIS+ review: https://aifunnelinsider.com/ai-automation-society-plus-skool-review/
- Apify case study: https://blog.apify.com/from-bi-to-ai/
- yespress profile: https://yespress.io/nate-herk
- CreatorDB: https://creatordb.app/creatorstats/nateherk/
- "AI Offer You Can Sell Tomorrow Morning" transcript summary: https://sozai.app/transcript/ai-offer-sell-tomorrow-morning/
- "4 agents for $23,000" summaries: https://recapio.com/digest/here-are-4-ai-agents-i-sold-in-2025-that-made-me-23000-by-nate-herk-ai-automation and https://ai.plainenglish.io/how-nate-herk-turned-four-simple-ai-agents-into-23-000-in-sales-dd763ecde3be
- "$6000 live sales call" summaries: https://recapio.com/digest/how-i-sold-a-6000-ai-workflow-to-a-business-live-sales-call-by-nate-herk-ai-automation and https://lilys.ai/en/notes/ai-sales-automations-20251030/live-selling-ai-workflow-business
- First client, $1,200 in 2 hours: https://pages.aiautomationsociety.ai/automation-fast-track and https://www.skool.com/ai-automation-society/new-video-i-built-this-ai-agent-in-2-hours-and-got-paid-1200
- $211k deal post (title only): https://www.skool.com/ai-automation-society/how-we-closed-a-211000-ai-automation-deal
- 7-day first-client video post: https://www.skool.com/ai-automation-society/new-video-how-to-sign-your-first-ai-workflow-client-in-7-days-with-proof
- Error handling: https://www.skool.com/ai-automation-society/new-video-5-must-know-error-handling-techniques-for-production-n8n-workflows
- RAG summary: https://jc-aiwiki.pages.dev/n8n/n8n-fundamentals (video https://youtu.be/Q4iEslmyMyM)
- $100M agency playbook (Devin Kearns interview): https://www.geeky-gadgets.com/m-ai-agency-playbook/
- AI Fire Claude-systems guide: https://www.aifire.co/p/4-claude-automation-systems-that-sold-for-up-to-15-000

---

## (b) Business playbook

### Who he is and what the business actually is now [P]
- Full name Nate Herkelman, born April 2002, based in Chicago.
- University of Iowa, double major in Business Analytics and Marketing.
- Business Intelligence Analyst at Goldman Sachs (Salt Lake City). He left in November 2024.
- **TrueHorizon AI** was the agency, not Uppit.
  - Co-founded January 2025. His site says it scaled to "over $100,000 per month in revenue".
  - Clients named include Topgolf and BarkBox.
  - He exited in December 2025.
  - The channel description says: "I left Goldman Sachs to build an AI consultancy, scaled it to $100K/month, and exited in December 2025."
- **Uppit AI** today presents itself as an *AI education company*, not a done-for-you agency: "We help people turn AI into skills they can prove and build a career around."
  - It covers two brands: Nate Herk (content) and AI Automation Society (community).
  - It also runs events, coaching, certification and the AIOS masterclass.
  - It claims "30M+ views".
  - **Correction to the brief:** Uppit is the education holding brand. The agency case studies come from TrueHorizon.
- Inc. (Oct 2026) says the team is about 10 core employees and roughly 30 people counting contractors. The business runs a paid tier, live events, a newsletter and a new certification.
- **[?] His revenue claims conflict:**
  - The AIS+ page says "AI automation agency from zero to over $1 million per year".
  - The free AIS page says "my $5M+ per year business".
  - The about page says the agency was "$100,000 per month".
  - Most likely these describe different entities (agency vs. the whole education business). Cite each one with its source.

### Positioning: the "AI partner" model [P]
- AIS+ pitch: "Clients on long-term contracts paying $5,000 - $20,000 per month. Nobody on YouTube teaches you how to do that, because they haven't done it. I have."
- The curriculum runs in this order:
  1. AI partner model
  2. Learn Claude Code
  3. Build your portfolio
  4. Get your first client (unlocks after 30 days)
  5. Scale your business (unlocks after 90 days)
- His site describes the end state as "long-term, high-leverage engagements … AI partner models instead of one-off projects."
- On how he framed the agency to his partners: "we're not even an AI agency. We are a data infrastructure agency and then after that we're just a boring automation agency." He also says "Boring is beautiful": deterministic automations are easier to build, easier to evaluate and less risky. (DoHPZf7jEQ4)

### The land-and-expand path to retainers (DoHPZf7jEQ4) [P]
- At TrueHorizon the minimum to work with them became a **$20,000/month retainer**. That minimum is what got the agency past $100k/month.
- The path: start with one project on a **value-based project fee** → choose a KPI before you take payment → push it to production → show that KPI at 1, 2 and 3 months → pitch the retainer.
- His retainer pitch: "we can move a lot quicker if we're not always doing the scoping and we're not always figuring out pricing … just keep attacking those constraints."
- The origin story behind the method. At 23, right after quitting his job, a client told him: **"We are not getting the value that we paid for."**
  - He had built the viral "personal assistant" from one of his videos.
  - He names 3 mistakes: it wasn't the constraint, there was no KPI, and he guessed the price.
  - The real constraint was that the owner was hand-writing proposals. A proposal agent would have been the right build.

### Discovery-call method [P]
- He says he has done about 300 discovery calls. "They come to you and they say something, but that's almost never what they want."
- Many prospects are really buying **relief**: board pressure, a viral video, competitors posting on LinkedIn.
- **Supply- vs demand-constrained** (a pipe metaphor). The two key questions, each followed by silence:
  - Supply-constrained: **"If you had 10x the business tomorrow, what would break first?"**
  - Demand-constrained: **"What would you do to 10x the business coming in tomorrow?"**
- Med-spa case: the owner asked for lead gen. The real problem was no-shows and no follow-up (low LTV), so they built reminder and reactivation systems instead.
- **Silence**: "your job on the discovery calls is to talk as least as possible." He pauses and waits even after the first answer.
- Sometimes the honest answer is "no AI" (e.g. just hire more people). "Knowing when not to use AI" is part of the value.
- **LRP** (Lg5TYWPSg6M): let them dump everything, then Listen, Repeat, Poke. Then pivot to "what changes for the business once this is up and running?"
- **Three question buckets: Why this? Why now? Why me?**
  - "Why me" is the deliberate objection-surfacer: "why wouldn't you just do this internally? Couldn't you vibe code this? Couldn't you hand it to an intern?"
  - Rebuttal script: "he probably could get a version of this up and running, but … who's going to watch it at 2:00 in the morning when the model updates? … who's going to help you scale this when you have way more throughput?" Then stop talking.
- **Sizing questions** for clients who won't share salaries:
  - "How long does this take you today? How many people touch it? What happens when it goes wrong?"
  - Then proxies: number of locations, volume on the busiest days.
- **KPI lock**: "In a perfect world, what does this look like for your business? … what do you want to see?" Then pin one objective number (e.g. baseline 5 appointments/week → target 10–12).
- **Red flag**: a prospect who only wants a number to compare vendors is shopping for cheap labour. Walk away.
- **[S]** The $6,000 live-sales-call video is reportedly a three-call breakdown (discovery → … → close). Its goal for discovery: "gather maximum information about the client." I couldn't check the specifics.

### Pricing (Lg5TYWPSg6M + DoHPZf7jEQ4) [P]
- **Golden rule: show the client a 10x return within year one.**
- **Price = 10–20% of first-year annualized value.** Worked examples:
  - **Appointment-setting agent:** 20 leads/week × 1 hour × $40/hour = $800/week = **$41,600/year**. Build priced at about 13% = **$5,500** (≈7.5x). The remaining upside is that lead volume grows as time frees up. He warns against guaranteeing revenue.
  - **Support automation:** 1 hour/day × $50 ≈ $12,000/year → **$1,200** build.
  - **Construction crew:** turned phone orders into the crew's text format. It saved only 45 minutes a day but avoided **about $12,000/month in scheduling errors**. His point: value hard-dollar error and revenue impact, not just hours.
- **Cost / value / price**: cost is the floor, the client's value is the ceiling, price sits in between. "Cost doesn't justify price, price justifies cost." He credits pricing consultant Jonathan Stark, who spoke at AIS Live, and uses Stark's landscaper/new-truck example.
- **Against hourly**: "it pays you more to be slow". Two devs billed at $150/hour: the slower one earns more. With Claude Code, being faster cuts your hourly income.
  - Exception: for the **first 2–3 projects**, hourly is fine, "maybe just like 100 bucks an hour".
  - Or even start free: "reps over cash upfront when you're getting started."
- **Proposal structure**:
  - Open with three short paragraphs about the client, none about you: where they are now in their words and numbers, where they want to be, and why you.
  - Then **three tiers**, e.g. 10% / 25% / 50% of first-year value, each with more scope. "The middle one is designed to win."
  - Three options change their question from "should we work with this person?" to "how should we work with this person?"
- **Have a price you can defend**: assume the next question is "how did you get that number?" and walk through the math.
  - "If you can't land on a number … you're not ready to write that proposal yet."
- **Upwork/marketplace bids**: state the assumption. "I've priced this assuming about 200 of these a month; if that's off, let's hop on a 15-minute call." That turns a cold quote into a reason to call.
- **Budget objection**: cut scope, never price. "It sounds like 20 grand isn't in the budget … reduce the scope … start with a smaller project." Example: $15k of value against a $7k budget becomes a $7k V1.
- **Milestones / cash flow**: e.g. a $9,000 project in 3 payments (start, milestone 1, final), about 30 days apart. You never carry "much more than 30 days of unpaid work."
  - Milestones must be objective. Good: "owner sends it a question, the agent pulls from the database and responds within a minute." Bad: "inbox agent is working as expected."
- **Scope creep**: "great idea … let's throw this on the backlog for our version two." Creep is a buying signal.
- **Maintenance retainer**: a flat **$400/month**, standard across all projects at that stage.
  - It covers keeping the build doing what was agreed: breakages, API changes, model updates, edge cases.
  - New functionality is a separate sale.
  - Check that maintenance on a big build won't cost you more than $400.
- **Run costs**: "client's account, client's card every single time". Tokens are a utility bill.
  - Put an expected monthly run cost, with its volume assumption, in the proposal.
  - Testing/eval costs ($100 to a few thousand) are folded into the price (+$1–3k). The agency pays during testing, then swaps to the client's keys at production.
- **Prove the after-state**: capture a baseline up front, then report at 1, 2 and 3 months.
  - Not doing this cost him the next deal.
  - Goldman story: a manager replied "Good job, Arthur" to Nate's own demo. If you don't spotlight results you don't get credit.
- Lead magnet: a free **27–30-page pricing masterclass doc** in the free Skool, under Classroom → "All YouTube Resources".
- Note: one example in the DoHPZf7jEQ4 auto-transcript reads "$2,100"/"$2,80". From the stated math (10 hours/week × $40) it should be about $20,800 / $2,080, so this is a transcription error.

### Price ladder and first clients [S unless noted]
- **[S]** Offer ladder from the "AI Offer You Can Sell Tomorrow Morning" summary:
  - 1:1 consulting/AI-OS setup sessions at **$100–$500**
  - audits at $500–$2,500
  - projects at $2,500–$10,000
  - retainers at $3,000–$10,000+/month
  - Unverified auto-summary.
- **[S]** His first sale was a **$1,200 agent built in about 2 hours** (2024). The client came inbound after seeing his YouTube builds, not from Upwork.
- **[S]** "4 AI agents for $23,000" (Aug 2025, 520K views [P]):
  - four separate businesses
  - reported per-deal prices of $1,650, $4,000, $6,000 and $12,000 (an AI summary, unverified)
  - at least one deal from an inbound YouTube lead
- **[P]** Titles show he regularly packages proof deals as content: "How I Sold a $6000 AI Workflow to a Business (Live Sales Call)", "4 Claude Systems That Sell For $3000+ Right Now (With PROOF)", "This n8n Sales Automation Won $5,000 in Just 14 days" [S], and the Skool post "How we closed a $211,000 AI automation deal" (contents not visible).
- **[S]** Client acquisition without content: the "Sign Your First Client in 7 days" video follows an AIS+ member, Christian, using Instantly (cold email), Upwork and LinkedIn. There is also a guide, "Land AI Workflow Clients (Without Posting Content)": 3 methods plus a 4-step framework.
- **[S]** Apify case study:
  - a pre-sales research agent scrapes the prospect's digital footprint and generates a custom proposal brief before each call
  - he generated about 8 leads/day using Apify-powered automation
- **[P]** What sells, from titles: "I've Built 500 AI Workflows, This is What Businesses Want in 2026" (279K views), "Sell These 5 Most In Demand AI Automations in 2026", plus "AI receptionists" and voice agents on his about page. Lead-gen/sales automations are the most common ask; he cites a stat that over 50% of AI automations are lead-gen/sales/marketing.

---

## (c) Content and growth playbook

### Growth numbers
| Metric | Value | Source |
|---|---|---|
| First YouTube video | Sept 2024 | [S] Apify, yespress |
| Free Skool started | Oct 2024 ("small free group to share YouTube resources") | [P] about page |
| Left Goldman | Nov 2024 | [P] |
| Subscribers, June 2025 | 230,000+ ("in 9 months") | [S] Apify |
| Subscribers, Mar 2026 | ~595K | [S] |
| Subscribers, Jul–Aug 2026 | ~847–850K | [S] |
| Passed 1M | ~Sept 2026 ("passed 1 million subscribers just last month", Inc., Oct 30 2026) | [P] Inc. |
| Subscribers, today | **1.13M**, 591 long-form videos | [P] channel data, 2026-11-15 |
| Free AIS members | **482.3k** (1.1k online, 16 admins) | [P] Skool, today |
| AIS+ (paid) members | **3.3k**, **$129/month**, 4.9★ (98 reviews), 24 admins | [P] Skool, today |
| AIS+ earlier price | $99/month or $839/year | [S] older review [?] |
| Skool Games | Won 4 consecutive times, Q1–Q4 2025 | [P] his site |
| Other credentials | n8n Verified Expert Partner; n8n Community Award 2024 & 2025; Microsoft "Learn With" creator; book *Becoming AI Native* (#1 Amazon in 4 categories) | [P] |

- **[?] Rough AIS+ revenue:** 3.3k × $129 ≈ $425k/month gross if everyone paid monthly. This is my estimate, not his disclosed number; annual plans and churn are ignored.

### Cadence and formats [P, from the last 30 uploads]
- About 30 long-form uploads between "1 month ago" and "4 days ago". That is about **4–6 long-form videos a week**.
- 591 videos in about 26 months averages about 5/week.
- His site says "New YouTube videos every week".
- Typical length is 9–26 minutes. Mixed in are long "course" videos ("Build & Sell n8n AI Agents (8+ Hour Course, No Code)" = **2.04M views**, his biggest seen) and occasional interviews (Matt Pocock 539K; collabs with Mark Kashef and Austin Marchese).
- **Recurring title templates** (all from real titles):
  - **"I Tested X. What You Need to Know."** / "I Tested X on 12 Real Use Cases. My Honest Thoughts." (new-model reaction, released fast)
  - **"I Tried 100+ X. These N Are the Best"** (curation listicle; GitHub repos 436K)
  - **"Every X Explained for Normal People"** / **"Every AI Business Ranked from Worst to Best"**
  - **"Master 96% of X in under 35 minutes"**
  - **"Build & Sell X (N+ Hour Course)"**: the "& Sell" framing on technical courses ties every tool back to income
  - **Money and proof in the title**: "$20K/Month Retainers", "Sold … for $23,000 (as a beginner)", "Sell For $3000+ (With PROOF)", "$6000 … (Live Sales Call)"
  - **Restart/regret framing**: "How I'd Learn n8n if I had to Start Over in 2026" (348K), "How I'd Make Money with AI … (if I had to Start Over)"
  - **"(Without Starting an Agency)" / "(With 0 Followers)" / "(as a beginner)"**: parentheses that remove an objection
  - **Experience compression**: "5000 Hours of Building AI in Just 17 Minutes", "18 Months of Pricing AI Automations in 21 Mins"
  - **Experiment/stunt**: "I Told Claude to 'Make it better' 100 Times (It Went Too Far)" (804K), "I Gave GPT … $10,000 to Trade Stocks"
  - **Borrowed authority**: "Everything Alex Hormozi Said About…", "Anthropic's CEO: How to Build a 1 Person Business with Claude"
- **Topic drift as a growth tactic**: the channel started n8n-only. It is now mostly Claude Code / Codex / model comparisons, keeping the "AI Automation" brand and moving to wherever search demand goes.
- **Hook pattern** (from both transcripts):
  1. A credibility stat in the first 15 seconds ("I've sold over 100 AI automation systems … scaled my agency to over $100,000 a month and then I sold it")
  2. an admitted mistake ("I've undercharged, I've underscoped")
  3. the promised outcome ("by the end … a price that you can actually defend")
  4. "let's not waste any time"
- **Thumbnails**: [?] I couldn't view them (YouTube blocked). I have no verified observations.

### Funnel [P]
- **YouTube (top of funnel) → free Skool → AIS+ ($129/month) → events/certification.** In his talk: "I've got a YouTube channel. It's pretty much the top of funnel … my free community … is where we try to get people into and try to build community."
- **Description CTAs** (seen across videos):
  - "My FREE AI OS Course: skool.com/ai-automation-society/about"
  - newer: "My playbook for growing a $1M AI agency: app.aiautomationsociety.ai/opaa-ads-optin" (an email opt-in)
  - "FREE First Client SOP"
  - plus affiliate/sponsor links (Hostinger, Clay, Apify, etc.)
- **Mid-roll CTA script**: "if you want to access this completely free resource, which is like a 27-page doc … join my free school community … click on classroom, go to all YouTube resources … I promise you guys it's in there." Every video's template or doc lives in that one Classroom folder.
- **Free Skool offer** (the page copy):
  - Claude Code skills
  - full GitHub repos
  - resource guides
  - "100+ n8n templates"
  - a **7-Day AIS Challenge** (build a Claude Code AI Executive Assistant → earn "AIS certification")
  - "Build your own AI OS" with a free repo "so you can … sell them to businesses"
  - Free courses (Uppit page): Start Here, 7 Day AIS Challenge, Build Your AI OS ("The Four Cs"), Your First AI Agent, Claude Code, "10 Hours to 10 Seconds".
- **Paid AIS+ offer**:
  - courses that drip-unlock (first-client module at 30 days, scaling at 90)
  - 3 online conferences a year plus 1 annual in-person event
  - "Unlimited FREE tech support"
  - weekly Q&As with Nate
  - job opportunities
  - Refund: annual plans within 7 days; monthly sales are final.
- **Events as content**: the retainer video is a recording of his talk at Workless AI (Montenegro). AIS Live speakers (e.g. Jonathan Stark) get reused in videos.
- **Survey PR**: a 1,000+ member survey given first to Inc. earned press coverage. The community data became a media asset.
- **Building in public**: his site says "Building in public across platforms". Many videos reverse-engineer his own systems and deals ("how he sold his first n8n workflow", "made over $1 million from AI by age 23").

---

## (d) n8n fundamentals (short; mostly [S])
- **5-step agent-building process** [P, about page]:
  1. foundations
  2. map the process
  3. choose workflow vs agent
  4. ship a fast proof-of-concept
  5. add strong guardrails
- Bias toward **deterministic automation first** and AI only where needed ("boring is beautiful"; "the real fix might be a really simple deterministic script and a Slack notification") [P].
- **Error handling** [S]: the video "5 Must-Know Error Handling Techniques for Production n8n Workflows" covers Retry on Fail, a fallback LLM, Continue on Error, an Error Trigger workflow, and polling.
  - Third-party caveat: a tool error inside an Agent node returns to the agent as a tool result, so a workflow-level Error Trigger won't catch it.
- **RAG** [S]: "Once You Know This, Building RAG Agents Becomes Easy in n8n" says don't default to vector search. There are four retrieval patterns, and the right one depends on the data shape: vector, filter/metadata, SQL, and full-context. "The system prompt is load-bearing."
- **Testing/evals** [P]: test rigorously before production (budget $100 to a few thousand), use objective milestones, and run the build on the agency's keys during testing.
- **Delivery** [P title]: "How to Actually Deliver AI Projects (APIs, Hosting & Handover Explained)" (102K). He self-hosts n8n (Hostinger sponsor) and puts APIs on the client's accounts at handover.
- Learning path: "How I'd Learn n8n if I had to Start Over in 2026", and the 8-hour "Build & Sell n8n AI Agents" course. Not transcribed.

---

## (e) Concrete moves for LTGPEAK to copy

1. **Price your site/dashboard work by value, not hours.**
   - In discovery, have the shop owner say what the problem costs them: missed calls, no-shows, hours on spreadsheets, lost online orders.
   - Quote 10–20% of first-year value, with the math written in the proposal.
   - Hourly (about $100/hour) or free is fine only for the first 2–3 jobs (e.g. your brother's shop as the paid-in-proof case study).
2. **Use his two diagnostic questions on every local-business call**: "If you had 10x the customers tomorrow, what breaks first?" / "What would you do to get 10x the customers in?" Then stay silent. For local shops the constraint is often follow-up and no-shows, not leads (his med-spa example). That points to booking, reminder and reactivation automations bolted onto the sites you already build.
3. **Pin one KPI before you take payment** (e.g. online bookings per week, calls answered). Record a baseline, report at 30/60/90 days, then pitch the retainer. "Spotlight your value" means a monthly results email or dashboard, and your dashboard skill is the delivery vehicle.
4. **Three-tier proposal** (e.g. Site → Site + booking/automation → Site + automation + monthly reels).
   - Open with 3 client-centric paragraphs.
   - Pay in milestones about 30 days apart, each milestone objective.
   - Scope creep goes to a "v2 backlog".
   - Budget pushback: cut scope, never price.
5. **A standard flat maintenance retainer** (he used $400/month) for every build. Define it as "keeps doing what we agreed", with new features quoted separately.
   - Recurring reels ads are a natural upsell retainer, because ads have the clear ROI that automation lacks (he contrasts the two himself).
6. **Client's account, client's card** for hosting, APIs and Vercel/LLM tokens. Put an estimated monthly run cost in each proposal.
7. **Turn every deal into content** with his title formulas:
   - "I Built [shop] a Dashboard That [result] (With PROOF)"
   - "How I'd Get My First Local Client if I Started Over"
   - "I Tested [new Claude feature]. What You Need to Know."
   - "I Tried 100+ Claude Code Plugins. These 6 Are the Best"
   - Your code-driven reels engine can produce the short-form cut-downs. Open with a credibility stat plus an admitted mistake.
8. **Build a single free "resources" hub** (a free Skool, Notion or LTGPEAK page) and promise one specific free asset in every video and reel: a plugin repo, a website template, a pricing doc. That is the lead magnet → email opt-in → paid offer chain. Later, sell the multi-agent plugins and templates as a paid tier, his "& Sell" framing.
9. **Productize what you already sell**:
   - a Claude Code "AI OS" setup for owners as an entry rung (the [S] ladder puts 1:1 sessions at $100–$500)
   - then audits → projects → retainers
10. **Automate your own pre-sales**: a research agent that scrapes a prospect's web/Google presence and drafts a proposal brief before each call (his Apify setup, [S]). This is a natural use of your multi-agent plugins.

*Unverified items to check yourself on YouTube: the per-deal prices in "4 agents for $23k", the $100–$500 consulting ladder, the $6k sales-call specifics, and thumbnail style.*
