#!/bin/bash
# Run 3 (H100): close the domain gap with real phone footage from a second home (Anish's), oversampled x20,
# and pick epochs on held-out frames from that home. Trains two models at once on the one GPU:
#   run3_world: YOLO-World v2 L (open-vocabulary, zero-shot 0.56 on the test home) fine-tuned
#   run3_y11:   YOLO11-m continued from run 2
# Writes RUN3_DONE when both finish (RUN3_FAILED on error).
set -e
cd ~/SafeSight/model
rm -f RUN3_DONE RUN3_FAILED
D=$PWD/data/yolo
find $D -name '._*' -delete   # macOS AppleDouble files that came along in the tar upload

# oversample the in-domain frames: 20 hard-linked copies each
rm -rf $D/images/train_home2_x20 $D/labels/train_home2_x20
mkdir -p $D/images/train_home2_x20 $D/labels/train_home2_x20
for f in $D/images/train_home2/*.jpg; do
  b=$(basename $f .jpg)
  for k in $(seq -w 1 20); do
    ln $f $D/images/train_home2_x20/${b}_r$k.jpg
    ln $D/labels/train_home2/$b.txt $D/labels/train_home2_x20/${b}_r$k.txt
  done
done

.venv/bin/python - "$D" <<'PY'
import sys, yaml
d = sys.argv[1]
labels = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable", "floor_clutter", "bin",
          "bed", "sofa", "chair", "table", "door", "window", "glass_door"]
# YOLO-World learns from the class names as text, so it gets plain phrases (same order as labels)
phrases = ["rug", "toilet", "toilet paper", "towel", "mirror", "staircase", "power cord", "clutter on floor",
           "trash can", "bed", "sofa", "chair", "table", "door", "window", "glass door"]
# one combined folder of hard links (YOLO-World's trainer needs a single train directory)
import os, shutil
from pathlib import Path
for kind in ("images", "labels"):
    out = Path(d, kind, "train_run3")
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir()
    for sub in ("train", "train_home2_x20"):
        for p in Path(d, kind, sub).iterdir():
            if not p.name.startswith("."):
                os.link(p, out / p.name)
print("train_run3:", len(os.listdir(Path(d, "images", "train_run3"))), "images")
for n, names in (("y11", labels), ("world", phrases)):
    yaml.safe_dump({"path": d, "train": "images/train_run3", "val": "images/val_home2",
                    "names": dict(enumerate(names))}, open(f"{d}/data_run3_{n}.yaml", "w"), sort_keys=False)
PY

COMMON="epochs=25 patience=8 imgsz=640 batch=48 workers=8 cache=ram device=0 optimizer=AdamW lr0=0.0015 lrf=0.1 cos_lr=True warmup_epochs=1 plots=True exist_ok=True project=$PWD/runs"
.venv/bin/yolo detect train model=runs/run2/weights/best.pt data=$D/data_run3_y11.yaml name=run3_y11 $COMMON > train_run3_y11.log 2>&1 &
P1=$!
# both runs share the same label cache file: let run3_y11 build it before the second run starts
until [ -f $D/labels/train_run3.cache ] && [ -f $D/labels/val_home2.cache ]; do sleep 10; done; sleep 20
.venv/bin/yolo detect train model=weights/yolov8l-worldv2.pt data=$D/data_run3_world.yaml name=run3_world $COMMON > train_run3_world.log 2>&1 &
P2=$!
wait $P1; S1=$?
wait $P2; S2=$?
echo "y11 exit $S1, world exit $S2"
touch RUN3_DONE
