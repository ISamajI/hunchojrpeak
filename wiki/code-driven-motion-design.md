---
tags: [motion-design, video, agents, orochimaru]
source: Instagram reel by ugoki.ai (screen recording, 2026-11-12)
---
# Code-driven motion design

Every frame is a pure function of the frame number, and the video is described as data rather than as keyframes. To edit the video, change one line of JSON and re-render.

What the reference reel showed:
- `lyrics.json` holding the cuts and caption slots, timed in frames to the beat. See [[beat-synced-captions]].
- The phone UI written as code (`ProfileIG.tsx`), so the numbers and copy are editable text.
- A Blender Python script for the 3D phone, with softbox "softcards" for the light.
- The screen corner-pinned onto the phone face.
- Captions where one keyword sits in an accent-colour pill.

How it's implemented: `motion-studio/` in this repo. Owned by [[Orochimaru]] (with [[Kabuto]], [[Anko]] and [[Kimimaro]]) through the `motion-design` skill.

Related: [[LTGPEAK]], [[Jarvis system]], [[Akamaru system]]
