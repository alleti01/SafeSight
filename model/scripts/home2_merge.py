"""Merge Grounding DINO + YOLO-World pre-labels for the second home, render review sheets, and (after review)
write the approved boxes as a YOLO split for training.

  home2_merge.py sheets   -> data/labeling/home2_candidates.json + numbered review sheets (12 frames each)
  home2_merge.py write    -> data/yolo/{images,labels}/{train_home2,val_home2}  (val = held-out videos)
Review file: data/labeling/review_home2.txt, lines "frame_index | keep box numbers | relabels n=label"
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / "data" / "labeling"
FR = ROOT / "data" / "frames" / "train_home2"
SHEETS = Path("/private/tmp/claude-501/-Users-abhijandyala-Desktop-SafeSight/c820ba87-384e-4c16-9754-fdaea120b99b/scratchpad/home2")
LABELS = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable", "floor_clutter", "bin",
          "bed", "sofa", "chair", "table", "door", "window", "glass_door"]
SHORT = {"rug": "rug", "toilet": "toil", "toilet_roll_holder": "tp", "towel": "towl", "mirror": "mirr",
         "stairs": "stair", "cable": "cabl", "floor_clutter": "clut", "bin": "bin", "bed": "bed", "sofa": "sofa",
         "chair": "chr", "table": "tbl", "door": "door", "window": "win", "glass_door": "glass"}
VAL_VIDEOS = {"IMG_8273", "IMG_8274"}  # held out to pick the best epoch on in-domain frames (bathroom stays in train)


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


def merged():
    gd = {t["data"]["file"]: t for t in json.load(open(LAB / "home2_gdino.json"))}
    wd = json.load(open(LAB / "home2_world.json"))
    out = {}
    for f in sorted(gd):
        W, H = Image.open(FR / f).size
        boxes = []
        for r in gd[f]["predictions"][0]["result"]:
            v = r["value"]
            x0, y0 = v["x"] * W / 100, v["y"] * H / 100
            boxes.append([v["rectanglelabels"][0], x0, y0, x0 + v["width"] * W / 100, y0 + v["height"] * H / 100, r["score"]])
        for lab, x0, y0, x1, y1, s in wd.get(f, []):
            if all(not (b[0] == lab and iou(b[1:5], [x0, y0, x1, y1]) > 0.5) for b in boxes):
                boxes.append([lab, x0, y0, x1, y1, s])
        out[f] = boxes
    return out


def sheets():
    m = merged()
    json.dump(m, open(LAB / "home2_candidates.json", "w"))
    SHEETS.mkdir(parents=True, exist_ok=True)
    F, FS = ImageFont.load_default(size=40), ImageFont.load_default(size=24)
    allf = sorted(m)
    idx = list(range(0, len(allf), 2))  # every second frame: neighbours at 4 fps are near-duplicates
    TW, TH, C = 330, 587, 6
    for s in range(0, len(idx), 12):
        sheet = Image.new("RGB", (C * TW, 2 * (TH + 28)), "white")
        dr = ImageDraw.Draw(sheet)
        for k, gi in enumerate(idx[s:s + 12]):
            f = allf[gi]
            im = Image.open(FR / f).convert("RGB")
            d = ImageDraw.Draw(im)
            for n, (lab, x0, y0, x1, y1, sc) in enumerate(m[f]):
                col = (255, 40, 40) if n % 3 == 0 else (30, 120, 255) if n % 3 == 1 else (20, 170, 60)
                d.rectangle([x0, y0, x1, y1], outline=col, width=6)
                tag = f"{n}{SHORT[lab]}"
                tx, ty = max(0, x0 + 4), max(0, y0 + 4 + 46 * (n % 2))
                d.rectangle([tx - 3, ty - 2, tx + 24 * len(tag), ty + 44], fill=col)
                d.text((tx, ty), tag, fill="white", font=F)
            im = im.resize((TW - 6, TH - 6))
            x, y = (k % C) * TW, (k // C) * (TH + 28)
            dr.text((x + 4, y + 2), f"#{gi}", fill="black", font=FS)
            sheet.paste(im, (x + 3, y + 28))
        sheet.save(SHEETS / f"h{s // 12:02d}.jpg", quality=82)
    print(len(idx), "frames to review,", sum(len(m[allf[i]]) for i in idx), "candidate boxes,", (len(idx) + 11) // 12, "sheets")


def write():
    m = json.load(open(LAB / "home2_candidates.json"))
    files = sorted(m)
    dec = {}
    for line in open(LAB / "review_home2.txt"):
        if line.startswith("#") or not line.strip():
            continue
        i, keep, rel = [p.strip() for p in line.split("|")]
        dec[int(i)] = ({int(x) for x in keep.split(",")} if keep != "-" else set(),
                       dict(x.split("=") for x in rel.split(",")) if rel != "-" else {})
    # only reviewed frames are used
    yolo = ROOT / "data" / "yolo"
    n_box = 0
    for i, f in enumerate(files):
        if i not in dec:
            continue
        keep, rel = dec[i]
        split = "val_home2" if f.split("__")[1].rsplit("_f", 1)[0] in VAL_VIDEOS else "train_home2"
        (yolo / "images" / split).mkdir(parents=True, exist_ok=True)
        (yolo / "labels" / split).mkdir(parents=True, exist_ok=True)
        im = Image.open(FR / f)
        W, H = im.size
        im.save(yolo / "images" / split / f, quality=92)
        lines = []
        for n, (lab, x0, y0, x1, y1, sc) in enumerate(m[f]):
            if n not in keep:
                continue
            lab = rel.get(str(n), lab)
            lines.append(f"{LABELS.index(lab)} {(x0 + x1) / 2 / W:.6f} {(y0 + y1) / 2 / H:.6f} {(x1 - x0) / W:.6f} {(y1 - y0) / H:.6f}")
        n_box += len(lines)
        (yolo / "labels" / split / f"{Path(f).stem}.txt").write_text("\n".join(lines))
    print(f"wrote {len(dec)} frames, {n_box} boxes")


if __name__ == "__main__":
    {"sheets": sheets, "write": write}[sys.argv[1]]()
