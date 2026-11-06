---
date: 2026-11-06
topic: "Editing tools and AI-powered editing features driving viral edits (mid-2026 to now)"
agent: "subagent-5"
tags:
  - editing-research
  - tools
  - ai-editing
  - short-form
  - capcut
  - premiere
  - davinci-resolve
  - ai-video
  - captions
  - dubbing
---

# Editing Tools and AI Features (2026-11-06)

Scope: the editing apps and AI features behind viral short-form and long-form edits, roughly mid-2026 to early November 2026. Sources are official vendor pages and established publications unless marked **[secondary]**. Anything I could not confirm from a primary source is marked **[unverified]**.

**Big shifts this period**
- [[Sora]] is gone. OpenAI shut down the Sora app and web experience on 2026-04-26 and the API on 2026-09-24. Generated-video workflows have moved to [[Veo]] / [[Gemini Omni]], [[Kling]], [[Runway]] and [[Seedance]].
- Generative video now sits inside the editors themselves: Seedance 2.0 in [[CapCut]], Firefly plus partner models (Veo, Kling, Runway, Luma) in [[Adobe Premiere Pro]], and Gemini Omni in YouTube Shorts and the YouTube Create app.
- Chat-driven editing (an AI assistant you prompt to make the edit) is now a feature category of its own: [[Descript]] Underlord, [[Opus Clip]] AI Producer (a plugin for ChatGPT and Claude), [[DaVinci Resolve]] 21.1 working with Claude and ChatGPT Codex, Captions Co-Editor, and an AI assistant being tested in Meta [[Edits]].
- Auto-dubbing with lip sync is now built into the platforms: YouTube auto dubbing is open to all creators, and Meta AI Translations is free for Reels.

---

## Tools

### [[CapCut]]
- **Official URL:** https://www.capcut.com
- **Used for:** all-in-one mobile, desktop and web editor; templates; auto captions; effects; AI tools.
- **Viral styles it enables:** template-driven trend edits, beat-synced cuts, animated [[Auto Captions]], and now AI-generated inserts and full AI clips through Seedance ([[AI B-Roll]]). CapCut describes Seedance as supporting "rhythmic editing, with scene cuts that align well with music beats".
- **Price tier:** freemium.
  - Free plan has no time limit.
  - Pro is listed at $19.99/month or $179.99/year (USD). This comes from CapCut's pricing page as quoted by Dupple on 2026-10-10 **[secondary]**.
  - App-store pricing may differ, and a cheaper "Standard" tier ($9.99) appears in-app **[secondary]**.
- **Platforms:** iOS, Android, desktop (Win/Mac), web.
- **2026 updates:**
  - **Dreamina Seedance 2.0 in CapCut** (CapCut Newsroom, 2026-04-09):
    - Text, image or reference-video to video, with synced audio.
    - Clips up to 15 seconds in 6 aspect ratios.
    - Can edit or correct uploaded footage.
    - Rolled out first to paid users in Indonesia, Philippines, Thailand, Vietnam, Malaysia, Brazil and Mexico, then expanded to Africa, South America, Europe, the Middle East, Japan and the US between 2026-03-25 and 2026-04-07.
    - Safeguards: at first, no generation from images or videos containing real faces; visible watermark; invisible watermark; C2PA Content Credentials.
  - **Video Studio**, a "timeline-free creative space" that supports Seedance 2.0 (No Film School, 2026-03-26).
  - A "Seedance 2.5" is mentioned in Runway's changelog (2026-10-02, "Seedance 2.5 Draft Mode in Agent"). I could not confirm whether 2.5 is in CapCut **[unverified]**.
- **US status:**
  - The TikTok USDS Joint Venture LLC announcement says the venture's safeguards "will also cover CapCut, and Lemon8".
  - Third-party reporting gives the deal close date as 2026-01-22, with ByteDance keeping 19.9% **[secondary: Wikipedia / BBC / ABC7]**.
  - CapCut is currently live in US app stores, per the Clixie blog **[secondary; lower-quality source]**.
- **Sources:** capcut.com/newsroom/dreamina-seedance-2; nofilmschool.com/capcut-vido-studio-seedance-2-0; newsroom.tiktok.com (USDS JV); dupple.com/learn/is-capcut-free.

### [[Edits]] (Meta / Instagram)
- **Official URL:** https://edits.instagram.com
- **Used for:** a free mobile editor tied to Instagram Reels, built as a CapCut rival.
- **Viral styles it enables:** Reels-native trend templates (you can open the template project file to see how it was built), teleprompter-led talking-head videos, [[Auto Captions]] with auto-highlighting, object "pop" effects, and A/B variants of a reel.
- **Price tier:** free.
- **Platforms:** iOS and Android. A desktop version was announced as "coming soon" (TechCrunch, 2026-06-11).
- **2026 updates:**
  - One-year post (Meta, 2026-04-22):
    - Upgrades promised for captions, including bilingual captions, plus advanced color adjustments and speed curves.
    - Customizable tools.
    - Templates opening up as project files, with richer templates (overlays, keyframes, effects) "soon".
    - Creator template collaborations (Ethan Barber, Cole Bennett).
  - Creator event (TechCrunch, 2026-06-11):
    - An AI assistant, in testing, that reads a creator's insights and suggests ideas and trending audio.
    - Desktop app "coming soon", with sync between devices.
    - A Beta tab for experiments.
    - Deeper audience insights and topic search in the Inspiration feed.
    - Multiple versions of a single reel, so creators can test what performs best.
  - Meta's own figures: Edits-made content gets a 10% higher save rate and a 2% higher reshare rate, and more than half of Reels viewers see Edits-made content daily **[vendor claim]**.
  - I did not confirm whether the desktop version has shipped as of 2026-11-06 **[unverified]**.
