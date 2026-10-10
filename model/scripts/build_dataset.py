"""Phase 2.1: merge Open Images, ADE20K (home scenes) and Roboflow into one YOLO dataset with our 13 labels.

Output: model/data/yolo/
  images/{train,val}/<source>__<id>.jpg   (resized so the long side is at most 1024 px)
  labels/{train,val}/<source>__<id>.txt   (class x_center y_center width height, all 0-1)
  data.yaml, manifest.csv, counts.txt
The test split (our own home) is added later in Phase 2.3.
"""
import hashlib
import json
import random
import shutil
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import imagehash
import numpy as np
import pandas as pd
import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "yolo"

LABELS = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable",
          "floor_clutter", "bin", "bed", "sofa", "chair", "table"]
ID = {n: i for i, n in enumerate(LABELS)}
MAX_SIDE = 1024
VAL_FRACTION = 0.10
MAX_BACKGROUND_FRACTION = 0.08  # images with none of our objects, kept as negatives
random.seed(0)

# ---------- source class -> our label ----------
OPEN_IMAGES = {
    "Toilet": "toilet", "Toilet paper": "toilet_roll_holder", "Towel": "towel", "Mirror": "mirror",
    "Stairs": "stairs", "Waste container": "bin", "Bed": "bed", "Sofa bed": "bed", "Couch": "sofa",
    "Studio couch": "sofa", "Loveseat": "sofa", "Chair": "chair", "Table": "table",
    "Coffee table": "table", "Kitchen & dining room table": "table",
}
# ADE20K objectInfo150 index (= pixel value in the annotation PNG) -> our label
ADE = {29: "rug", 66: "toilet", 82: "towel", 28: "mirror", 54: "stairs", 60: "stairs", 122: "stairs",
       139: "bin", 8: "bed", 24: "sofa", 31: "sofa", 20: "chair", 76: "chair", 16: "table", 65: "table"}
ADE_HOME_SCENES = {"bedroom", "living_room", "bathroom", "kitchen", "dining_room", "corridor", "home_office",
                   "attic", "childs_room", "staircase", "basement", "hallway", "kitchenette",
                   "entrance_hall", "entranceway_indoor"}
ADE_MIN_AREA = 0.001  # drop pieces smaller than 0.1% of the image
ROBOFLOW = {
    "mirror": "mirror", "towel": "towel", "wc": "toilet", "Toilet": "toilet", "Carpet": "rug",
    "carpet": "rug", "cables": "cable", "stairs": "stairs", "Toilet-paper": "toilet_roll_holder",
}
# Messy-home sets: furniture keeps its own label, loose items become floor_clutter, the rest is dropped.
MESSY_CLUTTER = {"book", "bottle", "box", "clothes", "plastic bag", "toy", "bag", "basket", "newspaper",
                 "shoes", "teddy", "remote", "mobile", "glasses", "mouse", "nail"}
MESSY_FURNITURE = {"chair": "chair", "stool": "chair", "table": "table", "bed": "bed", "sofa": "sofa", "mirror": "mirror"}
MESSY_SETS = {"sasya-0ullp__messy-room-y5qsc", "sds-first-workspace__messy-imgs", "superfish-5k9sp__robot-vacuum-cleaner"}
CLUTTER_SET = "hoarding-support__clutter-classes"  # every class except furniture -> floor_clutter
CABLES_APPROVED = DATA / "cable_search" / "approved.json"  # {image path: [[x0, y0, x1, y1], ...]} pixels


def rf_label(dataset, n):
    if dataset == CLUTTER_SET:
        return "floor_clutter" if n != "furniture" else None
    if dataset in MESSY_SETS:
        return MESSY_FURNITURE.get(n) or ("floor_clutter" if n in MESSY_CLUTTER else None)
    return ROBOFLOW.get(n)


def approved_cables():
    """Cable boxes found by Grounding DINO and approved by eye, normalized, keyed by image path."""
    if not CABLES_APPROVED.exists():
        return {}
    out = {}
    for path, boxes in json.load(open(CABLES_APPROVED)).items():
        W, H = Image.open(ROOT / path).size
        out[str(ROOT / path)] = [("cable", (x0 + x1) / 2 / W, (y0 + y1) / 2 / H, (x1 - x0) / W, (y1 - y0) / H)
                                 for x0, y0, x1, y1 in boxes]
    return out
# Cable set: product photos and a lab photo, by index into its sorted image list (checked by eye Oct 10)
CABLE_SET = "bartu-erguven-qpopt__cable-dataset"
CABLE_DROP = {14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 32, 35, 43, 72, 115, 116, 117, 136, 142}


