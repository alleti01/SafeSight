"""Room-level score: what the app actually does. For each room video in the test home and each label,
did the detector find a real instance of it in AT LEAST ONE frame (IoU >= 0.5, confidence >= CONF)?
Also counts false alarms: label reported in a room where it does not appear at all.

Uses data/eval/test_gt.json and the cached predictions from evaluate.py (data/eval/preds_<name>.json).
Usage: room_eval.py grounding-dino yolo-world combo_v1 ...
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent))
from evaluate import EVAL_DIR, iou  # noqa: E402

CONF = 0.30


def video(f):
    return f.split("__")[1].rsplit("_f", 1)[0]


def main():
    gt = json.load(open(EVAL_DIR / "test_gt.json"))
    vids = defaultdict(list)
    for f in gt:
        vids[video(f)].append(f)
    labels = sorted({l for v in gt.values() for l, _ in v})
    rows = {}
    for name in sys.argv[1:]:
        pr = json.load(open(EVAL_DIR / f"preds_{name}.json"))
        preds, known = pr["preds"], set(pr["known"])
        per = {}
        for l in labels:
            if l not in known:
                continue
            present = caught = false_rooms = 0
            for v, files in vids.items():
                g = [(f, b) for f in files for x, b in gt[f] if x == l]
                p = [(f, b) for f in files for x, b, s in preds.get(f, []) if x == l and s >= CONF]
                if g:
                    present += 1
                    caught += any(pf == gf and iou(pb, gb) >= 0.5 for gf, gb in g for pf, pb in p)
                elif p:
                    false_rooms += 1
            per[l] = (caught, present, false_rooms, len(vids) - present)
        rows[name] = per
    print(f"{len(vids)} room videos. Cell = rooms where it was found / rooms that have it  (false-alarm rooms / rooms without it)\n")
    print(f"{'label':20}" + "".join(f"{n[:20]:>24}" for n in rows))
    for l in labels:
        cells = []
        for n in rows:
            c = rows[n].get(l)
            cells.append("-" if c is None else f"{c[0]}/{c[1]} ({c[2]}/{c[3]})")
        print(f"{l:20}" + "".join(f"{x:>24}" for x in cells))
    for n in rows:
        found = sum(c[0] for c in rows[n].values())
        total = sum(c[1] for c in rows[n].values())
        fa = sum(c[2] for c in rows[n].values())
        print(f"\n{n}: found {found}/{total} = {found / total:.0%} of (room, object) pairs, {fa} false-alarm pairs")


if __name__ == "__main__":
    main()