- **Sources:** about.fb.com/news/2026/04/one-year-of-edits-built-for-and-with-creators/; techcrunch.com/2026/06/11/metas-edits-app-is-getting-an-ai-assistant-and-a-desktop-version/.

### [[Adobe Premiere Pro]] (desktop)
- **Official URL:** https://www.adobe.com/products/premiere.html
- **Used for:** professional NLE (non-linear editor); Firefly generative tools inside the timeline.
- **Viral styles it enables:**
  - [[Generative Extend]] for holding a beat or fixing short handles.
  - AI [[Object Mask]] for subject-isolation effects (text behind subject, selective color).
  - Gap-filling generated B-roll and generated SFX and music ([[AI B-Roll]]).
- **Price tier:** paid (Creative Cloud subscription). Generative features use Firefly credits.
- **Platforms:** Windows, macOS.
- **2026 updates:**
  - **v26.0** (Jan 2026, at Sundance; ProVideo Coalition, 2026-01-20):
    - AI Object Mask.
    - Redesigned shape masks that track up to 20x faster.
    - Film Impact effects and transitions, 90+ effects.
    - Firefly Boards import.
    - Firefly app connection to partner models (Google, OpenAI, Runway).
  - **v26.5** (Sept 2026; Adobe Help, Adobe Blog 2026-09-08):
    - Generative Extend now works on 360p to 4K, any aspect ratio (including 9:16), and interlaced or anamorphic footage.
    - New **Generative Media** tool in the timeline with four parts:
      - Generate Video, which fills gaps using reference frames from the project.
      - Generate Sound Effects, which can follow your voice for timing.
      - Generate Soundscape (beta).
      - Generate Music (beta).
    - Partner models (Google Veo, Kling, Runway, Luma) alongside Firefly.
  - **[secondary]** Kyler Holland also mentions "Paper Edit" in 26.5. I could not confirm it on Adobe's own blog.
- **Sources:** helpx.adobe.com/premiere/desktop/whats-new/release-notes.html; blog.adobe.com/en/publish/2026/09/08/...; provideocoalition.com (2026-01-20); kylerholland.com (Sept 2026).

### [[Premiere Mobile]] (Adobe Premiere on iPhone / Android)
- **Official URL:** https://www.adobe.com/products/premiere/app.html
- **Used for:** a free mobile NLE that is Adobe's answer to CapCut. Adobe Premiere Rush reached end of life on 2026-09-30 (Adobe Community).
- **Viral styles it enables:**
  - [[Speed Ramping]] via Speed Curves.
  - Beat-synced cuts via Beat Detection.
  - Keyframed crops and aspect-ratio animation.
  - One-tap [[Auto Reframe]] from 16:9 to 9:16.
  - One-tap background removal.
  - Animated captions.
  - Firefly-generated visuals and voice-to-SFX.
- **Price tier:** free app. Generative AI uses Firefly credits **[credit limits not verified]**.
- **Platforms:** iPhone (since Sept 2025) and Android (2026-09-22, Android 13+ with at least 5GB RAM).
- **2026 updates (release notes):**
  - April: keyframes, .cube LUT import, Beat Detection, crop presets.
  - May: Auto Reframe.
  - June: Speed Curves, audio keyframes, one-tap stabilization.
  - July: one-tap background removal, redesigned toolbar, voiceover updates.
  - August: Adobe Fresco animation import.
  - October: Adobe Fonts.
- **Sources:** helpx.adobe.com/premiere/mobile/whats-new/release-notes.html; helpx.adobe.com/premiere/mobile/whats-new/whats-new.html; blog.adobe.com/en/publish/2026/09/22/adobe-premiere-expands-android-...; community.adobe.com/announcements-736.

### [[Adobe Firefly]]
- **Official URL:** https://firefly.adobe.com
- **Used for:** Adobe's generative image, video and audio hub. Also routes requests to partner models.
- **Viral styles it enables:** [[AI B-Roll]] inserts, stylized transitions, and generated SFX, used in Premiere desktop and mobile.
- **Price tier:** freemium with generation credits; paid plans for more credits **[exact 2026 tiers not verified]**.
- **Platforms:** web, iPhone app (App Store), and integrated into Premiere.
- **2026 updates:** partner models (Google Veo, Kling, Runway, Luma) available through Premiere's Generative Media tool (Adobe Blog, 2026-09-08).
- **Sources:** apps.apple.com/us/app/adobe-firefly-ai-video-photo/id6742595426; blog.adobe.com (2026-09-08).