def save(src_img, boxes, name, group, split_hint=None):
    """Resize, write a temp image + label, and return a manifest row. boxes: [(label, xc, yc, w, h)] normalized."""
    im = Image.open(src_img).convert("RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    tmp_img = OUT / "_all" / "images" / f"{name}.jpg"
    im.save(tmp_img, quality=90)
    lines = []
    for lab, xc, yc, w, h in boxes:
        xc, yc = min(max(xc, 0), 1), min(max(yc, 0), 1)
        w, h = min(w, 1), min(h, 1)
        if w > 0.002 and h > 0.002:
            lines.append(f"{ID[lab]} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}")
    (OUT / "_all" / "labels" / f"{name}.txt").write_text("\n".join(lines))
    return {"name": name, "source": name.split("__")[0], "group": group, "split_hint": split_hint,
            "phash": str(imagehash.phash(im)), "n_boxes": len(lines),
            "labels": " ".join(sorted({LABELS[int(l.split()[0])] for l in lines}))}


# ---------- Open Images ----------
def open_images_jobs():
    b = pd.read_csv(DATA / "open-images" / "boxes.csv")
    b = b[b.ClassName.isin(OPEN_IMAGES)]
    grouped = set(b.ImageID[b.IsGroupOf == 1])
    jobs = []
    for img_id, g in b.groupby("ImageID"):
        if img_id in grouped:
            continue
        boxes = [(OPEN_IMAGES[r.ClassName], (r.XMin + r.XMax) / 2, (r.YMin + r.YMax) / 2,
                  r.XMax - r.XMin, r.YMax - r.YMin) for r in g.itertuples()]
        jobs.append((DATA / "open-images" / "images" / f"{img_id}.jpg", boxes, f"oi__{img_id}", f"oi__{img_id}"))
    print(f"Open Images: {len(jobs)} images kept, {len(grouped)} dropped for group boxes")
    return jobs


# ---------- ADE20K ----------
def ade_boxes(ann_path):
    m = np.array(Image.open(ann_path))
    H, W = m.shape
    boxes = []
    for v in np.unique(m):
        if int(v) not in ADE:
            continue
        mask = cv2.dilate((m == v).astype(np.uint8), np.ones((5, 5), np.uint8))  # join tiny gaps
        n, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        for x, y, w, h, area in stats[1:]:
            if area >= ADE_MIN_AREA * H * W:
                boxes.append((ADE[int(v)], (x + w / 2) / W, (y + h / 2) / H, w / W, h / H))
    return boxes


def ade_jobs():
    root = DATA / "ade20k" / "ADEChallengeData2016"
    scenes = dict(l.split() for l in open(root / "sceneCategories.txt"))
    jobs = []
    for i, s in scenes.items():
        if s not in ADE_HOME_SCENES:
            continue
        sp = "training" if "_train_" in i else "validation"
        jobs.append(("ade", root / "images" / sp / f"{i}.jpg", root / "annotations" / sp / f"{i}.png", f"ade__{i}"))
    print(f"ADE20K: {len(jobs)} home-scene images")
    return jobs


# ---------- Roboflow ----------
def rf_jobs():
    jobs = []
    for d in sorted((DATA / "roboflow").iterdir()):
        if not d.is_dir():
            continue
        names = yaml.safe_load(open(d / "data.yaml"))["names"]
        imgs = sorted(p for p in d.rglob("images/*") if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
        for k, img in enumerate(imgs):
            if d.name == CABLE_SET and k in CABLE_DROP:
                continue
            boxes = []
            for line in (img.parent.parent / "labels" / f"{img.stem}.txt").read_text().splitlines():
                parts = line.split()
                if not parts:
                    continue
                lab = rf_label(d.name, names[int(parts[0])])
                if lab is None:
                    continue
                c = list(map(float, parts[1:]))
                if len(c) == 4:
                    boxes.append((lab, *c))
                else:  # polygon -> box
                    xs, ys = c[0::2], c[1::2]
                    boxes.append((lab, (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, max(xs) - min(xs), max(ys) - min(ys)))
            orig = img.stem.split(".rf.")[0]  # augmented copies share this prefix
            short = d.name.split("__")[1]
            uid = hashlib.md5(str(img).encode()).hexdigest()[:10]
            # Roboflow's own held-out images go to val, except the pasted-wire cable set (not real homes): train only
            hint = "train" if d.name == CABLE_SET else "val" if img.parent.parent.name in ("valid", "test") else None
            jobs.append((img, boxes, f"rf-{short}__{uid}", f"rf-{short}__{orig}", hint))
    print(f"Roboflow: {len(jobs)} images")
    return jobs


# ---------- LVIS (COCO photos) ----------
def lvis_jobs(cables):
    lv = DATA / "lvis"
    jobs = []
    for name, boxes in json.load(open(lv / "selection.json")).items():
        jobs.append((lv / "images" / f"{name}.jpg", [tuple(b) for b in boxes], f"lvis__{name}", f"lvis__{name}"))
    # cable-pool photos join only if a cable box was approved in them
    pool = json.load(open(lv / "cable_pool_boxes.json"))
    n_pool = 0
    for name, boxes in pool.items():
        path = lv / "cable_pool" / f"{name}.jpg"
        if str(path) in cables:
            jobs.append((path, [tuple(b) for b in boxes] + cables[str(path)], f"lvis__{name}", f"lvis__{name}"))
            n_pool += 1
    print(f"LVIS: {len(jobs)} images ({n_pool} from the cable pool)")
    return jobs


def main():
    shutil.rmtree(OUT, ignore_errors=True)  # macOS can drop .DS_Store files in while deleting
    shutil.rmtree(OUT, ignore_errors=True)
    for sub in ("images", "labels"):
        (OUT / "_all" / sub).mkdir(parents=True)

    cables = approved_cables()
    print(f"approved cable boxes: {sum(len(v) for v in cables.values())} in {len(cables)} photos")
    rows = []
    with ThreadPoolExecutor(12) as ex:
        rows += list(ex.map(lambda j: save(*j), open_images_jobs()))
        rows += list(ex.map(lambda j: save(j[1], ade_boxes(j[2]) + cables.get(str(j[1]), []), j[3], j[3]), ade_jobs()))
        rows += list(ex.map(lambda j: save(*j), rf_jobs()))
        rows += list(ex.map(lambda j: save(*j), lvis_jobs(cables)))
    df = pd.DataFrame(rows)

    # near-duplicates across different groups (same perceptual hash): keep the first
    dup = df.duplicated("phash") & ~df.duplicated(["phash", "group"])
    print(f"duplicates across sources/groups removed: {int(dup.sum())}")
    df = df[~dup]

    # cap background images (no boxes)
    bg = df[df.n_boxes == 0]
    keep_bg = int(MAX_BACKGROUND_FRACTION * (df.n_boxes > 0).sum())
    drop_bg = bg.sample(max(len(bg) - keep_bg, 0), random_state=0).index
    df = df.drop(drop_bg)
    print(f"background images kept: {min(len(bg), keep_bg)} (dropped {len(drop_bg)})")

    # split by group so augmented copies never cross train/val; groups with augmented copies go to train
    # Roboflow's own valid/test images go to val; everything else is split by a hash of its group.
    augmented = set(df.group[df.group.duplicated()])
    df["split"] = ["train" if g in augmented or h == "train"
                   else "val" if h == "val"
                   else "val" if int(hashlib.md5(g.encode()).hexdigest(), 16) % 100 < VAL_FRACTION * 100
                   else "train" for g, h in zip(df.group, df.split_hint)]

    for sp in ("train", "val"):
        (OUT / "images" / sp).mkdir(parents=True)
        (OUT / "labels" / sp).mkdir(parents=True)
    for r in df.itertuples():
        (OUT / "_all" / "images" / f"{r.name}.jpg").rename(OUT / "images" / r.split / f"{r.name}.jpg")
        (OUT / "_all" / "labels" / f"{r.name}.txt").rename(OUT / "labels" / r.split / f"{r.name}.txt")
    shutil.rmtree(OUT / "_all", ignore_errors=True)  # Finder may be writing .DS_Store into it

    yaml.safe_dump({"train": "images/train", "val": "images/val", "names": dict(enumerate(LABELS))},
                   open(OUT / "data.yaml", "w"), sort_keys=False)
    df.to_csv(OUT / "manifest.csv", index=False)

    # counts: images and boxes per label per split
    lines = [f"{'label':20}{'train img':>10}{'train box':>10}{'val img':>9}{'val box':>9}"]
    box = {sp: Counter() for sp in ("train", "val")}
    img = {sp: Counter() for sp in ("train", "val")}
    for sp in ("train", "val"):
        for f in (OUT / "labels" / sp).glob("*.txt"):
            cls = [LABELS[int(l.split()[0])] for l in f.read_text().splitlines() if l.strip()]
            box[sp].update(cls)
            img[sp].update(set(cls))
    for l in LABELS:
        lines.append(f"{l:20}{img['train'][l]:10}{box['train'][l]:10}{img['val'][l]:9}{box['val'][l]:9}")
    lines.append(f"\nimages: train {(df.split == 'train').sum()}, val {(df.split == 'val').sum()}")
    lines.append("by source: " + ", ".join(f"{k} {v}" for k, v in df.source.value_counts().items()))
    (OUT / "counts.txt").write_text("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
