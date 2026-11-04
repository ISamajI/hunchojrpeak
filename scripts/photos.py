"""Download every photo the site uses, AI-upscale the small ones, and write web-ready copies.

Runs in GitHub Actions (see .github/workflows/photos.yml) because it needs network access to
seanslandscaping.com. Output goes to assets/photos/:
  <name>-1200.webp, <name>-2400.webp   responsive variants
  manifest.json                         {source path: {name, w, h, src_w, src_h, upscaled}}

Images whose long side is under MIN_LONG_SIDE are upscaled 4x with Real-ESRGAN (realesr-general-x4v3,
a fast compact model) and then resized to the target, which recovers far more detail than plain
resizing. Larger images get Lanczos resizing plus a light unsharp mask.

Sharding: set SHARD and SHARDS to split the work across parallel CI jobs; each shard writes
manifest-<SHARD>.json, and `python scripts/photos.py merge` combines them into manifest.json.
"""
import json
import re
import sys
import time
import urllib.request
from io import BytesIO
from pathlib import Path

import os

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "photos"
BASE = "https://www.seanslandscaping.com/wp-content/uploads/"
TARGET = 2400          # long side of the large variant
SMALL = 1200           # long side of the small variant
MIN_LONG_SIDE = 1200   # below this, upscale with AI first
WEIGHTS = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth"
PATTERN = re.compile(r'"(20\d\d/\d\d/[^"]+\.(?:jpe?g|png))"', re.I)


def sources():
    found = set()
    for f in ("src/data.mjs", "src/build.mjs"):
        found.update(PATTERN.findall((ROOT / f).read_text(encoding="utf-8")))
    return sorted(found)


def slug(path):
    return re.sub(r"[^A-Za-z0-9_-]+", "-", path.rsplit(".", 1)[0]).strip("-")


def fetch(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (site build)"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            print(f"  retry {url}: {e}", flush=True)
            time.sleep(2 ** i)


_model = None


def model():
    global _model
    if _model is None:
        import torch
        from spandrel import ModelLoader

        wpath = ROOT / ".cache" / "realesr-general-x4v3.pth"
        wpath.parent.mkdir(exist_ok=True)
        if not wpath.exists():
            wpath.write_bytes(fetch(WEIGHTS))
        _model = ModelLoader().load_from_file(str(wpath))
        _model.eval()
    return _model


def upscale4x(img, tile=384, pad=16):
    """Tiled Real-ESRGAN x4 inference on CPU (keeps memory bounded)."""
    import torch

    m = model()
    arr = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    h, w, _ = arr.shape
    out = np.zeros((h * 4, w * 4, 3), dtype=np.float32)
    t = torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0)
    with torch.inference_mode():
        for y in range(0, h, tile):
            for x in range(0, w, tile):
                y0, x0 = max(y - pad, 0), max(x - pad, 0)
                y1, x1 = min(y + tile + pad, h), min(x + tile + pad, w)
                res = m(t[:, :, y0:y1, x0:x1]).clamp(0, 1)[0].permute(1, 2, 0).numpy()
                ty, tx = (y - y0) * 4, (x - x0) * 4
                th, tw = (min(y + tile, h) - y) * 4, (min(x + tile, w) - x) * 4
                out[y * 4:y * 4 + th, x * 4:x * 4 + tw] = res[ty:ty + th, tx:tx + tw]
    return Image.fromarray((out * 255.0 + 0.5).astype(np.uint8))


def fit(img, long_side):
    w, h = img.size
    s = long_side / max(w, h)
    if s >= 1:
        return img
    return img.resize((round(w * s), round(h * s)), Image.LANCZOS)


def merge():
    manifest = {}
    for f in sorted(OUT.glob("manifest-*.json")):
        manifest.update(json.loads(f.read_text()))
        f.unlink()
    missing = [p for p in sources() if p not in manifest]
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1, sort_keys=True))
    print(f"merged {len(manifest)} photos; {len(missing)} missing", flush=True)
    for p in missing:
        print("  missing:", p)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    shard, shards = int(os.environ.get("SHARD", 0)), int(os.environ.get("SHARDS", 1))
    paths = [p for i, p in enumerate(sources()) if i % shards == shard]
    mpath = OUT / (f"manifest-{shard}.json" if shards > 1 else "manifest.json")
    manifest = {}
    print(f"shard {shard}/{shards}: {len(paths)} images", flush=True)
    failed = []
    for i, p in enumerate(paths, 1):
        name = slug(p)
        t0 = time.time()
        try:
            img = Image.open(BytesIO(fetch(BASE + p)))
            img = ImageOps.exif_transpose(img).convert("RGB")
        except Exception as e:  # noqa: BLE001
            print(f"[{i}/{len(paths)}] FAILED {p}: {e}", flush=True)
            failed.append(p)
            continue
        sw, sh = img.size
        upscaled = max(sw, sh) < MIN_LONG_SIDE
        if upscaled:
            large = fit(upscale4x(img), TARGET)
        elif max(sw, sh) < TARGET:
            s_ = TARGET / max(sw, sh)
            large = img.resize((round(sw * s_), round(sh * s_)), Image.LANCZOS)
            large = large.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
        else:
            large = fit(img, TARGET)
        small = fit(large, SMALL)
        large.save(OUT / f"{name}-2400.webp", "WEBP", quality=82, method=5)
        small.save(OUT / f"{name}-1200.webp", "WEBP", quality=80, method=5)
        manifest[p] = {"name": name, "w": large.size[0], "h": large.size[1], "src_w": sw, "src_h": sh, "upscaled": upscaled}
        mpath.write_text(json.dumps(manifest, indent=1, sort_keys=True))
        print(f"[{i}/{len(paths)}] {p} {sw}x{sh} -> {large.size[0]}x{large.size[1]}"
              f"{' (AI x4)' if upscaled else ''} {time.time() - t0:.1f}s", flush=True)
    print(f"done; {len(manifest)} written, {len(failed)} failed", flush=True)
    for p in failed:
        print("  failed:", p)


if __name__ == "__main__":
    merge() if sys.argv[1:] == ["merge"] else main()
