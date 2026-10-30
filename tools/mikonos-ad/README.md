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

## 4K version (AI upscale)

`outputs/mikonos-ad/mikonos-ad-final-4k.mp4` is 2160x3840. Only the camera footage is AI-upscaled; captions, title and end card are rendered natively at 4K so the text stays sharp.

1. Get the Real-ESRGAN weights (`realesr-general-x4v3.pth` and `realesr-general-wdn-x4v3.pth`, GitHub release v0.2.5.0 of xinntao/Real-ESRGAN) and build the ONNX model. No PyTorch needed, and the loader only accepts plain tensors:
   `python3 esrgan_onnx.py realesr-general-x4v3.pth realesr-general-wdn-x4v3.pth 0.5 esrgan.onnx`
2. Upscale the footage, split at the scene cut (about 13 s/frame on 4 CPU cores):
   `python3 upscale.py SOURCE.mov esrgan.onnx upA.mp4 --start 0 --end 10.0333`
   `python3 upscale.py SOURCE.mov esrgan.onnx upB.mp4 --start 10.0333 --end 17.4`
3. Render the graphics at 2x and build:
   `cd gfx && SCALE=2 node render.js && SCALE=2 node render2.js && cd ..`
   `python3 build.py SOURCE.mov words_final.json out-4k.mp4 --scale 2 --upscaled upA.mp4 upB.mp4`

The AI output is blended 75/25 with a Lanczos upscale, with fine luma grain added, so skin keeps a natural texture.

## Run (1080p)

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
