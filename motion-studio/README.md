# Motion Studio

Code-driven motion design for short-form video. No keyframes: every frame is a pure function of
the frame number, driven by a scene JSON file. Change a line of data, re-render.

Learned from a reference reel (ugoki.ai, "This entire reel was made with Claude") and wired into
the Orochimaru branch of the Jarvis and Akamaru agent systems via the `motion-design` skill
(`../plugins/*/skills/motion-design/SKILL.md`).

## Requirements
Node 18+, ffmpeg, and Playwright with Chromium (`npm i playwright && npx playwright install chromium`
on a fresh machine). Blender 4.x is only needed for the optional 3D shot.

## Use
```bash
node render.cjs scenes/demo.json --still 150 --scale 0.4   # one frame -> out/demo-150.png
node render.cjs scenes/demo.json --scale 0.5               # draft -> out/demo.mp4
node render.cjs scenes/demo.json                           # final 1080x1920
node render.cjs --serve                                    # live preview in a browser
```

## Files
| Path | Purpose |
|---|---|
| `scenes/*.json` | The whole video as data: `meta` (size, fps, bpm, audio, theme), `shots[]`, `captions[]` |
| `player.html` | Deterministic renderer. `seek(frame)` redraws everything |
| `screens/*.html` | Phone screens as code (390x844) |
| `render.cjs` | Headless Chromium → PNG frames → ffmpeg H.264 (+ audio) |
| `blender/phone_scene.py` | 3D phone hero shot with softbox lights and drivers (not yet run, since Blender isn't installed in the build container) |

## Shot types
- `title`: `lines[]`, `{word}` accent, `~word~` animated strike, `variant: "slam"`
- `phone`: `screen`, `rotY`/`rotX`/`scale` as `[from, to]`, optional `code` panel
- `code`: `file`, `note`, `lines[]`, `highlight` (typewriter reveal)
- `counter`: `from`, `to`, `suffix`

Timing is in frames. Seconds × fps = frame. One beat = `fps*60/bpm` frames.
