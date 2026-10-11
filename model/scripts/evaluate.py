"""Score detectors on the hand-labeled home test set (Abhi's home, never trained on).

Models: untrained Grounding DINO with the frozen prompts (the "before"), and fine-tuned YOLO runs (the "after").
Metric: AP at IoU 0.5 per label (all-point interpolated, same code for every model), plus mAP50 over
  - "common": the 13 labels every model knows (fair before/after comparison)
  - "all": every label the model knows that appears in the test set
Ground truth: completed Label Studio annotations (project 1), pulled fresh each run.

Usage: evaluate.py [--models gdino runs/run1/weights/best.pt runs/run2/weights/best.pt] [--out data/eval]
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent))
from labelstudio_setup import access_token, api  # noqa: E402

# EVAL_SET=home2 scores the second held-out test home (a friend's house, never trained on) instead of Abhi's home
import os  # noqa: E402
HOME2 = os.environ.get("EVAL_SET") == "home2"
FRAMES = ROOT / "data" / "frames" / ("friends4" if HOME2 else "home_test")
EVAL_DIR = ROOT / "data" / "eval" / ("home2" if HOME2 else "")
PROMPTS = json.load(open(ROOT / "prompts.json"))  # frozen baseline prompts
LABELS16 = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable", "floor_clutter", "bin",
            "bed", "sofa", "chair", "table", "door", "window", "glass_door"]
COMMON = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable",
          "floor_clutter", "bin", "bed", "sofa", "chair", "table"]
IOU = 0.5


def ground_truth():
    """{file: [(label, [x0, y0, x1, y1])]} from completed annotations (frozen snapshot if present)."""
    snap = EVAL_DIR / "test_gt.json"
    if snap.exists():
        return {f: [tuple(b) for b in v] for f, v in json.load(open(snap)).items()}
    tok = access_token()
    gt, page = {}, 1
    while True:
        r = api("GET", f"/api/tasks?project=1&page={page}&page_size=100&fields=all", tok)
        batch = r["tasks"] if isinstance(r, dict) else r
        for t in batch:
            anns = [a for a in t.get("annotations", []) if not a.get("was_cancelled")]
            if not anns:
                continue
            boxes = []
            for res in anns[-1]["result"]:
                if res.get("type") != "rectanglelabels":
                    continue
                v, W, H = res["value"], res["original_width"], res["original_height"]
                x0, y0 = v["x"] * W / 100, v["y"] * H / 100
                boxes.append((v["rectanglelabels"][0], [x0, y0, x0 + v["width"] * W / 100, y0 + v["height"] * H / 100]))
            gt[t["data"]["file"]] = boxes
        if len(batch) < 100:
            break
        page += 1
    return gt


def predict_gdino(files):
    from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor
    dev = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
    proc = AutoProcessor.from_pretrained(ROOT / "weights" / "grounding-dino-base")
    model = AutoModelForZeroShotObjectDetection.from_pretrained(ROOT / "weights" / "grounding-dino-base").to(dev).eval()
    phrase_to_label = sorted(((p, lab) for lab, ps in PROMPTS["labels"].items() for p in ps), key=lambda x: -len(x[0]))
    out = {}
    for f in files:
        im = Image.open(FRAMES / f).convert("RGB")
        preds = []
        for group in PROMPTS["groups"]:
            text = " . ".join(p for lab in group for p in PROMPTS["labels"][lab]) + " ."
            inp = proc(images=im, text=text, return_tensors="pt").to(dev)
            with torch.no_grad():
                o = model(**inp)
            r = proc.post_process_grounded_object_detection(
                o, inp.input_ids, threshold=PROMPTS["eval_threshold"], text_threshold=PROMPTS["eval_threshold"],
                target_sizes=[im.size[::-1]])[0]
            for b, s, t in zip(r["boxes"].tolist(), r["scores"].tolist(), r["text_labels"]):
                lab = next((l for p, l in phrase_to_label if p in t.lower()), None)
                if lab:
                    preds.append((lab, b, float(s)))
        out[f] = preds
    return out, set(PROMPTS["labels"])


def predict_yolo(weights, files):
    from ultralytics import YOLO
    m = YOLO(weights)
    if Path(weights).name == "yolov8l-worldv2.pt":  # untrained, open-vocabulary: one prompt per label (first frozen phrase)
        from ultralytics import YOLOWorld
        m = YOLOWorld(weights)
        m.set_classes([PROMPTS["labels"][l][0] for l in PROMPTS["labels"]])
        m.model.names = dict(enumerate(PROMPTS["labels"]))
    dev = "mps" if torch.backends.mps.is_available() else 0 if torch.cuda.is_available() else "cpu"
    out = {}
    for f in files:
        r = m.predict(str(FRAMES / f), conf=0.01, iou=0.6, max_det=300, verbose=False, device=dev)[0]
        out[f] = [(name_of(r.names, c), b, float(s)) for b, c, s in
                  zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist(), r.boxes.conf.tolist())]
    return out, {name_of(m.names, k) for k in m.names}


def predict_combo(cfg_path, files):
    cfg = json.load(open(cfg_path))
    out = {f: [] for f in files}
    for w in sorted(set(cfg["per_label"].values())):
        preds, _ = predict_yolo(ROOT / w, files)
        mine = {l for l, x in cfg["per_label"].items() if x == w}
        for f in files:
            out[f] += [p for p in preds[f] if p[0] in mine]
    return out, set(cfg["per_label"])


PHRASE2LABEL = {"toilet paper": "toilet_roll_holder", "staircase": "stairs", "power cord": "cable",
                "clutter on floor": "floor_clutter", "trash can": "bin", "glass door": "glass_door"}


def name_of(names, c):
    """Fine-tuned YOLO-World models were trained with plain-phrase class names; map them back to our labels."""
    n = names[int(c)]
    if n in LABELS16:
        return n
    if n in PHRASE2LABEL:
        return PHRASE2LABEL[n]
    return LABELS16[int(c)] if len(names) == 16 else n


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


def average_precision(gt, preds, label):
    n_gt = sum(1 for boxes in gt.values() for l, _ in boxes if l == label)
    if n_gt == 0:
        return None, 0
    dets = sorted(((s, f, b) for f, ps in preds.items() for l, b, s in ps if l == label), key=lambda x: -x[0])
    used = defaultdict(set)
    tp = []
    for s, f, b in dets:
        cands = [(iou(b, g), k) for k, (l, g) in enumerate(gt.get(f, [])) if l == label and k not in used[f]]
        best = max(cands, default=(0, None))
        if best[0] >= IOU:
            used[f].add(best[1])
            tp.append(1)
        else:
            tp.append(0)
    tp = np.array(tp, float)
    if len(tp) == 0:
        return 0.0, n_gt
    ctp, cfp = np.cumsum(tp), np.cumsum(1 - tp)
    recall, precision = ctp / n_gt, ctp / np.maximum(ctp + cfp, 1e-9)
    mrec = np.concatenate([[0], recall, [1]])
    mpre = np.concatenate([[1], precision, [0]])
    mpre = np.flip(np.maximum.accumulate(np.flip(mpre)))
    idx = np.where(mrec[1:] != mrec[:-1])[0]
    return float(np.sum((mrec[idx + 1] - mrec[idx]) * mpre[idx + 1])), n_gt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", default=["gdino", "runs/run1/weights/best.pt", "runs/run2/weights/best.pt"])
    ap.add_argument("--out", default=str(EVAL_DIR.relative_to(ROOT)))
    ap.add_argument("--iou", type=float, default=0.5)
    a = ap.parse_args()
    global IOU
    IOU = a.iou
    gt = ground_truth()
    files = sorted(gt)
    labels_in_test = sorted({l for boxes in gt.values() for l, _ in boxes})
    print(f"test set: {len(files)} labeled photos, {sum(len(v) for v in gt.values())} boxes")
    results = {"n_images": len(files), "gt_counts": {l: sum(1 for b in gt.values() for x, _ in b if x == l)
                                                     for l in labels_in_test}, "models": {}}
    for m in a.models:
        name = ("grounding-dino (untrained)" if m == "gdino" else "yolo-world (untrained)" if m.endswith("yolov8l-worldv2.pt")
                else Path(m).stem if m.endswith(".json") else Path(m).parts[-3])
        cache = ROOT / a.out / f"preds_{name.split()[0]}.json"
        hit = json.load(open(cache)) if cache.exists() else None
        if hit and set(hit["preds"]) >= set(files):
            preds, known = {f: [tuple(x) for x in hit["preds"][f]] for f in files}, set(hit["known"])
        else:
            preds, known = (predict_gdino(files) if m == "gdino" else predict_combo(ROOT / m, files)
                            if m.endswith(".json") else predict_yolo(ROOT / m, files))
            cache.parent.mkdir(parents=True, exist_ok=True)
            json.dump({"preds": preds, "known": sorted(known)}, open(cache, "w"))
        per = {}
        for l in labels_in_test:
            if l in known:
                per[l], _ = average_precision(gt, preds, l)
        common = [per[l] for l in COMMON if per.get(l) is not None]
        allk = [v for v in per.values() if v is not None]
        results["models"][name] = {"per_label_ap50": per, "map50_common13": float(np.mean(common)),
                                   "map50_all_known": float(np.mean(allk))}
        print(f"{name:30} mAP50 (13 common) {np.mean(common):.3f}   mAP50 (all known) {np.mean(allk):.3f}")
    out = ROOT / a.out
    out.mkdir(parents=True, exist_ok=True)
    json.dump(results, open(out / f"results_iou{a.iou}.json", "w"), indent=2)
    names = list(results["models"])
    print(f"\n{'label':20}{'n':>5}" + "".join(f"{n[:14]:>16}" for n in names))
    for l in labels_in_test:
        row = [results["models"][n]["per_label_ap50"].get(l) for n in names]
        print(f"{l:20}{results['gt_counts'][l]:5}" + "".join(f"{'-' if v is None else f'{v:.3f}':>16}" for v in row))


if __name__ == "__main__":
    main()
