#!/bin/bash
# ADL (Pirsiavash & Ramanan, CVPR 2012): chest-camera video in real homes. Annotations are every 30th frame,
# boxes in 640x480 coordinates. Downloads one video at a time, keeps only annotated frames (640x480), deletes it.
set -e
cd "$(dirname "$0")/.."
OUT=data/ext/adl
mkdir -p $OUT/frames
ANN=$OUT/ADL_annotations
if [ ! -d $ANN ]; then
  curl -sL -o $OUT/ann.zip https://web.cs.ucdavis.edu/~hpirsiav/papers/ADLdataset/ADL_annotations.zip
  unzip -q $OUT/ann.zip -d $OUT && rm $OUT/ann.zip
fi
for P in "$@"; do
  [ -f $OUT/done_$P ] && continue
  curl -sL -o $OUT/$P.MP4 https://web.cs.ucdavis.edu/~hpirsiav/papers/ADLdataset/ADL_videos/$P.MP4
  frames=$(awk '{print $6+0}' $ANN/object_annotation/object_annot_$P.txt | sort -nu | tr '\n' '+' | sed 's/+$//')
  # select exactly the annotated frame numbers
  sel=$(awk '{print $6+0}' $ANN/object_annotation/object_annot_$P.txt | sort -nu | awk '{printf "%seq(n\\,%d)", (NR>1?"+":""), $1}')
  ffmpeg -v error -i $OUT/$P.MP4 -vf "select='$sel',scale=640:480" -vsync 0 -frame_pts 1 -q:v 2 $OUT/frames/${P}_%08d.jpg
  rm $OUT/$P.MP4
  touch $OUT/done_$P
  echo "$P: $(ls $OUT/frames | grep -c "^${P}_") frames"
done
