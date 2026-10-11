"""Copy-paste augmentation for the weakest labels (towel, glass door, cable).

Cuts real instances (with exact outlines) from full ADE20K home scenes (towels), Trans10K (glass doors) and
LVIS/COCO (cables via 'cord'-like masks are scarce, so cable crops come from our reviewed cable boxes with a
GrabCut matte) and pastes them onto real phone-video home frames (Anish's home + Charades frames we reviewed),
with scale/brightness jitter and soft edges. Background frames keep their own reviewed boxes.

Output: data/yolo/{images,labels}/paste  (N images). Train only.
Usage (GPU machine or Mac): copy_paste.py N
"""
import json
import random
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
Y = ROOT / "data" / "yolo"
LABELS = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable", "floor_clutter", "bin",
          "bed", "sofa", "chair", "table", "door", "window", "glass_door"]
ID = {n: i for i, n in enumerate(LABELS)}
random.seed(0)


def crops_from_yolo(split, label, limit, min_side=40):
    """(rgb crop, alpha mask) for a label from an existing YOLO split, alpha by GrabCut inside the box."""
    out = []
    files = sorted((Y / "labels" / split).glob("*.txt"))
    random.shuffle(files)
    for lf in files:
        if len(out) >= limit:
            break
        rows = [r.split() for r in lf.read_text().splitlines() if r.strip()]
        rows = [r for r in rows if int(r[0]) == ID[label]]
        if not rows:
            continue
        img = Y / "images" / split / f"{lf.stem}.jpg"
        if not img.exists():
            continue
        im = np.array(Image.open(img).convert("RGB"))
        H, W = im.shape[:2]
        for r in rows:
            xc, yc, w, h = map(float, r[1:5])
            x0, y0 = int((xc - w / 2) * W), int((yc - h / 2) * H)
            x1, y1 = int((xc + w / 2) * W), int((yc + h / 2) * H)
            x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
            if min(x1 - x0, y1 - y0) < min_side or (x1 - x0) * (y1 - y0) > 0.5 * W * H:
                continue
            pad = 6
            X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
            patch = im[Y0:Y1, X0:X1].copy()
            mask = np.zeros(patch.shape[:2], np.uint8)
            rect = (x0 - X0, y0 - Y0, x1 - x0, y1 - y0)
            try:
                bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
                cv2.grabCut(patch, mask, rect, bg, fg, 3, cv2.GC_INIT_WITH_RECT)
                alpha = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
            except cv2.error:
                continue
            inside = alpha[rect[1]:rect[1] + rect[3], rect[0]:rect[0] + rect[2]].mean() / 255
            if not 0.15 <= inside <= 0.80:  # GrabCut failed or kept the whole box: skip, a hard rectangle teaches artifacts
                continue
            out.append((patch, alpha))
    return out


def paste(bg, rows, crop, alpha, label):
    H, W = bg.shape[:2]
    ch, cw = crop.shape[:2]
    target_h = random.uniform(0.15, 0.55) * H if label != "cable" else random.uniform(0.06, 0.25) * H
    s = target_h / ch
    nw, nh = max(8, int(cw * s)), max(8, int(ch * s))
    if nw >= W or nh >= H:
        return None
    crop = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_AREA)
    a = cv2.resize(alpha, (nw, nh), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
    a = cv2.GaussianBlur(a, (5, 5), 0)[..., None]
    crop = np.clip(crop.astype(np.float32) * random.uniform(0.7, 1.15), 0, 255)
    # cables go low (floor), glass doors/towels anywhere vertical-ish
    y = random.randint(int(0.55 * H), H - nh) if label == "cable" and H - nh > 0.55 * H else random.randint(0, H - nh)
    x = random.randint(0, W - nw)
    roi = bg[y:y + nh, x:x + nw].astype(np.float32)
    bg[y:y + nh, x:x + nw] = (roi * (1 - a) + crop * a).astype(np.uint8)
    ys, xs = np.nonzero(a[..., 0] > 0.5)
    if len(xs) < 20:
        return None
    bx0, by0, bx1, by1 = x + xs.min(), y + ys.min(), x + xs.max(), y + ys.max()
    rows.append(f"{ID[label]} {(bx0 + bx1) / 2 / W:.6f} {(by0 + by1) / 2 / H:.6f} {(bx1 - bx0) / W:.6f} {(by1 - by0) / H:.6f}")
    return bg


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    sources = {
        "towel": crops_from_yolo("ext", "towel", 600) + crops_from_yolo("train", "towel", 400),
        "glass_door": crops_from_yolo("ext", "glass_door", 800),
        "cable": crops_from_yolo("ext", "cable", 600, min_side=24) + crops_from_yolo("train", "cable", 300, min_side=24),
    }
    print({k: len(v) for k, v in sources.items()})
    bgs = sorted(p for sub in ("home2b", "chr_hand", "train_home2") for p in (Y / "images" / sub).glob("*.jpg"))
    print(len(bgs), "real-home backgrounds")
    for kind in ("images", "labels"):
        (Y / kind / "paste").mkdir(parents=True, exist_ok=True)
    made = 0
    while made < n:
        bgp = random.choice(bgs)
        sub = bgp.parent.name
        bg = np.array(Image.open(bgp).convert("RGB"))
        lf = Y / "labels" / sub / f"{bgp.stem}.txt"
        rows = [r for r in (lf.read_text().splitlines() if lf.exists() else []) if r.strip()]
        k = random.choice([1, 1, 2])
        ok = False
        for _ in range(k):
            label = random.choice(["towel", "glass_door", "cable", "cable"])
            if not sources[label]:
                continue
            crop, alpha = random.choice(sources[label])
            if random.random() < 0.5:
                crop, alpha = crop[:, ::-1].copy(), alpha[:, ::-1].copy()
            r = paste(bg, rows, crop, alpha, label)
            if r is not None:
                bg, ok = r, True
        if not ok:
            continue
        name = f"paste__{made:05d}"
        Image.fromarray(bg).save(Y / "images" / "paste" / f"{name}.jpg", quality=90)
        (Y / "labels" / "paste" / f"{name}.txt").write_text("\n".join(rows))
        made += 1
    print("made", made)


if __name__ == "__main__":
    main()
