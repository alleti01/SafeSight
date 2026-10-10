"""Convert the real-home / targeted external datasets into YOLO images+labels with our 16 labels.

Output: data/yolo/images/ext/<prefix>__<id>.jpg, data/yolo/labels/ext/<...>.txt  (long side <= 1024)
        data/ext/converted_<source>.json  {"images": n, "boxes": {label: n}, "covers": [...]}
Each source only labels some of our classes ("covers"); fill_missing_boxes.py fills the rest later.

Usage: convert_ext.py trans10k | robot6000 | phele | adl | sun | ade_full
"""
import io
import json
import sys
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / "data" / "ext"
OUT_I = ROOT / "data" / "yolo" / "images" / "ext"
OUT_L = ROOT / "data" / "yolo" / "labels" / "ext"
LABELS = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable", "floor_clutter", "bin",
          "bed", "sofa", "chair", "table", "door", "window", "glass_door"]
ID = {n: i for i, n in enumerate(LABELS)}
MAX_SIDE = 1024


def save(name, im, boxes):
    """im: PIL image; boxes: [(label, x0, y0, x1, y1)] in that image's pixels."""
    OUT_I.mkdir(parents=True, exist_ok=True)
    OUT_L.mkdir(parents=True, exist_ok=True)
    im = im.convert("RGB")
    W, H = im.size
    lines = []
    for lab, x0, y0, x1, y1 in boxes:
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
        if x1 - x0 < 3 or y1 - y0 < 3:
            continue
        lines.append(f"{ID[lab]} {(x0 + x1) / 2 / W:.6f} {(y0 + y1) / 2 / H:.6f} {(x1 - x0) / W:.6f} {(y1 - y0) / H:.6f}")
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    im.save(OUT_I / f"{name}.jpg", quality=90)
    (OUT_L / f"{name}.txt").write_text("\n".join(lines))
    return [LABELS[int(l.split()[0])] for l in lines]


def mask_boxes(mask, label, min_frac=0.003):
    H, W = mask.shape
    n, _, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    return [(label, x, y, x + w, y + h) for x, y, w, h, a in stats[1:] if a >= min_frac * H * W]


def report(source, n, counts, covers):
    json.dump({"images": n, "boxes": dict(counts), "covers": covers}, open(EXT / f"converted_{source}.json", "w"), indent=1)
    print(f"{source}: {n} images, boxes {dict(counts.most_common())}")


# ---------- Trans10K-v2: glass doors (and windows) ----------
def trans10k():
    import pyarrow.parquet as pq
    COLORS = {(120, 120, 120): "glass_door", (204, 255, 4): "window"}
    n, counts = 0, Counter()
    for f in sorted((EXT / "trans10k" / "data").glob("*.parquet")):
        pf = pq.ParquetFile(f)
        for rg in range(pf.num_row_groups):
            for k, r in enumerate(pf.read_row_group(rg).to_pylist()):
                m = np.array(Image.open(io.BytesIO(r["mask"]["bytes"])).convert("RGB"))
                boxes = []
                for col, lab in COLORS.items():
                    hit = np.all(np.abs(m.astype(int) - col) <= 3, axis=-1)
                    if hit.any():
                        boxes += mask_boxes(hit, lab)
                if not any(b[0] == "glass_door" for b in boxes):
                    continue  # only glass-door images: windows are plentiful elsewhere
                im = Image.open(io.BytesIO(r["image"]["bytes"]))
                counts.update(save(f"t10k__{f.stem}_{rg}_{k}", im, boxes))
                n += 1
    report("trans10k", n, counts, ["glass_door", "window"])



# ---------- PHELE: vertical phone photos of elderly people's homes (YOLO format) ----------
def phele():
    names = (EXT / "phele" / "PHELE" / "classes.txt").read_text().split("\n")
    MAP = {"wires": "cable", "steps": "stairs", "carpets": "rug", "Chair": "chair"}
    n, counts = 0, Counter()
    for split in ("train", "val", "test"):
        for img in sorted((EXT / "phele" / "PHELE" / split / "images").glob("*.jpg")):
            lab = img.parent.parent / "labels" / f"{img.stem}.txt"
            im = Image.open(img)
            W, H = im.size
            boxes = []
            for line in (lab.read_text().splitlines() if lab.exists() else []):
                p = line.split()
                if not p:
                    continue
                m = MAP.get(names[int(p[0])].strip())
                if m:
                    xc, yc, w, h = map(float, p[1:5])
                    boxes.append((m, (xc - w / 2) * W, (yc - h / 2) * H, (xc + w / 2) * W, (yc + h / 2) * H))
            counts.update(save(f"phele__{split}_{img.stem}", im, boxes))
            n += 1
    report("phele", n, counts, ["cable", "stairs", "rug", "chair"])


