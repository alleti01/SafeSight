"""The fine-tuned detector as a plain function (the model/ -> app hand-off in shared/README.md).

  detect(image)                        -> [{"label", "box": [x0, y0, x1, y1], "score"}]  (pixels, the 10 shared classes)
  detect16(image)                      -> same, with SafeSight's 16 object types
  live_hazards(analyzer, image, room)  -> hazards for one live-camera frame, boxes as fractions of the frame

Weights: combo.json (best fine-tuned run per object type). Swapping in new weights does not change these signatures.
"""
import sys
import threading
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "scripts"))
from analyze import Analyzer, dedupe, hazards_for, lab_image, lrv_image  # noqa: E402

# SafeSight's 16 object types -> the 10 classes named in shared/README.md (None: not one of them)
TO_SHARED = {"rug": "rug", "toilet": "toilet", "toilet_roll_holder": "bathroom_fitting", "towel": "bathroom_fitting",
             "mirror": "mirror", "stairs": "stair_edge", "cable": "floor_clutter", "floor_clutter": "floor_clutter",
             "bin": "bin", "bed": "furniture", "sofa": "furniture", "chair": "furniture", "table": "furniture",
             "door": None, "window": None, "glass_door": None}

_an = None
_lock = threading.Lock()


def _analyzer():
    global _an
    with _lock:
        if _an is None:
            _an = Analyzer("combo")
        return _an


def _pil(image):
    return image.convert("RGB") if isinstance(image, Image.Image) else Image.fromarray(np.asarray(image)[..., :3])


def detect16(image):
    dets = dedupe(_analyzer().detect(_pil(image)))
    return [{"label": l, "box": [round(float(v), 1) for v in b], "score": round(s, 3)} for l, b, s in dets]


def detect(image):
    out = []
    for d in detect16(image):
        shared = TO_SHARED.get(d["label"])
        if shared:
            out.append({**d, "label": shared})
    return out


def live_hazards(an, im, room):
    """Fast check of one camera frame: detector boxes + contrast measured inside each box (no SAM outline,
    no floor/wall segmentation), so it keeps up with a few frames a second."""
    im = _pil(im)
    rgb = np.array(im)
    H, W = rgb.shape[:2]
    lab, lrv = lab_image(rgb), lrv_image(rgb)
    found = []
    for label, box, score in dedupe(an.detect(im)):
        x0, y0, x1, y1 = (int(round(v)) for v in box)
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
        if x1 <= x0 or y1 <= y0:
            continue
        mask = np.zeros((H, W), bool)
        mask[y0:y1, x0:x1] = True
        for t, sev, _ in hazards_for(label, mask, [x0, y0, x1, y1], lab, lrv, rgb, room, H, None):
            found.append({"type": t, "severity": sev, "confidence": round(float(score), 3), "object": label,
                          "box": [round(x0 / W, 4), round(y0 / H, 4), round(x1 / W, 4), round(y1 / H, 4)]})
    return found
