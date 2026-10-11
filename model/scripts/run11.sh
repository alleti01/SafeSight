#!/bin/bash
# Run 11 (H100): continue the better of run 10 / run 9 with all user-checked friends homes (6 homes + Anish cable videos; friends4 is held out as test home 2),
# repeated x15 so they count next to the ~40k other images. Same recipe as runs 8/9 (frozen backbone, 1024 px, low LR).
# Writes RUN11_DONE (RUN11_FAILED on error).
cd ~/SafeSight/model
rm -f RUN11_DONE RUN11_FAILED
trap '[ -f RUN11_DONE ] || touch RUN11_FAILED' EXIT
set -e
D=$PWD/data/yolo
find $D -name '._*' -delete
.venv/bin/python - "$D" <<'PY'
import os, shutil, sys
from pathlib import Path
import yaml
d = Path(sys.argv[1])
reps = {"train_run9": 1, "friends": 15, "friends2": 15, "friends3": 15, "friends5": 15, "friends6": 15, "friends7": 15}
for kind in ("images", "labels"):
    out = d / kind / "train_run11"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir()
for sub, r in reps.items():
    for img in (d / "images" / sub).iterdir():
        if img.name.startswith("."):
            continue
        lab = d / "labels" / sub / f"{img.stem}.txt"
        for k in range(r):
            stem = img.stem if r == 1 else f"{img.stem}_r{k:02d}"
            os.link(img, d / "images" / "train_run11" / f"{stem}{img.suffix}")
            if lab.exists():
                os.link(lab, d / "labels" / "train_run11" / f"{stem}.txt")
print("train_run11", len(os.listdir(d / "images" / "train_run11")))
cfg = yaml.safe_load(open(d / "data_run5_world.yaml"))
cfg["train"] = "images/train_run11"
yaml.safe_dump(cfg, open(d / "data_run11_world.yaml", "w"), sort_keys=False)
PY
START=runs/run9_world/weights/best.pt
S10=$(.venv/bin/python -c "import pandas as p;print(p.read_csv('runs/run10_world/results.csv').filter(like='mAP50(B)').iloc[:,0].max())" 2>/dev/null || echo 0)
S9=$(.venv/bin/python -c "import pandas as p;print(p.read_csv('runs/run9_world/results.csv').filter(like='mAP50(B)').iloc[:,0].max())")
echo "val mAP50 run10=$S10 run9=$S9"
.venv/bin/python -c "import sys;sys.exit(0 if float('$S10')>=float('$S9') else 1)" && START=runs/run10_world/weights/best.pt
echo "starting from $START"
.venv/bin/yolo detect train model=$START data=$D/data_run11_world.yaml name=run11_world \
  freeze=10 imgsz=1024 epochs=8 patience=4 batch=24 workers=16 cache=False device=0 optimizer=AdamW \
  lr0=0.0003 lrf=0.1 cos_lr=True warmup_epochs=0.5 hsv_v=0.5 hsv_s=0.6 degrees=5 scale=0.6 \
  plots=True exist_ok=True project=$PWD/runs > train_run11_world.log 2>&1
touch RUN11_DONE
