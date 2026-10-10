"""First-guess boxes for our 13 labels with untrained Grounding DINO, so labeling is fixing, not drawing.

Writes Label Studio tasks (image URL + predictions) for frames served from model/data via Label Studio's
local-files storage. Usage: prelabel.py <frames dir> <out tasks.json>
"""
import json
import sys
from pathlib import Path

import torch
from PIL import Image
from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
# label -> phrases Grounding DINO is asked for (first phrase that matches the returned text wins)
PHRASES = {
    "rug": ["rug", "carpet", "mat"],
    "toilet": ["toilet"],
    "toilet_roll_holder": ["toilet paper"],
    "towel": ["towel"],
    "mirror": ["mirror"],
    "stairs": ["staircase", "stairs"],
    "cable": ["power cord", "cable"],
    "floor_clutter": ["clothes on floor", "shoes", "bag", "box", "toy"],
    "bin": ["trash can"],
    "bed": ["bed"],
    "sofa": ["sofa", "couch"],
    "chair": ["chair"],
    "table": ["table", "desk"],
    "door": ["door"],
    "window": ["window"],
    "glass_door": ["glass door", "shower screen"],
}
BOX_THRESHOLD = 0.30
TEXT_THRESHOLD = 0.25
# Grounding DINO handles long prompts poorly, so the labels are asked in a few smaller groups
GROUPS = [["rug", "toilet", "toilet_roll_holder", "towel", "mirror"],
          ["stairs", "cable", "floor_clutter", "bin"],
          ["bed", "sofa", "chair", "table"],
          ["door", "window", "glass_door"]]


def label_for(text):
    """Longest matching phrase wins, so 'toilet paper' is not read as 'toilet'."""
    t = text.lower()
    hits = [(len(p), lab) for lab, phrases in PHRASES.items() for p in phrases if p in t]
    return max(hits)[1] if hits else None


def main():
    dev = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
    proc = AutoProcessor.from_pretrained(ROOT / "weights" / "grounding-dino-base")
    model = AutoModelForZeroShotObjectDetection.from_pretrained(ROOT / "weights" / "grounding-dino-base").to(dev).eval()
    files = sorted(Path(sys.argv[1]).glob("*.jpg"))
    tasks = []
    for k, f in enumerate(files):
        im = Image.open(f).convert("RGB")
        W, H = im.size
        results = []
        for group in GROUPS:
            prompt = " . ".join(p for lab in group for p in PHRASES[lab]) + " ."
            inp = proc(images=im, text=prompt, return_tensors="pt").to(dev)
            with torch.no_grad():
                out = model(**inp)
            r = proc.post_process_grounded_object_detection(
                out, inp.input_ids, threshold=BOX_THRESHOLD, text_threshold=TEXT_THRESHOLD, target_sizes=[(H, W)])[0]
            for (x0, y0, x1, y1), s, text in zip(r["boxes"].tolist(), r["scores"].tolist(), r["text_labels"]):
                lab = label_for(text)
                if lab is None or (x1 - x0) * (y1 - y0) > 0.95 * W * H:
                    continue
                results.append({
                    "from_name": "label", "to_name": "image", "type": "rectanglelabels",
                    "original_width": W, "original_height": H, "score": round(s, 3),
                    "value": {"x": 100 * x0 / W, "y": 100 * y0 / H, "width": 100 * (x1 - x0) / W,
                              "height": 100 * (y1 - y0) / H, "rotation": 0, "rectanglelabels": [lab]},
                })
        rel = f.resolve().relative_to(DATA)
        room = f.name.split("__")[0]
        tasks.append({"data": {"image": f"/data/local-files/?d={rel}", "room": room, "file": f.name},
                      "predictions": [{"model_version": "grounding-dino-base", "result": results}]})
        if k % 50 == 0:
            print(f"{k}/{len(files)}", flush=True)
    json.dump(tasks, open(sys.argv[2], "w"))
    print(f"done: {len(tasks)} tasks, {sum(len(t['predictions'][0]['result']) for t in tasks)} first-guess boxes")


if __name__ == "__main__":
    main()