### [[DaVinci Resolve]]
- **Official URL:** https://www.blackmagicdesign.com/products/davinciresolve
- **Used for:** pro editing, color, Fusion VFX and Fairlight audio. The free version is popular with YouTubers and cinematic editors.
- **Viral styles it enables:**
  - "Cinematic" color-graded edits.
  - Speed Warp slow motion.
  - Relight and depth-map effects.
  - Fusion motion graphics.
  - Fast multi-cam podcast and event edits.
- **Price tier:**
  - DaVinci Resolve 21 is free.
  - DaVinci Resolve Studio 21 is a paid one-time purchase that adds DaVinci Neural Engine AI tools, among other features.
  - A Reddit summary says the AI features are Studio-only **[secondary]**.
  - The Studio price is commonly cited as $295 but was not confirmed on the scraped page **[unverified]**.
- **Platforms:** Windows, macOS, Linux; iPad version exists **[iPad status in 2026 not re-verified]**.
- **2026 updates:**
  - **Resolve 21:**
    - New Photo page.
    - AI IntelliSearch (search media by content).
    - Slate reading, de-aging, blemish removal.
    - AI Speech Generator **[secondary: Facebook group summary]**.
    - Faster Relight, Depth Map and Speed Warp.
  - **Resolve 21.1** (Blackmagic press release, IBC 2026-09-08):
    - Works with AI assistants (Claude, Claude Code, ChatGPT Codex) to analyze projects, organize media, batch render and "create highlight edits".
    - 25-angle multi-cam shortcuts and inspector presets.
    - New log formats: GoPro, Leica, DJI D-Log2, Vivo.
    - 25 new Krokodove Fusion tools.
- **Sources:** blackmagicdesign.com/products/davinciresolve/whatsnew; blackmagicdesign.com/media/release/20260908-03; documents.blackmagicdesign.com (DaVinci Resolve 21 New Features Guide PDF; viewed in search snippet only, not downloaded).

### [[Final Cut Pro]] / iPhone editing ([[Apple Creator Studio]])
- **Official URL:** https://www.apple.com/final-cut-pro/
- **Used for:** Mac and iPad pro editing; Final Cut Camera; Live Multicam with up to 4 iPhones or iPads.
- **Viral styles it enables:**
  - Multi-iPhone music videos and podcasts.
  - Editing iPhone Cinematic-mode footage (changing focus after the shot).
  - MotionVFX-style titles, transitions and tracking effects.
  - Transcript-based captions in more languages.
- **Price tier:**
  - Apple Creator Studio subscription: $12.99/month or $129/year (US); education $2.99/month or $29.99/year.
  - Final Cut Pro one-time purchase: $299.99 (US).
- **Platforms:** macOS and iPadOS. Capture on iPhone through Final Cut Camera.
- **2026 updates:**
  - Apple Newsroom, 2026-10-27:
    - Built-in MotionVFX effects, transitions, templates, rotoscoping, tracking and grading.
    - Video assets in Content Hub.
    - Text-to-image generation inside projects.
    - Pixelmator Pro round-trip.
    - More keyframe easing options.
    - Disconnecting clips from the primary storyline.
    - 23 new transcription languages.
    - Compressor support for Cinematic video from iPhone 18 Pro and "iPhone Duo".
  - Final Cut for iPad 3.4: Cinematic-mode editing and a Liquid Glass UI (Apple Support release notes).
- **Sources:** apple.com/newsroom/2026/10/apple-creator-studio-adds-powerful-new-ai-features-and-even-more-creative-tools/; support.apple.com/en-us/102731; support.apple.com/en-us/102825.

### [[Descript]]
- **Official URL:** https://www.descript.com
- **Used for:** text-based (transcript) editing of podcasts and talking-head video.
- **Viral styles it enables:**
  - Tight jump-cut talking heads with filler words and gaps removed.
  - Podcast-to-clips ([[AI Clipping]]).
  - Studio Sound cleanup.
  - Eye contact correction.
  - [[AI Dubbing]].
- **Price tier:**
  - Free: 60 media minutes/month and 100 one-time AI credits.
  - Hobbyist: $16–$24/person/month, 400 AI credits.
  - Creator and Business tiers above that.
  - Dubbing is only on Creator and higher (Help Center).
- **Platforms:** web; desktop (Mac/Windows).
- **2026 updates:**
  - Underlord is the "AI video co-editor". It generates clips, writes show notes, fixes audio and does tedious edits.
  - The changelog shows releases on 2026-01-06, 02-10, 03-02, 03-17, 04-16, 05-14, 06-11, 08-05, 09-17 and 10-13. The latest is the "Release roundup—October 12, 2026".
  - One entry adds new models to Underlord's model picker. I did not pull the details of individual entries **[detail unverified]**.
- **Sources:** descript.com/underlord; descript.com/pricing; help.descript.com/billing-payments-plans/legacy-sunset; descript.canny.io/changelog.

