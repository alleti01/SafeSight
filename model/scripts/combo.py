"""Combined detector: for each label, use whichever model detects it best on the VALIDATION frames
(Anish's held-out home videos, data/yolo/images/val_home2), never on the test home.

  combo.py select <base weights> <fine-tuned weights> [...]  -> combo.json {label: weights}
Labels missing from the validation set fall back to the base (untrained) model.
The Analyzer and evaluate.py load combo.json as a detector named "combo".
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent))
import evaluate as ev  # noqa: E402

Y = ROOT / "data" / "yolo"
# validation = Anish's held-out videos + the held-out ADE20K home-room photos (public val split).
# Neither is trained on, and neither is the test home.
VAL = ROOT / "data" / "combo_val"
MIN_VAL_BOXES = 3   # fewer than this: not enough evidence, keep the base model
MIN_GAIN = 0.05     # switch only if the fine-tuned model is clearly better


def build_val():
    VAL.mkdir(exist_ok=True)
    for sub, keep in (("val_home2", lambda n: True), ("val", lambda n: n.startswith("ade__"))):
        for img in (Y / "images" / sub).glob("*.jpg"):
            if not img.name.startswith(".") and keep(img.name) and not (VAL / img.name).exists():
                (VAL / img.name).symlink_to(img)
                (VAL / f"{img.stem}.txt").symlink_to(Y / "labels" / sub / f"{img.stem}.txt")


def val_gt():
    build_val()
    gt = {}
    for img in sorted(VAL.glob("*.jpg")):
        W, H = Image.open(img).size
        boxes = []
        for line in (VAL / f"{img.stem}.txt").read_text().splitlines():
            if line.strip():
                c, xc, yc, w, h = line.split()
                xc, yc, w, h = float(xc) * W, float(yc) * H, float(w) * W, float(h) * H
                boxes.append((ev.LABELS16[int(c)], [xc - w / 2, yc - h / 2, xc + w / 2, yc + h / 2]))
        gt[img.name] = boxes
    return gt


def score(models, gt, files):
    counts = {l: sum(1 for f in files for x, _ in gt[f] if x == l) for l in ev.LABELS16}
    sub = {f: gt[f] for f in files}
    out = {}
    for w, (preds, known) in models.items():
        p = {f: preds[f] for f in files}
        out[w] = {l: ev.average_precision(sub, p, l)[0] for l in ev.LABELS16 if l in known and counts[l]}
    return out, counts


def select(base, tuned):
    """Per label: decide on Anish's home frames (real phone video) when they have >= MIN_VAL_BOXES of it,
    otherwise on the ADE20K home-room photos. Switch away from the base model only for a clear gain."""
    ev.FRAMES = VAL
    gt = val_gt()
    files = sorted(gt)
    models = {w: ev.predict_yolo(ROOT / w, files) for w in [base] + tuned}
    home = [f for f in files if f.startswith("home2__")]
    ade = [f for f in files if f.startswith("ade__")]
    s_home, n_home = score(models, gt, home)
    s_ade, n_ade = score(models, gt, ade)
    short = lambda w: Path(w).parts[-3] if "runs" in w else "base"
    print(f"{'label':20}{'source':>8}{'n':>5}" + "".join(f"{short(w):>12}" for w in models))
    choice = {}
    for l in ev.LABELS16:
        src, sc, n = ("home", s_home, n_home[l]) if n_home[l] >= MIN_VAL_BOXES else ("ade", s_ade, n_ade[l])
        pick = base
        if n >= MIN_VAL_BOXES:
            best = max(sc, key=lambda w: sc[w].get(l) if sc[w].get(l) is not None else -1)
            if best != base and (sc[best].get(l) or 0) >= (sc[base].get(l) or 0) + MIN_GAIN:
                pick = best
        else:
            src = "none"
        choice[l] = pick
        row = "".join(f"{'-' if sc[w].get(l) is None else f'{sc[w][l]:.2f}':>12}" for w in sc)
        print(f"{l:20}{src:>8}{n:5}{row}   -> {short(pick)}")
    json.dump({"base": base, "per_label": choice}, open(ROOT / "combo.json", "w"), indent=2)
    print("wrote combo.json")


if __name__ == "__main__":
    if sys.argv[1] == "select":
        select(sys.argv[2], sys.argv[3:])
