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


def person_boxes(img, model, device=None):
    """img: HxWx3 uint8 RGB. Every person's box, grown by PAD per side, as [x0, y0, x1, y1] floats."""
    H, W = img.shape[:2]
    r = model.predict(img[:, :, ::-1], classes=[0], conf=CONF, device=device, verbose=False)[0]
    out = []
    for x0, y0, x1, y1 in r.boxes.xyxy.tolist():
        px, py = (x1 - x0) * PAD, (y1 - y0) * PAD
        out.append([max(0.0, x0 - px), max(0.0, y0 - py), min(W, x1 + px), min(H, y1 + py)])
    return out


def blur_boxes(img, boxes):
    """Blur inside each box with a soft, feathered edge. The whole frame is blurred once (shrunk to a few dozen
    pixels and grown back, then smoothed), so no face or body detail survives, and blended in through a rounded
    mask, so the patch doesn't flicker at its edges as the box moves."""
    if not boxes:
        return img.copy()
    H, W = img.shape[:2]
    s = 24 / max(W, H)
    heavy = cv2.resize(cv2.resize(img, (max(1, int(W * s)), max(1, int(H * s))), interpolation=cv2.INTER_AREA),
                       (W, H), interpolation=cv2.INTER_LINEAR)
    heavy = cv2.GaussianBlur(heavy, (0, 0), max(W, H) / 80)
    mask = np.zeros((H, W), np.float32)
    for x0, y0, x1, y1 in boxes:
        x0, y0, x1, y1 = int(max(0, x0)), int(max(0, y0)), int(min(W, x1)), int(min(H, y1))
        if x1 - x0 < 2 or y1 - y0 < 2:
            continue
        r = int(0.25 * min(x1 - x0, y1 - y0))
        cv2.rectangle(mask, (x0 + r, y0), (x1 - r, y1), 1.0, -1)
        cv2.rectangle(mask, (x0, y0 + r), (x1, y1 - r), 1.0, -1)
        for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
            cv2.circle(mask, (cx, cy), r, 1.0, -1)
    feather = max(3.0, max(W, H) / 120)
    # grow then feather, so the fully blurred area still covers the whole box
    mask = cv2.dilate(mask, np.ones((int(feather * 2) | 1, int(feather * 2) | 1), np.uint8))
    mask = np.clip(cv2.GaussianBlur(mask, (0, 0), feather), 0, 1)[..., None]
    return (img * (1 - mask) + heavy * mask).astype(np.uint8)


def blur_people(img, model, device=None):
    """img: HxWx3 uint8 RGB. Returns (blurred copy, number of people blurred). For a single photo."""
    boxes = person_boxes(img, model, device)
    return blur_boxes(img, boxes), len(boxes)


def _iou(a, b):
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


def steady_boxes(per_frame, hold=6, smooth=0.5):
    """Per-frame person boxes for a run of video frames -> steady boxes per frame, for blurring video.

    Each person is followed from frame to frame (boxes that overlap), its box is smoothed so the blur glides
    instead of jumping, and a person's blur starts `hold` frames before they are first seen and lasts `hold`
    frames after they're last seen, filling any gaps in between. So a person missed for a frame or two is
    never shown, and blur patches don't blink on and off. Every detected box stays covered (the smoothed box
    is joined with the detection)."""
    tracks = []  # each: {"seen": {frame: box}, "last": box, "end": frame}
    for k, dets in enumerate(per_frame):
        used = set()
        for t in sorted(tracks, key=lambda t: -t["end"]):
            if k - t["end"] > hold:
                continue
            best = max((i for i in range(len(dets)) if i not in used), key=lambda i: _iou(t["last"], dets[i]), default=None)
            if best is not None and _iou(t["last"], dets[best]) > 0.1:
                d, prev = dets[best], t["last"]
                sm = [smooth * a + (1 - smooth) * b for a, b in zip(d, prev)]
                box = [min(sm[0], d[0]), min(sm[1], d[1]), max(sm[2], d[2]), max(sm[3], d[3])]
                t["seen"][k], t["last"], t["end"] = box, box, k
                used.add(best)
        for i, d in enumerate(dets):
            if i not in used:
                tracks.append({"seen": {k: list(d)}, "last": list(d), "end": k})
    out = [[] for _ in per_frame]
    for t in tracks:
        keys = sorted(t["seen"])
        first, last = keys[0], keys[-1]
        for k in range(max(0, first - hold), min(len(per_frame), last + hold + 1)):
            if k in t["seen"]:
                out[k].append(t["seen"][k])
                continue
            before = max((j for j in keys if j < k), default=None)
            after = min((j for j in keys if j > k), default=None)
            if before is None or after is None:  # before first / after last sighting: hold the nearest box
                out[k].append(t["seen"][after if before is None else before])
            else:  # a gap: slide between the two sightings, covering both
                f = (k - before) / (after - before)
                a, b = t["seen"][before], t["seen"][after]
                out[k].append([a[i] + (b[i] - a[i]) * f for i in range(4)])
    return out


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
