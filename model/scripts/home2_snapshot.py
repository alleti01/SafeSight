"""Freeze test home 2 (friends4: a friend's whole house, 7 videos, never trained on) into data/eval/home2/test_gt.json.

Reads the reviewed YOLO labels in data/yolo/labels/friends4 (Claude's review + the user's Label Studio fixes,
pulled by sync_friends.py). Same format as data/eval/test_gt.json: {frame: [[label, [x0, y0, x1, y1]], ...]}.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LABELS = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable", "floor_clutter", "bin",
          "bed", "sofa", "chair", "table", "door", "window", "glass_door"]
gt = {}
for lf in sorted((ROOT / "data/yolo/labels/friends4").glob("*.txt")):
    name = lf.stem.split("__", 1)[1] + ".jpg"
    W, H = Image.open(ROOT / "data/frames/friends4" / name).size
    boxes = []
    for r in lf.read_text().splitlines():
        if r.strip():
            c, x, y, w, h = r.split()
            x, y, w, h = float(x) * W, float(y) * H, float(w) * W, float(h) * H
            boxes.append([LABELS[int(c)], [x - w / 2, y - h / 2, x + w / 2, y + h / 2]])
    gt[name] = boxes
out = ROOT / "data/eval/home2"
out.mkdir(parents=True, exist_ok=True)
json.dump(gt, open(out / "test_gt.json", "w"))
print(len(gt), "frames,", sum(map(len, gt.values())), "boxes ->", out / "test_gt.json")
