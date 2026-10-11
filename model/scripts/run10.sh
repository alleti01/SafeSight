#!/bin/bash
# Run 10 (H100): continue run 9 with 128 hand-checked frames from friends' homes (3 homes, user-corrected),
# repeated x15 so they count next to the ~40k other images. Same recipe as runs 8/9 (frozen backbone, 1024 px, low LR).
# Writes RUN10_DONE (RUN10_FAILED on error).
cd ~/SafeSight/model
rm -f RUN10_DONE RUN10_FAILED
trap '[ -f RUN10_DONE ] || touch RUN10_FAILED' EXIT
set -e
D=$PWD/data/yolo
find $D -name '._*' -delete
.venv/bin/python - "$D" <<'PY'
import os, shutil, sys
from pathlib import Path
import yaml
d = Path(sys.argv[1])
reps = {"train_run9": 1, "friends": 15, "friends2": 15, "friends3": 15}
for kind in ("images", "labels"):
    out = d / kind / "train_run10"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir()
for sub, r in reps.items():
    for img in (d / "images" / sub).iterdir():
        if img.name.startswith("."):
            continue
        lab = d / "labels" / sub / f"{img.stem}.txt"
        for k in range(r):
            stem = img.stem if r == 1 else f"{img.stem}_r{k:02d}"
            os.link(img, d / "images" / "train_run10" / f"{stem}{img.suffix}")
            if lab.exists():
                os.link(lab, d / "labels" / "train_run10" / f"{stem}.txt")
print("train_run10", len(os.listdir(d / "images" / "train_run10")))
cfg = yaml.safe_load(open(d / "data_run5_world.yaml"))
cfg["train"] = "images/train_run10"
yaml.safe_dump(cfg, open(d / "data_run10_world.yaml", "w"), sort_keys=False)
PY
.venv/bin/yolo detect train model=runs/run9_world/weights/best.pt data=$D/data_run10_world.yaml name=run10_world \
  freeze=10 imgsz=1024 epochs=8 patience=4 batch=24 workers=16 cache=False device=0 optimizer=AdamW \
  lr0=0.0003 lrf=0.1 cos_lr=True warmup_epochs=0.5 hsv_v=0.5 hsv_s=0.6 degrees=5 scale=0.6 \
  plots=True exist_ok=True project=$PWD/runs > train_run10_world.log 2>&1
touch RUN10_DONE
