"""The brain: photos (or video frames) + room -> hazards in the shared/contract.json format.

detect objects (fine-tuned YOLO or Grounding DINO) + scene regions (floor, wall, door, window, glass door;
Grounding DINO) -> SAM 2 outlines -> check the problem (LRV contrast, darkness, glare, pattern,
position) -> hazard codes -> merge repeats across frames -> frames, outline PNGs, result.json.

Contrast rules use light reflectance value (LRV ~ 100 x relative luminance of linearised sRGB) with the
published dementia/low-vision thresholds (see HAZARD_RESEARCH.md):
  - critical surfaces (object vs surroundings, floor vs wall, door vs wall) need >= 30 LRV points;
    < 20 is poor (BS 8300 / DSDC / Thomas Pocklington Trust)
  - adjoining floor finishes should differ by <= 10 LRV points, ideally < 8 (DSDC)
Only surfaces side by side in the same frame are compared, because phone auto-exposure makes absolute
values unreliable.

Usage: analyze.py --room bathroom --out out/job1 [--detector gdino | --detector runs/run1/weights/best.pt] photo1.jpg ...
"""
import argparse
import json
import sys
import uuid
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent))
from prelabel import GROUPS, PHRASES, label_for  # noqa: E402

LABELS16 = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable", "floor_clutter", "bin",
            "bed", "sofa", "chair", "table", "door", "window", "glass_door"]
FLOOR_ITEMS = {"cable", "floor_clutter"}
FIXTURES = {"toilet", "toilet_roll_holder", "towel"}
FURNITURE = {"bed", "sofa", "chair", "table"}
SEV_COLOR = {"high": (220, 38, 38), "medium": (245, 158, 11), "low": (59, 130, 246)}
SEV_RANK = {"high": 3, "medium": 2, "low": 1}

# ---- thresholds from the guidance (LRV points) ----
LRV_POOR = 20             # below this between critical surfaces: flag
LRV_BAD = 10              # below this: hard to tell apart at all
SAME_SURFACE_LRV = 1.5    # floor vs "wall" closer than this: both samples are the same surface
FLOOR_STEP_LRV = 10       # adjoining floor areas differing by more than this can read as a step or hole
DARK_RUG_HIGH_LRV = 30    # rug darker than the floor by at least this: severe
# ---- image-measurement thresholds (tuned by eye on our footage) ----
PATTERN_EDGES = 0.12      # share of edge pixels inside a region that counts as a busy pattern
WALL_PATTERN_EDGES = 0.10
STAIR_EDGE_STRENGTH = 4.0 # mean vertical brightness change inside stairs; below = step edges hard to see
GLARE_SHARE = 0.02        # share of very bright, colourless floor pixels that counts as glare
ON_FLOOR_Y = 0.55         # box bottom below this share of image height = on the floor
DARK_WINDOW_LRV = 6       # window this dark while the room is lit = black glass at night
LIT_ROOM_LRV = 20

# Scene regions found with Grounding DINO text prompts (no training needed). Each special prompt runs
# alone with its own threshold: in a shared prompt "glass door" leaks onto every door.
SCENE = {
    "floor": ["floor"],
    "wall": ["wall"],
    "door": ["door"],
    "window": ["window"],
}
SPECIAL = {
    "glass_door": ("glass shower door . sliding glass door . glass door .", 0.45),
}
MIN_WINDOW_SHARE = 0.03   # window must cover at least 3% of the frame


