"""Phase 3 step 1: add boxes for our labels that a source never annotated (e.g. chairs in stairs datasets).

Each source only labeled its own classes, so an unlabeled chair in a stairs photo teaches the detector
"this is background". Grounding DINO looks only for the labels that source did NOT cover, and only
confident boxes are added. Original labels are kept in labels_orig/; added boxes are logged.

Usage (on the GPU machine): fill_missing_boxes.py data/yolo
"""
import json
import shutil
import sys
from pathlib import Path

import torch
from PIL import Image
from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

sys.path.insert(0, str(Path(__file__).parent))
from prelabel import PHRASES, label_for  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
LABELS = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable",
          "floor_clutter", "bin", "bed", "sofa", "chair", "table", "door", "window", "glass_door"]
NEVER_FILL = {"glass_door"}
ID = {n: i for i, n in enumerate(LABELS)}
ALL = set(LABELS)
BATCH = 16
# Stricter than pre-labeling: a wrong added box hurts more than a missing one.
THRESHOLD = {"default": 0.45, "cable": 0.50, "floor_clutter": 0.50}
TEXT_THRESHOLD = 0.30
SAME_BOX_IOU = 0.5

# Labels each source already annotated (so we never second-guess them)
STAIRS = {"stairs"}
COVERED = {
    "oi": {"toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "bin", "bed", "sofa", "chair", "table"},
    "ade": {"rug", "toilet", "towel", "mirror", "stairs", "bin", "bed", "sofa", "chair", "table", "door", "window"},
    "lvis": {"toilet_roll_holder", "rug", "toilet", "mirror", "bin", "towel", "bed", "sofa", "chair", "table", "floor_clutter"},
    "rf-stairs-spqnr": STAIRS, "rf-stairs-i2yia": STAIRS, "rf-stairs-segmentation": STAIRS,
    "rf-cable-dataset": ALL,  # pasted-wire images: nothing else real to find
    "rf-clutter-classes": {"floor_clutter"},
    "rf-toilet-seat-object-detection": {"toilet"},
    "rf-bathroom-sdsne": {"toilet", "mirror", "towel"}, "rf-bathroom-lyfer": {"toilet", "mirror", "towel"},
    "rf-carpet-segmentation": {"rug"}, "rf-carpet-rjju3": {"rug"}, "rf-carpet-calpo": {"rug"},
    "rf-toilet-paper-rv8hr": ALL,  # product photos on white: nothing else to find
    "rf-messy-room-y5qsc": {"floor_clutter", "chair", "table"},
    "rf-messy-imgs": {"floor_clutter", "chair", "table", "bed", "sofa", "mirror"},
    "rf-robot-vacuum-cleaner": {"floor_clutter"},
    "rf-shower-and-screen-91lzq": {"glass_door"},
    "rf-glass-door-stair-fish_tank-tllvf": {"glass_door", "stairs"},
    "rf-hazardcap-glass-door": ALL,  # shop entrances: nothing else from our list to find
}


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


def main():
    root = Path(sys.argv[1])
    if not (root / "labels_orig").exists():
        shutil.copytree(root / "labels", root / "labels_orig")
    dev = "cuda" if torch.cuda.is_available() else "mps"
    proc = AutoProcessor.from_pretrained(ROOT / "weights" / "grounding-dino-base")
    model = AutoModelForZeroShotObjectDetection.from_pretrained(ROOT / "weights" / "grounding-dino-base").to(dev).eval()

    # group images by which labels they are missing, so each batch shares one prompt
    jobs = {}
    for split in ("train", "val"):
        for img in sorted((root / "images" / split).glob("*.jpg")):
            source = img.stem.split("__")[0]
            missing = tuple(sorted(ALL - COVERED.get(source, ALL) - NEVER_FILL))
            if missing:
                jobs.setdefault(missing, []).append((split, img))
    total = sum(len(v) for v in jobs.values())
    print(f"{total} images need a look, in {len(jobs)} label groups", flush=True)

    added, done = {}, 0
    for missing, items in jobs.items():
        prompt = " . ".join(p for lab in missing for p in PHRASES[lab]) + " ."
        for s in range(0, len(items), BATCH):
            chunk = items[s:s + BATCH]
            ims = [Image.open(p).convert("RGB") for _, p in chunk]
            inp = proc(images=ims, text=[prompt] * len(ims), return_tensors="pt", padding=True).to(dev)
            with torch.no_grad(), torch.autocast(dev, dtype=torch.bfloat16, enabled=dev == "cuda"):
                out = model(**inp)
            res = proc.post_process_grounded_object_detection(
                out, inp.input_ids, threshold=min(THRESHOLD.values()), text_threshold=TEXT_THRESHOLD,
                target_sizes=[im.size[::-1] for im in ims])
            for (split, path), im, r in zip(chunk, ims, res):
                W, H = im.size
                lab_file = root / "labels" / split / f"{path.stem}.txt"
                lines = [l for l in lab_file.read_text().splitlines() if l.strip()]
                have = []
                for l in lines:
                    c, xc, yc, w, h = l.split()
                    xc, yc, w, h = float(xc) * W, float(yc) * H, float(w) * W, float(h) * H
                    have.append((int(c), (xc - w / 2, yc - h / 2, xc + w / 2, yc + h / 2)))
                new = []
                for box, score, text in zip(r["boxes"].tolist(), r["scores"].tolist(), r["text_labels"]):
                    lab = label_for(text)
                    if lab not in missing or score < THRESHOLD.get(lab, THRESHOLD["default"]):
                        continue
                    x0, y0, x1, y1 = box
                    if (x1 - x0) * (y1 - y0) > 0.9 * W * H:
                        continue
                    if any(c == ID[lab] and iou(box, b) > SAME_BOX_IOU for c, b in have):
                        continue
                    have.append((ID[lab], tuple(box)))
                    new.append(f"{ID[lab]} {(x0 + x1) / 2 / W:.6f} {(y0 + y1) / 2 / H:.6f} {(x1 - x0) / W:.6f} {(y1 - y0) / H:.6f}")
                    added.setdefault(lab, 0)
                    added[lab] += 1
                if new:
                    lab_file.write_text("\n".join(lines + new))
            done += len(chunk)
            if done % 800 < BATCH:
                print(f"{done}/{total} images, added so far: {added}", flush=True)
    json.dump(added, open(root / "filled_boxes.json", "w"))
    print(f"done: added {sum(added.values())} boxes: {added}")


if __name__ == "__main__":
    main()
