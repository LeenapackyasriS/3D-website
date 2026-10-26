#!/usr/bin/env python3
"""Create optimized WebP frame sets from the original JPEGs.
Usage: python3 scripts/optimize-frames.py   (requires: pip install Pillow)
Outputs: assets/frames-webp/ (1280x720, q80) and assets/frames-mobile/ (720x405, q72).
Originals in assets/frames/ are kept as the JPEG fallback."""
import os, sys
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
SRC = os.path.join(ROOT, "frames")
SETS = [("frames-webp", (1280, 720), 80), ("frames-mobile", (720, 405), 72)]
files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".jpg"))
if not files:
    sys.exit("No JPEG frames found in assets/frames/")
for name, size, q in SETS:
    out = os.path.join(ROOT, name); os.makedirs(out, exist_ok=True)
    total = 0
    for f in files:
        im = Image.open(os.path.join(SRC, f)).convert("RGB")
        if im.size != size: im = im.resize(size, Image.LANCZOS)
        p = os.path.join(out, f.rsplit(".", 1)[0] + ".webp")
        im.save(p, "WEBP", quality=q, method=6); total += os.path.getsize(p)
    print(f"{name}: {len(files)} frames, {total/1e6:.1f} MB")
