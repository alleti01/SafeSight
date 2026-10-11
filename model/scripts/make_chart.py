"""Before vs after accuracy chart for the README / Devpost (Best Fine-tune).

Before = the untrained open-vocabulary detector (YOLO-World v2 L, same architecture we fine-tune).
After  = SafeSight's fine-tuned detector (combo.json: best fine-tuned run per label, picked on validation).
Scored on two homes that were never trained on: Abhi's house (211 frames) and a friend's whole house (125 frames).
Writes results/accuracy_chart.png and results/accuracy.json.
"""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent))
from cross_select import room_found  # noqa: E402
from evaluate import LABELS16, average_precision  # noqa: E402

HOMES = {"Test home 1 (Abhi's house)": (ROOT / "data/eval", "combo"),
         "Test home 2 (friend's house)": (ROOT / "data/eval/home2", "combo")}
SHOW = ["door", "window", "stairs", "sofa", "table", "towel", "bed", "chair", "mirror", "toilet", "rug",
        "floor_clutter", "cable"]


def scores(d, name, gt):
    p = json.load(open(d / f"preds_{name}.json"))["preds"]
    pr = {f: [tuple(x) for x in p.get(f, [])] for f in gt}
    ap = {l: average_precision(gt, pr, l)[0] for l in LABELS16}
    f, t, fa = room_found(gt, pr)
    return ap, f / t, fa


def main():
    out = {}
    fig, axes = plt.subplots(1, 3, figsize=(18, 6.5), gridspec_kw={"width_ratios": [2.2, 2.2, 1]})
    room_rows = []
    for ax, (title, (d, after)) in zip(axes[:2], HOMES.items()):
        gt = {f: [tuple(b) for b in v] for f, v in json.load(open(d / "test_gt.json")).items()}
        b_ap, b_room, b_fa = scores(d, "yolo-world", gt)
        a_ap, a_room, a_fa = scores(d, after, gt)
        labels = [l for l in SHOW if b_ap[l] is not None and sum(1 for v in gt.values() for x, _ in v if x == l) >= 5]
        y = np.arange(len(labels))
        ax.barh(y + 0.2, [b_ap[l] * 100 for l in labels], 0.4, color="#b0b7c3", label="Before: untrained detector")
        ax.barh(y - 0.2, [a_ap[l] * 100 for l in labels], 0.4, color="#2f6fde", label="After: SafeSight fine-tuned")
        ax.set_yticks(y, [l.replace("_", " ") for l in labels])
        ax.invert_yaxis()
        ax.set_xlim(0, 100)
        ax.set_xlabel("Accuracy per object type (AP50, %)")
        ax.set_title(f"{title}\n{len(gt)} frames, never trained on", fontsize=12)
        ax.legend(loc="lower right", fontsize=9)
        room_rows.append((title.split(" (")[0], b_room, a_room))
        out[title] = {"frames": len(gt), "before_ap50": b_ap, "after_ap50": a_ap,
                      "before_rooms_found": b_room, "after_rooms_found": a_room,
                      "before_false_alarm_rooms": b_fa, "after_false_alarm_rooms": a_fa}
    ax = axes[2]
    x = np.arange(len(room_rows))
    ax.bar(x - 0.2, [r[1] * 100 for r in room_rows], 0.4, color="#b0b7c3", label="Before")
    ax.bar(x + 0.2, [r[2] * 100 for r in room_rows], 0.4, color="#2f6fde", label="After")
    for i, r in enumerate(room_rows):
        ax.text(i - 0.2, r[1] * 100 + 1.5, f"{r[1]:.0%}", ha="center", fontsize=10)
        ax.text(i + 0.2, r[2] * 100 + 1.5, f"{r[2]:.0%}", ha="center", fontsize=10, fontweight="bold")
    ax.set_xticks(x, [r[0] for r in room_rows])
    ax.set_ylim(0, 100)
    ax.set_ylabel("Room-object pairs found (%)")
    ax.set_title("What the app reports:\nobjects found per room", fontsize=12)
    ax.legend(fontsize=9)
    fig.suptitle("SafeSight: fine-tuning on real homes (H100) vs the untrained detector", fontsize=15, fontweight="bold")
    fig.tight_layout()
    (ROOT / "results").mkdir(exist_ok=True)
    fig.savefig(ROOT / "results/accuracy_chart.png", dpi=150)
    json.dump(out, open(ROOT / "results/accuracy.json", "w"), indent=2)
    for t, v in out.items():
        print(t, f"rooms found {v['before_rooms_found']:.0%} -> {v['after_rooms_found']:.0%}")


if __name__ == "__main__":
    main()
