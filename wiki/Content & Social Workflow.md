---
tags: [workflow, content, social]
updated: 2026-11-07
---
# Content & Social Workflow

How social content, ads and research get made for [[LTGPEAK]] and clients like [[Mikonos]].

## Captions & posts
- Write captions by content pillar: speed, client proof, pricing transparency, local reach, behind the scenes, referral, direct CTA, add-ons, testimonial, meet the team (LTGPEAK Caption Library).
- Mikonos Content Studio: a daily bot designs a new post every morning around 7:56 am. You review it, then post it.

## Video / ad edits
1. Edit with ffmpeg. Captions written as ASS and burned in; graphics rendered in headless Chromium (Playwright).
2. A QA subagent checks frames and runs speech-to-text on the edit to catch misheard captions. Fix the audio mix (duck music under speech).
3. Upscale to 4K with Real-ESRGAN (ONNX locally or on GitHub runners). Test on a face crop first, compare against a standard upscale.
4. Commit the pipeline + outputs, send the final file.

## Trend research
- Run parallel research subagents → sourced raw notes → a source-vetting agent → a synthesizer that writes wiki notes + a report → link check (see the viral editing research session).

## Related
- [[Mikonos]] · [[LTGPEAK]] · [[Session Index]] · [[Home]]
