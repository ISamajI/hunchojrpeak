---
date: 2026-11-06
platform: YouTube (Shorts + long-form)
agent: "subagent-3"
tags: [editing-research, youtube, youtube-shorts, retention, pacing, captions, sound-design, ai-editing, raw]
---

# YouTube Editing Trends — 2026-11-06 (raw research)

Scope: editing styles and techniques getting traction on YouTube Shorts and long-form, roughly mid-2026 to now. Each claim cites a source; source quality is noted at the end. Most "trend" sources are vendor or agency blogs (OpusClip, Pixflow, AIR Media-Tech) that sell editing products or services, so treat their numbers as directional, not independent research.

**Big picture (synthesis):**
1. On long-form, the push is away from constant non-stop stimulation and toward **pacing that varies on purpose**: tight openings, calmer middles, and bursts timed to story beats. MrBeast himself said in 2024 that he was slowing down. The 2026 guidance from AIR and Pixflow names over-editing as a mistake, especially for viewers over 25–35.
2. On Shorts, the field has split into many recognizable **aesthetics** rather than a single "TikTok edit". Two extremes both perform: the maximalist brainrot stack and the minimal talking-head or documentary-realism look.
3. YouTube's own tools are moving to **AI and conversational editing** (Gemini Omni in Shorts Remix and the YouTube Create app, plus Conversational Editing announced at Made on YouTube, 2026-09-23). Studio also got **video A/B testing of up to 3 cuts**, which means you can test hooks directly in Studio.
4. Since 2026-10-01 the Shorts algorithm de-prioritizes re-uploads that don't add "unique editing" or commentary. That raises the value of real transformative editing over plain clip-and-caption reposts.

---

## Trending techniques

### 1. [[Retention Editing]] (graph-driven, rhythm-first)
- **What it looks like:** The edit is shaped around the YouTube Studio audience-retention graph instead of the order things were shot. Cold opens, payoffs previewed early, rehooks placed where viewers tend to drop, and no "winding down" energy at the end.
- **Why it works:** YouTube Studio's retention report includes an "Intro" metric (share of viewers still watching after 30s), and videos above 50% are flagged as outperforming. vidIQ (cited by Pixflow) says most drop-off, often 55%+, happens in the first minute.
- **How to do it (any NLE: Premiere Pro, DaVinci Resolve, CapCut):**
  1. Before editing, look at the retention graphs of your last 5 videos and classify the drops: early crash, slow mid-video decline, sudden cliff, or end falloff.
  2. Open with a highlights teaser (under 10s), a direct value statement, or a cold open ("but let me back up").
  3. Change something visual every 10–15s in the opening, and put the first deliberate [[Pattern Interrupt]] at about 25–35s.
  4. Rehook about every 2–3 min (see [[Rehook]] / [[Hook-Deliver Cycle]]).
  5. Cut finalizing language ("to recap", "lastly"), move the CTA to mid-video (under 5s), and keep talking over the end screen.
  6. Do a "rewatch test" the next day with your phone out of reach, and fix every spot where you feel the urge to check it.
- **Status:** Peak. It's the baseline approach now, but the *style* is changing (see #2).
- **Sources:** Pixflow (2026-07-19, upd. 2026-08-11); AIR Media-Tech (2026-09-14); YouTube Help "key moments for audience retention" (support.google.com/youtube/answer/9314415, referenced by both).

### 2. [[Variable Pacing]] — the five long-form cutting patterns
- **What it looks like:** Instead of evenly fast cuts, the edit commits to one rhythm pattern per video. AIR Media-Tech says it analyzed 100 long-form channels and that the top 25% by average view duration held viewers 20–30% longer. It names five patterns:
  - **Progressive Rhythm:** a visual change every 10–20s for minutes 0–3, widening to 25–40s, then calm stretches mixed with short energy bursts after minute 8 (examples given: Veritasium, Ali Abdaal).
  - **Contrast:** calm talking-head pacing (15–25s per cut), broken every 2–3 min by a burst of 5–10 quick cuts (Ryan Trahan, Drew Gooden).
  - **Narrative Loop:** return to the core premise or hook every 2–3 min with a title card or a verbal callback (MrBeast, Yes Theory).
  - **Hybrid Tempo:** fast micro-cuts during explanation, slow holds of up to 40s on visuals or examples (Better Ideas, Think Media).
  - **Anchor:** cuts triggered by emotional beats rather than a timer, with ambient sound guiding the pacing (Nathaniel Drew, Johnny Harris).