def scene_label(text):
    t = text.lower()
    hits = [(len(p), lab) for lab, ps in SCENE.items() for p in ps if p in t]
    return max(hits)[1] if hits else None


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
        self.yolos = []  # [(model, labels it is responsible for or None=all, name map)]
        if detector != "gdino":
            from ultralytics import YOLO
            cfg = json.load(open(ROOT / "combo.json")) if detector == "combo" else {"per_label": None, "only": detector}
            weights = sorted(set(cfg["per_label"].values())) if cfg["per_label"] else [cfg["only"]]
            for w in weights:
                m = YOLO(ROOT / w)
                if Path(w).name == "yolov8l-worldv2.pt":
                    prompts = json.load(open(ROOT / "prompts.json"))["labels"]
                    m.set_classes([prompts[l][0] for l in LABELS16])
                    m.model.names = dict(enumerate(LABELS16))
                from evaluate import name_of
                names = {k: name_of(m.names, k) for k in m.names}
                mine = {l for l, x in cfg["per_label"].items() if x == w} if cfg["per_label"] else None
                self.yolos.append((m, mine, names))
        self.sam_proc = Sam2Processor.from_pretrained(ROOT / "weights" / "sam2.1-hiera-large")
        self.sam = Sam2Model.from_pretrained(ROOT / "weights" / "sam2.1-hiera-large").to(self.dev).eval()

    def _gd(self, im, prompt, threshold=0.30):
        inp = self.gd_proc(images=im, text=prompt, return_tensors="pt").to(self.dev)
        with torch.no_grad():
            out = self.gd(**inp)
        return self.gd_proc.post_process_grounded_object_detection(
            out, inp.input_ids, threshold=threshold, text_threshold=0.25, target_sizes=[im.size[::-1]])[0]

    def detect(self, im):
        """[(label, [x0, y0, x1, y1], score)] for the detector's object labels."""
        if self.yolos:
            dets = []
            for m, mine, names in self.yolos:
                r = m.predict(np.array(im)[:, :, ::-1], conf=0.30, verbose=False,
                              device=0 if self.dev == "cuda" else self.dev)[0]
                dets += [(names[int(c)], b, float(s)) for b, c, s in
                         zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist(), r.boxes.conf.tolist())
                         if mine is None or names[int(c)] in mine]
            return dets
        dets = []
        for group in GROUPS:
            prompt = " . ".join(p for lab in group for p in PHRASES[lab]) + " ."
            r = self._gd(im, prompt)
            for b, s, t in zip(r["boxes"].tolist(), r["scores"].tolist(), r["text_labels"]):
                lab = label_for(t)
                if lab and (b[2] - b[0]) * (b[3] - b[1]) < 0.95 * im.size[0] * im.size[1]:
                    dets.append((lab, b, float(s)))
        return dets

    def scene(self, im):
        """[(region, box, score)] for floor/wall/door/window/glass door."""
        prompt = " . ".join(p for ps in SCENE.values() for p in ps) + " ."
        r = self._gd(im, prompt, threshold=0.30)
        out = []
        for b, s, t in zip(r["boxes"].tolist(), r["scores"].tolist(), r["text_labels"]):
            lab = scene_label(t)
            if lab:
                out.append((lab, b, float(s)))
        W, H = im.size
        for lab, (prompt, thr) in SPECIAL.items():
            r = self._gd(im, prompt, threshold=thr)
            for b, s in zip(r["boxes"].tolist(), r["scores"].tolist()):
                w, h = b[2] - b[0], b[3] - b[1]
                if w * h > 0.9 * W * H:
                    continue
                # a coat that looks like a person: upright, hanging (top in the upper half of the frame)
                if lab == "coat" and not (h > 1.3 * w and b[1] < 0.5 * H):
                    continue
                out.append((lab, b, float(s)))
        return out

    def segment(self, im, boxes):
        if not boxes:
            return []
        inp = self.sam_proc(images=im, input_boxes=[boxes], return_tensors="pt").to(self.dev)
        with torch.no_grad():
            out = self.sam(**inp, multimask_output=False)
        masks = self.sam_proc.post_process_masks(out.pred_masks.cpu(), inp["original_sizes"])[0]
        return [m[0].numpy().astype(bool) for m in masks]


# ---------- measurements ----------
def lrv_image(rgb):
    """Approximate light reflectance value per pixel (0-100): 100 x relative luminance of linear sRGB."""
    c = rgb.astype(np.float32) / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 100 * (0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2])


def lab_image(rgb):
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    lab[..., 0] *= 100 / 255
    lab[..., 1:] -= 128
    return lab


def ring(mask, frac=0.15):
    side = max(9, int(frac * np.sqrt(mask.sum())))
    grown = cv2.dilate(mask.astype(np.uint8), np.ones((side, side), np.uint8)) > 0
    return grown & ~mask


def wall_above_floor(wall, floor):
    """Whether the wall sits mostly above the floor in the picture (its middle row is higher up)."""
    wy, fy = np.nonzero(wall)[0], np.nonzero(floor)[0]
    return len(wy) > 0 and len(fy) > 0 and float(np.median(wy)) < float(np.median(fy))


def lrv_contrast(lrv, mask, around=None):
    """(|LRV object - LRV surroundings|, surroundings - object). Median is robust to small highlights."""
    r = ring(mask) if around is None else around
    if mask.sum() < 50 or r.sum() < 50:
        return None, None
    a, b = float(np.median(lrv[mask])), float(np.median(lrv[r]))
    return abs(a - b), b - a


