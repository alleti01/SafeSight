"""Turn room videos into a small set of sharp, distinct frames.

Samples FPS frames per second (ffmpeg, phone rotation applied), drops blurry frames, and drops
near-duplicates of a frame already kept from the same video. The analysis service reuses extract().

Usage: extract_frames.py <video or folder> <out dir> [--fps 2] [--room-map]
"""
import argparse
import subprocess
import tempfile
from pathlib import Path

import cv2
import imagehash
import numpy as np
from PIL import Image

MAX_SIDE = 1280
MIN_SHARPNESS = 2.0       # variance of the Laplacian on a 640 px wide gray copy; only near-black/smeared frames
REL_SHARPNESS = 0.5       # drop frames much blurrier than the same video's median (1080p and plain walls score
                          # far lower than 4K, so a fixed cutoff throws away whole videos)
DUP_DISTANCE = 8          # perceptual-hash bits; closer than this to a kept frame = duplicate

# Video file name -> room tag used in the contract (see shared/README.md)
ROOMS = {
    "bedroom": "bedroom", "bedroombathroom": "bathroom", "bedroomcloset": "bedroom",
    "bonusroom1": "living_room", "bonusroom2": "living_room", "frontdoor_to_hallway": "hallway",
    "guestroom": "bedroom", "guestroomcloset": "bedroom", "kitchen_diningroom": "kitchen",
    "livingroom": "living_room", "pantry": "kitchen", "staircase": "stairs",
    "upstairscloset": "hallway", "upstairshallway": "hallway",
}


def sharpness(img):
    g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    g = cv2.resize(g, (640, int(640 * g.shape[0] / g.shape[1])))
    return float(cv2.Laplacian(g, cv2.CV_64F).var())


def extract(video, out_dir, fps=2.0, prefix=None):
    """Write kept frames as <prefix>_f0000.jpg into out_dir; return [(path, sharpness)]."""
    video, out_dir = Path(video), Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    prefix = prefix or video.stem
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf",
                        f"fps={fps},scale='if(gt(iw,ih),min({MAX_SIDE},iw),-2)':'if(gt(iw,ih),-2,min({MAX_SIDE},ih))'",
                        "-q:v", "2", f"{tmp}/%05d.jpg"], check=True)
        frames = sorted(Path(tmp).glob("*.jpg"))
        imgs = [np.array(Image.open(f).convert("RGB")) for f in frames]
    if not imgs:
        return []
    sharp = [sharpness(i) for i in imgs]
    cutoff = max(MIN_SHARPNESS, REL_SHARPNESS * float(np.median(sharp)))
    kept, hashes = [], []
    for k, (img, s) in enumerate(zip(imgs, sharp)):
        if s < cutoff:
            continue
        h = imagehash.phash(Image.fromarray(img))
        if any(h - prev <= DUP_DISTANCE for prev in hashes):
            continue
        hashes.append(h)
        path = out_dir / f"{prefix}_f{k:04d}.jpg"
        Image.fromarray(img).save(path, quality=92)
        kept.append((path, s))
    return kept


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--fps", type=float, default=2.0)
    a = ap.parse_args()
    src = Path(a.src)
    videos = sorted(p for p in (src.iterdir() if src.is_dir() else [src]) if p.suffix.lower() in (".mov", ".mp4", ".m4v"))
    total = 0
    for v in videos:
        room = ROOMS.get(v.stem.lower(), "unknown")
        kept = extract(v, a.out, a.fps, prefix=f"{room}__{v.stem}")
        total += len(kept)
        print(f"{v.name:28} room={room:12} kept {len(kept):3} frames")
    print(f"total frames: {total} -> {a.out}")


if __name__ == "__main__":
    main()
