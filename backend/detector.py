"""Baseline object detector, used until Abhi's fine-tuned model is on this machine.

YOLO-World finds objects from text prompts, so it can look for our object
classes (shared/README.md) without training. Several prompts can feed one
class ("rug", "bath mat" -> rug). It is the "starting model" the fine-tuned
detector is compared against.
"""

from pathlib import Path

import numpy as np

WEIGHTS = Path(__file__).resolve().parent / "weights" / "yolov8s-worldv2.pt"

# class -> the prompts that find it. patterned_floor and floor_glare are left to
# the fine-tuned model: they're surfaces, which a prompt-based detector boxes badly.
PROMPTS: dict[str, list[str]] = {
    "rug": ["rug", "bath mat", "doormat"],
    "mirror": ["mirror"],
    "toilet": ["toilet"],
    "bathroom_fitting": ["toilet paper holder", "towel", "towel rail", "grab bar"],
    "furniture": ["chair", "sofa", "bed", "table"],
    # The guide: "a bin, basket or storage box" in a bathroom may be mistaken for the toilet.
    "bin": ["trash can", "laundry basket", "wicker basket"],
    "floor_clutter": ["cable on the floor", "shoes", "cardboard box"],
    "stair_edge": ["stairs"],
}

# Things that aren't hazards but look like ones. The detector gives each box
# one name, so a basket named "wicker basket" can't also be called a rug.
# Matches on these are dropped.
DECOYS = ["bottle", "potted plant", "bathtub", "sink", "window", "towel on a rail",
          "stack of folded towels", "footstool", "ottoman", "wooden stool"]

MIN_SCORE = 0.25
# Clutter prompts fire on stray lines and shadows, so they need to be surer.
MIN_SCORE_BY_LABEL = {"floor_clutter": 0.35, "bin": 0.35}
# Two boxes of the same class overlapping this much are the same object.
SAME_OBJECT_IOU = 0.6


class Detector:
    def __init__(self, prompts: dict[str, list[str]] = PROMPTS, weights: Path = WEIGHTS, decoys: list[str] = DECOYS):
        from ultralytics import YOLOWorld

        self.labels = [label for label, texts in prompts.items() for _ in texts] + [None] * len(decoys)
        self.model = YOLOWorld(str(weights))
        self.model.set_classes([text for texts in prompts.values() for text in texts] + decoys)

    def __call__(self, rgb: np.ndarray) -> list[dict]:
        """[{"label", "box": [x0, y0, x1, y1], "score"}] in pixel coordinates."""
        h, w = rgb.shape[:2]
        result = self.model.predict(rgb[:, :, ::-1], conf=min(MIN_SCORE, *MIN_SCORE_BY_LABEL.values()),
                                    imgsz=max(h, w), verbose=False)[0]
        found, decoys = [], []
        for cls, score, box in zip(result.boxes.cls.tolist(), result.boxes.conf.tolist(), result.boxes.xyxy.tolist()):
            label = self.labels[int(cls)]
            x0, y0, x1, y1 = (round(v) for v in box)
            obj = {"label": label, "box": [max(0, x0), max(0, y0), min(w, x1), min(h, y1)], "score": round(score, 3)}
            if label is None:
                decoys.append(obj)
            elif score >= MIN_SCORE_BY_LABEL.get(label, MIN_SCORE):
                found.append(obj)
        return dedupe(one_name_each(drop_decoyed(found, decoys)))


def iou(a: list[int], b: list[int]) -> float:
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union else 0.0


def drop_decoyed(objects: list[dict], decoys: list[dict]) -> list[dict]:
    """Drop a box when a decoy (a basket, a bottle) sits on the same spot and
    the detector is at least as sure it's the decoy."""
    return [o for o in objects
            if not any(iou(o["box"], d["box"]) > SAME_OBJECT_IOU and d["score"] >= o["score"] for d in decoys)]


def one_name_each(objects: list[dict]) -> list[dict]:
    """When two classes claim the same spot (a basket found as both a bin and
    a rug), keep the one the detector is surer of."""
    return [o for o in objects
            if not any(p["label"] != o["label"] and iou(o["box"], p["box"]) > SAME_OBJECT_IOU and p["score"] > o["score"]
                       for p in objects)]


def dedupe(objects: list[dict]) -> list[dict]:
    """Keep the best box when several prompts found the same object."""
    kept: list[dict] = []
    for obj in sorted(objects, key=lambda o: -o["score"]):
        if not any(k["label"] == obj["label"] and iou(k["box"], obj["box"]) > SAME_OBJECT_IOU for k in kept):
            kept.append(obj)
    return kept
