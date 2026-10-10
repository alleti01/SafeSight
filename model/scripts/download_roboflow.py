"""Download the approved Roboflow Universe datasets (latest version, YOLO format).

Needs ROBOFLOW_API_KEY in model/.env. Output: model/data/roboflow/<workspace>__<project>/
Mapping to our labels happens in Phase 2. All are CC BY 4.0: credit each in the README.
"""
import json
import os
import urllib.request
from pathlib import Path

from dotenv import load_dotenv
from roboflow import Roboflow

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "roboflow"
load_dotenv(ROOT / ".env")
KEY = os.environ["ROBOFLOW_API_KEY"]

# workspace/project -> what it covers for us (approved Oct 10)
DATASETS = {
    "bcpmodel1commona/stairs-spqnr": "stairs",
    "tom-lai-8bp7n/stairs-i2yia": "stairs",
    "kaist-9sscg/stairs-segmentation": "stairs",
    "bartu-erguven-qpopt/cable-dataset": "cable (drop overhead power lines in Phase 2)",
    "hoarding-support/clutter-classes": "floor_clutter",
    "sapiens/toilet-seat-object-detection": "toilet (drop Door-handle)",
    "svalab12/bathroom-lyfer": "toilet, mirror, towel",
    "adrian-gorcea/bathroom-sdsne": "toilet, mirror, towel",
    "asdasd-fl13n/carpet-segmentation": "rug",
    "ai-dataset-8dqwo/carpet-rjju3": "rug",
    "practicas-preprofesionales/toilet-paper-rv8hr": "toilet_roll_holder (product shots)",
    "ethan-tigrik-zgtmb/carpet-calpo": "rug (flat rug photos)",
    # added Oct 10 to strengthen cable / floor_clutter (floor-level and messy real homes)
    "superfish-5k9sp/robot-vacuum-cleaner": "cable (wire, thread), floor_clutter",
    "sasya-0ullp/messy-room-y5qsc": "floor_clutter, chair, table",
    "sds-first-workspace/messy-imgs": "floor_clutter, chair, table, bed, mirror",
    # added Oct 10 for run 2 (glass doors; checked by eye, CCTV-only set skipped)
    "annotation-4rrq6/shower-and-screen-91lzq": "glass_door (shower screens)",
    "indoor-detection/glass-door-stair-fish_tank-tllvf": "glass_door, stairs",
    "xinen-2awjn/hazardcap-glass-door": "glass_door (shop entrances)",
}

rf = Roboflow(api_key=KEY)
summary = {}
for slug, covers in DATASETS.items():
    ws, proj = slug.split("/")
    meta = json.load(urllib.request.urlopen(f"https://api.roboflow.com/{slug}?api_key={KEY}"))
    latest = max(int(v["id"].split("/")[-1]) for v in meta["versions"])
    dest = OUT / f"{ws}__{proj}"
    if not dest.exists():
        rf.workspace(ws).project(proj).version(latest).download("yolov8", location=str(dest))
    n = len(list(dest.rglob("*.jpg"))) + len(list(dest.rglob("*.png")))
    summary[slug] = {"version": latest, "images": n, "covers": covers,
                     "license": meta["project"].get("license"),
                     "url": f"https://universe.roboflow.com/{slug}/dataset/{latest}"}
    print(f"{slug:50} v{latest:<3} {n:6} images  ({covers})")

(OUT / "sources.json").write_text(json.dumps(summary, indent=1))
print("done:", OUT)
