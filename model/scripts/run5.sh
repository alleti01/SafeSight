#!/bin/bash
# Run 5 (H100): real-home data added (SUN RGB-D, full ADE20K homes, robot6000, ADL, Trans10K glass doors,
# 12 Roboflow sets picked by eye) + Anish's frames x20. YOLO-World v2 L, frozen backbone (forgets less),
# trained at 1024 px so cables / clutter / bins stay visible. Writes RUN5_DONE (RUN5_FAILED on error).
set -e
cd ~/SafeSight/model
rm -f RUN5_DONE RUN5_FAILED
D=$PWD/data/yolo
find $D -name '._*' -delete

# 1) fill labels each new source never annotated (Grounding DINO, high confidence only)
[ -f data/yolo/filled_ext.json ] || { .venv/bin/python -u scripts/fill_missing_boxes.py data/yolo ext > fill_ext.log 2>&1; cp data/yolo/filled_boxes.json data/yolo/filled_ext.json; }

# 2) one train folder and one val folder of hard links
.venv/bin/python - "$D" <<'PY'
import os, shutil, sys
from pathlib import Path
import yaml
d = Path(sys.argv[1])
drop = set((d / "ade_dupes.txt").read_text().split())  # ADE-150 copies of images now in full-ADE (richer labels)
def link(name, subs):
    for kind in ("images", "labels"):
        out = d / kind / name
        shutil.rmtree(out, ignore_errors=True)
        out.mkdir()
        for sub in subs:
            for p in (d / kind / sub).iterdir():
                if not p.name.startswith(".") and p.stem not in drop:
                    os.link(p, out / p.name)
    print(name, len(os.listdir(d / "images" / name)))
link("train_run5", ["train", "ext", "train_home2_x20"])
link("val_run5", ["val", "val_home2"])
phrases = ["rug", "toilet", "toilet paper", "towel", "mirror", "staircase", "power cord", "clutter on floor",
           "trash can", "bed", "sofa", "chair", "table", "door", "window", "glass door"]
yaml.safe_dump({"path": str(d), "train": "images/train_run5", "val": "images/val_run5",
                "names": dict(enumerate(phrases))}, open(d / "data_run5_world.yaml", "w"), sort_keys=False)
PY

# 3) train
.venv/bin/yolo detect train model=weights/yolov8l-worldv2.pt data=$D/data_run5_world.yaml name=run5_world \
  freeze=10 imgsz=1024 epochs=15 patience=5 batch=24 workers=16 cache=False device=0 optimizer=AdamW \
  lr0=0.0005 lrf=0.1 cos_lr=True warmup_epochs=1 plots=True exist_ok=True project=$PWD/runs > train_run5_world.log 2>&1
touch RUN5_DONE