### [[Opus Clip]] (OpusClip)
- **Official URL:** https://www.opus.pro
- **Used for:** turning long videos (podcasts, streams, webinars) into vertical short clips, each with a "Virality Score" from 0 to 99.
- **Viral styles it enables:**
  - Podcast and streamer clip farms ([[AI Clipping]]).
  - Hook-first openings via the Viral Hook template library.
  - Animated captions.
  - [[AI B-Roll]].
  - Motion graphics that turn spoken numbers and ideas into animated icons and charts.
- **Price tier:** freemium. Pro is paid; the 4.0 post promotes 40% off the first month **[full price tiers not verified]**.
- **Platforms:** web; mobile app is mainly for review and posting **[secondary: bigvu.tv]**.
- **2026 updates:** **OpusClip 4.0** (Opus blog, 2026-11-02):
  - **Auto-edit** for talking videos: speech cleanup, captions and B-roll, returning a finished video.
  - **Every format** from one edit: 60–90s highlights, 3–5 min cuts, lo-fi updates.
  - **Recipes**: saved editing setups.
  - **Viral Hook** templates.
  - **Motion Graphics**.
  - **AI Producer**: a plugin for ChatGPT or Claude that edits footage to match a style you show it.
  - The changelog also lists Motion Studio (prompt plus brand assets to a clip), Speech Enhancement sliders, and direct publishing to Pinterest and YouTube **[entry dates not captured]**.
- **Sources:** opus.pro/blog/opusclip-4-0; opusclip.canny.io/changelog; bigvu.tv review **[secondary]**.

### [[Captions]] app (Captions / Mirage)
- **Official URL:** https://captions.ai (the company and its models are now branded Mirage: https://mirage.app)
- **Used for:** AI-edited talking-head videos and avatars ("AI Twin").
- **Viral styles it enables:**
  - Dozens of named AI Edit styles (Prism, Bloom, Pop, Orbit, Bitmap, Scrapbook, Neon and more) that add zooms, B-roll, SFX and transitions automatically.
  - 75+ animated caption styles, including "Negative Captions".
  - Eye-contact correction.
  - Viral sound effects.
  - AI dubbing.
  - Avatar or AI-twin videos.
- **Price tier:**
  - Freemium. Free plans can now export with a watermark.
  - Paid credits for AI features **[exact prices not verified]**.
- **Platforms:** iOS, web, macOS (returned). Legacy desktop signups are disabled.
- **2026 updates (official "What's new"):**
  - Clips Chat.
  - Avatar Looks.
  - AI Twin from a video upload or a single photo.
  - Rebuilt rendering engine.
  - Horizontal AI Edit.
  - Multi-clip AI Edit.
  - Inline translate, transcribe and dub.
  - SRT export.
  - Co-Editor (chat-to-edit).
  - Mirage Edit on web.
  - Mirage Avatar X model (blog, 2026-07-28).
  - The App Store page lists dubbing into 29 languages and subtitles in 91+ languages.
- **Sources:** captions.ai/help/whats-new; mirage.app/about-us; apps.apple.com/us/app/captions-ai-edits-your-video/id1541407007.

### [[Submagic]]
- **Official URL:** https://www.submagic.co
- **Used for:** fast animated captions plus auto B-roll, zooms, silence removal and "Magic Clips" for Shorts, Reels and TikTok.
- **Viral styles it enables:** the Hormozi/MrBeast-style bold word-by-word captions with emojis and highlight colors ([[Auto Captions]]); auto zoom-cuts.
- **Price tier:** paid, per member (official help center):
  - Starter: $19/month, 45 credits.
  - Pro: $39/month, 120 credits.
  - Business: $69/month, 300 credits.
  - Annual billing saves up to 41%.
  - Magic Clips cost 8 credits each.
- **Platforms:** web.
- **2026 updates:** no specific dated 2026 release found from an official source **[unverified]**.
- **Sources:** submagic.co/pricing; care.submagic.co/en/article/how-much-does-it-cost-to-use-submagic-1xm83pa/.

### [[Veo]] / [[Gemini Omni]] (Google)
- **Official URL:** https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni/
- **Used for:**
  - Generative video with native audio.
  - Conversational video editing ("make the sky overcast, keep everything else").
  - Shorts Remix.
- **Viral styles it enables:**
  - AI remixes of trending Shorts.
  - Turning real footage into another scene ("transform the world around you").
  - Avatar videos in your own voice.
  - Physics gag videos.
  - [[AI B-Roll]] inside Premiere (Veo is a partner model there).
- **Price tier:**
  - Free in YouTube Shorts and the YouTube Create app.
  - In the Gemini app and Flow for Google AI Plus, Pro and Ultra subscribers.
  - API for developers.
  - Free 1080p in Google Vids.
- **Platforms:** Gemini app, Google Flow, YouTube Shorts, YouTube Create, Google Vids, API.
- **2026 updates:**
  - Gemini Omni Flash introduced at Google I/O on 2026-05-19.
  - All output carries a SynthID watermark.
  - Veo 3.1 continues for developers **[secondary: ocdevel podcast]**.
- **Sources:** blog.google (Gemini Omni, 2026-05-19); blog.youtube/news-and-events/youtube-news-google-io-2026/; engadget.com (Gemini Omni).

