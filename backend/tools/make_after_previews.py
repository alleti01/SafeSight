"""Make the "after" pictures for the home page's before-and-after section.

Runs Abhi's fix preview (model/scripts/fix_preview.py: the flagged area
recolored in the direction of the fix, keeping its texture) on findings in the
example living room, through the outline our pipeline traced for each.

    backend/.venv/bin/python backend/tools/make_after_previews.py
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "model" / "scripts"))
from fix_preview import preview  # noqa: E402

SITE = REPO / "app" / "public"
# Only the fixes the recolor preview shows well: a lighter rug and a covered
# mirror. Removing things (shoes, a loose rug) smears the floor, and a throw
# isn't a recolored sofa; those wait for real inpainting on the H100.
SHOWN = {"dark_rug", "mirror"}
OUT = SITE / "site" / "after"


def whole(photo: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """The traced outline can leave gaps in a big rug (holes, ragged edges in
    shadow), which the recolor would leave showing in the old color. Fill the
    holes, and take in pixels of the rug's own color just past its edge."""
    filled = mask.copy().astype(np.uint8)
    contours, _ = cv2.findContours(filled, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(filled, contours, -1, 1, thickness=cv2.FILLED)
    lab = cv2.cvtColor(photo, cv2.COLOR_RGB2LAB).astype(np.float32)
    near = np.linalg.norm(lab - lab[mask].mean(axis=0), axis=2) < 30
    # ...but nothing warmer than the rug, so wood furniture beside it stays.
    near &= lab[..., 2] < lab[mask][:, 2].mean() + 6
    edge = cv2.dilate(filled, np.ones((61, 61), np.uint8)) > 0
    return (filled > 0) | (near & edge)


def main():
    room = json.loads((REPO / "app" / "src" / "lib" / "site-images.json").read_text())["room-wide"]
    photo = Image.open(SITE / room["src"].lstrip("/")).convert("RGB")
    OUT.mkdir(exist_ok=True)
    for h in (h for h in room["hazards"] if h["type"] in SHOWN):
        mask = np.asarray(Image.open(SITE / h["outline_url"].lstrip("/")))[..., 3] > 0
        if h["type"] == "dark_rug":
            mask = whole(np.asarray(photo), mask)
        name = Path(h["outline_url"]).stem + ".jpg"
        preview(photo, mask, h["type"]).save(OUT / name, quality=88)
        print(h["type"], "->", (OUT / name).relative_to(REPO))


if __name__ == "__main__":
    main()
