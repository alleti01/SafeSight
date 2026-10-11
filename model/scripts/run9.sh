#!/bin/bash
# Run 9 (H100): bins + cables (+ towels, toilet paper) from Objects365 home scenes, on top of run 8's data.
# Starts from the better of run 8 / run 5 (by validation mAP50 on val_run5). Waits for run 8 and the O365 fetch.
cd ~/SafeSight/model
rm -f RUN9_DONE RUN9_FAILED
touch RUN9_PENDING
until [ -f RUN8_DONE ] || [ -f RUN8_FAILED ]; do sleep 60; done
until ! pgrep -f "python -u scripts/get_o365" >/dev/null; do sleep 30; done
set -e
D=$PWD/data/yolo
find $D -name '._*' -delete
# keep only Objects365 images that actually have boxes
for f in $D/labels/o365/*.txt; do [ -s "$f" ] || { rm -f "$f" "$D/images/o365/$(basename "$f" .txt).jpg"; }; done
echo "o365 kept: $(ls $D/images/o365 | wc -l)"
START=runs/run5_world/weights/best.pt
if [ -f runs/run8_world/results.csv ]; then
  S8=$(.venv/bin/python -c "import pandas as p;print(p.read_csv('runs/run8_world/results.csv').filter(like='mAP50(B)').iloc[:,0].max())")
  S5=$(.venv/bin/python -c "import pandas as p;print(p.read_csv('runs/run5_world/results.csv').filter(like='mAP50(B)').iloc[:,0].max())" 2>/dev/null || echo 0)
  echo "val mAP50 run8=$S8 run5=$S5"
  .venv/bin/python -c "import sys;sys.exit(0 if float('$S8')>=float('$S5') else 1)" && START=runs/run8_world/weights/best.pt
fi
echo "starting from $START"
.venv/bin/python - "$D" <<'PY'
import os, shutil, sys
from pathlib import Path
import yaml
d = Path(sys.argv[1])
for kind in ("images", "labels"):
    out = d / kind / "train_run9"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir()
    for sub in ("train_run8", "o365"):
        for p in (d / kind / sub).iterdir():
            if not p.name.startswith("."):
                os.link(p, out / p.name)
print("train_run9", len(os.listdir(d / "images" / "train_run9")))
cfg = yaml.safe_load(open(d / "data_run5_world.yaml"))
cfg["train"] = "images/train_run9"
yaml.safe_dump(cfg, open(d / "data_run9_world.yaml", "w"), sort_keys=False)
PY
.venv/bin/yolo detect train model=$START data=$D/data_run9_world.yaml name=run9_world \
  freeze=10 imgsz=1024 epochs=8 patience=4 batch=24 workers=16 cache=False device=0 optimizer=AdamW \
  lr0=0.0003 lrf=0.1 cos_lr=True warmup_epochs=0.5 hsv_v=0.5 hsv_s=0.6 degrees=5 scale=0.6 \
  plots=True exist_ok=True project=$PWD/runs > train_run9_world.log 2>&1
rm -f RUN9_PENDING
touch RUN9_DONE