### [[Sora]] (OpenAI), discontinued
- **Status:**
  - OpenAI announced the shutdown on 2026-03-24.
  - The Sora web and app experiences ended on 2026-04-26; the API ended on 2026-09-24 (OpenAI Help Center).
  - TechCrunch, citing WSJ: users peaked around 1M, fell below 500K, and the app cost about $1M/day to run.
- **Relevance:** Sora 2 "cameo" (later "characters") deepfake edits were a late-2025 viral format. Anything still labeled "Sora" is legacy or a re-upload.
- **Sources:** help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation; techcrunch.com/2026/03/24/...; techcrunch.com/2026/03/29/why-openai-really-shut-down-sora/; openai.com/index/sora-2/.

### [[Runway]]
- **Official URL:** https://runwayml.com
- **Used for:** generating video (Gen-4.5) and editing or transforming existing video (Aleph). It now also serves third-party models.
- **Viral styles it enables:**
  - Video-to-video restyles: change the angle, lighting, objects or style of real footage.
  - Cinematic AI shots.
  - Background removal.
  - AI SFX.
  - Ad creatives.
- **Price tier:** freemium, credit-based. Aleph is on all paid plans.
- **Platforms:** web, iOS, API.
- **2026 updates (changelog):**
  - Runway Ads (2026-10-27).
  - App Studio (10-26).
  - Mirelo SFX 2.0 (10-15).
  - BiRefNet v2 background removal (10-15).
  - Fish Audio Drama 3 (10-14).
  - Seedream 5.0 Flash (10-12).
  - Project credit caps (10-09).
  - Seedance 2.5 Draft Mode in Agent (10-02).
  - The Gen-4 research page also mentions "Aleph 2.0" **[details unverified]**.
- **Sources:** runwayml.com/changelog; runwayml.com/research/introducing-runway-gen-4.5; runwayml.com/research/introducing-runway-aleph.

### [[Kling]] (Kuaishou)
- **Official URL:** https://kling.ai
- **Used for:** image-to-video and text-to-video generation with strong human motion. Native audio and lip-synced dialogue in v3 **[audio detail: secondary]**.
- **Viral styles it enables:**
  - Animating still photos (old photos, memes, product shots).
  - Multi-shot AI mini-stories.
  - Consistent recurring characters through "Elements".
  - AI B-roll inside Premiere (Kling is a partner model there).
- **Price tier:** freemium, credit-based **[2026 tiers not verified]**.
- **Platforms:** web, mobile apps, API, and inside Premiere through partner models.
- **2026 updates:**
  - Kling AI 3.0 launched on 2026-02-05: Video 3.0, Video 3.0 Omni, Image 3.0 and Image 3.0 Omni.
  - Omni adds reference-based consistency (Elements) and a multi-shot storyboard where you set duration, shot size, perspective and camera move per shot.
  - Kuaishou says Kling has produced over 600M videos.
- **Sources:** ir.kuaishou.com (Kling 3.0 release, 2026-02-05); nasdaq.com press release mirror.

### [[Seedance]] (ByteDance / Dreamina)
- See the CapCut entry. Seedance 2.0 sits inside CapCut and Dreamina. Seedance 2.5 Draft Mode appears in Runway's changelog (2026-10-02).
- **Sources:** capcut.com/newsroom/dreamina-seedance-2; runwayml.com/changelog.

### [[ElevenLabs]]
- **Official URL:** https://elevenlabs.io
- **Used for:** AI voice, text-to-speech and [[AI Dubbing]] through Dubbing Studio.
- **Viral styles it enables:**
  - Multilingual channel versions of the same video.
  - AI narrator voiceovers.
  - Voice-cloned skits.
- **Price tier:** freemium. Creator tier is $22/month ($11 the first month).
- **Platforms:** web, API, mobile.
- **2026 updates:**
  - **Dubbing v2** keeps the original speaker's tone, pacing and emotion across 90+ languages, with sync-aware translation. Publish date not shown on the page **[date unverified]**.
  - Vimeo case study (2026-09-07): automated dubbing across 40 languages.
- **Sources:** elevenlabs.io/blog/introducing-dubbing-v2; elevenlabs.io/dubbing-studio; elevenlabs.io/blog/vimeo; elevenlabs.io/pricing.

### [[YouTube Auto Dubbing]]
- **Official URL:** https://blog.youtube/news-and-events/youtube-auto-dubbing-expressive-speech/
- **Used for:** automatic multi-language audio tracks on YouTube videos.
- **Viral styles it enables:** global reach for talking-head and explainer channels.
- **Price tier:** free (built into YouTube).
- **2026 updates:**
  - Expanded to all creators on 2026-02-04 (Social Media Today), with 27 languages.
  - Expressive Speech keeps the creator's emotion and energy.
  - A Lip Sync pilot is in testing.
  - Smart filtering skips content that shouldn't be dubbed, such as music videos.
- **Sources:** blog.youtube (auto dubbing); socialmediatoday.com/news/youtube-expands-auto-dubbing-to-all-creators/811375/; support.google.com/youtube/answer/15569972.

