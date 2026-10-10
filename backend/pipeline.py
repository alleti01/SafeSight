"""The analysis pipeline: uploaded files in, contract-shaped results out.

Each stage is a plain function so it can be built and tested on its own.
Stages marked TODO are stubs for now; see the phase cards for when each lands.
"""

import io
import sys
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


def detect(image: Image.Image) -> list[dict]:
    rgb = np.asarray(image.convert("RGB"))
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


def merge_repeats(hazards: list[dict]) -> list[dict]:
    # TODO(be-merge): group the same hazard seen in several frames; keep the clearest.
    for i, h in enumerate(hazards, start=1):
        h["hazard_id"] = f"h{i}"
    return hazards


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

    return {"room": room, "frames": frames, "hazards": merge_repeats(hazards)}
