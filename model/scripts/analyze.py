"""The brain: photos (or video frames) + room -> hazards in the shared/contract.json format.

detect objects -> SAM 2 outline -> check the problem (contrast, darkness, glare, pattern, on the floor)
-> map to the 10 hazard codes -> merge repeats across frames -> write frames, outline PNGs, result.json.

Usage: analyze.py --room bathroom --out out/job1 [--detector gdino | --detector runs/run1/weights/best.pt] photo1.jpg ...
"""
import argparse
import json
import uuid
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
import sys  # noqa: E402
sys.path.insert(0, str(Path(__file__).parent))
from prelabel import GROUPS, PHRASES, label_for  # noqa: E402

FLOOR_ITEMS = {"cable", "floor_clutter"}
FIXTURES = {"toilet", "toilet_roll_holder", "towel"}
FURNITURE = {"bed", "sofa", "chair", "table"}
SEV_COLOR = {"high": (220, 38, 38), "medium": (245, 158, 11), "low": (59, 130, 246)}
SEV_RANK = {"high": 3, "medium": 2, "low": 1}

# Rule thresholds (first guesses; tune on the labeled home test set)
DARK_RUG_DL = 25          # rug at least this much darker (L*, 0-100) than the floor around it
DARK_RUG_HIGH_DL = 40
PATTERN_EDGES = 0.12      # share of edge pixels inside a rug/floor that counts as a busy pattern
FIXTURE_BLEND_DE = 18     # colour difference (Delta E) below which a fixture blends into its surroundings
FIXTURE_HIGH_DE = 10
FURNITURE_BLEND_DE = 12
FURNITURE_MED_DE = 7
STAIR_EDGE_STRENGTH = 4.0 # mean vertical brightness change inside stairs; below = step edges hard to see
GLARE_SHARE = 0.02        # share of very bright, colourless floor pixels that counts as glare
ON_FLOOR_Y = 0.55         # box bottom below this share of image height = on the floor


def device():
    return "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"


class Analyzer:
    def __init__(self, detector="gdino"):
        from transformers import (AutoModelForZeroShotObjectDetection, AutoProcessor, Sam2Model,
                                  Sam2Processor)
        self.dev = device()
        self.detector = detector
        self.gd_proc = AutoProcessor.from_pretrained(ROOT / "weights" / "grounding-dino-base")
        self.gd = AutoModelForZeroShotObjectDetection.from_pretrained(
            ROOT / "weights" / "grounding-dino-base").to(self.dev).eval()
        if detector != "gdino":
            from ultralytics import YOLO
            self.yolo = YOLO(detector)
        self.sam_proc = Sam2Processor.from_pretrained(ROOT / "weights" / "sam2.1-hiera-large")
        self.sam = Sam2Model.from_pretrained(ROOT / "weights" / "sam2.1-hiera-large").to(self.dev).eval()

    # ---------- detection ----------
    def _gd(self, im, prompt, threshold=0.30):
        inp = self.gd_proc(images=im, text=prompt, return_tensors="pt").to(self.dev)
        with torch.no_grad():
            out = self.gd(**inp)
        return self.gd_proc.post_process_grounded_object_detection(
            out, inp.input_ids, threshold=threshold, text_threshold=0.25, target_sizes=[im.size[::-1]])[0]

    def detect(self, im):
        """[(label, [x0, y0, x1, y1], score)] for our 13 object labels."""
        if self.detector != "gdino":
            r = self.yolo.predict(np.array(im)[:, :, ::-1], conf=0.30, verbose=False, device=0 if self.dev == "cuda" else self.dev)[0]
            return [(r.names[int(c)], b, float(s)) for b, c, s in
                    zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist(), r.boxes.conf.tolist())]
        dets = []
        for group in GROUPS:
            prompt = " . ".join(p for lab in group for p in PHRASES[lab]) + " ."
            r = self._gd(im, prompt)
            for b, s, t in zip(r["boxes"].tolist(), r["scores"].tolist(), r["text_labels"]):
                lab = label_for(t)
                if lab and (b[2] - b[0]) * (b[3] - b[1]) < 0.95 * im.size[0] * im.size[1]:
                    dets.append((lab, b, float(s)))
        return dets

    def floor_box(self, im):
        r = self._gd(im, "floor .", threshold=0.30)
        if not len(r["boxes"]):
            return None
        return r["boxes"][int(torch.argmax(r["scores"]))].tolist()

    # ---------- outlines ----------
    def segment(self, im, boxes):
        if not boxes:
            return []
        inp = self.sam_proc(images=im, input_boxes=[boxes], return_tensors="pt").to(self.dev)
        with torch.no_grad():
            out = self.sam(**inp, multimask_output=False)
        masks = self.sam_proc.post_process_masks(out.pred_masks.cpu(), inp["original_sizes"])[0]
        return [m[0].numpy().astype(bool) for m in masks]