### [[Meta AI Translations]]
- **Official URL:** https://creators.instagram.com/blog/meta-ai-translations
- **Used for:** free auto-dubbing with optional lip sync for Reels on Instagram and Facebook.
- **Price tier:** free.
  - Facebook: creators with 1,000+ followers.
  - Instagram: all public accounts where Meta AI is available.
- **Updates:**
  - Languages: English, Spanish, Hindi, Portuguese, Bengali, Tamil, Telugu, Marathi and Kannada.
  - Expanding on Instagram to French, German, Italian, Japanese and Korean.
  - Expanding on Facebook to Arabic, Bahasa Indonesia, French, Thai and Vietnamese.
  - Facebook Pages can upload up to 20 of their own dubbed tracks per reel.
  - The Meta post dates to 2025-10 and was updated on 2026-01-20.
- **Sources:** about.fb.com/news/2025/10/discover-reels-around-world-meta-ai-translation/ (original 2025, updated 2026-01-20); facebook.com/creators/blog/meta-ai-translations/.

---

## AI editing techniques

### [[Auto Captions]]
- **What it is:** word-level animated captions with highlighted keywords, emojis and pop-in motion. Still the default look for talking-head Shorts, Reels and TikToks.
- **Tools:**
  - [[CapCut]].
  - [[Edits]] (auto-highlighting captions; bilingual captions on the roadmap).
  - [[Premiere Mobile]] (animated captions).
  - [[Captions]] (75+ styles, "Negative Captions").
  - [[Submagic]].
  - [[Opus Clip]].
  - [[Descript]].
  - [[Final Cut Pro]] (23 new transcription languages).
- **Trend note:** bilingual and translated captions are rising alongside auto-dubbing.

### [[AI B-Roll]]
- **What it is:** generated or auto-inserted cutaways that cover jump cuts or illustrate what is being said.
- **Tools:**
  - [[Adobe Premiere Pro]] Generate Video fills timeline gaps using project reference frames; models are Firefly plus Veo, Kling, Runway and Luma.
  - [[CapCut]] with [[Seedance]].
  - [[Opus Clip]] Auto-edit.
  - [[Captions]] AI Edit.
  - [[Submagic]].
- **Related:** [[Generative Extend]], which adds frames to the head or tail of a clip; now supports 9:16.

### [[Auto Reframe]]
- **What it is:** converting 16:9 footage to 9:16 or 1:1 while tracking the subject.
- **Tools:**
  - [[Premiere Mobile]] (one tap, May 2026).
  - [[Adobe Premiere Pro]].
  - [[Opus Clip]].
  - [[CapCut]].
  - [[DaVinci Resolve]] Studio (Smart Reframe via Neural Engine **[not re-verified for v21]**).

### [[AI Clipping]]
- **What it is:** cutting long-form content into ranked short clips.
- **Tools:**
  - [[Opus Clip]] (Virality Score; 4.0 Auto-edit, Recipes, Viral Hook).
  - [[Descript]] Underlord.
  - [[Captions]] (Long-to-Short, Clips Chat).
  - [[Submagic]] Magic Clips.
  - [[DaVinci Resolve]] 21.1, where an AI assistant can "create highlight edits".
- **Trend:** chat or agent-driven editing, i.e. editing from ChatGPT or Claude.

### [[AI Dubbing]]
- **What it is:** translated voice tracks that keep the creator's voice, increasingly with lip sync.
- **Tools:**
  - [[YouTube Auto Dubbing]] (27 languages, Expressive Speech, Lip Sync pilot).
  - [[Meta AI Translations]] (free, optional lip sync).
  - [[ElevenLabs]] Dubbing v2 (90+ languages).
  - [[Captions]] (29 dubbing languages).
  - [[Descript]] (Creator plan and up).

### [[Speed Ramping]] and [[Beat Sync]]
- **What it is:** smooth speed curves and cuts on the beat, the core of velocity edits and music edits.
- **Tools:**
  - [[Premiere Mobile]] Speed Curves (June 2026) and Beat Detection (April 2026).
  - [[Edits]] speed curves (on the roadmap).
  - [[CapCut]] (long-standing; Seedance clips cut to the beat).
  - [[DaVinci Resolve]] Speed Warp.

### [[Object Mask]] and [[Background Removal]]
- **What it is:** subject isolation for text-behind-subject, selective color and cutout effects.
- **Tools:**
  - [[Adobe Premiere Pro]] AI Object Mask (v26.0).
  - [[Premiere Mobile]] one-tap background removal (July 2026).
  - [[Runway]] BiRefNet v2 (Oct 2026).
  - [[DaVinci Resolve]] Studio Neural Engine region tracking.

### [[Conversational Video Editing]]
- **What it is:** editing generated or real footage with natural-language turns.
- **Tools:**
  - [[Gemini Omni]] (YouTube Shorts Remix and Create app, free).
  - [[Runway]] Aleph (video-to-video).
  - [[Captions]] Co-Editor.
  - [[Descript]] Underlord.
  - [[Opus Clip]] AI Producer.
  - [[DaVinci Resolve]] 21.1 working with AI assistants.

### Provenance and labeling (context)
- Seedance output in CapCut carries visible and invisible watermarks plus C2PA Content Credentials.
- Gemini Omni output carries a SynthID watermark.
- Meta labels dubbed reels "Translated with Meta AI".
- Expect platforms to detect and label generated inserts.

