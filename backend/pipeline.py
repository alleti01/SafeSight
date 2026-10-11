"""The analysis pipeline: uploaded files in, contract-shaped results out.

Each stage is a plain function so it can be built and tested on its own.
Stages marked TODO are stubs for now; see the phase cards for when each lands.
"""

import io
import sys
import threading
from collections.abc import Callable
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

import blur
import contrast
import frames as frames_lib

register_heif_opener()

REPO = Path(__file__).resolve().parent.parent
MAX_SIDE = 1280


class BadUpload(ValueError):
    """An upload we can't use. The message is shown to the caregiver."""


class PrivacyUnavailable(RuntimeError):
    """People can't be blurred right now, so nothing may be saved."""


# --- Detector hook ----------------------------------------------------------
# Abhi's model/ exposes detect(image) -> [{"label", "box", "score"}] (see
# shared/README.md). Until it exists on this machine, the YOLO-World baseline
# in detector.py stands in, with the same output.

try:
    sys.path.insert(0, str(REPO))
    from model.detect import detect as _model_detect  # type: ignore

    DETECTOR = "model"
except ImportError:
    _model_detect = None
    DETECTOR = "baseline"

_baseline = None


# The model is shared by full checks (a worker thread) and the live camera
# (request threads), so one picture goes through it at a time.
_detect_lock = threading.Lock()


def detect(image: Image.Image) -> list[dict]:
    rgb = np.asarray(image.convert("RGB"))
    with _detect_lock:
        if _model_detect is not None:
            return _model_detect(rgb)
        global _baseline
        if _baseline is None:
            import detector

            _baseline = detector.Detector()
        return _baseline(rgb)


# --- Stages -----------------------------------------------------------------
# progress(step, done, total) is called as work moves along, so the app can
# show which step is running. Steps, in order: frames, people, objects, contrast.

Progress = Callable[[str, int, int], None]


def _no_progress(step: str, done: int, total: int) -> None:
    pass


def load_photos(photos: list[tuple[str, bytes]]) -> list[tuple[Image.Image, dict]]:
    """Each photo upright, as RGB, at most 1280px on its long side."""
    images = []
    for name, data in photos:
        try:
            img = Image.open(io.BytesIO(data))
            img = ImageOps.exif_transpose(img).convert("RGB")
        except (UnidentifiedImageError, OSError):
            raise BadUpload(f"We couldn't open {name}. Try a JPG or PNG photo.")
        img.thumbnail((MAX_SIDE, MAX_SIDE))
        images.append((img, {}))
    return images


def load_video(video_path: Path) -> list[tuple[Image.Image, dict]]:
    """About one sharp, distinct frame per second; see frames.py."""
    try:
        picked = frames_lib.extract(video_path)
    except frames_lib.VideoError as e:
        raise BadUpload(str(e))
    return [(Image.fromarray(bgr[:, :, ::-1]), {"time_s": round(t, 1)}) for t, bgr in picked]


def save_frame(img: Image.Image, frames_dir: Path, frame_id: str) -> dict:
    """Shrink, blur any people, then write. Nothing unblurred reaches disk."""
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    try:
        img, people = blur.blur_people(img)
    except blur.BlurUnavailable as e:
        raise PrivacyUnavailable(str(e)) from e
    img.save(frames_dir / f"{frame_id}.jpg", quality=88)
    return {"frame_id": frame_id, "width": img.width, "height": img.height, "people_blurred": people}


# Objects that are a hazard wherever they're found: label -> (hazard type, severity).
ALWAYS_A_HAZARD = {
    "floor_clutter": ("floor_clutter", "high"),
    "mirror": ("mirror", "low"),
    "patterned_floor": ("patterned_floor", "medium"),
    "floor_glare": ("shiny_floor", "medium"),
}


