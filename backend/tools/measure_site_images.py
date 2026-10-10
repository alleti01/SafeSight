"""Add contrast measurements to each hazard on the website photos.

Reads the outlines annotate_site_images.py already saved and measures each
hazard against the ring of pixels around it (contrast.measure), so the site
can show the real numbers: lightness inside, lightness around, and color
difference (delta E). Nothing is re-detected.

Run from backend/ after annotate_site_images.py:
    .venv/bin/python tools/measure_site_images.py
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import contrast  # noqa: E402
from stock_photos import local  # noqa: E402

PUBLIC = Path(__file__).resolve().parents[2] / "app" / "public"
DATA = Path(__file__).resolve().parents[2] / "app" / "src" / "lib" / "site-images.json"


def hex_color(pixels: np.ndarray) -> str:
    """The median color of some pixels, as #rrggbb."""
    r, g, b = (int(v) for v in np.median(pixels, axis=0))
    return f"#{r:02x}{g:02x}{b:02x}"


def profile(lab: np.ndarray, box: list[int], points: int = 48) -> list[int]:
    """Lightness (L*) along a line across the object's middle, running past
    it on both sides, so a chart shows the dip or rise the check measured."""
    h, w = lab.shape[:2]
    x0, y0, x1, y1 = box
    reach = (x1 - x0) * 0.6
    xs = np.linspace(max(0, x0 - reach), min(w - 1, x1 + reach), points).round().astype(int)
    y = (y0 + y1) // 2
    band = lab[max(0, y - 4): y + 5, :, 0]
    return [round(float(np.median(band[:, x]))) for x in xs]


def main() -> None:
    data = json.loads(DATA.read_text())
    for name, photo in data.items():
        if "hazards" not in photo:
            continue
        # Stock photos load from Unsplash, so measure the local copy; generated
        # ones live in the app.
        path = local(name) if not photo["src"].startswith("/") else PUBLIC / photo["src"].lstrip("/")
        rgb = np.asarray(Image.open(path).convert("RGB"))
        lab = contrast.to_lab(rgb)
        for h in photo["hazards"]:
            mask = np.asarray(Image.open(PUBLIC / h["outline_url"].lstrip("/")).convert("RGBA"))[:, :, 3] > 127
            if mask.sum() < 50:
                continue
            m = contrast.measure(lab, mask)
            h["measure"] = {k: round(v) for k, v in m.items()}
            # The two colors being compared, for the site to show side by side.
            h["colors"] = {"inside": hex_color(rgb[mask]), "around": hex_color(rgb[contrast.ring(mask)])}
            h["profile"] = profile(lab, h["box"])
            print(f"{name:18} {h['type']:28} L* {h['measure']['lightness']:3} vs {h['measure']['around_lightness']:3}  ΔE {h['measure']['delta_e']}")
    DATA.write_text(json.dumps(data, indent=2) + "\n")


if __name__ == "__main__":
    main()
