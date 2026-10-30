#!/usr/bin/env python3
"""Mikonos ad build: HLG->SDR grade, push-ins, word-highlight captions, brand bug,
optional website-scroll segment, end card, voice cleanup + soft music bed.

usage: build.py SOURCE.mov WORDS.json OUT.mp4 [--scroll scroll.mp4]
                [--scale 2 --upscaled A.mp4 B.mp4]   # 4K: AI-upscaled footage from upscale.py
Graphics must be rendered at the same scale first: SCALE=2 node gfx/render.js && SCALE=2 node gfx/render2.js
"""
import json, subprocess, sys, os, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
GFX = os.path.join(HERE, "gfx")
CUT = 10.033            # interior -> exterior cut in the source
END_CARD = 3.6          # seconds
XF = 0.5                # crossfade into scroll / end card

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("words"); ap.add_argument("out")
ap.add_argument("--scroll")
ap.add_argument("--scale", type=int, default=1, choices=[1, 2])
ap.add_argument("--upscaled", nargs=2, metavar=("INTERIOR", "EXTERIOR"),
                help="pre-upscaled SDR segments from upscale.py (split at the scene cut)")
a = ap.parse_args()
SC = a.scale
W, H, FPS = 1080 * SC, 1920 * SC, 30
if SC > 1 and not a.upscaled: sys.exit("--scale 2 needs --upscaled (run upscale.py first)")

words = json.load(open(a.words))
body_end = min(round(words[-1]["end"] + 0.7, 3), 19.7)

def run(cmd):
    print("+", " ".join(cmd)[:300], flush=True)
    subprocess.run(cmd, check=True)

# ---------- captions (ASS, karaoke-style active-word highlight) ----------
def ts(t):
    t = max(t, 0); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def chunks(ws, max_words=3, max_chars=16, gap=0.45):
    out, cur = [], []
    for w in ws:
        brk = cur and (len(cur) >= max_words
                       or len(" ".join(x["w"] for x in cur + [w])) > max_chars
                       or w["start"] - cur[-1]["end"] > gap
                       or cur[-1]["w"][-1] in ".!?,")
        if brk and cur[-1]["w"].lower() in ("a", "the", "to", "for", "of", "at", "and") and len(cur) > 1:
            out.append(cur[:-1]); cur = cur[-1:]          # don't leave a function word hanging
        elif brk: out.append(cur); cur = []
        cur.append(w)
    if cur: out.append(cur)
    return out

WHITE, GOLD = "&H00FFFFFF", "&H006DC4F2"   # ASS is &HAABBGGRR
ass = [
    "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1080", "PlayResY: 1920",
    "WrapStyle: 2", "ScaledBorderAndShadow: yes", "YCbCr Matrix: TV.709", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    f"Style: Cap,Inter Display Black,92,{WHITE},{WHITE},&H00211B0B,&H96000000,1,0,0,0,100,100,0,0,1,7,4,2,70,70,560,1",
    "", "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
]
cs = chunks(words)
for i, c in enumerate(cs):
    c_start = c[0]["start"]
    nxt = cs[i + 1][0]["start"] if i + 1 < len(cs) else body_end
    c_end = min(c[-1]["end"] + 0.35, nxt)
    if c_start < CUT <= c_end: c_end = CUT - 0.02   # never carry a caption across the scene cut
    # highlight spans: every word stays lit at least MIN_HL; a short word borrows time from
    # the following word(s), and the chunk's tail may run on into the gap before the next chunk
    MIN_HL = 0.12
    starts = [c_start] + [w["start"] for w in c[1:]]
    for j in range(1, len(starts)):
        starts[j] = max(starts[j], starts[j - 1] + MIN_HL)
    limit = nxt if not (c_start < CUT <= nxt) else CUT - 0.02
    c_end = min(max(c_end, starts[-1] + MIN_HL), limit)
    spans = [[starts[j], starts[j + 1] if j + 1 < len(c) else c_end, j] for j in range(len(c))]
    for s, e, j in spans:
        pop = r"{\fscx112\fscy112\t(0,90,\fscx100\fscy100)}" if j == 0 else ""
        parts = []
        for k, x in enumerate(c):
            txt = x["w"].upper()
            parts.append(rf"{{\c{GOLD}}}{txt}{{\c{WHITE}}}" if k == j else txt)
        ass.append(f"Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,0,,{pop}{' '.join(parts)}")
ass_path = os.path.join(HERE, "captions.ass")
open(ass_path, "w").write("\n".join(ass) + "\n")

# ---------- graphics must be rendered at this scale ----------
from PIL import Image
for g in ("bug.png", "endcard.png"):
    sz = Image.open(os.path.join(GFX, g)).size
    if sz != (W, H): sys.exit(f"gfx/{g} is {sz}, expected {(W, H)}: run SCALE={SC} node gfx/render.js")

