#!/bin/bash
# Run 4 (H100): gentler YOLO-World fine-tune to stop it forgetting everyday objects (run 3 lost chair/bed/mirror).
# Frozen backbone (first 10 layers keep the pre-trained visual features), lower learning rate, fewer epochs.
# Same data as run 3 (images/train_run3 + data_run3_world.yaml must already exist). Writes RUN4_DONE.
cd ~/SafeSight/model
rm -f RUN4_DONE RUN4_FAILED
D=$PWD/data/yolo
.venv/bin/yolo detect train model=weights/yolov8l-worldv2.pt data=$D/data_run3_world.yaml name=run4_world \
  freeze=10 epochs=20 patience=6 imgsz=640 batch=48 workers=12 cache=ram device=0 optimizer=AdamW \
  lr0=0.0005 lrf=0.1 cos_lr=True warmup_epochs=1 plots=True exist_ok=True project=$PWD/runs > train_run4_world.log 2>&1
echo "exit $?"
touch RUN4_DONE