# ---------- robot6000: floor-level robot-vacuum photos in real homes (VOC xml) ----------
def robot6000():
    import xml.etree.ElementTree as ET
    MAP = {"trashcan": "bin", "trash can": "bin", "wire": "cable", "slippers": "floor_clutter",
           "socks": "floor_clutter", "carpet": "rug", "sofa": "sofa", "bed": "bed", "table": "table",
           "stool": "chair", "closestool": "toilet", "closetool": "toilet"}
    root = EXT / "robot6000"
    n, counts = 0, Counter()
    for xml in sorted((root / "Annotations").glob("*.xml")):
        t = ET.parse(xml).getroot()
        img = root / "JPEGImages" / f"{xml.stem}.jpg"
        if not img.exists():
            continue
        boxes = []
        for o in t.findall("object"):
            m = MAP.get(o.findtext("name", "").strip())
            if m:
                b = o.find("bndbox")
                boxes.append((m, *(float(b.findtext(k)) for k in ("xmin", "ymin", "xmax", "ymax"))))
        counts.update(save(f"robot__{xml.stem}", Image.open(img), boxes))
        n += 1
    report("robot6000", n, counts, ["bin", "cable", "floor_clutter", "rug", "sofa", "bed", "table", "chair", "toilet"])



# ---------- full ADE20K (HF 1aurent/ADE20K), home_or_hotel scenes, train split only ----------
ADE_MAP = {
    "door": "door", "double door": "door", "sliding door": "glass_door",
    "windowpane, window": "window", "rug, carpet, carpeting": "rug", "mirror": "mirror", "towel": "towel",
    "toilet, can, commode, crapper, pot, potty, stool, throne": "toilet",
    "toilet tissue, toilet paper, bathroom tissue": "toilet_roll_holder", "toilet paper holder": "toilet_roll_holder",
    "ashcan, trash can, garbage can, wastebin, ash bin, ash-bin, ashbin, dustbin, trash barrel, trash bin": "bin",
    "sofa, couch, lounge": "sofa", "armchair": "sofa", "chair": "chair", "swivel chair": "chair", "stool": "chair",
    "rocking chair, rocker": "chair", "table": "table", "coffee table, cocktail table": "table", "desk": "table",
    "console table, console": "table", "bed": "bed", "step, stair": "stairs", "stairway, staircase": "stairs",
    "stairs, steps": "stairs",
}
ADE_CLUTTER = {"box", "shoe", "bag", "apparel, wearing apparel, dress, clothes", "plaything, toy", "gym shoe, sneaker, tennis shoe",
               "bag, handbag, pocketbook, purse", "bag, traveling bag, travelling bag, grip, suitcase", "basket, handbasket"}


def ade_full():
    import pyarrow.parquet as pq
    n, counts = 0, Counter()
    for f in sorted((EXT / "ade20k_full" / "data").glob("train-*.parquet")):
        pf = pq.ParquetFile(f)
        for rg in range(pf.num_row_groups):
            for r in pf.read_row_group(rg).to_pylist():
                if "home_or_hotel" not in r["folder"]:
                    continue
                im = Image.open(io.BytesIO(r["image"]["bytes"]))
                W, H = im.size
                boxes = []
                for o in r["objects"]:
                    if o["parts"]["part_level"] != 0 or not o["polygon"]["x"]:
                        continue
                    xs, ys = o["polygon"]["x"], o["polygon"]["y"]
                    b = (min(xs), min(ys), max(xs), max(ys))
                    lab = ADE_MAP.get(o["name"])
                    if lab is None and o["name"] in ADE_CLUTTER and b[3] >= 0.6 * H:
                        lab = "floor_clutter"  # loose items low in the frame = on the floor
                    if lab and (b[2] - b[0]) * (b[3] - b[1]) >= 0.0005 * W * H:
                        boxes.append((lab, *b))
                counts.update(save(f"adef__{Path(r['filename']).stem}", im, boxes))
                n += 1
    report("ade_full", n, counts, sorted(set(ADE_MAP.values()) | {"floor_clutter"}))