# ---------- body: grade + push-ins + captions + bug ----------
TM = ("zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,"
      "zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
GRADE = ("eq=contrast=1.03:brightness=0.01:saturation=1.10,scale=in_range=tv:out_range=pc:in_color_matrix=bt709,format=gbrp,"
         "vignette=angle=PI/5:mode=forward,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p")
GRADE_EXT = "eq=gamma=1.12:saturation=1.05,colorbalance=rm=0.05:bm=-0.05:rh=0.02:bh=-0.02"

SS = 4 // SC           # supersample so each zoom step is <= 1/4 px at 1080p-equivalent
def push(dur, z):  # smooth push-in from 1.0 to 1+z over dur
    return (f"scale=w='{SS}*{W}*(1+{z}*t/{dur})':h='{SS}*{H}*(1+{z}*t/{dur})':eval=frame:flags=bicubic,"
            f"crop={SS*W}:{SS*H},scale={W}:{H}:flags=lanczos,setsar=1")
# fine luma grain on upscaled footage so it reads as camera texture, not an AI "plastic" look
GRAIN = ",noise=c0s=3:c0f=t" if a.upscaled else ""

body = os.path.join(HERE, "body.mp4")
dA, dB = CUT, body_end - CUT
if a.upscaled:   # already tone-mapped and split at the cut
    vin = ["-i", a.upscaled[0], "-i", a.upscaled[1]]
    split = (f"[0:v]trim=0:{CUT},setpts=PTS-STARTPTS[g1];"
             f"[1:v]trim=0:{body_end - CUT},setpts=PTS-STARTPTS[g2];")
    bi = 2
else:
    vin = ["-i", a.src]
    split = (f"[0:v]{TM},split=2[t1][t2];[t1]trim=0:{CUT},setpts=PTS-STARTPTS[g1];"
             f"[t2]trim={CUT}:{body_end},setpts=PTS-STARTPTS[g2];")
    bi = 1
fc = (
    split +
    f"[g1]{GRADE},{push(dA,0.045)}{GRAIN}[a];"
    f"[g2]{GRADE_EXT},{GRADE},{push(dB,0.035)}{GRAIN}[b];"
    f"[a][b]concat=n=2:v=1:a=0,fps={FPS},format=yuv420p[v0];"
    f"[{bi}:v]format=rgba,fade=in:st=0.3:d=0.6:alpha=1,fade=out:st={CUT-0.5}:d=0.45:alpha=1,scale=out_color_matrix=bt709:out_range=tv,format=yuva420p[bug];"
    f"[v0][bug]overlay=0:0:shortest=1,ass={ass_path}:fontsdir=/usr/share/fonts[v]"
)
run(["ffmpeg", "-v", "error", "-y", *vin,
     "-loop", "1", "-framerate", str(FPS), "-t", str(body_end), "-i", os.path.join(GFX, "bug.png"),
     "-filter_complex", fc, "-map", "[v]", "-t", str(body_end),
     "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", body])

# ---------- tail segments ----------
segs = [(body, body_end)]
if a.scroll:
    sdur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", a.scroll]).decode())
    scroll_seg = os.path.join(HERE, "scrollseg.mp4")
    # phone-framed scroll on brand background with a CTA line
    run(["ffmpeg", "-v", "error", "-y",
         "-loop", "1", "-framerate", str(FPS), "-i", os.path.join(GFX, "scrollbg.png"),
         "-i", a.scroll,
         "-loop", "1", "-framerate", str(FPS), "-i", os.path.join(GFX, "mask.png"),
         "-loop", "1", "-framerate", str(FPS), "-i", os.path.join(GFX, "bezel.png"),
         "-filter_complex",
         f"[1:v]fps={FPS},scale={780*SC}:{1386*SC}:flags=lanczos,setsar=1,format=rgba[sc];"
         f"[2:v]format=gray[m];[sc][m]alphamerge[ph];"
         f"[0:v]format=rgba[bg];[bg][ph]overlay={150*SC}:{330*SC}:shortest=1[t];"
         f"[t][3:v]overlay=0:0:shortest=1,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]",
         "-map", "[v]", "-t", str(sdur), "-c:v", "libx264", "-preset", "slow", "-crf", "14", scroll_seg])
    segs.append((scroll_seg, sdur))

end_seg = os.path.join(HERE, "endseg.mp4")
run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-t", str(END_CARD),
     "-i", os.path.join(GFX, "endcard.png"),
     "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
     "-t", str(END_CARD), "-c:v", "libx264", "-preset", "slow", "-crf", "14", end_seg])