- **Why it works:** Viewers learn a video's rhythm within the first minute. An intentional rhythm feels comfortable, while flat or chaotic rhythm makes people leave. Contrast also makes the fast sections feel faster.
- **How to do it:** Choose a pattern at the script stage. Put markers in the timeline at each planned burst or rehook point (Premiere: M key; Resolve: M). Use [[Smash Cut]]s to go into bursts and [[Strategic Silence]] or pause cards to come out of them.
- **Audience calibration (AIR):** For ages 13–24, a visual change every 15–25s. For 25+, every 20–40s and only on a topic or tone shift, using simple fades or light zooms.
- **Status:** Rising.
- **Sources:** AIR Media-Tech (2026-09-14). Note: AIR's data (the 100-channel analysis) is proprietary and not independently verifiable.

### 3. Post-"Beastification" slowdown ([[Story-First Pacing]])
- **What it looks like:** Fewer cuts, scenes allowed to breathe, less yelling, more personality, longer videos. Tubefilter counted 38 cuts per minute in a March 2023 MrBeast video versus 23 per minute in his March 2024 "Abandoned City" video.
- **Why it works:** MrBeast (via X, 2024-03-03) said views "skyrocketed" after the slowdown and that ultra-fast "overstim" content "doesn't even work." In 2026, AIR also names over-editing (endless zooms, whooshes, stacked jump cuts) as a retention killer, especially for older audiences, and points to Penguinz0 and MKBHD as minimal-edit successes.
- **How to do it:** Keep [[Jump Cut]]s to remove dead air, but hold A-roll longer when the message carries itself. Save heavy transitions for real turning points such as scene changes, reveals and emotional peaks. Add micro-pauses after big statements.
- **Status:** Peak, now mainstream on long-form. The source data is **from 2024 (possibly stale)** but is corroborated by 2026 guidance from AIR and Pixflow.
- **Sources:** Tubefilter (2024-03-04, **pre-2025: flag**); Washington Post (2024-03-30, **pre-2025: flag**, not opened, headline only); AIR Media-Tech (2026-09-14); Pixflow (2026-07-19).

### 4. [[Zoom Punch-In]] / [[Kinetic Pacing]]
- **What it looks like:** Digital 10–20% punch-ins on emphasis words in a single-camera talking head, plus slow continuous zooms or drifts so the frame is never fully still while an idea is developing.
- **Why it works:** It creates visual variety from one camera angle, and movement signals "something is happening." A slow zoom in builds tension and a slow zoom out releases it or reads as an ending.
- **How to do it:** Premiere Pro: Effect Controls > Scale keyframes (100% → 110–120%), or cut and scale the second half of a split clip for an instant punch. Resolve: Inspector > Zoom, or Dynamic Zoom. CapCut: Animation > "Zoom in" or keyframes. Cut on the emphasis word. If two adjacent clips both zoom, match their speed and direction.
- **Status:** Peak, with signs of fatigue when overused (AIR and Pixflow both warn that audiences over 35 retain worse with a zoom on every sentence). Expect slow, subtle zooms to outlast hard punches.
- **Sources:** AIR Media-Tech (2026-09-14); Pixflow (2026-07-19); Choppity "Alex Hormozi editing style" page (undated, vendor).

### 5. [[Kinetic Captions]] (word-by-word / "Hormozi-style")
- **What it looks like:** Big bold captions, often all caps, showing 1–4 words at a time that pop in as each word is spoken. Keywords are color-highlighted (often yellow), sizes vary for emphasis, with a slight bounce animation and outline or shadow for readability.
- **Why it works:** Captions pull attention even when the video is muted. OpusClip calls them "the most important retention mechanism" in brainrot edits (a vendor claim). A caption-tool blog (Exemplary AI) notes it found **no controlled study** showing that Hormozi captions increase views, so the effect is unverified.
- **How to do it:**
  - Premiere Pro 26.3 added **single-word captions** (per EditorsKeys). Use Text panel > Transcribe > Create captions, then style them.
  - CapCut / OpusClip / Submagic: auto-caption presets with keyword highlighting.
  - Free fonts: Anton or Montserrat Black/ExtraBold (Google Fonts, SIL OFL). Centered, lower-middle placement.
