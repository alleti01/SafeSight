"""Blur every person in a frame before it is stored or sent anywhere (stock YOLO11 'person' class).

Catches people walking through, the filmer's own hands/legs/feet, and people in wall photos. The analysis
service calls blur_people(); run as a script to blur a folder of frames in place.

Usage: blur_people.py <frames dir>
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
CONF = 0.25   # low on purpose: a missed person is worse than an extra blurred patch
PAD = 0.08    # grow each box by 8% per side so edges of hair/hands are covered


def load_model():
    return YOLO(ROOT / "weights" / "yolo11m.pt")


def blur_people(img, model, device=None):
    """img: HxWx3 uint8 RGB. Returns (blurred copy, number of people blurred)."""
    H, W = img.shape[:2]
    r = model.predict(img[:, :, ::-1], classes=[0], conf=CONF, device=device, verbose=False)[0]
    out = img.copy()
    for x0, y0, x1, y1 in r.boxes.xyxy.tolist():
        px, py = (x1 - x0) * PAD, (y1 - y0) * PAD
        x0, y0 = int(max(0, x0 - px)), int(max(0, y0 - py))
        x1, y1 = int(min(W, x1 + px)), int(min(H, y1 + py))
        if x1 - x0 < 2 or y1 - y0 < 2:
            continue
        # shrink to ~8 px across, scale back up, then blur: no face or body detail survives
        patch = out[y0:y1, x0:x1]
        w, h = x1 - x0, y1 - y0
        s = 8 / max(w, h)
        tiny = cv2.resize(patch, (max(1, int(w * s)), max(1, int(h * s))), interpolation=cv2.INTER_AREA)
        k = (max(w, h) // 6) | 1
        out[y0:y1, x0:x1] = cv2.GaussianBlur(cv2.resize(tiny, (w, h), interpolation=cv2.INTER_LINEAR), (k, k), 0)
    return out, len(r.boxes)


def main():
    import torch
    device = "mps" if torch.backends.mps.is_available() else 0 if torch.cuda.is_available() else "cpu"
    model = load_model()
    files = sorted(Path(sys.argv[1]).glob("*.jpg"))
    n_frames = n_people = 0
    for f in files:
        img = np.array(Image.open(f).convert("RGB"))
        out, n = blur_people(img, model, device)
        if n:
            Image.fromarray(out).save(f, quality=92)
            n_frames += 1
            n_people += n
    print(f"blurred {n_people} people in {n_frames} of {len(files)} frames")


if __name__ == "__main__":
    main()
