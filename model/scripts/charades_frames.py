"""Pull a few frames per Charades video (people filming their own homes) straight out of the zip.

Charades (Sigurdsson et al. 2016, Allen Institute for AI): 9,848 crowd-sourced videos of everyday activities
in the participants' own homes. Non-commercial research license. No object boxes for our labels, so these
frames get pseudo-labels from our models (scripts/pseudo_label.py) before training.

Usage: charades_frames.py data/ext/charades/Charades_v1_480.zip data/ext/charades/frames [per_video=2]
"""
import sys
import tempfile
import zipfile
from pathlib import Path

import cv2

zpath, out = Path(sys.argv[1]), Path(sys.argv[2])
per = int(sys.argv[3]) if len(sys.argv) > 3 else 2
out.mkdir(parents=True, exist_ok=True)
z = zipfile.ZipFile(zpath)
vids = [n for n in z.namelist() if n.endswith(".mp4")]
print(len(vids), "videos")
n = 0
with tempfile.TemporaryDirectory() as tmp:
    for k, name in enumerate(vids):
        vid = Path(name).stem
        if (out / f"{vid}_0.jpg").exists():
            continue
        p = Path(tmp) / "v.mp4"
        p.write_bytes(z.read(name))
        cap = cv2.VideoCapture(str(p))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        for j in range(per):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(total * (j + 1) / (per + 1)))
            ok, fr = cap.read()
            if ok and fr.mean() > 25:  # skip near-black frames
                cv2.imwrite(str(out / f"{vid}_{j}.jpg"), fr, [cv2.IMWRITE_JPEG_QUALITY, 92])
                n += 1
        cap.release()
        if k % 1000 == 0:
            print(f"{k}/{len(vids)} videos, {n} frames", flush=True)
print("done:", n, "frames")
