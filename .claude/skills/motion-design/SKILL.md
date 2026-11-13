---
name: motion-design
description: >
  Code-driven motion design: build short-form video (Reels/TikTok/Shorts ads, promo clips,
  kinetic typography, phone-mockup product shots, animated stats) entirely from code and JSON
  with no hand-set keyframes. Use when Henry asks for a reel, video ad, animated post, motion
  graphic, lyric/caption video, "make it move", or a phone-mockup animation for LTGPEAK or a
  client. Owned by the Orochimaru branch (Kabuto plans, Anko builds, Kimimaro reviews).
metadata:
  version: "0.1.0"
---

# Code-driven motion design

Learned from a reference reel ("This entire reel was made with Claude. No keyframes.").
The technique: **every frame is a pure function of the frame number**, driven by data files
an agent can edit. Change one line of JSON → re-render. Nothing is animated by hand.

The reel's building blocks, and where each lives in Henry's toolkit
(`motion-studio/` in the `hunchojrpeak` repo):

| Reel piece | What it is | Toolkit file |
|---|---|---|
| `lyrics.json` — "4 cuts · 21 slots", frame ruler | Timed captions/shots in frames, synced to the beat | `scenes/*.json` (`captions`, `shots`, `meta.bpm`) |
| "The screen, as code" (`ProfileIG.tsx`) | Phone UI built as real markup so numbers/text are editable | `screens/*.html` |
| `blender_ugoki94.py` — softcards, "the light", "the phone" | 3D phone hero shot scripted in Blender Python | `blender/phone_scene.py` |
| "four corners" | Screen mapped onto the phone face (corner pin) | CSS 3D phone in `player.html`; UV-mapped plane in Blender |
| "And the type" — red pill on the key word | Kinetic captions, one highlighted word | `captions[].hl` |
| "Change `\"text\": \"200\"` → re-render" | Edit data, not timelines | `render.cjs` |

## The pipeline

1. **Beat & script (Kabuto).** Get: platform + length (default 9:16, 1080x1920, 30fps, 8–15s),
   the hook line, the one message, CTA, brand colours, and the audio track + BPM if any.
   Write the shot list as frame ranges. Frame = seconds × fps. With BPM, a beat is
   `fps*60/bpm` frames — put cuts and caption changes on beats (at 120 BPM / 30fps, every 15 frames).
   Hook lands in the first 30 frames. Captions 1–4 words, one highlighted word each.
2. **Build (Anko).** Copy `scenes/demo.json` to `scenes/<project>.json` and edit data:
   - `shots[]`: `title` (lines; `{word}` = accent colour, `~word~` = animated strike-through;
     `variant: "slam"` for a giant first line), `phone` (`screen`, `rotY`/`rotX`/`scale` as
     `[from, to]`, optional `code` panel), `code` (typewriter code panel), `counter`
     (`from`, `to`, `suffix`).
   - `captions[]`: `start`, `end`, `text`, `hl` (the word that gets the pill).
   - `meta.theme` for brand colours, `meta.audio` for a track (muxed automatically).
   - Phone screens: copy `screens/profile.html`, keep it 390x844, put real copy in it.
   - New shot type needed? Add a branch in `build()` and `seek()` in `player.html` —
     only ever compute state from `f` (use `prog`, `lerp`, `ease.*`). No `setTimeout`,
     no CSS transitions, no `Math.random()` without a seed: they break determinism.
   - 3D hero shot: `blender -b -P blender/phone_scene.py -- --screen <png> --out out/phone_`
     (needs Blender 4.x; drivers, not keyframes).
3. **Check stills first, then render.**
   ```bash
   node render.cjs scenes/<project>.json --still 45 --scale 0.4   # look at key frames
   node render.cjs scenes/<project>.json --scale 0.5                # fast draft mp4
   node render.cjs scenes/<project>.json                            # final 1080x1920
   ```
   `node render.cjs --serve` gives a live preview at `http://localhost:4173/player.html?scene=...`.
4. **Review (Kimimaro).** Render stills at every shot's midpoint and last frame and actually
   look at them. Check: text inside 9:16 safe zone (nothing in the bottom ~320px or right
   ~140px where platform UI sits), highlighted word exists in caption text, no shot gaps
   (every frame covered by a shot), captions readable for ≥ 1s, ends on CTA, duration
   matches audio, no client claims/numbers Henry didn't give, file plays (`ffprobe`).

## Rules

- Data over timelines: if Henry asks for a change, edit JSON/HTML and re-render; don't
  hand-tune per-frame values.
- Don't recreate someone else's branded content or logos; build Henry's/the client's own.
- Never invent follower counts, prices, or testimonials for a client — use placeholders and
  flag them.
- Report the output path and a contact sheet of stills, not just "done".