def objects_to_hazards(room: str, frame: dict, objects: list[dict], rgb: np.ndarray | None = None,
                       outline_dir: Path | None = None, url_prefix: str = "") -> list[dict]:
    """Turn detected objects into hazards. Mirrors and clutter always count;
    bins count in bathrooms; rugs, toilets, fittings, furniture and stair
    edges count only when the contrast check says so (which needs the photo).
    Each hazard's exact outline is saved for the app when the photo is given."""
    masks = (
        contrast.outline(rgb, [o["box"] for o in objects], [o["label"] for o in objects])
        if rgb is not None
        else [None] * len(objects)
    )
    lab = contrast.to_lab(rgb) if rgb is not None else None

    hazards = []
    for obj, mask in zip(objects, masks):
        label = obj["label"]
        if label in ALWAYS_A_HAZARD:
            verdict = ALWAYS_A_HAZARD[label]
        elif label == "bin":
            verdict = ("toilet_lookalike", "medium") if room == "bathroom" else None
        else:
            verdict = contrast.judge(label, lab, mask) if mask is not None else None
        if verdict is None:
            continue

        outline_url = ""
        if mask is not None and outline_dir is not None:
            name = f"{frame['frame_id']}-{len(hazards) + 1}.png"
            contrast.save_outline(mask, outline_dir / name)
            outline_url = f"{url_prefix}/outlines/{name}"

        # For labels SAM traces in a widened box (rugs), the box covers both
        # what the detector saw and what SAM traced, so the rug is drawn whole.
        box = [int(v) for v in obj["box"]]
        if label in contrast.WIDEN and mask is not None and mask.any():
            ys, xs = np.nonzero(mask)
            box = [min(box[0], int(xs.min())), min(box[1], int(ys.min())),
                   max(box[2], int(xs.max()) + 1), max(box[3], int(ys.max()) + 1)]

        kind, severity = verdict
        hazards.append({
            "type": kind,
            "severity": severity,
            "confidence": obj["score"],
            "frame_id": frame["frame_id"],
            "box": box,
            "outline_url": outline_url,
        })
    return hazards


def live_hazards(room: str, image: Image.Image) -> list[dict]:
    """A quick look at one frame from the live camera: what may be a problem
    in it right now, for the app to mark on the video as you film. Objects
    that count by contrast are measured inside their box rather than traced
    with SAM, which would be too slow to do several times a second. Boxes are
    fractions of the frame (left, top, right, bottom). Nothing is saved; the
    full check runs on the recording."""
    rgb = np.asarray(image.convert("RGB"))
    h, w = rgb.shape[:2]
    lab = None
    found = []
    for obj in detect(image):
        label = obj["label"]
        x0, y0, x1, y1 = (int(round(v)) for v in obj["box"])
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
        if x1 <= x0 or y1 <= y0:
            continue
        if label in ALWAYS_A_HAZARD:
            verdict = ALWAYS_A_HAZARD[label]
        elif label == "bin":
            verdict = ("toilet_lookalike", "medium") if room == "bathroom" else None
        else:
            if lab is None:
                lab = contrast.to_lab(rgb)
            box = np.zeros((h, w), bool)
            box[y0:y1, x0:x1] = True
            verdict = contrast.judge(label, lab, box)
        if verdict is None:
            continue
        kind, severity = verdict
        found.append({
            "type": kind,
            "severity": severity,
            "confidence": round(float(obj["score"]), 3),
            "box": [round(x0 / w, 4), round(y0 / h, 4), round(x1 / w, 4), round(y1 / h, 4)],
        })
    return found


# --- Merging repeats ---------------------------------------------------------
# A video sees the same rug in many frames; the caregiver should get one card.
# Two sightings of the same kind of hazard are taken for the same thing when:
#   video:  they're at most SAME_GAP_S apart and its middle moved less than
#           SAME_SHIFT of the frame (the camera turns, so things slide across);
#           each sighting is compared with the group's latest, so a slow pan
#           keeps following the same rug.
#   photos: there's no timing, so only when the boxes sit in the same place
#           (IoU of SAME_PHOTO_IOU or more), as in burst shots.
# Two of the same thing in one frame are two things, unless one box mostly
# covers the other (SAME_FRAME_COVER of the smaller one): detectors often box
# one big rug twice.
SAME_GAP_S = 3.0
SAME_SHIFT = 0.45
SAME_PHOTO_IOU = 0.5
SAME_FRAME_COVER = 0.7
SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2}


def _norm_box(h: dict, frame: dict) -> tuple[float, float, float, float]:
    x0, y0, x1, y1 = h["box"]
    w, hgt = frame["width"], frame["height"]
    return x0 / w, y0 / hgt, x1 / w, y1 / hgt


def _iou(a: tuple, b: tuple) -> float:
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def _cover(a: list, b: list) -> float:
    """How much of the smaller box the larger one covers."""
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    smaller = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
    return ix * iy / smaller if smaller > 0 else 0.0


