#!/usr/bin/env python3
"""AI-upscale the source footage 2x (1080x1920 -> 2160x3840) with Real-ESRGAN (ONNX, CPU).

The HLG source is tone-mapped to SDR first (same as build.py), run through the x4 model,
box-downscaled to 2x (cleaner than a native 2x pass), then blended with a Lanczos upscale so
skin keeps natural texture instead of the "plastic" AI look.

usage: upscale.py SOURCE.mov MODEL.onnx OUT.mp4 [--start S] [--end S] [--threads N] [--ai-mix 0.75]
"""
import argparse, subprocess, sys, time
import numpy as np, onnxruntime as ort
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("model"); ap.add_argument("out")
ap.add_argument("--start", type=float, default=0.0)
ap.add_argument("--end", type=float, default=17.4)
ap.add_argument("--threads", type=int, default=4)
ap.add_argument("--ai-mix", type=float, default=0.75)
a = ap.parse_args()

W, H, FPS = 1080, 1920, 30
TM = ("zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,"
      "zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", a.src, "-vf",
                        f"{TM},fps={FPS},trim=start={a.start}:end={a.end},setpts=PTS-STARTPTS,scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24",
                        "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                        "-s", f"{2*W}x{2*H}", "-r", str(FPS), "-i", "-",
                        "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
                        "-c:v", "libx264", "-preset", "slow", "-crf", "8",
                        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                        a.out], stdin=subprocess.PIPE)
o = ort.SessionOptions(); o.intra_op_num_threads = a.threads
sess = ort.InferenceSession(a.model, o, providers=["CPUExecutionProvider"])

n, t0 = 0, time.time()
while True:
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3: break
    img = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    x = np.ascontiguousarray(img.transpose(2, 0, 1)[None], dtype=np.float32) / 255
    y = sess.run(None, {"input": x})[0][0]                                   # 3 x 4H x 4W
    y = y.reshape(3, 2 * H, 2, 2 * W, 2).mean(axis=(2, 4))                   # box 4x -> 2x
    ai = np.clip(y.transpose(1, 2, 0), 0, 1) * 255
    lz = np.asarray(Image.fromarray(img).resize((2 * W, 2 * H), Image.LANCZOS), np.float32)
    out = a.ai_mix * ai + (1 - a.ai_mix) * lz
    enc.stdin.write(np.clip(out + 0.5, 0, 255).astype(np.uint8).tobytes())
    n += 1
    if n % 10 == 0:
        el = time.time() - t0
        print(f"{n} frames, {el/n:.1f}s/frame, ~{el/n*((a.end-a.start)*FPS-n)/60:.0f} min left", flush=True)
enc.stdin.close(); enc.wait(); dec.wait()
print(f"done: {n} frames -> {a.out}")
sys.exit(enc.returncode or dec.returncode)
