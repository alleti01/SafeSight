"""Draw the boxes the missing-box pass added (labels vs labels_orig) on random images for a by-eye check.

Added boxes are drawn thick and labeled; original boxes thin and gray.
Usage: review_filled.py data/yolo out.jpg [n=30] [label]
"""
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw

LABELS = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable",
          "floor_clutter", "bin", "bed", "sofa", "chair", "table"]


def boxes(path):
    return [l.split() for l in path.read_text().splitlines() if l.strip()] if path.exists() else []


def main():
    root, out = Path(sys.argv[1]), sys.argv[2]
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 30
    only = sys.argv[4] if len(sys.argv) > 4 else None
    changed = []
    for split in ("train", "val"):
        for f in (root / "labels" / split).glob("*.txt"):
            new, old = boxes(f), boxes(root / "labels_orig" / split / f.name)
            added = [b for b in new[len(old):]]
            if added and (only is None or any(LABELS[int(b[0])] == only for b in added)):
                changed.append((split, f.stem, old, added))
    print(f"{len(changed)} images got added boxes")
    random.seed(0)
    pick = random.sample(changed, min(n, len(changed)))
    T, C = 300, 6
    sheet = Image.new("RGB", (C * T, ((len(pick) + C - 1) // C) * T), "white")
    for k, (split, stem, old, added) in enumerate(pick):
        im = Image.open(root / "images" / split / f"{stem}.jpg").convert("RGB")
        W, H = im.size
        d = ImageDraw.Draw(im)
        for group, color, width in ((old, (160, 160, 160), 2), (added, (255, 0, 0), max(3, W // 120))):
            for c, xc, yc, w, h in group:
                xc, yc, w, h = float(xc) * W, float(yc) * H, float(w) * W, float(h) * H
                d.rectangle([xc - w / 2, yc - h / 2, xc + w / 2, yc + h / 2], outline=color, width=width)
                if color != (160, 160, 160):
                    d.text((xc - w / 2 + 4, yc - h / 2 + 2), LABELS[int(c)], fill=color)
        im.thumbnail((T - 4, T - 4))
        sheet.paste(im, ((k % C) * T, (k // C) * T))
    sheet.save(out, quality=85)


if __name__ == "__main__":
    main()
