"""Blur people in a frame before it is saved, so family members aren't stored.

Uses an off-the-shelf YOLO11 segmentation model (Ultralytics, COCO "person"),
which downloads itself into weights/ on first use.
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

WEIGHTS = Path(__file__).resolve().parent / "weights" / "yolo11n-seg.pt"
PERSON = 0
# Low on purpose: blurring a coat on a chair is better than missing a person.
MIN_CONFIDENCE = 0.2
# Grow each person's outline by this fraction of the image's long side, so
# hair, hands and edges the outline misses are covered too.
GROW = 0.03


class BlurUnavailable(RuntimeError):
    """The person detector couldn't load, so frames must not be saved."""


_model = None


def _get_model():
    global _model
    if _model is None:
        try:
            from ultralytics import YOLO

            _model = YOLO(str(WEIGHTS))
        except Exception as e:
            raise BlurUnavailable(f"Couldn't load the person detector: {e}") from e
    return _model


def person_mask(bgr: np.ndarray) -> tuple[np.ndarray, int]:
    """A 0/255 mask covering every person found, and how many were found."""
    h, w = bgr.shape[:2]
    result = _get_model().predict(bgr, classes=[PERSON], conf=MIN_CONFIDENCE, imgsz=1280, verbose=False)[0]
    mask = np.zeros((h, w), np.uint8)
    boxes = result.boxes.xyxy.cpu().numpy().round().astype(int)
    outlines = result.masks.xy if result.masks is not None else [None] * len(boxes)

    for box, outline in zip(boxes, outlines):
        if outline is not None and len(outline) >= 3:
            cv2.fillPoly(mask, [outline.round().astype(np.int32)], 255)
        else:
            x0, y0, x1, y1 = box
            mask[max(0, y0):y1, max(0, x0):x1] = 255

    if len(boxes):
        grow = max(3, round(GROW * max(h, w)))
        mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)))
    return mask, len(boxes)


def blur_people(img: Image.Image) -> tuple[Image.Image, int]:
    """Return the image with every person heavily blurred, and the count."""
    bgr = np.asarray(img.convert("RGB"))[:, :, ::-1].copy()
    mask, count = person_mask(bgr)
    if count == 0:
        return img, 0

    blurred = cv2.GaussianBlur(bgr, (0, 0), sigmaX=max(bgr.shape[:2]) / 30)
    out = np.where(mask[:, :, None] == 255, blurred, bgr)
    return Image.fromarray(out[:, :, ::-1].copy()), count
