#!/bin/bash
# H100: download Charades 480p from AI2's S3, pull 2 frames per video, delete the zip, then run6.sh.
set -e
cd ~/SafeSight/model
mkdir -p data/ext/charades
if [ ! -d data/ext/charades/frames ] || [ $(ls data/ext/charades/frames | wc -l) -lt 15000 ]; then
  curl -sL -o data/ext/charades/Charades_v1_480.zip https://ai2-public-datasets.s3-us-west-2.amazonaws.com/charades/Charades_v1_480.zip
  .venv/bin/python -u scripts/charades_frames.py data/ext/charades/Charades_v1_480.zip data/ext/charades/frames 2 > charades_frames.log 2>&1
  rm -f data/ext/charades/Charades_v1_480.zip
fi
bash scripts/run6.sh
