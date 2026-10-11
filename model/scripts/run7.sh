#!/bin/bash
# Run 7 (H100): a 3-label SPECIALIST for the labels the general model handles worst: towel, glass door, cable.
# Trains YOLO-World (from run 5) on every photo containing one of them + look-alike negatives (mirror / window /
# door photos), at 1280 px for thin cables. The app uses it for these 3 labels and run 5/6 for the rest.
# Starts after run 6. Writes RUN7_DONE (RUN7_FAILED on error).
cd ~/SafeSight/model
rm -f RUN7_DONE RUN7_FAILED
until [ -f RUN6_DONE ] || [ -f RUN6_FAILED ]; do sleep 60; done
set -e
D=$PWD/data/yolo
.venv/bin/python - "$D" <<'PY'
import os, random, shutil, sys
from pathlib import Path
import yaml
d = Path(sys.argv[1])
KEEP = {3: 0, 15: 1, 6: 2}                 # towel, glass_door, cable  ->  0, 1, 2
CONFUSERS = {4, 14, 13}                    # mirror, window, door: look-alikes for glass / towel
random.seed(0)

def build(name, src, neg_frac):
    for kind in ("images", "labels"):
        shutil.rmtree(d / kind / name, ignore_errors=True)
        (d / kind / name).mkdir()
    pos = neg = 0
    files = sorted(p for p in (d / "labels" / src).iterdir() if not p.name.startswith("."))
    for lf in files:
        rows = [l.split() for l in lf.read_text().splitlines() if l.strip()]
        cls = {int(r[0]) for r in rows}
        mine = [r for r in rows if int(r[0]) in KEEP]
        if mine:
            pos += 1
        elif cls & CONFUSERS and random.random() < neg_frac:
            neg += 1
        else:
            continue
        img = d / "images" / src / f"{lf.stem}.jpg"
        if not img.exists():
            continue
        os.link(img, d / "images" / name / img.name)
        (d / "labels" / name / lf.name).write_text("\n".join(" ".join([str(KEEP[int(r[0])])] + r[1:]) for r in mine))
    print(name, "positives", pos, "negatives", neg)

build("train_spec", "train_run5", 0.12)
build("val_spec", "val_run5", 1.0)
yaml.safe_dump({"path": str(d), "train": "images/train_spec", "val": "images/val_spec",
                "names": {0: "towel", 1: "glass door", 2: "power cord"}},
               open(d / "data_spec.yaml", "w"), sort_keys=False)
PY
.venv/bin/yolo detect train model=runs/run5_world/weights/best.pt data=$D/data_spec.yaml name=run7_spec \
  freeze=10 imgsz=1280 epochs=25 patience=8 batch=16 workers=16 cache=False device=0 optimizer=AdamW \
  lr0=0.0005 lrf=0.1 cos_lr=True warmup_epochs=1 plots=True exist_ok=True project=$PWD/runs > train_run7_spec.log 2>&1
touch RUN7_DONE