---

## Sources

| # | Site | URL | Date |
|-|-|-|-|
| 1 | CapCut Newsroom | https://www.capcut.com/newsroom/dreamina-seedance-2 | 2026-04-09 |
| 2 | CapCut (tool page) | https://www.capcut.com/tools/dreamina-seedance-2-0 | undated |
| 3 | No Film School | https://nofilmschool.com/capcut-vido-studio-seedance-2-0 | 2026-03-26 |
| 4 | TikTok Newsroom | https://newsroom.tiktok.com/announcement-from-the-new-tiktok-usds-joint-venture-llc?lang=en | Jan 2026 (deal close 2026-01-22 per secondary) |
| 5 | BBC News | https://www.bbc.com/news/articles/cq5yynydvgzo | 2026 (exact date not captured) |
| 6 | Wikipedia (TikTok USDS) [secondary] | https://en.wikipedia.org/wiki/TikTok_USDS | accessed 2026-11-06 |
| 7 | Dupple [secondary] | https://dupple.com/learn/is-capcut-free | checked 2026-10-10 |
| 8 | Clixie AI blog [secondary, low confidence] | https://www.clixie.ai/blog/capcut-ban-explained | ~May 2026 |
| 9 | Meta Newsroom | https://about.fb.com/news/2026/04/one-year-of-edits-built-for-and-with-creators/ | 2026-04-22 |
| 10 | TechCrunch | https://techcrunch.com/2026/06/11/metas-edits-app-is-getting-an-ai-assistant-and-a-desktop-version/ | 2026-06-11 |
| 11 | Edits (official) | https://edits.instagram.com/ | undated |
| 12 | Adobe Help (Premiere desktop release notes) | https://helpx.adobe.com/premiere/desktop/whats-new/release-notes.html | Sept 2026 (v26.5) |
| 13 | Adobe Help (Premiere desktop what's new) | https://helpx.adobe.com/premiere/desktop/whats-new/whats-new.html | Sept 2026 |
| 14 | Adobe Blog (IBC 2026) | https://blog.adobe.com/en/publish/2026/09/08/generate-create-directly-in-your-timeline-with-new-ai-powered-innovations-in-premiere-after-effects | 2026-09-08 |
| 15 | ProVideo Coalition | https://www.provideocoalition.com/new-ai-and-masking-tools-in-premiere-plus-major-upgrade-to-after-e%EF%AC%80ects/ | 2026-01-20 |
| 16 | Kyler Holland [secondary] | https://www.kylerholland.com/blog/premiere-pro-september-2026-whats-new/ | Sept 2026 |
| 17 | Adobe Help (Premiere iPhone release notes) | https://helpx.adobe.com/premiere/mobile/whats-new/release-notes.html | through Sept 2026 |
| 18 | Adobe Help (Premiere iPhone what's new) | https://helpx.adobe.com/premiere/mobile/whats-new/whats-new.html | updated 2026-10-28 |
| 19 | Adobe Blog (Premiere Android) | https://blog.adobe.com/en/publish/2026/09/22/adobe-premiere-expands-android-fast-powerful-easy-mobile-video-editing | 2026-09-22 |
| 20 | Adobe Blog (Premiere iPhone launch) | https://blog.adobe.com/en/publish/2025/09/04/adobe-premiere-bringing-pro-quality-video-editing-to-your-iphone | 2025-09-04 |
| 21 | Adobe Community (Rush EOL) | https://community.adobe.com/announcements-736 | 2026 (EOL 2026-09-30) |
| 22 | Apple App Store (Firefly) | https://apps.apple.com/us/app/adobe-firefly-ai-video-photo/id6742595426 | undated |
| 23 | Blackmagic Design (What's New) | https://www.blackmagicdesign.com/products/davinciresolve/whatsnew | 2026 (v21) |
| 24 | Blackmagic Design press release | https://www.blackmagicdesign.com/media/release/20260908-03 | 2026-09-08 |
| 25 | Blackmagic Design (Resolve product page) | https://www.blackmagicdesign.com/products/davinciresolve | 2026 |
| 26 | Reddit r/davinciresolve [secondary] | https://www.reddit.com/r/davinciresolve/comments/1skkwi0/davinci_resolve_21_whats_new_page_is_up/ | ~Apr 2026 |
| 27 | Apple Newsroom | https://www.apple.com/newsroom/2026/10/apple-creator-studio-adds-powerful-new-ai-features-and-even-more-creative-tools/ | 2026-10-27 |
| 28 | Apple Support (Final Cut for iPad notes) | https://support.apple.com/en-us/102731 | 2026 |
| 29 | Apple Support (Final Cut Pro notes) | https://support.apple.com/en-us/102825 | 2026 |
| 30 | Apple (Final Cut Pro) | https://www.apple.com/final-cut-pro/ | undated |
| 31 | Descript (Underlord) | https://www.descript.com/underlord | undated |
| 32 | Descript (Pricing) | https://www.descript.com/pricing | accessed 2026-11-06 |
| 33 | Descript Help (plans) | https://help.descript.com/billing-payments-plans/legacy-sunset | 2026 |
| 34 | Descript Changelog | https://descript.canny.io/changelog | latest 2026-10-12/13 |
| 35 | OpusClip Blog | https://www.opus.pro/blog/opusclip-4-0 | 2026-11-02 |
| 36 | OpusClip Changelog | https://opusclip.canny.io/changelog | 2026 (entries undated in capture) |
| 37 | BIGVU [secondary] | https://bigvu.tv/blog/opus-clip-tested-2026-where-ai-wins-40-percent-discard/ | Nov 2026 |
| 38 | Captions Help (What's new) | https://captions.ai/help/whats-new | 2026 rolling |
| 39 | Mirage (About) | https://mirage.app/about-us | posts dated 2026-07-28, 2026-08-17 |
| 40 | Apple App Store (Captions) | https://apps.apple.com/us/app/captions-ai-edits-your-video/id1541407007 | undated |
| 41 | Submagic (Pricing) | https://www.submagic.co/pricing | accessed 2026-11-06 |
| 42 | Submagic Help Center | https://care.submagic.co/en/article/how-much-does-it-cost-to-use-submagic-1xm83pa/ | 2026 |
| 43 | Google Blog (Gemini Omni) | https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni/ | 2026-05-19 |
| 44 | Google Blog (I/O 2026) | https://blog.google/innovation-and-ai/sundar-pichai-io-2026/ | 2026-05 |
| 45 | YouTube Blog (I/O 2026) | https://blog.youtube/news-and-events/youtube-news-google-io-2026/ | 2026-05 |
| 46 | Engadget | https://www.engadget.com/2176590/googles-gemini-omni-can-generate-anything-from-any-input-starting-with-video/ | 2026-05 |
| 47 | OpenAI Help Center | https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation | 2026 |
| 48 | TechCrunch | https://techcrunch.com/2026/03/24/openais-sora-was-the-creepiest-app-on-your-phone-now-its-shutting-down/ | 2026-03-24 |
| 49 | TechCrunch | https://techcrunch.com/2026/03/29/why-openai-really-shut-down-sora/ | 2026-03-29 |
| 50 | OpenAI (Sora 2 post) | https://openai.com/index/sora-2/ | 2025-09-30 (STALE: pre-2026, product discontinued) |
| 51 | Runway Changelog | https://runwayml.com/changelog | through 2026-10-27 |
| 52 | Runway Research (Gen-4.5) | https://runwayml.com/research/introducing-runway-gen-4.5 | undated (late 2025?) |
| 53 | Runway Research (Aleph) | https://runwayml.com/research/introducing-runway-aleph | 2025 (possibly stale) |
| 54 | Kuaishou IR | https://ir.kuaishou.com/news-releases/news-release-details/kling-ai-launches-30-model-ushering-era-where-everyone-can-be | 2026-02-05 |
| 55 | Nasdaq (GlobeNewswire mirror) | https://www.nasdaq.com/press-release/kling-ai-launches-30-model-ushering-era-where-everyone-can-be-director-2026-02-05 | 2026-02-05 |
| 56 | OCDevel podcast [secondary] | https://ocdevel.com/mlg/mla-26 | 2026 |
| 57 | ElevenLabs Blog (Dubbing v2) | https://elevenlabs.io/blog/introducing-dubbing-v2 | undated |
| 58 | ElevenLabs Blog (Vimeo) | https://elevenlabs.io/blog/vimeo | 2026-09-07 |
| 59 | ElevenLabs (Pricing) | https://elevenlabs.io/pricing | accessed 2026-11-06 |
| 60 | YouTube Blog (auto dubbing) | https://blog.youtube/news-and-events/youtube-auto-dubbing-expressive-speech/ | 2026-02-04 |
| 61 | Social Media Today | https://www.socialmediatoday.com/news/youtube-expands-auto-dubbing-to-all-creators/811375/ | 2026-02-04 |
| 62 | YouTube Help (auto dubbing) | https://support.google.com/youtube/answer/15569972?hl=en | undated |
| 63 | Meta Newsroom (AI translations) | https://about.fb.com/news/2025/10/discover-reels-around-world-meta-ai-translation/ | 2025-10 (updated 2026-01-20; partly stale) |
| 64 | Facebook Creators blog | https://www.facebook.com/creators/blog/meta-ai-translations/ | updated 2026 (Jan 16 / Jun 4 notes) |
| 65 | Instagram Creators blog | https://creators.instagram.com/blog/meta-ai-translations | 2025–2026 |

**Flags / gaps:**
- I did not confirm on official pages:
  - DaVinci Resolve Studio's exact price.
  - Captions, Opus Clip and Kling price tiers.
  - Exact Firefly credit tiers.
- The Edits desktop app was "coming soon" as of June 2026; I found no shipping confirmation.
- I did not capture individual Descript changelog entries.
- The Clixie claim that "CapCut was banned 2025-01-19" is simplified. CapCut went offline with TikTok in January 2025; its status since then rests on the USDS JV announcement and secondary reporting.
- No installers, files or APKs were downloaded. The Blackmagic PDF was seen only as a search snippet.