segs.append((end_seg, END_CARD))

# xfade chain
inputs, fcv, off, last = [], [], 0.0, "0:v"
for i, (p, d) in enumerate(segs):
    inputs += ["-i", p]
for i in range(1, len(segs)):
    off += segs[i - 1][1] - XF
    trans = "smoothup" if i < len(segs) - 1 or not a.scroll else "fade"
    lab = f"x{i}"
    fcv.append(f"[{last}][{i}:v]xfade=transition={trans}:duration={XF}:offset={off:.3f}[{lab}]")
    last = lab
total = sum(d for _, d in segs) - XF * (len(segs) - 1)

# ---------- audio: voice cleanup + synthesized warm pad bed ----------
import re
def lufs(src, flt):
    o = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", src, "-af", f"{flt},ebur128",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", o)[-1])

HP = "highpass=f=85,lowpass=f=13000"
# the exterior take was recorded much quieter: match it to the interior by measurement
li = lufs(a.src, f"atrim=0.1:9.85,{HP}")
le = lufs(a.src, f"atrim=10.6:{body_end},{HP}")
g_ext = 10 ** ((li - le) / 20)
# source has digital silence 9.90-10.55 (edit gap): fade room tone around it instead of a hard drop
env = (f"if(lt(t,9.72),1,if(lt(t,9.90),(9.90-t)/0.18,if(lt(t,10.55),0,"
       f"if(lt(t,10.62),{g_ext:.3f}*(t-10.55)/0.07,{g_ext:.3f}))))")
vchain = (f"atrim=0:{body_end},asetpts=PTS-STARTPTS,{HP},volume='{env}':eval=frame,afade=t=in:d=0.03,"
          f"acompressor=threshold=-22dB:ratio=3:attack=8:release=120:makeup=3dB,"
          f"afade=t=out:st={body_end-0.35}:d=0.35")
g_voice = 10 ** ((-14.5 - lufs(a.src, vchain)) / 20)        # static gain: no pumping
print(f"audio: interior {li:.1f} LUFS, exterior {le:.1f} LUFS -> ext gain {g_ext:.2f}x, voice gain {g_voice:.2f}x")

# A-major add9 pad (with upper partials so it reads on phone speakers): slow tremolo, gentle
# echo; sidechain-ducked under the voice and brought up over the end card
freqs = [110.0, 164.81, 220.0, 277.18, 329.63, 440.0, 493.88, 554.37, 659.26, 987.77]
def partial(k, f):
    return f"{0.9/(k+1.6):.3f}*sin(2*PI*{f}*t)*(0.8+0.2*sin(2*PI*{0.11+0.03*k:.2f}*t))"
xf0 = body_end - XF                                   # end-card crossfade starts here
ramp = f"clip((t-{xf0:.3f})/0.8,0,1)"
low = "+".join(partial(k, f) for k, f in enumerate(freqs) if f < 500)
high = "+".join(partial(k, f) for k, f in enumerate(freqs) if f >= 500)
expr = f"({low})+{ramp}*({high})"
audio = os.path.join(HERE, "mix.wav")
fc = (f"[0:a]{vchain},volume={g_voice:.4f},apad=whole_dur={total},aresample=48000,asplit=2[vo][sc];"
      f"aevalsrc='0.10*({expr})':s=48000:d={total},lowpass=f=2400,"
      f"aecho=0.8:0.6:180|340:0.35|0.22,afade=t=in:d=1.2,afade=t=out:st={total-1.4}:d=1.4,"
      f"volume='0.6+4.0*{ramp}':eval=frame[padraw];"
      f"[padraw][sc]sidechaincompress=threshold=0.015:ratio=10:attack=20:release=400[pad];"
      f"[vo][pad]amix=inputs=2:normalize=0,alimiter=limit=0.79:attack=2:release=50:level=0,"
      f"atrim=0:{total:.3f}[aout]")
run(["ffmpeg", "-v", "error", "-y", "-i", a.src, "-filter_complex", fc, "-map", "[aout]",
     "-ac", "2", "-c:a", "pcm_s24le", audio])

run(["ffmpeg", "-v", "error", "-y", *inputs, "-i", audio, "-filter_complex", ";".join(fcv),
     "-map", f"[{last}]", "-map", f"{len(segs)}:a", "-t", f"{total:.3f}",
     "-c:v", "libx264", "-preset", "slow", "-crf", "17" if SC == 1 else "18", "-profile:v", "high",
     "-pix_fmt", "yuv420p", *([] if SC == 1 else ["-level:v", "5.2", "-maxrate", "60M", "-bufsize", "120M"]),
     "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
     "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", a.out])
print(f"done: {a.out} ({total:.2f}s)")
