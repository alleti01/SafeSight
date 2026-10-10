"""Download the Open Images V7 images we need, with boxes for every one of our classes.

Picks up to CAP images per Open Images class from the train split (real photos only,
at least one single-object box), then downloads that set with FiftyOne, loading boxes
for ALL our classes so an image picked for "Toilet" still has its towel boxed.

Output: model/data/open-images/ (FiftyOne layout). Mapping to our 14 labels happens in Phase 2.
"""
import random
import urllib.request
from pathlib import Path

import pandas as pd
import fiftyone.zoo as foz

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "open-images"
CSV_DIR = OUT / "_csv"
CSV_DIR.mkdir(parents=True, exist_ok=True)

BOXES_URL = "https://storage.googleapis.com/openimages/v6/oidv6-train-annotations-bbox.csv"
CLASSES_URL = "https://storage.googleapis.com/openimages/v7/oidv7-class-descriptions-boxable.csv"

# Open Images class -> max images to pick for it. Bathroom items and stairs get the most,
# common furniture less (it is everywhere already).
CAP = {
    "Toilet": 1000,
    "Toilet paper": 1000,
    "Towel": 1000,
    "Mirror": 1000,
    "Waste container": 1000,
    "Stairs": 1000,
    "Bed": 500,
    "Sofa bed": 200,
    "Couch": 500,
    "Studio couch": 200,
    "Loveseat": 200,
    "Chair": 500,
    "Table": 400,
    "Coffee table": 300,
    "Kitchen & dining room table": 300,
}

random.seed(0)


def fetch(url, dest):
    if not dest.exists():
        print("downloading", url)
        urllib.request.urlretrieve(url, dest)
    return dest


classes = pd.read_csv(fetch(CLASSES_URL, CSV_DIR / "classes.csv"), header=None, names=["mid", "name"])
mid_of = {n: m for m, n in zip(classes.mid, classes.name)}
missing = [c for c in CAP if c not in mid_of]
assert not missing, f"not Open Images classes: {missing}"

boxes = pd.read_csv(
    fetch(BOXES_URL, CSV_DIR / "train-boxes.csv"),
    usecols=["ImageID", "LabelName", "IsGroupOf", "IsDepiction"],
)
boxes = boxes[boxes.LabelName.isin(set(mid_of[c] for c in CAP))]
good = boxes[(boxes.IsGroupOf == 0) & (boxes.IsDepiction == 0)]

picked = set()
print(f"{'class':30} {'available':>9} {'picked':>6}")
for name, cap in CAP.items():
    ids = sorted(set(good.ImageID[good.LabelName == mid_of[name]]))
    random.shuffle(ids)
    take = ids[:cap]
    picked.update(take)
    print(f"{name:30} {len(ids):9} {len(take):6}")
print("unique images:", len(picked))

(OUT / "picked_image_ids.txt").write_text("\n".join(sorted(picked)))

# Download only (no FiftyOne database); files land in ~/fiftyone/open-images-v7/train.
foz.download_zoo_dataset(
    "open-images-v7",
    split="train",
    label_types=["detections"],
    classes=list(CAP),
    image_ids=sorted(picked),
    num_workers=16,
)

# Move the images into the project and keep only the boxes we need (all our classes,
# on our images, real photos only), so the 2 GB box lists can be deleted.
src = Path.home() / "fiftyone" / "open-images-v7" / "train" / "data"
img_dir = OUT / "images"
img_dir.mkdir(exist_ok=True)
for i in picked:
    f = src / f"{i}.jpg"
    if f.exists():
        f.rename(img_dir / f.name)

full = pd.read_csv(CSV_DIR / "train-boxes.csv")
ours = full[full.ImageID.isin(picked) & full.LabelName.isin(set(mid_of[c] for c in CAP)) & (full.IsDepiction == 0)].copy()
ours["ClassName"] = ours.LabelName.map({m: n for n, m in mid_of.items()})
ours.to_csv(OUT / "boxes.csv", index=False)
print(f"images: {len(list(img_dir.glob('*.jpg')))}  boxes: {len(ours)}")
print(ours.ClassName.value_counts().to_string())
print("done:", OUT)