# ---------- SUN RGB-D: real rooms (Kinect/Xtion/RealSense RGB), 2D boxes [x, y, w, h] ----------
SUN_MAP = {"chair": "chair", "stool": "chair", "sofa_chair": "sofa", "sofa": "sofa", "table": "table", "desk": "table",
           "endtable": "table", "end_table": "table", "side_table": "table", "coffee_table": "table",
           "dining_table": "table", "door": "door", "bed": "bed", "garbage_bin": "bin", "recycle_bin": "bin",
           "toilet": "toilet", "mirror": "mirror", "dresser_mirror": "mirror", "towel": "towel",
           "toilet_paper": "toilet_roll_holder", "window": "window"}
SUN_CLUTTER = {"box", "bag", "cloth", "shoes", "shoe", "toy", "toys", "paper_bag", "plastic_bag", "stuffed_toy", "basket"}
SUN_HOME = {"door", "bin", "toilet", "mirror", "towel", "sofa", "bed", "window", "toilet_roll_holder", "floor_clutter"}


def sun():
    import scipy.io as sio
    meta = sio.loadmat(EXT / "sun_meta2d.mat", squeeze_me=True, struct_as_record=False)["SUNRGBDMeta2DBB"]
    n, counts = 0, Counter()
    for e in meta:
        img = EXT / "sun" / e.sequenceName / "image" / e.rgbname
        if not img.exists():
            continue
        im = Image.open(img)
        W, H = im.size
        g = e.groundtruth2DBB
        g = g if hasattr(g, "__len__") else [g]
        boxes = []
        for b in g:
            name = str(b.classname).strip().lower()
            x, y, w, h = [float(v) for v in b.gtBb2D]
            lab = SUN_MAP.get(name)
            if lab is None and name in SUN_CLUTTER and y + h >= 0.6 * H:
                lab = "floor_clutter"
            if lab:
                boxes.append((lab, x, y, x + w, y + h))
        if not {b[0] for b in boxes} & SUN_HOME:
            continue  # office/classroom photos with only chairs and desks
        counts.update(save(f"sun__{e.sequenceName.replace('/', '_')}", im, boxes))
        n += 1
    report("sun", n, counts, sorted(set(SUN_MAP.values()) | {"floor_clutter"}))



# ---------- Roboflow Universe sets picked by eye (Oct 10 evening), YOLO export ----------
CL = "floor_clutter"
RF2 = {  # slug: ({source class: our label}, max images or None)
    "jiwoo-qcx21/lgdata": ({"Electrical wire": "cable", "Socks": CL, "Shoes": CL}, None),
    "hoarding-support/clutter-dataset-labeled": ({k: CL for k in ["laundry", "box", "trash", "carrier_bag", "toys", "clothes", "shoes", "bag", "paper", "books"]}, None),
    "custom-object-detection-gjcsk/assistive-object-detection-2-d00fb": ({"trip_hazard": CL}, None),
    "sock-and-underwear-detection/roomba-claw-mod-polygon": ({"Sock": CL, "Underwear": CL, "Shoe": CL, "Book": CL, "Cord": "cable"}, None),
    "project-icngw/sock-detection": ({"Sock": CL}, 800),
    "cableando/cables-p2yfn": ({"cable": "cable"}, 600),
    "nafiz-fahad-1otyg/indoor-objects-1epjv": ({"bin": "bin", "door": "door"}, None),
    "habibas-workspace-clali/project-iyibv": ({"trashbin": "bin"}, None),
    "brian-5ds8w/glassdoor-3lply": ({"glass": "glass_door"}, None),
    "rick-l7ot7/door-bhrek": ({"door": "door"}, None),
    "biswajeet-panda/door-open-closed-relabel": ({"door_open": "door", "door_closed": "door"}, None),
    "annotation-4rrq6/door-xwnuj": ({"Door internal": "door", "Main-Door": "door"}, None),
    "momo-nutwk/toilet-paper-wehrw": ({"Full": "toilet_roll_holder", "Empty": "toilet_roll_holder"}, None),
}


