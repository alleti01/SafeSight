"""Pseudo-label unlabeled real-home frames with two different models; keep only boxes they agree on.

  teacher A: run 5 (fine-tuned YOLO-World), teacher B: untrained Grounding DINO (frozen prompts)
  keep a box when A and B find the same label at IoU >= 0.5 (box = average of the two),
  or when A alone is very confident (>= A_SOLO). Everything else is dropped.
Writes YOLO labels next to an images folder: <out>/images/*.jpg, <out>/labels/*.txt

Usage (GPU machine): pseudo_label.py <frames dir> <out dir> <run5 weights>
"""
import json
import shutil
import sys
from pathlib import Path

import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent))
from evaluate import LABELS16, iou, name_of  # noqa: E402

A_CONF, B_CONF, A_SOLO, AGREE_IOU = 0.35, 0.30, 0.80, 0.5
BATCH = 16


def main():
    frames, out, wA = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "labels").mkdir(parents=True, exist_ok=True)
    from transformers import AutoModelForZeroShotObjectDetection, AutoProcessor
    from ultralytics import YOLO
    dev = "cuda" if torch.cuda.is_available() else "mps"
    A = YOLO(wA)
    proc = AutoProcessor.from_pretrained(ROOT / "weights" / "grounding-dino-base")
    B = AutoModelForZeroShotObjectDetection.from_pretrained(ROOT / "weights" / "grounding-dino-base").to(dev).eval()
    P = json.load(open(ROOT / "prompts.json"))
    phrase_to_label = sorted(((p, l) for l, ps in P["labels"].items() for p in ps), key=lambda x: -len(x[0]))
    files = sorted(f for f in frames.glob("*.jpg") if not f.name.startswith("."))
    kept = {l: 0 for l in LABELS16}
    for s in range(0, len(files), BATCH):
        chunk = files[s:s + BATCH]
        ims = [Image.open(f).convert("RGB") for f in chunk]
        ra = A.predict([str(f) for f in chunk], conf=A_CONF, verbose=False, device=0 if dev == "cuda" else dev, imgsz=1024)
        bdets = [[] for _ in chunk]
        for group in P["groups"]:
            text = " . ".join(p for l in group for p in P["labels"][l]) + " ."
            inp = proc(images=ims, text=[text] * len(ims), return_tensors="pt", padding=True).to(dev)
            with torch.no_grad(), torch.autocast(dev, dtype=torch.bfloat16, enabled=dev == "cuda"):
                o = B(**inp)
            rs = proc.post_process_grounded_object_detection(o, inp.input_ids, threshold=B_CONF, text_threshold=0.25,
                                                             target_sizes=[im.size[::-1] for im in ims])
            for k, r in enumerate(rs):
                for b, sc, t in zip(r["boxes"].tolist(), r["scores"].tolist(), r["text_labels"]):
                    l = next((l for p, l in phrase_to_label if p in t.lower()), None)
                    if l:
                        bdets[k].append((l, b, sc))
        for f, im, r, bd in zip(chunk, ims, ra, bdets):
            W, H = im.size
            lines = []
            for b, c, sc in zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist(), r.boxes.conf.tolist()):
                l = name_of(r.names, c)
                match = max(((iou(b, bb), bb) for ll, bb, _ in bd if ll == l), default=(0, None))
                if match[0] >= AGREE_IOU:
                    b = [(x + y) / 2 for x, y in zip(b, match[1])]
                elif sc < A_SOLO:
                    continue
                lines.append(f"{LABELS16.index(l)} {(b[0] + b[2]) / 2 / W:.6f} {(b[1] + b[3]) / 2 / H:.6f} "
                             f"{(b[2] - b[0]) / W:.6f} {(b[3] - b[1]) / H:.6f}")
                kept[l] += 1
            if lines:
                shutil.copy(f, out / "images" / f"chr__{f.name}")
                (out / "labels" / f"chr__{f.stem}.txt").write_text("\n".join(lines))
        if s % 1600 == 0:
            print(f"{s}/{len(files)} frames, kept boxes {kept}", flush=True)
    print("done:", len(list((out / "labels").glob("*.txt"))), "frames with boxes;", kept)


if __name__ == "__main__":
    main()
