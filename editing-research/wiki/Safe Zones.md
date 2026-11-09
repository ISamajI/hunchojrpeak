---
type: concept
aliases:
  - Safe Zone
  - UI Safe Area
  - Caption Safe Zone
platforms: [TikTok, Instagram Reels, YouTube, X, Snapchat Spotlight, Pinterest, LinkedIn, Twitch and Kick Clipping]
status: stable
updated: 2026-11-06
tags: [editing-research, concept, specs, captions, cross-platform]
---
# Safe Zones

The parts of a vertical frame that platform UI (buttons, captions, profile rows) covers, so key text, captions and faces must stay out of them. Burned-in captions for muted autoplay make this matter everywhere.

## Per-platform guidance (from the raw notes)
| Platform | Canvas | Safe-zone guidance | Confidence |
|---|---|---|---|
| [[X]] | 9:16 1080×1920 (Kickstart <3 min); also 16:9 / 1:1 | No official safe zone; keep text off the bottom ~15% | inference |
| [[Snapchat Spotlight]] | 9:16 1080×1920 | Keep **top 150 px and bottom 330 px** clear; some agencies say ~450 px bottom | official (ads); vendor |
| [[Pinterest]] | 2:3 (1000×1500) or 9:16 | Top & bottom ~15% (~270 px) clear on 9:16; avoid bottom ~20% on standard Pins; >2:3 may be cropped; overlay ≤10 words | vendor; verified (crop, ad spec) |
| [[LinkedIn]] | 9:16 short; 16:9 / 4:5 longer | Captions lower third with margin above like/comment/share; ≤42 chars/line | vendor |
| [[Twitch and Kick Clipping]] → Shorts/TikTok/Reels | 9:16 1080×1920 | Face in upper third, gameplay central, lower 15% for captions/UI | vendor |
| [[TikTok]] | 9:16 | Keep text in the center safe zone; captions out of the bottom UI zone | agent guidance |
| [[YouTube]] Shorts | 9:16 | Captions centered, lower-middle | agent guidance |

## Related
[[Kinetic Captions]] · [[Native Vertical Video]] · [[Facecam Stack Layout]] · [[Cross-Posting Hygiene]] · [[Text Overlay POV]]

## Sources
- Snapchat Business Help, safe zones: https://businesshelp.snapchat.com/s/article/safe-zones?language=en_US
- Spilno Agency (vendor): https://spilnoagency.com.ua/en/instructions-us/snapchat-ad-specs ; https://spilnoagency.com.ua/en/instructions-us/pinterest-ads-creative-sizes
- Pinterest Business Help, specs: https://help.pinterest.com/en/business/article/pinterest-product-specs
- TrymyPost (vendor): https://www.trymypost.com/blog/pinterest-idea-pins-vs-standard-pins-strategy-2026
- Sprout Social (2026-11-02): https://sproutsocial.com/insights/social-media-video-specs-guide/
- OpusClip LinkedIn captions (vendor): https://www.opus.pro/blog/linkedin-video-caption-subtitle-best-practices
- StreamGen (vendor): https://streamgen.cc/blog/twitch-streaming-layouts/
- Raw notes: [[2026-11-06 Other Platforms Editing Trends]], [[2026-11-06 TikTok Editing Trends]], [[2026-11-06 YouTube Editing Trends]]
