"""Pull the user's corrected boxes for friends' homes (Label Studio project 2) into the YOLO train splits.

room "friends" -> data/yolo/labels/friends/fr__*, "friends2" -> friends2/fr2__*, "friends3" -> friends3/fr3__*.
Tasks without a saved annotation keep the reviewed labels already on disk. Prints per-label before/after counts.
Usage: sync_friends.py [--dry]
"""
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from labelstudio_setup import access_token, api  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
LABELS = ["rug", "toilet", "toilet_roll_holder", "towel", "mirror", "stairs", "cable", "floor_clutter", "bin",
          "bed", "sofa", "chair", "table", "door", "window", "glass_door"]
SPLITS = {"friends": ("friends", "fr"), "friends2": ("friends2", "fr2"), "friends3": ("friends3", "fr3"),
          "friends4": ("friends4", "fr4"), "friends5": ("friends5", "fr5"),
          "friends6": ("friends6", "fr6"), "friends7": ("friends7", "fr7")}


def main():
    dry = "--dry" in sys.argv
    tok = access_token()
    tasks, page = [], 1
    while True:
        r = api("GET", f"/api/tasks?project=2&page={page}&page_size=100&fields=all", tok)
        tasks += r["tasks"]
        if len(tasks) >= r["total"]:
            break
        page += 1
    before, after, n_ann, missing = Counter(), Counter(), 0, []
    for t in tasks:
        split, prefix = SPLITS[t["data"]["room"]]
        lf = ROOT / "data/yolo/labels" / split / f"{prefix}__{Path(t['data']['file']).stem}.txt"
        if not lf.exists():
            missing.append(str(lf))
            continue
        old = [r for r in lf.read_text().splitlines() if r.strip()]
        before.update(LABELS[int(r.split()[0])] for r in old)
        anns = [a for a in t.get("annotations", []) if not a.get("was_cancelled")]
        if not anns:
            after.update(LABELS[int(r.split()[0])] for r in old)
            continue
        n_ann += 1
        rows = []
        for res in anns[-1]["result"]:
            if res.get("type") != "rectanglelabels":
                continue
            v = res["value"]
            x, y, w, h = v["x"] / 100, v["y"] / 100, v["width"] / 100, v["height"] / 100
            x0, y0, x1, y1 = max(0, x), max(0, y), min(1, x + w), min(1, y + h)
            if x1 <= x0 or y1 <= y0:
                continue
            lab = v["rectanglelabels"][0]
            rows.append(f"{LABELS.index(lab)} {(x0 + x1) / 2:.6f} {(y0 + y1) / 2:.6f} {x1 - x0:.6f} {y1 - y0:.6f}")
            after[lab] += 1
        if not dry:
            lf.write_text("\n".join(rows))
    print(f"{len(tasks)} tasks, {n_ann} with your saved fixes, {len(missing)} missing label files {missing[:3]}")
    for lab in LABELS:
        if before[lab] or after[lab]:
            print(f"  {lab:20} {before[lab]:4} -> {after[lab]:4}")
    print(f"  {'TOTAL':20} {sum(before.values()):4} -> {sum(after.values()):4}", "(dry run)" if dry else "")


if __name__ == "__main__":
    main()