def edge_share(rgb, mask):
    edges = cv2.Canny(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), 80, 160) > 0
    inner = cv2.erode(mask.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    return float(edges[inner].mean()) if inner.sum() > 100 else 0.0


def stair_edge_strength(lab, mask):
    dy = np.abs(cv2.Sobel(lab[..., 0], cv2.CV_32F, 0, 1, ksize=3)) / 4
    return float(dy[mask].mean()) if mask.sum() > 100 else 99.0


def glare_share(lab, mask):
    chroma = np.linalg.norm(lab[..., 1:], axis=-1)
    bright = (lab[..., 0] > 92) & (chroma < 10)
    return float(bright[mask].mean()) if mask.sum() > 100 else 0.0


def floor_step(lrv, lab, floor, exclude):
    """Two large floor areas with different finishes side by side (not just a shadow):
    returns (LRV difference, mask of the darker area) or (None, None)."""
    m = floor & ~exclude
    if m.sum() < 2000:
        return None, None
    ys, xs = np.nonzero(m)
    feats = np.stack([lrv[ys, xs], lab[ys, xs, 1], lab[ys, xs, 2]], 1).astype(np.float32)
    _, lbl, cen = cv2.kmeans(feats, 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5),
                             3, cv2.KMEANS_PP_CENTERS)
    lbl = lbl.ravel()
    share = np.bincount(lbl, minlength=2) / len(lbl)
    d_lrv = abs(float(cen[0, 0] - cen[1, 0]))
    d_hue = float(np.linalg.norm(cen[0, 1:] - cen[1, 1:]))
    # shadows change brightness but not colour; a change of finish changes both
    if share.min() < 0.15 or d_lrv <= FLOOR_STEP_LRV or d_hue < 6:
        return None, None
    dark = int(np.argmin(cen[:, 0]))
    out = np.zeros_like(m)
    out[ys[lbl == dark], xs[lbl == dark]] = True
    out = cv2.morphologyEx(out.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)) > 0
    return (d_lrv, out) if out.sum() > 1000 else (None, None)


def box_of(mask):
    ys, xs = np.nonzero(mask)
    return [float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())]


# ---------- object -> hazard rules ----------
def hazards_for(label, mask, box, lab, lrv, rgb, room, H, floor):
    """Return [(hazard_type, severity, evidence)] for one detected object."""
    out = []
    around = (ring(mask) & floor) if label == "rug" and floor is not None and (ring(mask) & floor).sum() > 200 else None
    d, darker_by = lrv_contrast(lrv, mask, around)
    ev = {"lrv_difference": round(d, 1)} if d is not None else {}
    if label == "rug":
        if darker_by is not None and darker_by > FLOOR_STEP_LRV:
            out.append(("dark_rug", "high" if darker_by >= DARK_RUG_HIGH_LRV else "medium",
                        {"darker_than_floor_by": round(darker_by, 1)}))
        else:
            out.append(("loose_rug", "medium" if room in ("hallway", "stairs") else "low", {}))
        es = edge_share(rgb, mask)
        if es >= PATTERN_EDGES:
            out.append(("patterned_floor", "medium", {"edge_share": round(es, 3)}))
    elif label in FIXTURES:
        if d is not None and d < LRV_POOR:
            sev = "high" if label == "toilet" and d < LRV_BAD else "medium"
            out.append(("bathroom_fitting_blends_in", sev, ev))
    elif label in FURNITURE:
        if d is not None and d < LRV_POOR:
            out.append(("furniture_blends_in", "medium" if d < LRV_BAD else "low", ev))
    elif label == "mirror":
        out.append(("mirror", "low", {}))
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


def dedupe(dets, thr=0.6):
    dets = sorted(dets, key=lambda d: -d[2])
    kept = []
    for d in dets:
        if all(not (d[0] == k[0] and iou(d[1], k[1]) > thr) for k in kept):
            kept.append(d)
    return kept


