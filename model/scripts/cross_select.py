"""Pick the best model per label using real phone-video homes, without grading on the house used to pick.

Two test homes, never trained on: home 1 (Abhi's house, data/eval) and home 2 (a friend's whole house,
data/eval/home2). Cross-check:
  - pick each label's model on home 2, score that combo on home 1
  - pick on home 1, score on home 2
Each reported number comes from a house that played no part in its own picks. A label switches away from the
untrained model only for a clear gain (MIN_GAIN); labels with too few boxes in the picking house keep the
validation-set pick (combo_v5_pre.json). Final model: picks made on both homes together, written to combo_final.json.

Uses cached predictions from evaluate.py (preds_<name>.json in each eval dir).
Usage: cross_select.py run5_world run8_world run9_world run10_world [run11_world]
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent))
from evaluate import LABELS16, average_precision, iou  # noqa: E402

HOMES = {"home1": ROOT / "data/eval", "home2": ROOT / "data/eval/home2"}
BASE = "yolo-world"
WEIGHTS = {"yolo-world": "weights/yolov8l-worldv2.pt"}
MIN_BOXES, MIN_GAIN, CONF = 3, 0.05, 0.30


def load(home, names):
    d = HOMES[home]
    gt = {f: [tuple(b) for b in v] for f, v in json.load(open(d / "test_gt.json")).items()}
    preds = {}
    for n in names:
        p = json.load(open(d / f"preds_{n}.json"))["preds"]
        preds[n] = {f: [tuple(x) for x in p.get(f, [])] for f in gt}
    return gt, preds


def per_label_ap(gt, preds):
    return {l: average_precision(gt, preds, l) for l in LABELS16}


def pick(homes, names, fallback):
    """Per label: best model on the pooled picking homes (gain >= MIN_GAIN over base), else validation pick."""
    choice = {}
    for l in LABELS16:
        n_box = sum(sum(1 for v in gt.values() for x, _ in v if x == l) for gt, _ in homes)
        if n_box < MIN_BOXES:
            choice[l] = fallback[l]
            continue
        score = {}
        for n in names:
            aps = [average_precision(gt, pr[n], l) for gt, pr in homes]
            aps = [(a, k) for a, k in aps if a is not None]
            score[n] = sum(a * k for a, k in aps) / max(1, sum(k for _, k in aps))
        best = max(score, key=score.get)
        choice[l] = best if score[best] >= score[BASE] + MIN_GAIN else BASE
    return choice


def combine(preds, choice, files):
    return {f: [x for l in LABELS16 for x in preds[choice[l]].get(f, []) if x[0] == l] for f in files}


def room_found(gt, pr):
    vids = defaultdict(list)
    for f in gt:
        vids[f.split("__")[1].rsplit("_f", 1)[0]].append(f)
    found = total = fa = 0
    for l in {x for v in gt.values() for x, _ in v}:
        for files in vids.values():
            g = [(f, b) for f in files for x, b in gt[f] if x == l]
            p = [(f, b) for f in files for x, b, s in pr.get(f, []) if x == l and s >= CONF]
            if g:
                total += 1
                found += any(pf == gf and iou(pb, gb) >= 0.5 for gf, gb in g for pf, pb in p)
            elif p:
                fa += 1
    return found, total, fa


def report(gt, pr):
    aps = per_label_ap(gt, pr)
    m = float(np.mean([a for a, _ in aps.values() if a is not None]))
    f, t, fa = room_found(gt, pr)
    return m, f, t, fa, aps


def main():
    names = [BASE] + sys.argv[1:]
    fallback_raw = json.load(open(ROOT / "combo_v5_pre.json"))["per_label"]
    to_name = {v: (BASE if "worldv2" in v else Path(v).parts[-3]) for v in fallback_raw.values()}
    fallback = {l: to_name[w] if to_name[w] in names else BASE for l, w in fallback_raw.items()}
    data = {h: load(h, names + ["combo_v4" if h == "home1" else "combo"]) for h in HOMES}
    for pick_on, test_on in (("home2", "home1"), ("home1", "home2")):
        choice = pick([data[pick_on]], names, fallback)
        gt, pr = data[test_on]
        mixed = combine(pr, choice, gt)
        v4 = pr["combo_v4" if test_on == "home1" else "combo"]
        a = report(gt, v4)
        b = report(gt, mixed)
        print(f"\npicked on {pick_on}, scored on {test_on} ({len(gt)} frames):")
        print(f"  combo v4    : per-photo {a[0]:.3f}   rooms found {a[1]}/{a[2]} = {a[1] / a[2]:.0%}   false alarms {a[3]}")
        print(f"  cross-picked: per-photo {b[0]:.3f}   rooms found {b[1]}/{b[2]} = {b[1] / b[2]:.0%}   false alarms {b[3]}")
        for l in LABELS16:
            if a[4][l][0] is not None:
                print(f"    {l:20} n={a[4][l][1]:3}  v4 {a[4][l][0]:.2f}  new {b[4][l][0]:.2f}  ({choice[l]})")
    final = pick([data["home1"], data["home2"]], names, fallback)
    w = {n: WEIGHTS.get(n, f"runs/{n}/weights/best.pt") for n in names}
    json.dump({"base": WEIGHTS[BASE], "per_label": {l: w[final[l]] for l in LABELS16}}, open(ROOT / "combo_final.json", "w"), indent=2)
    print("\nfinal picks (both homes):", {l: final[l] for l in LABELS16})
    print("wrote combo_final.json")


if __name__ == "__main__":
    main()
