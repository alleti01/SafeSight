#!/bin/bash
# Run 8 (H100): continue run 5 (best so far) with hand-checked real-home data weighted up.
#   + 178 newly reviewed frames of Anish's home (x15) + 466 hand-reviewed Charades frames from 195 homes (x8)
#   + ~1,500 copy-paste images (towel / glass door / cable on real phone-video floors and walls)
#   + phone-style augmentation: stronger HSV/brightness, blur via mosaic+scale, rotation +-5 deg
# Frozen backbone, 1024 px, low LR. Writes RUN8_DONE (RUN8_FAILED on error).
set -e
cd ~/SafeSight/model
rm -f RUN8_DONE RUN8_FAILED
D=$PWD/data/yolo
find $D -name '._*' -delete
.venv/bin/python - "$D" <<'PY'
import os, shutil, sys
from pathlib import Path
import yaml
d = Path(sys.argv[1])
reps = {"train_run5": 1, "home2b": 15, "chr_hand": 8, "paste": 1}
for kind in ("images", "labels"):
    out = d / kind / "train_run8"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir()
for sub, r in reps.items():
    for img in (d / "images" / sub).iterdir():
        if img.name.startswith("."):
            continue
        lab = d / "labels" / sub / f"{img.stem}.txt"
        for k in range(r):
            stem = img.stem if r == 1 else f"{img.stem}_r{k:02d}"
            os.link(img, d / "images" / "train_run8" / f"{stem}{img.suffix}")
            if lab.exists():
                os.link(lab, d / "labels" / "train_run8" / f"{stem}.txt")
print("train_run8", len(os.listdir(d / "images" / "train_run8")))
cfg = yaml.safe_load(open(d / "data_run5_world.yaml"))
cfg["train"] = "images/train_run8"
yaml.safe_dump(cfg, open(d / "data_run8_world.yaml", "w"), sort_keys=False)
PY
.venv/bin/yolo detect train model=runs/run5_world/weights/best.pt data=$D/data_run8_world.yaml name=run8_world \
  freeze=10 imgsz=1024 epochs=10 patience=4 batch=24 workers=16 cache=False device=0 optimizer=AdamW \
  lr0=0.0003 lrf=0.1 cos_lr=True warmup_epochs=0.5 hsv_v=0.5 hsv_s=0.6 degrees=5 scale=0.6 \
  plots=True exist_ok=True project=$PWD/runs > train_run8_world.log 2>&1
touch RUN8_DONE
