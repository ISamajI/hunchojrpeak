---
title: Video captions, advertisement edit, Mikonos website
session_id: session_01TTo3ynRUopcRZ6zcmxhw4T
date: 2026-10-30
status: done (website scroll segment missing)
tags: [session, mikonos, video-editing, captions, ffmpeg, real-esrgan, 4k]
---

# Video captions, advertisement edit, Mikonos website

> Coverage note: newest 4 pages read (2026-10-30 ~17:10 UTC onward). The initial cut/caption build was not read.

## Summary
Claude produced a captioned vertical ad for Mikonos restaurant from a raw phone clip: edited cut, voice chain, music pad, burned-in word-timed captions, graphics rendered with Playwright, and a slot for a scroll through the Mikonos website. A QA subagent did a regression pass (no must-fix items; four should-fix items fixed: pad level jump, caption highlight timing, title contrast, closing-line clarity, checked with ASR). Henry then asked to "upscale and make it perfect", so Claude built a Real-ESRGAN (realesr-general-x4v3) ONNX upscaler, upscaled the footage 2x to 4K in two parallel halves (~1.5 h on CPU), re-rendered all graphics natively at 4K and output a 4K master.

## What was built / decided
- Branch `claude/video-captions-ad-mikonos-m1z8wp` in `ISamajI/hunchojrpeak`.
- `outputs/mikonos-ad/mikonos-ad-final.mp4` (20.5 s, 1080x1920), `outputs/mikonos-ad/mikonos-ad-final-4k.mp4` (2160x3840), `outputs/mikonos-ad/mikonos-ad-captions.srt`.
- `tools/mikonos-ad/` rebuild pipeline: `build.py`, `README.md`, `esrgan_onnx.py`, `upscale.py`, `gfx/render.js`, `gfx/render2.js` (`SCALE=2` for 4K), `.gitignore` for mp4/wav/ass/pycache.
- Decision: did not fake the website; `mikonosrestaurant.us` was blocked by the sandbox network, so a test pattern sits in the website slot.

## Workflow / process used
1. Edit with ffmpeg; captions as ASS -> burned in; graphics rendered in headless Chromium (Playwright) with retries.
2. QA subagent watches frames + runs ASR on the edit to catch misheard lines; fix audio mix (removed denoiser, ducked pad under speech).
3. Upscale: build ONNX model with safe weight loading, test on a face crop, split job at the scene cut, run in background, compare AI vs standard upscale side by side.
4. Commit pipeline + outputs, send final file to Henry.

## Open items / next steps
- Record a real scroll of the Mikonos website (needs network access to mikonosrestaurant.us or a screen recording from Henry) and drop it into the website slot, then rebuild.

## Related
[[Mikonos]] · [[Content & Social Workflow]] · [[viral-editing-research-project|Viral editing research project]] · [[Mikonos|Mikonos Content Studio]]
