"""Pick LVIS v1 (COCO photos) images that strengthen toilet_roll_holder, floor_clutter and rug, and download them.

Rules:
- every image with toilet_tissue (-> toilet_roll_holder)
- every image with bath_mat / doormat / runner (-> rug)
- clutter items (shoes, socks, toys, boxes, bags, newspapers...) only in home photos (the image also has a bed,
  sofa, toilet, bathtub, TV, fridge, lamp, coffee table...), and never a box that sits mostly on a person
  (shoes on feet, bags in hands)
- each chosen image keeps boxes for all our classes LVIS has, to limit missing labels

Output: model/data/lvis/images/*.jpg and model/data/lvis/selection.json  {file: [[label, xc, yc, w, h], ...]}
"""
import json
import time
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LV = ROOT / "data" / "lvis"
(LV / "images").mkdir(parents=True, exist_ok=True)

MAP = {
    "toilet_tissue": "toilet_roll_holder",
    "bath_mat": "rug", "doormat": "rug", "runner_(carpet)": "rug",
    "toilet": "toilet", "mirror": "mirror", "trash_can": "bin",
    "towel": "towel", "bath_towel": "towel", "hand_towel": "towel",
    "bed": "bed", "sofa": "sofa", "armchair": "sofa", "chair": "chair",
    "table": "table", "dining_table": "table", "coffee_table": "table",
}
CLUTTER = {"shoe", "sock", "slipper_(footwear)", "sandal_(type_of_shoe)", "boot", "toy", "teddy_bear", "box",
           "plastic_bag", "newspaper", "duffel_bag", "shopping_bag", "tote_bag"}
HOME = {"bed", "sofa", "armchair", "toilet", "bathtub", "television_set", "refrigerator", "lamp",
        "coffee_table", "bookcase", "wall_socket", "towel_rack", "pillow", "quilt", "bath_mat"}
TRIGGER = {"toilet_tissue", "bath_mat", "doormat", "runner_(carpet)"}
MAX_CLUTTER_IMAGES = 3000


def download(url, dest, tries=4):
    for t in range(tries):
        try:
            urllib.request.urlretrieve(url, dest)
            return
        except OSError:
            if t == tries - 1:
                raise
            time.sleep(2 * (t + 1))


def on_person(b, persons):
    x, y, w, h = b
    for px, py, pw, ph in persons:
        ix = max(0, min(x + w, px + pw) - max(x, px))
        iy = max(0, min(y + h, py + ph) - max(y, py))
        if ix * iy > 0.3 * w * h:
            return True
    return False


selection, urls, counts = {}, {}, Counter()
clutter_images = 0
for split in ("train", "val"):
    d = json.load(open(LV / f"lvis_v1_{split}.json"))
    names = {c["id"]: c["name"] for c in d["categories"]}
    imgs = {i["id"]: i for i in d["images"]}
    by_img = {}
    for a in d["annotations"]:
        by_img.setdefault(a["image_id"], []).append((names[a["category_id"]], a["bbox"]))
    for iid, anns in sorted(by_img.items()):
        present = {n for n, _ in anns}
        is_home = bool(present & HOME)
        wants_clutter = is_home and bool(present & CLUTTER) and clutter_images < MAX_CLUTTER_IMAGES
        if not (present & TRIGGER or wants_clutter):
            continue
        im = imgs[iid]
        W, H = im["width"], im["height"]
        persons = [b for n, b in anns if n == "person"]
        boxes = []
        for n, (x, y, w, h) in anns:
            lab = MAP.get(n)
            if lab is None and n in CLUTTER and is_home and not on_person((x, y, w, h), persons):
                lab = "floor_clutter"
            if lab:
                boxes.append([lab, (x + w / 2) / W, (y + h / 2) / H, w / W, h / H])
        if not boxes:
            continue
        if wants_clutter and not (present & TRIGGER):
            if not any(b[0] == "floor_clutter" for b in boxes):
                continue
            clutter_images += 1
        name = f"{split}_{iid:012d}"
        selection[name] = boxes
        urls[name] = im["coco_url"]
        counts.update({b[0] for b in boxes})
    del d

print(f"selected {len(selection)} images")
print(dict(counts.most_common()))
json.dump(selection, open(LV / "selection.json", "w"))


def fetch(item):
    name, url = item
    dest = LV / "images" / f"{name}.jpg"
    if not dest.exists():
        download(url, dest)


with ThreadPoolExecutor(12) as ex:
    list(ex.map(fetch, urls.items()))
print("downloaded:", len(list((LV / "images").glob("*.jpg"))))

# ---------- cable pool: home photos where cords usually are (no LVIS cable class exists) ----------
# These get searched by scripts/pseudo_label_cables.py; only approved cable boxes are used.
CORD_SPOTS = {"wall_socket", "lamp", "television_set", "laptop_computer", "computer_keyboard", "cellular_telephone"}
MAX_POOL = 2500
pool, pool_boxes = {}, {}
for split in ("train", "val"):
    d = json.load(open(LV / f"lvis_v1_{split}.json"))
    names = {c["id"]: c["name"] for c in d["categories"]}
    imgs = {i["id"]: i for i in d["images"]}
    by_img = {}
    for a in d["annotations"]:
        by_img.setdefault(a["image_id"], []).append((names[a["category_id"]], a["bbox"]))
    for iid, anns in sorted(by_img.items()):
        ns = {n for n, _ in anns}
        name = f"{split}_{iid:012d}"
        if len(pool) < MAX_POOL and name not in selection and ns & HOME and ns & CORD_SPOTS and "person" not in ns:
            pool[name] = imgs[iid]["coco_url"]
            W, H = imgs[iid]["width"], imgs[iid]["height"]
            pool_boxes[name] = [[MAP[n], (x + w / 2) / W, (y + h / 2) / H, w / W, h / H]
                                for n, (x, y, w, h) in anns if n in MAP]
    del d
json.dump(pool_boxes, open(LV / "cable_pool_boxes.json", "w"))
(LV / "cable_pool").mkdir(exist_ok=True)


def fetch_pool(item):
    name, url = item
    dest = LV / "cable_pool" / f"{name}.jpg"
    if not dest.exists():
        download(url, dest)


with ThreadPoolExecutor(12) as ex:
    list(ex.map(fetch_pool, pool.items()))
print("cable pool downloaded:", len(list((LV / "cable_pool").glob("*.jpg"))))

