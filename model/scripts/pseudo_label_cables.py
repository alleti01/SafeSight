"""Find cables in home photos with untrained Grounding DINO, to top up the weak `cable` label.

Every candidate is cropped onto review sheets; only boxes approved by eye are kept (see APPROVED in
build_dataset.py). Usage: pseudo_label_cables.py <list of image paths> <out.json>
"""
import json
import sys
from pathlib import Path

import torch
from PIL import Image
from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor

ROOT = Path(__file__).resolve().parents[1]
PROMPT = "power cord. electrical cable. extension cord. charging cable."
BOX_THRESHOLD = 0.25
TEXT_THRESHOLD = 0.25
MAX_BOX_AREA = 0.25  # a cable box covering a quarter of the photo is almost always wrong
MIN_BOX_AREA = 0.004  # tiny boxes are almost always wall outlets or plugs

dev = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
proc = AutoProcessor.from_pretrained(ROOT / "weights" / "grounding-dino-base")
model = AutoModelForZeroShotObjectDetection.from_pretrained(ROOT / "weights" / "grounding-dino-base").to(dev).eval()

paths = [Path(p) for p in Path(sys.argv[1]).read_text().split()]
out = {}
for k, p in enumerate(paths):
    im = Image.open(p).convert("RGB")
    inp = proc(images=im, text=PROMPT, return_tensors="pt").to(dev)
    with torch.no_grad():
        res = model(**inp)
    r = proc.post_process_grounded_object_detection(
        res, inp.input_ids, threshold=BOX_THRESHOLD, text_threshold=TEXT_THRESHOLD, target_sizes=[im.size[::-1]])[0]
    W, H = im.size
    boxes = []
    for (x0, y0, x1, y1), s in zip(r["boxes"].tolist(), r["scores"].tolist()):
        if MIN_BOX_AREA <= (x1 - x0) * (y1 - y0) / (W * H) <= MAX_BOX_AREA:
            boxes.append([round(x0), round(y0), round(x1), round(y1), round(s, 3)])
    if boxes:
        out[str(p)] = boxes
    if k % 50 == 0:
        print(f"{k}/{len(paths)} images, {sum(len(v) for v in out.values())} candidate boxes", flush=True)
json.dump(out, open(sys.argv[2], "w"))
print(f"done: {len(out)} images with {sum(len(v) for v in out.values())} candidate boxes")
