"""Outline objects with SAM 2, then measure how much each one stands out.

A rug isn't a hazard because it's a rug; it's a hazard when it's dark against
the floor. A toilet is a problem when it blends into the floor and walls. So
for each object we compare the pixels inside its outline with a ring of
pixels just outside it, in CIE Lab color (L* is lightness, 0-100; distances
roughly match how different two colors look).
"""

from pathlib import Path

import cv2
import numpy as np

WEIGHTS = Path(__file__).resolve().parent / "weights" / "sam2.1_t.pt"

# Thresholds, in Lab units.
DARK_RUG_GAP = 20         # rug at least this much darker than the floor around it
BLENDS_IN_DELTA_E = 18    # object and surroundings closer than this look alike
BLENDS_IN_BADLY = 9       # ...and closer than this is hard to see at all
STAIR_EDGE_STEP = 10      # a visible step edge changes lightness at least this much

# SAM only traces inside the box it's given, and the detector's rug boxes are
# often too tight, cutting the rug short. Rugs lie flat on a plain floor, so
# letting SAM look a little wider finds the rest of the rug without spilling.
# (Widening every box makes mirrors and furniture worse, so it's rugs only.)
WIDEN = {"rug": 0.1}

_sam = None


def prompt_box(box: list[int], label: str | None, shape: tuple[int, ...]) -> list[int]:
    """The box SAM is asked to trace in: widened for labels in WIDEN."""
    grow = WIDEN.get(label or "", 0)
    if not grow:
        return box
    x0, y0, x1, y1 = box
    dx, dy = int((x1 - x0) * grow), int((y1 - y0) * grow)
    h, w = shape[:2]
    return [max(0, x0 - dx), max(0, y0 - dy), min(w - 1, x1 + dx), min(h - 1, y1 + dy)]


def outline(rgb: np.ndarray, boxes: list[list[int]], labels: list[str] | None = None) -> list[np.ndarray]:
    """One boolean mask per box, the shape of the object inside it."""
    if not boxes:
        return []
    global _sam
    if _sam is None:
        from ultralytics import SAM

        _sam = SAM(str(WEIGHTS))
    prompts = [prompt_box(b, labels[i] if labels else None, rgb.shape) for i, b in enumerate(boxes)]
    result = _sam(rgb[:, :, ::-1], bboxes=prompts, verbose=False)[0]
    masks = result.masks.data.cpu().numpy() > 0.5 if result.masks is not None else []
    out = []
    for i, box in enumerate(boxes):
        mask = masks[i] if i < len(masks) else None
        if mask is None or mask.sum() < 50:
            # SAM found nothing usable: fall back to the box itself.
            mask = np.zeros(rgb.shape[:2], bool)
            x0, y0, x1, y1 = box
            mask[y0:y1, x0:x1] = True
        out.append(fill_holes(mask))
    return out


def fill_holes(mask: np.ndarray) -> np.ndarray:
    """Objects are solid: fill gaps fully enclosed by the outline (SAM leaves
    them where a mirror reflects or a pattern changes)."""
    # Pad by one so the flood from the corner reaches every outside pixel.
    padded = np.pad(mask.astype(np.uint8), 1)
    flood_mask = np.zeros((padded.shape[0] + 2, padded.shape[1] + 2), np.uint8)
    cv2.floodFill(padded, flood_mask, (0, 0), 1)
    return mask | (padded[1:-1, 1:-1] == 0)


def to_lab(rgb: np.ndarray) -> np.ndarray:
    """Lab with L* in 0-100 and a*, b* centered on 0."""
    lab = cv2.cvtColor(rgb.astype(np.float32) / 255.0, cv2.COLOR_RGB2LAB)
    return lab


def ring(mask: np.ndarray) -> np.ndarray:
    """The band of pixels just outside an object's outline."""
    ys, xs = np.nonzero(mask)
    size = max(ys.max() - ys.min(), xs.max() - xs.min())
    grow = int(np.clip(size * 0.12, 8, 60))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1))
    outer = cv2.dilate(mask.astype(np.uint8), kernel).astype(bool)
    return outer & ~mask


def measure(lab: np.ndarray, mask: np.ndarray) -> dict:
    """Median color inside the outline and in the ring around it."""
    inside = np.median(lab[mask], axis=0)
    around = np.median(lab[ring(mask)], axis=0)
    return {
        "lightness": float(inside[0]),
        "around_lightness": float(around[0]),
        "delta_e": float(np.linalg.norm(inside - around)),
    }


def stair_edges_visible(lab: np.ndarray, mask: np.ndarray) -> bool:
    """Steps show up as sudden lightness changes from one row to the next."""
    ys, xs = np.nonzero(mask)
    rows = [np.median(lab[y, xs[ys == y], 0]) for y in range(ys.min(), ys.max() + 1) if (ys == y).sum() > 5]
    if len(rows) < 4:
        return True
    # Compare rows a few pixels apart so soft edges still count.
    profile = np.array(rows)
    jumps = np.abs(profile[4:] - profile[:-4])
    return bool(jumps.max() >= STAIR_EDGE_STEP)


def judge(label: str, lab: np.ndarray, mask: np.ndarray) -> tuple[str, str] | None:
    """(hazard type, severity) for an object whose problem is contrast, or None."""
    m = measure(lab, mask)
    if label == "rug":
        if m["around_lightness"] - m["lightness"] >= DARK_RUG_GAP:
            return "dark_rug", "high"
        return "loose_rug", "low"
    if label in ("toilet", "bathroom_fitting"):
        if m["delta_e"] < BLENDS_IN_BADLY:
            return "bathroom_fitting_blends_in", "high"
        if m["delta_e"] < BLENDS_IN_DELTA_E:
            return "bathroom_fitting_blends_in", "medium"
        return None
    if label == "furniture":
        if m["delta_e"] < BLENDS_IN_DELTA_E:
            return "furniture_blends_in", "medium"
        return None
    if label == "stair_edge":
        return None if stair_edges_visible(lab, mask) else ("stair_edge_hard_to_see", "high")
    return None


def save_outline(mask: np.ndarray, path: Path) -> None:
    """White where the object is, transparent elsewhere: usable as a CSS mask."""
    rgba = np.zeros((*mask.shape, 4), np.uint8)
    rgba[mask] = (255, 255, 255, 255)
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