def _one_box_each(hazards: list[dict]) -> list[dict]:
    """Within a frame, keep the surer of two same-kind boxes on one thing."""
    kept: list[dict] = []
    for h in sorted(hazards, key=lambda h: -float(h["confidence"])):
        if not any(k["frame_id"] == h["frame_id"] and k["type"] == h["type"] and _cover(k["box"], h["box"]) >= SAME_FRAME_COVER
                   for k in kept):
            kept.append(h)
    return kept


def _shift(a: tuple, b: tuple) -> float:
    return float(np.hypot((a[0] + a[2] - b[0] - b[2]) / 2, (a[1] + a[3] - b[1] - b[3]) / 2))


def _same_thing(a: dict, b: dict, frames: dict[str, dict]) -> float | None:
    """How far apart two sightings are if they're the same thing (smaller is
    closer), or None if they aren't."""
    fa, fb = frames[a["frame_id"]], frames[b["frame_id"]]
    na, nb = _norm_box(a, fa), _norm_box(b, fb)
    ta, tb = fa.get("time_s"), fb.get("time_s")
    if ta is not None and tb is not None:
        moved = _shift(na, nb)
        return moved if abs(tb - ta) <= SAME_GAP_S and moved < SAME_SHIFT else None
    overlap = _iou(na, nb)
    return 1 - overlap if overlap >= SAME_PHOTO_IOU else None


def _clarity(h: dict, frame: dict) -> float:
    """How good a view this sighting is: sure of it, big enough to see, and
    not cut off at the edge of the picture."""
    x0, y0, x1, y1 = _norm_box(h, frame)
    size = min(1.0, (x1 - x0) * (y1 - y0) / 0.08) ** 0.5
    edge = 0.02
    cut_off = x0 <= edge or y0 <= edge or x1 >= 1 - edge or y1 >= 1 - edge
    return float(h["confidence"]) * size * (0.6 if cut_off else 1.0)


def merge_repeats(hazards: list[dict], frames: list[dict]) -> list[dict]:
    """One hazard per thing: sightings of the same thing across frames become
    one, shown in its clearest frame, at the most serious severity it got.
    Hazards come back in the order they were first seen, numbered h1, h2..."""
    by_id = {f["frame_id"]: f for f in frames}
    order = {f["frame_id"]: i for i, f in enumerate(frames)}
    groups: list[list[dict]] = []
    for h in sorted(_one_box_each(hazards), key=lambda h: order.get(h["frame_id"], 0)):
        best, best_gap = None, None
        for g in groups:
            if g[-1]["type"] != h["type"] or any(x["frame_id"] == h["frame_id"] for x in g):
                continue
            gap = _same_thing(g[-1], h, by_id)
            if gap is not None and (best_gap is None or gap < best_gap):
                best, best_gap = g, gap
        if best is None:
            groups.append([h])
        else:
            best.append(h)

    merged = []
    for i, g in enumerate(groups, start=1):
        clearest = max(g, key=lambda x: _clarity(x, by_id[x["frame_id"]]))
        worst = min((x["severity"] for x in g), key=lambda s: SEVERITY_RANK.get(s, 3))
        merged.append({**clearest, "severity": worst, "hazard_id": f"h{i}"})
    return merged


def analyze(room: str, frames_dir: Path, url_prefix: str,
            photos: list[tuple[str, bytes]], video_path: Path | None,
            progress: Progress = _no_progress) -> dict:
    progress("frames", 0, 0)
    images = load_video(video_path) if video_path else load_photos(photos)

    frames = []
    for i, (img, extra) in enumerate(images):
        progress("people", i, len(images))
        frames.append({**save_frame(img, frames_dir, f"f{i + 1:02d}"), **extra})

    found = []
    for i, frame in enumerate(frames):
        progress("objects", i, len(frames))
        with Image.open(frames_dir / f"{frame['frame_id']}.jpg") as img:
            found.append(detect(img))

    hazards = []
    for i, (frame, objects) in enumerate(zip(frames, found)):
        progress("contrast", i, len(frames))
        if not objects:
            continue
        with Image.open(frames_dir / f"{frame['frame_id']}.jpg") as img:
            rgb = np.asarray(img.convert("RGB"))
        hazards += objects_to_hazards(room, frame, objects, rgb, frames_dir.parent / "outlines", url_prefix)

    for frame in frames:
        frame["image_url"] = f"{url_prefix}/frames/{frame['frame_id']}.jpg"

    return {"room": room, "frames": frames, "hazards": merge_repeats(hazards, frames)}