# ---------- measurements ----------
def lab_image(rgb):
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    lab[..., 0] *= 100 / 255
    lab[..., 1:] -= 128
    return lab


def ring(mask, frac=0.15):
    side = max(9, int(frac * np.sqrt(mask.sum())))
    grown = cv2.dilate(mask.astype(np.uint8), np.ones((side, side), np.uint8)) > 0
    return grown & ~mask


def contrast(lab, mask):
    """(Delta E between object and surroundings, L* surroundings minus L* object)."""
    r = ring(mask)
    if mask.sum() < 50 or r.sum() < 50:
        return None, None
    a, b = lab[mask].mean(0), lab[r].mean(0)
    return float(np.linalg.norm(a - b)), float(b[0] - a[0])


def edge_share(rgb, mask):
    edges = cv2.Canny(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), 80, 160) > 0
    inner = cv2.erode(mask.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0  # ignore the object's own outline
    return float(edges[inner].mean()) if inner.sum() > 100 else 0.0


def stair_edge_strength(lab, mask):
    dy = np.abs(cv2.Sobel(lab[..., 0], cv2.CV_32F, 0, 1, ksize=3)) / 4
    return float(dy[mask].mean()) if mask.sum() > 100 else 99.0


def glare_share(lab, mask):
    chroma = np.linalg.norm(lab[..., 1:], axis=-1)
    bright = (lab[..., 0] > 92) & (chroma < 10)
    return float(bright[mask].mean()) if mask.sum() > 100 else 0.0


# ---------- object -> hazard rules ----------
def hazards_for(label, mask, box, score, lab, rgb, room, H):
    """Return [(hazard_type, severity, evidence)] for one detected object."""
    out = []
    de, dl = contrast(lab, mask)
    if label == "rug":
        if dl is not None and dl >= DARK_RUG_DL:
            out.append(("dark_rug", "high" if dl >= DARK_RUG_HIGH_DL else "medium", {"darker_by": round(dl, 1)}))
        else:
            out.append(("loose_rug", "medium" if room in ("hallway", "stairs") else "low", {}))
        es = edge_share(rgb, mask)
        if es >= PATTERN_EDGES:
            out.append(("patterned_floor", "medium", {"edge_share": round(es, 3)}))
    elif label in FIXTURES:
        if de is not None and de < FIXTURE_BLEND_DE:
            sev = "high" if label == "toilet" and de < FIXTURE_HIGH_DE else "medium"
            out.append(("bathroom_fitting_blends_in", sev, {"delta_e": round(de, 1)}))
    elif label in FURNITURE:
        if de is not None and de < FURNITURE_BLEND_DE:
            out.append(("furniture_blends_in", "medium" if de < FURNITURE_MED_DE else "low", {"delta_e": round(de, 1)}))
    elif label == "mirror":
        out.append(("mirror", "medium", {}))
    elif label == "stairs":
        s = stair_edge_strength(lab, mask)
        if s < STAIR_EDGE_STRENGTH:
            out.append(("stair_edge_hard_to_see", "high", {"edge_strength": round(s, 2)}))
    elif label in FLOOR_ITEMS:
        if box[3] / H >= ON_FLOOR_Y:
            out.append(("floor_clutter", "high" if label == "cable" else "medium", {"on_floor": True}))
    elif label == "bin":
        if room == "bathroom":
            out.append(("toilet_lookalike", "medium", {}))
    return out


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


def analyze_frame(an, im, room):
    rgb = np.array(im)
    H = rgb.shape[0]
    lab = lab_image(rgb)
    dets = an.detect(im)
    # same label, heavily overlapping boxes: keep the most confident
    dets.sort(key=lambda d: -d[2])
    kept = []
    for d in dets:
        if all(not (d[0] == k[0] and iou(d[1], k[1]) > 0.6) for k in kept):
            kept.append(d)
    masks = an.segment(im, [d[1] for d in kept])
    found = []
    for (label, box, score), mask in zip(kept, masks):
        for htype, sev, ev in hazards_for(label, mask, box, score, lab, rgb, room, H):
            found.append({"type": htype, "severity": sev, "confidence": round(score, 2), "box": box,
                          "mask": mask, "object": label, "evidence": ev})
    fb = an.floor_box(im)
    if fb:
        fmask = an.segment(im, [fb])[0]
        g = glare_share(lab, fmask)
        if g >= GLARE_SHARE:
            found.append({"type": "shiny_floor", "severity": "low", "confidence": 0.5, "box": fb, "mask": fmask,
                          "object": "floor", "evidence": {"glare_share": round(g, 3)}})
        es = edge_share(rgb, fmask)
        if es >= PATTERN_EDGES:
            found.append({"type": "patterned_floor", "severity": "medium", "confidence": 0.5, "box": fb,
                          "mask": fmask, "object": "floor", "evidence": {"edge_share": round(es, 3)}})
    return found


def merge(per_frame):
    """Same hazard seen in several frames of one video -> keep the clearest, most confident shot."""
    allh = [dict(h, frame=k) for k, hs in enumerate(per_frame) for h in hs]
    allh.sort(key=lambda h: (-SEV_RANK[h["severity"]], -h["confidence"]))
    kept = []
    for h in allh:
        dup = any(k["type"] == h["type"] and k["video"] == h["video"] and k["video"] is not None
                  and abs(k["frame_idx"] - h["frame_idx"]) <= 6 and iou(k["box"], h["box"]) > 0.2
                  for k in kept)
        if not dup:
            kept.append(h)
    return kept


def outline_png(mask, color, path):
    h, w = mask.shape
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[mask] = (*color, 90)
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(rgba, contours, -1, (*color, 255), thickness=max(3, w // 200))
    Image.fromarray(rgba, "RGBA").save(path)


def run(an, image_paths, room, out_dir, job_id=None, video_info=None):
    """video_info: optional list of (video_name, frame_idx) per image so repeats get merged."""
    out_dir = Path(out_dir)
    (out_dir / "frames").mkdir(parents=True, exist_ok=True)
    (out_dir / "outlines").mkdir(exist_ok=True)
    job_id = job_id or uuid.uuid4().hex[:8]
    ims = [Image.open(p).convert("RGB") for p in image_paths]
    per_frame = []
    for k, im in enumerate(ims):
        hs = analyze_frame(an, im, room)
        vid, idx = video_info[k] if video_info else (None, k)
        for h in hs:
            h["video"], h["frame_idx"] = vid, idx
        per_frame.append(hs)
    hazards = merge(per_frame)
    used = sorted({h["frame"] for h in hazards})
    frame_ids = {k: f"f{n + 1:02d}" for n, k in enumerate(used)}
    frames = []
    for k in used:
        im = ims[k]
        im.save(out_dir / "frames" / f"{frame_ids[k]}.jpg", quality=92)
        frames.append({"frame_id": frame_ids[k], "image_url": f"/frames/{frame_ids[k]}.jpg",
                       "width": im.size[0], "height": im.size[1]})
    out_h, debug = [], []
    for n, h in enumerate(hazards, 1):
        hid = f"h{n}"
        outline_png(h["mask"], SEV_COLOR[h["severity"]], out_dir / "outlines" / f"{hid}.png")
        out_h.append({"hazard_id": hid, "type": h["type"], "severity": h["severity"],
                      "confidence": h["confidence"], "frame_id": frame_ids[h["frame"]],
                      "box": [int(round(v)) for v in h["box"]], "outline_url": f"/outlines/{hid}.png"})
        debug.append({"hazard_id": hid, "object": h["object"], "evidence": h["evidence"],
                      "source": str(image_paths[h["frame"]])})
    result = {"job_id": job_id, "room": room, "frames": frames, "hazards": out_h}
    json.dump(result, open(out_dir / "result.json", "w"), indent=2)
    json.dump(debug, open(out_dir / "debug.json", "w"), indent=2)
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--room", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--detector", default="gdino")
    ap.add_argument("images", nargs="+")
    a = ap.parse_args()
    an = Analyzer(a.detector)
    r = run(an, a.images, a.room, a.out)
    print(json.dumps({"hazards": len(r["hazards"]), "types": [h["type"] for h in r["hazards"]]}))


if __name__ == "__main__":
    main()
