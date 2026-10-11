"""Objects365 (HF hieupth/objects365_384_squared, images 384x384) subset for the weakest labels.

Picks: every image with an Extention Cord; Trash bin Can / Towel / Toilet Paper only in indoor-home images
(co-occurring with a home object), capped. Fetches only those files from the remote zips (HTTP range
requests via remotezip) and writes YOLO labels with our label ids (other home objects in the image keep
their boxes too). Non-commercial license (Objects365): credit in README.

Usage (GPU machine): get_o365.py
"""
import json
import random
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from huggingface_hub import hf_hub_url
from remotezip import RemoteZip

ROOT = Path(__file__).resolve().parents[1]
O = ROOT / "data" / "ext" / "o365"
OUT_I, OUT_L = ROOT / "data/yolo/images/o365", ROOT / "data/yolo/labels/o365"
LABELS = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable", "floor_clutter", "bin",
          "bed", "sofa", "chair", "table", "door", "window", "glass_door"]
ID = {n: i for i, n in enumerate(LABELS)}
TARGET = {"Extention Cord": "cable", "Trash bin Can": "bin", "Towel": "towel", "Toilet Paper": "toilet_roll_holder"}
OTHER = {"Toilet": "toilet", "Mirror": "mirror", "Bed": "bed", "Couch": "sofa", "Chair": "chair",
         "Carpet": "rug", "Slippers": "floor_clutter", "Dining Table": "table", "Desk": "table",
         "Coffee Table": "table"}
HOME = {"Toilet", "Bed", "Couch", "Bathtub", "Sink", "Mirror", "Carpet", "Nightstand", "Coffee Table",
        "Refrigerator", "Microwave", "Washing Machine/Drying Machine", "Lamp", "Pillow", "Slippers", "Faucet"}
CAP = {"bin": 4000, "towel": 2500, "toilet_roll_holder": 2500}
random.seed(0)


def main():
    d = json.load(open(O / "annotations" / "instances_train.json"))
    cats = {c["id"]: c["name"] for c in d["categories"]}
    imgs = {i["id"]: i for i in d["images"]}
    anns = defaultdict(list)
    for a in d["annotations"]:
        anns[a["image_id"]].append((cats[a["category_id"]], a["bbox"]))
    del d
    pick, n_by = {}, defaultdict(int)
    order = list(anns)
    random.shuffle(order)
    for iid in order:
        names = {n for n, _ in anns[iid]}
        targets = {TARGET[n] for n in names if n in TARGET}
        if not targets:
            continue
        home = bool(names & HOME)
        take = "cable" in targets or (home and any(n_by[t] < CAP[t] for t in targets if t in CAP))
        if not take:
            continue
        for t in targets:
            n_by[t] += 1
        pick[iid] = imgs[iid]
    print(f"picked {len(pick)} images:", dict(n_by))

    # which zip holds each file: read every zip's directory (small range requests)
    files = {}
    idx = O / "zip_index.json"
    if idx.exists():
        files = {k: tuple(v) for k, v in json.load(open(idx)).items()}
    for k in ([] if files else range(1, 21)):
        url = hf_hub_url("hieupth/objects365_384_squared", f"images_part{k:03d}.zip", repo_type="dataset")
        with RemoteZip(url) as z:
            for name in z.namelist():
                files[name.split("/")[-1]] = (url, name)
    if not idx.exists():
        json.dump(files, open(idx, "w"))
    print(len(files), "files indexed")

    OUT_I.mkdir(parents=True, exist_ok=True)
    OUT_L.mkdir(parents=True, exist_ok=True)
    by_zip = defaultdict(list)
    for iid, im in pick.items():
        base = im["file_name"].split("/")[-1]
        if base in files:
            by_zip[files[base][0]].append((iid, im, files[base][1]))

    def read_retry(z, member, tries=8):
        import time
        for t in range(tries):
            try:
                return z.read(member)
            except Exception:  # Hugging Face rate limit (429) or a dropped connection: back off and retry
                if t == tries - 1:
                    raise
                time.sleep(min(60, 5 * 2 ** t))

    def fetch(item):
        url, items = item
        n = 0
        with RemoteZip(url) as z:
            for iid, im, member in items:
                dest = OUT_I / f"o365__{iid}.jpg"
                if not dest.exists():
                    dest.write_bytes(read_retry(z, member))
                rows = []
                for name, (x, y, w, h) in anns[iid]:  # this mirror stores boxes as fractions (0-1) of the image
                    lab = TARGET.get(name) or OTHER.get(name)
                    if lab and w > 0.006 and h > 0.006:
                        rows.append(f"{ID[lab]} {x + w / 2:.6f} {y + h / 2:.6f} {w:.6f} {h:.6f}")
                (OUT_L / f"o365__{iid}.txt").write_text("\n".join(rows))
                n += 1
        return n

    with ThreadPoolExecutor(3) as ex:  # fewer parallel streams: 10 tripped the rate limit
        print("fetched", sum(ex.map(fetch, by_zip.items())))


if __name__ == "__main__":
    main()
