"""Short clips of where each hazard was seen in an uploaded video, with a box track that follows the object.

For each moment a hazard was seen (time_s), cut CLIP_BEFORE..CLIP_AFTER seconds around it at CLIP_FPS, blur every
person in every frame, and encode a small H.264 mp4 that plays in any browser. The box is not burned in: the website
draws it from `track`, a list of [t, left, top, right, bottom] (t = seconds into the clip, box as fractions of the
frame), so it stays crisp and can be styled; a 6th value per entry is 1 when the object is in view, 0 when not. Hazards seen at the same moment share one clip; each gets its own track.

Tracking: the fine-tuned model responsible for that object type looks at every TRACK_EVERY-th frame; the box closest
to the previous one is kept, missing frames hold the last box, and the result is lightly smoothed. Surfaces (floor,
wall) and objects the detector can't re-find keep the box from the analysed frame.
"""
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

CLIP_BEFORE, CLIP_AFTER = 1.0, 2.0
CLIP_FPS = 15
CLIP_SIDE = 960          # long side of the clip, pixels
TRACK_EVERY = 3          # frames between detector looks (5 per second)
MAX_CLIPS = 12           # moments per job (each takes a few seconds)
LOST_AFTER = 2           # detector looks in a row without the object before its box is hidden


def duration(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(video)],
                         capture_output=True, text=True).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


def _decode(video, start, length, out_dir):
    subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{start:.2f}", "-i", str(video), "-t", f"{length:.2f}", "-an",
                    "-vf", f"fps={CLIP_FPS},scale='if(gt(iw,ih),min({CLIP_SIDE},iw),-2)':'if(gt(iw,ih),-2,min({CLIP_SIDE},ih))'",
                    "-q:v", "3", str(out_dir / "%04d.jpg")], check=True)
    return sorted(out_dir.glob("*.jpg"))


def _encode(frames_dir, dest):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(CLIP_FPS), "-i", str(frames_dir / "%04d.jpg"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "26",
                    "-movflags", "+faststart", str(dest)], check=True)


def _iou(a, b):
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


def _center_dist(a, b):
    return ((a[0] + a[2] - b[0] - b[2]) ** 2 + (a[1] + a[3] - b[1] - b[3]) ** 2) ** 0.5 / 2


def _area(b):
    return max(1e-6, (b[2] - b[0]) * (b[3] - b[1]))


def _follow(boxes_at, start_k, start_box, keys):
    """Walk the keyframes outward from start_k, keeping the detection that matches the previous box (overlapping or
    close, and a similar size). Returns {k: (box, seen)}; after LOST_AFTER misses in a row the object is treated as
    out of view until it is matched again."""
    track = {start_k: (start_box, True)}
    for order in (sorted(k for k in keys if k > start_k), sorted((k for k in keys if k < start_k), reverse=True)):
        prev, misses = start_box, 0
        for k in order:
            cands = [b for b in boxes_at.get(k, []) if 0.4 < _area(b) / _area(prev) < 2.5
                     and (_iou(prev, b) > 0.2 or _center_dist(prev, b) < 0.08 + 0.04 * misses)]
            best = max(cands, key=lambda b: _iou(prev, b) - 0.5 * _center_dist(prev, b), default=None)
            if best is not None:
                prev, misses = best, 0
                track[k] = (best, True)
            else:
                misses += 1
                track[k] = (prev, misses < LOST_AFTER)
    return track


def _smooth(track, keys, a=0.5):
    out, prev = {}, None
    for k in keys:
        b, seen = np.array(track[k][0], float), track[k][1]
        prev = b if prev is None or not seen else a * b + (1 - a) * prev
        out[k] = (prev, seen)
    return out


def make_clips(video, hazards, frames, out_dir, url_prefix, an, blur, dev, progress=lambda d, t: None):
    """hazards: result hazards (with time_s, object, box, frame_id). Adds clip_url + track to each, in place."""
    total = duration(video)
    by_frame = {f["frame_id"]: f for f in frames}
    moments = {}
    for h in hazards:
        if h.get("time_s") is not None:
            moments.setdefault(h["time_s"], []).append(h)
    moments = dict(sorted(moments.items(), key=lambda kv: -max(_sev(h) for h in kv[1]))[:MAX_CLIPS])
    out_dir.mkdir(parents=True, exist_ok=True)
    for n, (t, hs) in enumerate(sorted(moments.items())):
        progress(n, len(moments))
        start = max(0.0, min(t - CLIP_BEFORE, total - (CLIP_BEFORE + CLIP_AFTER)))
        length = min(CLIP_BEFORE + CLIP_AFTER, max(0.5, total - start))
        name = f"c{n + 1:02d}.mp4"
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            raw, done = tmp / "raw", tmp / "blurred"
            raw.mkdir()
            done.mkdir()
            paths = _decode(video, start, length, raw)
            if not paths:
                continue
            ims = []
            for k, p in enumerate(paths):  # blur everyone before anything is written to the job
                img = blur(np.array(Image.open(p).convert("RGB")))
                ims.append(img)
                Image.fromarray(img).save(done / f"{k + 1:04d}.jpg", quality=88)
            H, W = ims[0].shape[:2]
            keys = list(range(0, len(ims), TRACK_EVERY)) + ([len(ims) - 1] if (len(ims) - 1) % TRACK_EVERY else [])
            key_t = int(round((t - start) * CLIP_FPS))
            for h in hs:
                f = by_frame[h["frame_id"]]
                fw, fh = f["width"], f["height"]
                start_box = [h["box"][0] / fw, h["box"][1] / fh, h["box"][2] / fw, h["box"][3] / fh]
                k0 = min(keys, key=lambda k: abs(k - key_t))
                found = _detect_label(an, [ims[k] for k in keys], h.get("object"), dev)
                if found is None:  # surfaces or unknown objects: hold the analysed box near the analysed moment
                    track = {k: (start_box, abs(k - k0) <= CLIP_FPS) for k in keys}
                else:
                    boxes_at = {k: [[x0 / W, y0 / H, x1 / W, y1 / H] for x0, y0, x1, y1 in bs] for k, bs in zip(keys, found)}
                    track = _smooth(_follow(boxes_at, k0, start_box, keys), keys)
                h["clip_url"] = f"{url_prefix}/{name}"
                h["clip_start_s"] = round(start, 2)
                # [t, left, top, right, bottom, seen]: seen = 0 when the object is out of view (the site hides the box)
                h["track"] = [[round(k / CLIP_FPS, 2), *[round(float(v), 4) for v in track[k][0]], int(track[k][1])]
                              for k in keys]
            _encode(done, out_dir / name)
    progress(len(moments), len(moments))


SEV = {"high": 3, "medium": 2, "low": 1}


def _sev(h):
    return SEV.get(h["severity"], 0)


def _detect_label(an, imgs, label, dev):
    """Boxes of one object type in each image, from the fine-tuned model responsible for it (None: can't track)."""
    for m, mine, names in getattr(an, "yolos", []):
        if label not in (mine or set(names.values())):
            continue
        out = []
        for img in imgs:
            r = m.predict(img[:, :, ::-1], conf=0.15, verbose=False, device=dev)[0]
            out.append([b for b, c in zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist()) if names[int(c)] == label])
        return out
    return None