def roboflow2():
    import os, random, urllib.request
    import yaml
    from dotenv import load_dotenv
    from roboflow import Roboflow
    load_dotenv(ROOT / ".env")
    key = os.environ["ROBOFLOW_API_KEY"]
    rf = Roboflow(api_key=key)
    covers = {}
    total, counts = 0, Counter()
    for slug, (cmap, cap) in RF2.items():
        ws, proj = slug.split("/")
        dest = EXT / "rf2" / f"{ws}__{proj}"
        try:
            if not dest.exists():
                meta = json.load(urllib.request.urlopen(f"https://api.roboflow.com/{slug}?api_key={key}"))
                ver = max(int(v["id"].split("/")[-1]) for v in meta["versions"])
                rf.workspace(ws).project(proj).version(ver).download("yolov8", location=str(dest))
            names = yaml.safe_load(open(dest / "data.yaml"))["names"]
        except Exception as e:
            print(f"SKIP {slug}: {e}")
            continue
        imgs = sorted(p for p in dest.rglob("images/*") if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
        # keep one augmented copy per original
        seen, uniq = set(), []
        for p in imgs:
            o = p.stem.split(".rf.")[0]
            if o not in seen:
                seen.add(o)
                uniq.append(p)
        random.Random(0).shuffle(uniq)
        n = 0
        for p in uniq[:cap] if cap else uniq:
            im = Image.open(p)
            W, H = im.size
            boxes = []
            for line in (p.parent.parent / "labels" / f"{p.stem}.txt").read_text().splitlines():
                q = line.split()
                if not q:
                    continue
                lab = cmap.get(names[int(q[0])] if isinstance(names, list) else names[int(q[0])])
                if lab is None:
                    continue
                c = list(map(float, q[1:]))
                if len(c) == 4:
                    xc, yc, w, h = c
                    x0, y0, x1, y1 = xc - w / 2, yc - h / 2, xc + w / 2, yc + h / 2
                else:
                    xs, ys = c[0::2], c[1::2]
                    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
                boxes.append((lab, x0 * W, y0 * H, x1 * W, y1 * H))
            counts.update(save(f"rf2-{proj}__{n:05d}", im, boxes))
            n += 1
        covers[proj] = sorted(set(cmap.values()))
        total += n
        print(f"{slug}: {n} images")
    report("roboflow2", total, counts, covers)



# ---------- ADL: chest-camera video in real homes; boxes every 30th frame in 640x480 ----------
ADL_MAP = {"door": "door", "towel": "towel", "trash_can": "bin", "bed": "bed"}
ADL_LOW = {"shoes", "shoe", "basket", "cloth"}  # floor_clutter only when low in the frame


def adl(every=3):
    A = EXT / "adl"
    by_frame = {}
    for f in sorted((A / "ADL_annotations" / "object_annotation").glob("object_annot_P_*.txt")):
        P = f.stem.replace("object_annot_", "")
        for line in f.read_text().splitlines():
            q = line.split()
            if len(q) < 8:
                continue
            by_frame.setdefault((P, int(q[5])), []).append((q[7], *map(float, q[1:5])))
    n, counts = 0, Counter()
    frames = sorted((A / "frames").glob("*.jpg"))
    for k, img in enumerate(frames):
        if k % every:
            continue
        P, fr = img.stem.rsplit("_", 1)[0], int(img.stem.rsplit("_", 1)[1])
        boxes = []
        for name, x0, y0, x1, y1 in by_frame.get((P, fr), []):
            lab = ADL_MAP.get(name) or ("floor_clutter" if name in ADL_LOW and y1 >= 0.6 * 480 else None)
            if lab:
                boxes.append((lab, x0, y0, x1, y1))
        counts.update(save(f"adl__{img.stem}", Image.open(img), boxes))
        n += 1
    report("adl", n, counts, ["door", "towel", "bin", "bed", "floor_clutter"])


if __name__ == "__main__":
    globals()[sys.argv[1]]()