- **Status:** Peak on Shorts and fading as a signature look, since it's now everywhere and preset-driven. Several 2026 aesthetics use minimal or no captions (see #7). "Fading" is my inference from that contrast and is **not stated by any source**.
- **Sources:** OpusClip brainrot article (undated, 2026); Exemplary AI (undated); Choppity (undated); EditorsKeys (2026, undated); OpusClip aesthetics (2026-05-12).

### 6. [[Brainrot Stack]] (Shorts)
- **What it looks like:** A collage of 2–3 vertical video layers: a talking head on top, gameplay (e.g., Subway Surfers) below, an ASMR sound layer, and three-color kinetic captions jumping by phrase. Cuts every **0.6–0.8s**.
- **Why it works:** Sensory overload. More inputs make it harder to scroll away. OpusClip calls it "the dominant short-form aesthetic of 2026" (vendor claim; its article frames it around TikTok).
- **How to do it:** CapCut or Premiere, 9:16 canvas. Stack the clips in a split-screen layout, add a low-volume ASMR or gameplay audio bed, then kinetic captions.
- **Caution:** The 2026-10-01 Shorts algorithm update reduces reach for re-uploaded content without original contribution. Using someone else's footage as filler, or in the top layer, carries risk unless you add real commentary or editing.
- **Status:** Peak, at risk on YouTube because of the originality update.
- **Sources:** OpusClip (2026-05-12); OpusClip brainrot article (undated); Social Media Today (2026-10-01).

### 7. [[Documentary Realism]] / [[Phone-First Cinematic]] (counter-trend)
- **What it looks like:** Cinematic framing, slow zooms, a 24fps feel, one restrained grade (one LUT) across the whole piece, and captions only where needed. The phone-first variant is shot on a phone on a tripod or gimbal with manual exposure and light grain.
- **Why it works:** It stands out against fast-cut feeds ("this is not made for the algorithm") and signals quality within about 2 seconds.
- **How to do it:** DaVinci Resolve (free) or Final Cut Pro for the grade. Apply one LUT or grade on an adjustment layer over the whole timeline. Use slow keyframed push-ins and minimal text. Optional [[Letterboxing]] bars animated in before a big moment (AIR).
- **Status:** Rising.
- **Sources:** OpusClip (2026-05-12); AIR Media-Tech (2026-09-14).

