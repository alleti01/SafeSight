"""Candidate boxes for hand review: the UNION of three models' guesses (run 5, untrained Grounding DINO,
untrained YOLO-World), merged per label (same label, IoU > 0.55 -> one box). Review sheets number every box.

  charades_candidates.py candidates   -> data/ext/charades/hand_candidates.json
  charades_candidates.py sheets       -> numbered review sheets (scratchpad/chr_review/)
  charades_candidates.py write        -> data/yolo/{images,labels}/chr_hand from review_chr.txt
Review file lines: "<frame index> | <keep box numbers or -> | <relabels n=label or ->"
"""
import json
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent))
import evaluate as ev  # noqa: E402

import os
C = Path(os.environ.get("CAND_DIR", ROOT / "data" / "ext" / "charades"))   # holds candidates json + review file
FR = Path(os.environ.get("CAND_FRAMES", C / "hand"))
PREFIX = os.environ.get("CAND_PREFIX", "chrh")
OUTSPLIT = os.environ.get("CAND_SPLIT", "chr_hand")
SHEETS = Path(os.environ.get("CAND_SHEETS", "/private/tmp/claude-501/-Users-abhijandyala-Desktop-SafeSight/c820ba87-384e-4c16-9754-fdaea120b99b/scratchpad/chr_review"))
SHORT = {"rug": "rug", "toilet": "toil", "toilet_roll_holder": "tp", "towel": "towl", "mirror": "mirr", "stairs": "stair",
         "cable": "cabl", "floor_clutter": "clut", "bin": "bin", "bed": "bed", "sofa": "sofa", "chair": "chr",
         "table": "tbl", "door": "door", "window": "win", "glass_door": "glass"}


def candidates():
    files = sorted(f.name for f in FR.glob("*.jpg"))
    ev.FRAMES = FR
    ev.PROMPTS["eval_threshold"] = 0.30
    allp = {f: [] for f in files}
    for preds in (ev.predict_yolo(ROOT / "runs/run5_world/weights/best.pt", files)[0],
                  ev.predict_yolo(ROOT / "weights/yolov8l-worldv2.pt", files)[0],
                  ev.predict_gdino(files)[0]):
        for f in files:
            allp[f] += [(l, b, s) for l, b, s in preds[f] if s >= 0.30]
    out = {}
    for f in files:
        kept = []
        for l, b, s in sorted(allp[f], key=lambda x: -x[2]):
            if all(not (l == k[0] and ev.iou(b, k[1]) > 0.55) for k in kept):
                kept.append((l, b, s))
        out[f] = [[l, *b, round(s, 2)] for l, b, s in kept]
    json.dump(out, open(C / "hand_candidates.json", "w"))
    print(len(out), "frames,", sum(len(v) for v in out.values()), "candidate boxes")


def sheets():
    m = json.load(open(C / "hand_candidates.json"))
    files = sorted(m)
    SHEETS.mkdir(parents=True, exist_ok=True)
    FS = ImageFont.load_default(size=22)
    TW, TH, COLS = (480, 360, 4) if os.environ.get("CAND_PORTRAIT") != "1" else (320, 569, 6)
    for s in range(0, len(files), 12):
        rows = (12 + COLS - 1) // COLS
        sheet = Image.new("RGB", (COLS * TW, rows * (TH + 26)), "white")
        dr = ImageDraw.Draw(sheet)
        for k, f in enumerate(files[s:s + 12]):
            im = Image.open(FR / f).convert("RGB")
            W, H = im.size
            d = ImageDraw.Draw(im)
            fs = max(22, W // 18)   # scale labels to the frame so they stay readable after shrinking
            F = ImageFont.load_default(size=fs)
            for n, (lab, x0, y0, x1, y1, sc) in enumerate(m[f]):
                col = [(255, 40, 40), (30, 120, 255), (20, 170, 60), (230, 140, 0)][n % 4]
                d.rectangle([x0, y0, x1, y1], outline=col, width=max(3, W // 200))
                tag = f"{n}{SHORT[lab]}"
                tx, ty = max(0, x0 + 2), max(0, y0 + 2 + int(fs * 1.05) * (n % 3))
                d.rectangle([tx - 2, ty - 1, tx + int(fs * 0.62) * len(tag), ty + fs + 2], fill=col)
                d.text((tx, ty - 2), tag, fill="white", font=F)
            im = im.resize((TW - 6, TH - 6))
            x, y = (k % COLS) * TW, (k // COLS) * (TH + 26)
            dr.text((x + 4, y + 2), f"#{s + k}  {f}", fill="black", font=FS)
            sheet.paste(im, (x + 3, y + 26))
        sheet.save(SHEETS / f"c{s // 12:02d}.jpg", quality=82)
    print((len(files) + 11) // 12, "sheets")


def write():
    m = json.load(open(C / "hand_candidates.json"))
    files = sorted(m)
    I, L = ROOT / "data/yolo/images" / OUTSPLIT, ROOT / "data/yolo/labels" / OUTSPLIT
    I.mkdir(parents=True, exist_ok=True)
    L.mkdir(parents=True, exist_ok=True)
    n_img = n_box = 0
    for line in open(C / os.environ.get("CAND_REVIEW", "review_chr.txt")):
        if line.startswith("#") or not line.strip():
            continue
        i, keep, rel = [p.strip() for p in line.split("|")]
        f = files[int(i)]
        keep = {int(x) for x in keep.split(",")} if keep != "-" else set()
        rel = dict(x.split("=") for x in rel.split(",")) if rel != "-" else {}
        im = Image.open(FR / f)
        W, H = im.size
        lines = []
        for n, (lab, x0, y0, x1, y1, sc) in enumerate(m[f]):
            if n in keep:
                lab = rel.get(str(n), lab)
                lines.append(f"{ev.LABELS16.index(lab)} {(x0 + x1) / 2 / W:.6f} {(y0 + y1) / 2 / H:.6f} {(x1 - x0) / W:.6f} {(y1 - y0) / H:.6f}")
        im.save(I / f"{PREFIX}__{f}", quality=92)
        (L / f"{PREFIX}__{Path(f).stem}.txt").write_text("\n".join(lines))
        n_img += 1
        n_box += len(lines)
    print(f"wrote {n_img} frames, {n_box} boxes")


if __name__ == "__main__":
    globals()[sys.argv[1]]()