def analyze_frame(an, im, room):
    rgb = np.array(im)
    H, W = rgb.shape[:2]
    lab, lrv = lab_image(rgb), lrv_image(rgb)
    objs = dedupe(an.detect(im))
    scene = dedupe(an.scene(im))
    # the fine-tuned detector may already know door/window; prefer its boxes
    have = {o[0] for o in objs}
    scene = [s for s in scene if s[0] not in have] + [o for o in objs if o[0] in SCENE]
    objs = [o for o in objs if o[0] not in SCENE]
    masks = an.segment(im, [o[1] for o in objs] + [s[1] for s in scene])
    omasks, smasks = masks[:len(objs)], masks[len(objs):]

    def union(name):
        ms = [m for (l, _, _), m in zip(scene, smasks) if l == name]
        return np.logical_or.reduce(ms) if ms else None

    floor, wall = union("floor"), union("wall")
    found = []

    def add(t, sev, conf, box, mask, obj, ev):
        found.append({"type": t, "severity": sev, "confidence": round(conf, 2), "box": box,
                      "mask": mask, "object": obj, "evidence": ev})

    for (label, box, score), mask in zip(objs, omasks):
        for t, sev, ev in hazards_for(label, mask, box, lab, lrv, rgb, room, H, floor):
            add(t, sev, score, box, mask, label, ev)

    obj_union = np.logical_or.reduce(omasks) if omasks else np.zeros((H, W), bool)
    lit_room = float(np.median(lrv)) >= LIT_ROOM_LRV

    glass = [b for l, b, _ in scene if l == "glass_door"]
    for (label, box, score), mask in zip(scene, smasks):
        if label == "door" and any(iou(box, g) > 0.5 for g in glass):
            continue  # already reported as a glass door
        if label == "glass_door":
            add("glass_door", "medium", score, box, mask, label, {})
        elif label == "door":
            around = ring(mask) & wall if wall is not None and (ring(mask) & wall).sum() > 200 else None
            d, _ = lrv_contrast(lrv, mask, around)
            if d is not None and d < LRV_POOR:
                add("door_blends_in", "medium" if d < LRV_BAD else "low", score, box, mask, label,
                    {"lrv_difference": round(d, 1)})
        elif label == "window":
            if lit_room and mask.mean() >= MIN_WINDOW_SHARE and float(np.median(lrv[mask])) < DARK_WINDOW_LRV:
                add("window_reflection", "low", score, box, mask, label,
                    {"window_lrv": round(float(np.median(lrv[mask])), 1)})

    if floor is not None and floor.sum() > 2000:
        fb = box_of(floor)
        g = glare_share(lab, floor)
        if g >= GLARE_SHARE:
            add("shiny_floor", "low", 0.5, fb, floor, "floor", {"glare_share": round(g, 3)})
        es = edge_share(rgb, floor & ~obj_union)
        if es >= PATTERN_EDGES:
            add("patterned_floor", "medium", 0.5, fb, floor, "floor", {"edge_share": round(es, 3)})
        d, step = floor_step(lrv, lab, floor, obj_union)
        if d is not None:
            add("floor_transition", "medium" if d > 2 * FLOOR_STEP_LRV else "low", 0.5, box_of(step), step,
                "floor", {"lrv_difference": round(d, 1)})
        # A pixel can't be both floor and wall, and a wall rises from the floor, so it sits mostly above it
        # in the picture. Without these, a camera pointed down at carpet can box the carpet as "wall" too and
        # compare it with itself (Anish, Oct 11: a near-0 difference on a carpet with no wall in view).
        wall_only = wall & ~floor if wall is not None else None
        if wall_only is not None and wall_only.sum() > 2000 and wall_above_floor(wall_only, floor):
            fw = floor & (cv2.dilate(wall_only.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0)
            ww = wall_only & (cv2.dilate(floor.astype(np.uint8), np.ones((41, 41), np.uint8)) > 0)
            d, _ = lrv_contrast(lrv, fw, ww)
            # Under SAME_SURFACE_LRV the two samples are the same surface, not a floor meeting a wall.
            if d is not None and fw.sum() > 500 and ww.sum() > 500 and SAME_SURFACE_LRV <= d < LRV_POOR:
                edge = fw | ww
                add("floor_wall_blend", "medium" if d < LRV_BAD else "low", 0.5, box_of(edge), edge,
                    "floor+wall", {"lrv_difference": round(d, 1)})
    if wall is not None and wall.sum() > 5000:
        es = edge_share(rgb, wall & ~obj_union)
        if es >= WALL_PATTERN_EDGES:
            add("patterned_wall", "low", 0.5, box_of(wall), wall, "wall", {"edge_share": round(es, 3)})
    return found


MAX_PER_OBJECT = 2  # cards per (hazard type, object) in one job: the caregiver needs one clear example, not 10


def merge(per_frame):
    """Same hazard seen in several frames of one video -> keep the clearest, most confident shot,
    then cap repeats of the same hazard on the same kind of object."""
    allh = [dict(h, frame=k) for k, hs in enumerate(per_frame) for h in hs]
    allh.sort(key=lambda h: (-SEV_RANK[h["severity"]], -h["confidence"]))
    kept = []
    for h in allh:
        dup = any(k["type"] == h["type"] and k["video"] == h["video"] and k["video"] is not None
                  and abs(k["frame_idx"] - h["frame_idx"]) <= 6 and iou(k["box"], h["box"]) > 0.2
                  for k in kept)
        if not dup:
            kept.append(h)
    count, capped = {}, []
    for h in kept:
        k = (h["type"], h["object"])
        count[k] = count.get(k, 0) + 1
        if count[k] <= MAX_PER_OBJECT:
            capped.append(h)
    return capped


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
        debug.append({"hazard_id": hid, "type": h["type"], "object": h["object"], "evidence": h["evidence"],
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
