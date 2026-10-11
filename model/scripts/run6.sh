#!/bin/bash
# Run 6 (H100): self-training on Charades frames (people filming their own homes).
# 1) pseudo-label the frames with run 5 + Grounding DINO (agreement only), 2) continue training run 5 on
# run 5's data + the pseudo-labeled frames. Writes RUN6_DONE (RUN6_FAILED on error).
set -e
cd ~/SafeSight/model
rm -f RUN6_DONE RUN6_FAILED
D=$PWD/data/yolo
find data/ext/charades/frames -name '._*' -delete

if [ ! -d $D/images/chr ]; then
  .venv/bin/python -u scripts/pseudo_label.py data/ext/charades/frames data/chr_pl runs/run5_world/weights/best.pt > pseudo.log 2>&1
  mv data/chr_pl/images $D/images/chr
  mv data/chr_pl/labels $D/labels/chr
fi

.venv/bin/python - "$D" <<'PY'
import os, shutil, sys
from pathlib import Path
import yaml
d = Path(sys.argv[1])
for kind in ("images", "labels"):
    out = d / kind / "train_run6"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir()
    for sub in ("train_run5", "chr"):
        for p in (d / kind / sub).iterdir():
            if not p.name.startswith("."):
                os.link(p, out / p.name)
print("train_run6", len(os.listdir(d / "images" / "train_run6")))
cfg = yaml.safe_load(open(d / "data_run5_world.yaml"))
cfg["train"] = "images/train_run6"
yaml.safe_dump(cfg, open(d / "data_run6_world.yaml", "w"), sort_keys=False)
PY

.venv/bin/yolo detect train model=runs/run5_world/weights/best.pt data=$D/data_run6_world.yaml name=run6_world \
  freeze=10 imgsz=1024 epochs=8 patience=4 batch=24 workers=16 cache=False device=0 optimizer=AdamW \
  lr0=0.0003 lrf=0.1 cos_lr=True warmup_epochs=0.5 plots=True exist_ok=True project=$PWD/runs > train_run6_world.log 2>&1
touch RUN6_DONE
