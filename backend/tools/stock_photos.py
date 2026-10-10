"""The stock photos the website uses, from Unsplash (free under the Unsplash
License). The site loads each one straight from Unsplash at a fixed 1280x720
crop; a copy at exactly that crop is fetched into backend/stock/ (gitignored,
never committed) so the pipeline can find, outline and measure what's in it.

Fetch them:
    .venv/bin/python tools/stock_photos.py
"""

import urllib.request
from pathlib import Path

STOCK_DIR = Path(__file__).resolve().parents[1] / "stock"
SIZE = "w=1280&h=720&fit=crop&q=80&fm=jpg"
# Photos whose subject sits low in the frame keep the bottom of the photo.
CROP = {"bath-rug": "bottom"}

# name -> (Unsplash image id, room, photographer, Unsplash photo page id)
STOCK: dict[str, tuple[str, str, str, str]] = {
    "bath-rug": ("photo-1770941450515-50f2b8ca380b", "bathroom", "Clay Banks", "j7Uv1Y_A7dY"),
    "bath-white": ("photo-1668910227848-8b604673e051", "bathroom", "Point3D Commercial Imaging Ltd.", "4F0B0U3nafQ"),
    "dark-rug": ("photo-1721742606286-4b5e9836ce5e", "hallway", "Lisa Anna", "gf-N7tQqq4Y"),
    "loose-rug": ("photo-1721739496969-0dbd15306bd5", "hallway", "Alex Tyson", "nv_KSE0p2Iw"),
    "shiny-floor": ("photo-1646618697079-3de96be2af49", "hallway", "Abdul Kayum", "Fr1M70uw0OU"),
    "patterned-floor": ("photo-1788834321938-1e1fecde96b3", "bedroom", "David Marquez", "9_RpEE1Ri8g"),
    "furniture-blends": ("photo-1675608691851-6493dbbc111e", "bedroom", "avechenri", "NmqPnM4HJEc"),
    "mirror": ("photo-1570974797119-9d44484cd541", "bedroom", "Brina Blum", "PfFDmKsA3vo"),
    "stairs": ("photo-1778731660445-91149ecc1441", "hallway", "Franco Debartolo", "ukA7CLd-LqE"),
    "clutter": ("photo-1581578731509-8ae9c5a3e7d3", "hallway", "CDC", "6u7vdYOJ2KY"),
    "lookalike": ("photo-1656646424512-a6291005fc23", "bathroom", "Point3D Commercial Imaging Ltd.", "qA15HWrJLJM"),
    "filming": ("photo-1727328982998-b3ec4ed239cc", "bedroom", "Jakub Żerdzicki", "xs5q4uPiBhA"),
}
# The photo with a person in it, for the privacy step.
PERSON = ("person", "photo-1675179181127-2c0666e2334d", "Centre for Ageing Better", "ZnhLxDMsCbY")


def url(image_id: str, name: str = "") -> str:
    crop = f"&crop={CROP[name]}" if name in CROP else ""
    return f"https://images.unsplash.com/{image_id}?{SIZE}{crop}"


def local(name: str) -> Path:
    return STOCK_DIR / f"{name}.jpg"


def main() -> None:
    STOCK_DIR.mkdir(exist_ok=True)
    items = {name: v[0] for name, v in STOCK.items()} | {PERSON[0]: PERSON[1]}
    for name, image_id in items.items():
        path = local(name)
        if path.exists():
            continue
        req = urllib.request.Request(url(image_id, name), headers={"User-Agent": "SafeSight hackathon"})
        with urllib.request.urlopen(req, timeout=30) as r:
            path.write_bytes(r.read())
        print(f"{name:18} {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