### 8. [[Video Essay Style]] (Vox-style information density)
- **What it looks like:** Lower thirds, maps, archival footage, one sans-serif font, a chart or map every 8–10s, music low and voiceover in front. Includes [[Text Emphasis]] (circling, underlining or recoloring a word as it's spoken; AIR cites Vox and Ali Abdaal).
- **Why it works:** Slower pace but very high watch time when the topic resonates. Viewers come away feeling smarter.
- **How to do it:** After Effects or Premiere MOGRTs for lower thirds and maps. Keep one typographic system. Time the graphics to the VO.
- **Status:** Peak on long-form, and showing up in Shorts.
- **Sources:** OpusClip (2026-05-12); AIR Media-Tech (2026-09-14).

### 9. [[Talking-Head Static]] (Shorts)
- **What it looks like:** One shot, one angle, no B-roll, captions slightly off-center and hard-cut by paragraph.
- **Why it works:** Trust beats production value when the person is the brand. OpusClip says it "built dozens of $1M-ARR creators in 2026" (**unverifiable** vendor claim).
- **Status:** Rising.
- **Sources:** OpusClip (2026-05-12).

### 10. [[Greenscreen Explain]]
- **What it looks like:** The presenter sits on the left or right third, with images, news clips or screenshots on the other side, swapped every 4–6s. Clean VO and minimal music.
- **Why it works:** Lets you comment on visuals you don't own. Commentary also counts as "adding value" under the Shorts originality update.
- **How to do it:** The YouTube Shorts camera green screen. Social Media Today reported this feature (2025, URL 806508) as generating AI backgrounds; I did not open that article. Or use CapCut Chroma Key / Remove Background.
- **Status:** Peak.
- **Sources:** OpusClip (2026-05-12); Social Media Today (search excerpt, ~2025); Social Media Today (2026-10-01).

### 11. [[Hands-Only ASMR]] / [[Audio-Reactive Edit]]
- **Hands-only ASMR:** No face, no voice. Overhead or close-up shots of restoring, building or cooking, in real time or slightly sped up, with clean diegetic sound and no music or captions.
- **Audio-reactive AI:** Visuals that morph, color-shift or beat-drop in sync with the audio peaks of an 8–30s loop.
- **Status:** Rising (OpusClip). Popularity is **unverified** beyond the vendor article.
- **Sources:** OpusClip (2026-05-12).

### 12. [[SFX Layering]] / sound design as structure
- **What it looks like:** Whooshes or swipes on camera motion, subtle pops on text or icon reveals, amplified impacts (slam, coin drop) on reveals and punchlines, music tracks changed at chapter turns, and music dropped to silence just before a reveal.
- **Why it works:** Sound effects are the cheapest [[Pattern Interrupt]]. Music changes signal progress without words.
- **How to do it — AIR's numbers:** Music under the voice at **−20 to −25 dB, 60–80 BPM** for calm narrative sections, and **−8 to −12 dB, 100–120 BPM** for energetic builds. Use [[Cut to the Beat]] by landing hard cuts on kicks or snares. Don't put a pop on every subtitle, or it feels over-processed.
- **Tools:** Epidemic Sound (AIR partner, so AIR has a disclosed interest), Premiere Essential Sound and the new Sept-2026 audio tools, Resolve Fairlight.
- **Status:** Peak.
- **Sources:** AIR Media-Tech (2026-09-14); Pixflow (2026-07-19); Adobe Blog (2026-09-08).

### 13. Invisible cutting: [[J-Cut]] / [[L-Cut]] / [[Match Cut]]
- **What it looks like:** Audio leads into the next scene (J-cut) or trails over the next visual (L-cut) so B-roll can cover a sentence without breaking it. Shot-size progression (skip a size, e.g., wide → medium-close), match-on-action, and keeping the subject within about 10% of its previous frame position.
- **Why it works:** Viewers leave at the "seams" between sections. Smoothing them with L-cuts and continuous music makes the video feel like one unbroken ride.
- **How to do it:** Premiere or Resolve: unlink audio (Alt/Option-drag) and extend the audio tail or head past the video cut.
- **Status:** Peak (an evergreen craft basic, now framed explicitly as a retention tool).
- **Sources:** Pixflow (2026-07-19); AIR Media-Tech (2026-09-14).

### 14. [[Rehook]] / [[Hook-Deliver Cycle]]
- **What it looks like:** Every resolved point is immediately followed by a new open loop ("but there's one problem…"). There are three rehook types: question, tease, and pattern-interrupt (new angle, sudden zoom, location change). Tease rehooks should be used sparingly.
- **How to do it:** Mark every 2 minutes of the outline as a candidate rehook point and decide in the edit which ones earn a place. Never let a section end on a flat pause. In list videos, don't show the count for the last item.
- **Status:** Peak.
- **Sources:** AIR Media-Tech (2026-09-14); Pixflow (2026-07-19).

### 15. [[Hook A/B Testing]] (new YouTube Studio capability)
- **What it looks like:** Uploading up to **three different cuts** of a video so YouTube can test which one holds attention best. This turns the opening edit into something you can measure.
- **How to do it:** YouTube Studio > video A/B testing (announced "coming soon" on 2026-09-23). Edit 2–3 versions that differ only in the first 30s (cold open vs. value statement vs. highlights teaser).
- **Status:** Rising. Availability and rollout are **unconfirmed**; it was announced as coming soon.
- **Sources:** YouTube Official Blog (2026-09-23, two posts).

### 16. [[Conversational AI Editing]] (YouTube-native)
- **What it looks like:** You prompt a Gemini-powered assistant in the Shorts composer or the YouTube Create app to make a first draft, then keep chatting ("trim pauses", "reorder for better pacing", "sync music to the beat"). You can switch to manual timeline edits at any time.
- **Context:** Gemini Omni was added to Shorts Remix and YouTube Create on 2026-05-19 (I/O). YouTube says "hundreds of thousands of channels" a day used it in Aug 2026. YouTube's GenAI trends report says 72% of US video posters aged 14–44 used AI to create or edit in the past year. Omni remixes carry SynthID watermarks and link back to the original. Creators can opt out of visual remix.
- **Status:** Rising. Conversational Editing was **previewed** on 2026-09-23 and full availability is unconfirmed.
- **Sources:** YouTube Official Blog (2026-05-19; 2026-09-23 ×2); Social Media Today (2026-09-27).

### 17. [[Serialized Shorts]] / microdramas
- **What it looks like:** Vertical scripted episodes, often 30s–3min, with a cliffhanger at the end of every episode, grouped into seasons and episodes using **Shorts Series**, with custom thumbnails and sequential playback. YouTube added microdrama subscriptions after Made On.
- **Editing implication:** Each episode needs a cold-open recap of 1–2s and a hard cliffhanger cut at the end. Keep grade and caption style consistent across the series.
- **Status:** Rising.
- **Sources:** YouTube Official Blog (Shorts Series / TV, 2026-09-23 era; microdramas culture post, undated in excerpt); Tubefilter (2026-09-24); Social Media Today (microdrama subscriptions, ~Oct 2026; not opened, excerpt only).

### 18. [[Transformative Editing]] (algorithm-driven, Shorts)
- **What it looks like:** Clips from other creators are only reposted with clear original commentary, "unique edits", or storytelling added.
- **Why it matters:** On 2026-10-01 YouTube said channels that "primarily aggregat[e] or re-upload… other creators' videos without significant changes will likely see less distribution within the Shorts feed."
- **Status:** Rising (policy-driven).
- **Sources:** Social Media Today (2026-10-01), quoting the YouTube Help Community thread (support.google.com/youtube/thread/470890423); YouTube spam policy (support.google.com/youtube/answer/2801973).

### Other techniques worth notes (brief, from AIR 2026-09-14)
[[Time Ramping]] (slow-mo into a snap back to full speed), [[Smash Cut]], [[Strategic Silence]] / pause cards, [[Cutaway Bridge]], [[Picture-in-Picture]] (Ali Abdaal tutorials), [[Side-Screen Swipe]], simulated handheld shake on static shots (Mrwhosetheboss intros), contrast and vignette to direct the eye, [[Letterboxing]] animated in before big moments.

---

## Tools & apps

| Tool | 2026 relevance | Source |
|---|---|---|
| **YouTube Create app** | Gemini Omni remix (May 2026); Conversational Editing assistant (announced Sept 2026) | blog.youtube 2026-05-19, 2026-09-23 |
| **YouTube Shorts composer / Remix** | Omni remix with prompts and images; Conversational Editing; Shorts Series | blog.youtube 2026-05-19, 2026-09-23 |
| **YouTube Studio ("Ask Studio")** | Draft feedback on pacing, structure and storytelling; channel-matched AI thumbnails; dynamic thumbnails (best of 3 by audience segment); **video A/B testing of up to 3 cuts** (coming soon); Insights and Research tabs for outlier ideas | blog.youtube 2026-09-23 |
| **Adobe Premiere Pro (26.x)** | Generative Extend, AI Object Mask, Media Intelligence search, speech-to-text, now included in the standard subscription (Rework, July 2026); **single-word captions** in 26.3 (EditorsKeys); Sept 2026 **Generative Media Tool** in the timeline plus new audio enhancement tools and Color Mode updates (Adobe Blog 2026-09-08) | Adobe Blog; Rework; EditorsKeys |
| **Adobe After Effects** | AI Assistant for automating repetitive tasks (Sept 2026) | Adobe Blog 2026-09-08 |
| **DaVinci Resolve 21** | AI media search by content, de-aging and blemish removal, better keyframing on the Edit and Cut pages, Fairlight folders; free tier, strong for [[Documentary Realism]] grades | blackmagicdesign.com (What's New) |
| **CapCut** | Manual kinetic captions, chroma key, keyframe zooms; AIR points to CapCut's blog for click-by-click tutorials. Check current regional availability and terms. | AIR 2026-09-14 |
| **OpusClip** | Long-to-short clipping with auto kinetic captions (emoji and keyword highlight); OpusClip 4.0, "AI Producer" | opus.pro (2026) |
| **Submagic** | Caption presets, including Hormozi-style (Anton font, yellow stroke) | via Exemplary AI (undated) |
| **Descript / Gling** | Text-based editing; auto-removal of silence and filler words for talking heads | thecreatorsassistant.com (search excerpt only, not verified) |
| **Epidemic Sound** | Royalty-free music and SFX for [[SFX Layering]] (note: AIR partner) | AIR 2026-09-14 |

---

## Rising vs. fading (summary)

| Rising | Peak | Fading / at risk |
|---|---|---|
| [[Variable Pacing]] patterns, [[Documentary Realism]], [[Talking-Head Static]], [[Hook A/B Testing]], [[Conversational AI Editing]], [[Serialized Shorts]], [[Transformative Editing]] | [[Retention Editing]], [[Kinetic Captions]], [[SFX Layering]], [[J-Cut]]/[[L-Cut]], [[Rehook]], [[Video Essay Style]], [[Greenscreen Explain]], [[Brainrot Stack]] | Ultra-fast, uniform "overstim" cutting on long-form (MrBeast 2024 and AIR 2026); a zoom and whoosh on every sentence; long branded intros and "hey guys" openers; aggregator re-uploads on Shorts (algorithm, 2026-10-01); [[Kinetic Captions]] as a *differentiator* (my inference, not from a source) |

---

## Flags / unverifiable
- AIR Media-Tech's "100 channels" and "450K channels" datasets are proprietary. AIR sells audits, and Epidemic Sound is a partner.
- OpusClip and Pixflow are product vendors, and their articles promote their own tools. Claims like "dominant aesthetic of 2026" and "$1M-ARR creators" are unverified.
- MrBeast cut-count data is from 2024 (Tubefilter), which predates this research window.
- Video A/B testing and Conversational Editing were *announced or previewed* on 2026-09-23. Broad availability as of 2026-11-06 is unconfirmed.
- The Premiere 26.3 "single-word captions" detail comes from a third-party retailer blog (EditorsKeys), not Adobe release notes.
- I found no independent study showing that word-by-word captions increase views (Exemplary AI says the same).

---

## Sources
1. YouTube Official Blog — "New tools to power your creation journey from start to finish" (Aparna Pappu), 2026-09-23 — https://blog.youtube/news-and-events/made-on-youtube-new-tools-power-creation-journey/
2. YouTube Official Blog — "Innovation for the YouTube Era: What's new for viewers and creators" (Neal Mohan), 2026-09-23 — https://blog.youtube/news-and-events/innovation-youtube-era-made-on-viewers-creators/
3. YouTube Official Blog — "All the YouTube news from Google I/O 2026", 2026-05-19 — https://blog.youtube/news-and-events/youtube-news-google-io-2026/
4. YouTube Official Blog — Shorts Series & TV features (Made on YouTube 2026), ~2026-09-23 (excerpt only) — https://blog.youtube/news-and-events/made-on-youtube-creators-shorts-series-tv-features/
5. YouTube Official Blog — "The evolution of web series on YouTube: Microdramas", date not captured (excerpt only) — https://blog.youtube/culture-and-trends/the-evolution-of-web-series-on-youtube-microdramas/
6. YouTube GenAI Trends Report (referenced by source 1, not opened) — https://www.youtube.com/trends/report/tr26-genai-trends-report/
7. YouTube Help — Audience retention key moments (referenced by Pixflow/AIR, not opened) — https://support.google.com/youtube/answer/9314415
8. YouTube Help Community — "Prioritizing original content on Shorts" (referenced by SMT, not opened) — https://support.google.com/youtube/thread/470890423
9. YouTube Help — Spam, deceptive practices policy (referenced by SMT, not opened) — https://support.google.com/youtube/answer/2801973
10. Social Media Today — "YouTube updates Shorts algorithm to put more focus on original content", 2026-10-01 — https://www.socialmediatoday.com/news/youtube-updates-shorts-algorithm-to-put-more-focus-on-original-content/831976/
11. Social Media Today — "YouTube previews AI-powered Conversational Editing", 2026-09-27 — https://www.socialmediatoday.com/news/youtube-previews-ai-powered-conversational-editing/831445/
12. Social Media Today — "YouTube presents new AI and engagement features at Made On 2026", ~2026-09-23 (excerpt only) — https://www.socialmediatoday.com/news/youtube-presents-new-ai-and-engagement-features-at-made-on-2026/831216/
13. Social Media Today — "YouTube adds microdrama subscriptions", ~2026-10 (excerpt only) — https://www.socialmediatoday.com/news/youtube-adds-microdrama-subscriptions/872982/
14. Social Media Today — "YouTube Expands Access to Gen AI Features" (green screen / clips), date not captured, likely 2025 (excerpt only; **possibly stale**) — https://www.socialmediatoday.com/news/youtube-expands-access-to-gen-ai-features-adds-communities-features/806508/
15. Tubefilter — "YouTube wants you to pump its TV watch time with microdramas", 2026-09-24 (excerpt) — https://www.tubefilter.com/2026/09/24/made-on-youtube-shorts-series-microdramas/
16. Tubefilter — "MrBeast says to stop using his editing style (because he did, too)", 2024-03-04 (**pre-2025, possibly stale**) — https://www.tubefilter.com/2024/03/04/mrbeast-editing-style-number-of-cuts-per-video/
17. Washington Post — "The 'Beastification of YouTube' may be coming to an end", 2024-03-30 (**pre-2025**, headline/excerpt only) — https://www.washingtonpost.com/technology/2024/03/30/video-editing-mrbeast-retention/
18. AIR Media-Tech — "How to Edit Videos So Viewers Don't Drop Off at Minute 8", last updated 2026-09-14 — https://air.io/en/youtube-hacks/advanced-retention-editing-cutting-patterns-that-keep-viewers-past-minute-8
19. Pixflow Blog — "YouTube Video Retention Editing: How to Keep Viewers Watching Until the End", published 2026-07-19, updated 2026-08-11 — https://pixflow.net/blog/youtube-video-retention-editing/
20. OpusClip Blog — "11 Editing Aesthetics Dominating Short-Form in 2026" (Jake Geller), 2026-05-12 — https://www.opus.pro/blog/editing-aesthetics-dominating-short-form-2026
21. OpusClip Blog — "Brainrot Edit Style Explained", 2026, exact date not captured (excerpt) — https://www.opus.pro/blog/brainrot-edit-style
22. Adobe Blog — "Generate and create directly in your timeline with new AI-powered innovations in Premiere and After Effects", 2026-09-08 — https://blog.adobe.com/en/publish/2026/09/08/generate-create-directly-in-your-timeline-with-new-ai-powered-innovations-in-premiere-after-effects
23. Blackmagic Design — DaVinci Resolve 21 "What's New", current page (undated) — https://www.blackmagicdesign.com/products/davinciresolve/whatsnew
24. EditorsKeys — "DaVinci Resolve vs Premiere Pro in 2026", 2026, exact date not captured (excerpt) — https://www.editorskeys.com/blogs/news/davinci-resolve-vs-premiere-pro-in-2026-which-video-editing-software-is-best
25. Rework Resources — "Best AI Video Editing Tools in 2026" (updated July 2026, excerpt) — https://resources.rework.com/tools/ai-tools/best-ai-video-editing-tools-2026
26. Exemplary AI — "Alex Hormozi Captions: How to Make Them", undated (excerpt) — https://exemplary.ai/blog/alex-hormozi-captions
27. Choppity — "Alex Hormozi Video Editing Style", undated vendor page (excerpt) — https://www.choppity.com/tools/recreate-video-editing-style/alex-hormozi/
