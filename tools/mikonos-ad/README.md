# Mikonos ad build

Rebuilds `outputs/mikonos-ad/mikonos-ad-final.mp4` from the raw phone clip.

What it does:
- Tone-maps the iPhone HLG HDR footage to SDR BT.709 (hable), applies a light grade and warms the exterior shot
- Adds slow push-ins (4x supersampled so they don't judder)
- Burns in word-by-word captions (white, active word in Mikonos gold) from `words_final.json`
- Shows a "MIKONOS / GREEK RESTAURANT" title over the interior shot only, so it never doubles the real sign outside
- Matches the quieter exterior voice take to the interior by measurement
- Adds a soft synthesized pad, ducked under the voice
- Ends on a brand card: mikonosrestaurant.us · (609) 883-9333
- Optionally adds a phone-framed **website scroll** segment before the end card

## Run

```bash
cd tools/mikonos-ad/gfx && node render.js && node render2.js   # needs Playwright + Chromium
cd .. && python3 build.py SOURCE.mov words_final.json ../../outputs/mikonos-ad/mikonos-ad-final.mp4
```

Add the website scroll once you have a screen recording of mikonosrestaurant.us (any vertical phone recording works; it's scaled into a phone frame under "See the full menu at mikonosrestaurant.us"):

```bash
python3 build.py SOURCE.mov words_final.json out.mp4 --scroll website-scroll.mp4
```

Requires ffmpeg with zscale, libass and libx264, plus the Inter Display and Caladea fonts.

Specs of the output: 1080x1920 H.264 High, 30 fps, AAC 48 kHz stereo, about -15 LUFS, true peak about -4.5 dBTP.
