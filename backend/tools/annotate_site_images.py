"""Run the real pipeline over the website's stock photos.

For each photo: detect objects, outline them with SAM 2, run the contrast
checks, and save the hazards (and their outlines) for the site to draw. For
the photo with a person, save the mask of where people are, so the site can
show the privacy blur. Nothing here is drawn by hand: the site shows what the
backend actually finds.

The photos themselves are never saved into the app: the site loads them from
Unsplash (see stock_photos.py); only the outline masks are written here.

Run from backend/ after stock_photos.py, then measure_site_images.py:
    .venv/bin/python tools/annotate_site_images.py
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import blur  # noqa: E402
import contrast  # noqa: E402
import pipeline  # noqa: E402
from stock_photos import PERSON, STOCK, local, url  # noqa: E402

OUTLINES = Path(__file__).resolve().parents[2] / "app" / "public" / "site" / "outlines"
DATA = Path(__file__).resolve().parents[2] / "app" / "src" / "lib" / "site-images.json"


# Findings a person looked at and agreed with, by hazard number in the order
# the pipeline returns them (deterministic for these photos). The starting
# model also boxes windows as mirrors, picture frames, shoe racks and towels;
# the site shows only what's listed here, and says so. Re-check after any
# change to the detector.
CONFIRMED: dict[str, set[int]] = {
    "bath-rug": {1},          # the dark bath mat
    "bath-white": {1, 2},     # the white toilet, the mirror
    "dark-rug": {1, 2},       # the doormat (loose rug), the dark red rug
    "loose-rug": {1, 3},      # the round mirror, the runner
    "patterned-floor": {4},   # the hide rug (loose rug)
    "mirror": {1},            # the floor mirror
    "lookalike": {1},         # the white toilet on white walls
    # The bed and rug seen through the doorway are too far off to be useful,
    # and the third "rug" is the navy rug's reflection in the mirror.
    "room-wide": {2, 3, 5, 7, 8},  # sofa blends in, mirror, striped runner, navy rug, shoes
}

# Photos we generated rather than licensed, kept in the app (no real home in
# them): name -> (path under app/public, room, credit).
GENERATED: dict[str, tuple[str, str, dict]] = {
    "room-wide": ("site/room-wide.jpg", "bedroom", {"by": "OpenAI GPT-6 Astra", "url": "", "site": "AI-generated"}),
}
PUBLIC = Path(__file__).resolve().parents[2] / "app" / "public"


def credit(name: str, photographer: str, page_id: str) -> dict:
    return {"by": photographer, "url": f"https://unsplash.com/photos/{page_id}", "site": "Unsplash"}


def sources():
    """(name, local file, src the site loads, room, credit) for every photo."""
    for name, (image_id, room, photographer, page_id) in STOCK.items():
        yield name, local(name), url(image_id, name), room, credit(name, photographer, page_id)
    for name, (path, room, made_by) in GENERATED.items():
        yield name, PUBLIC / path, f"/{path}", room, made_by


def main() -> None:
    out: dict[str, dict] = {}
    for name, path, src, room, made_by in sources():
        if not path.exists():
            print(f"{name:18} skipped: {path.name} not found (run stock_photos.py?)")
            continue
        img = Image.open(path).convert("RGB")
        rgb = np.asarray(img)
        objects = pipeline.detect(img)
        frame = {"frame_id": name}
        hazards = pipeline.objects_to_hazards(room, frame, objects, rgb, OUTLINES, "/site")
        for i, h in enumerate(hazards, start=1):
            h["hazard_id"] = f"{name}-h{i}"
        found = len(hazards)
        hazards = [h for i, h in enumerate(hazards, start=1) if i in CONFIRMED.get(name, set())]
        # Every object's outline too, for the "how the model sees it" strip.
        masks = contrast.outline(rgb, [o["box"] for o in objects], [o["label"] for o in objects])
        for i, (obj, mask) in enumerate(zip(objects, masks), start=1):
            contrast.save_outline(mask, OUTLINES / f"{name}-obj{i}.png")
            obj["outline_url"] = f"/site/outlines/{name}-obj{i}.png"
        out[name] = {
            "src": src,
            "width": img.width,
            "height": img.height,
            "room": room,
            "credit": made_by,
            "objects": objects,
            "hazards": hazards,
        }
        print(f"{name:18} {found} found, {len(hazards)} confirmed: {[(h['type'], h['severity']) for h in hazards]}")

    name, image_id, photographer, page_id = PERSON
    if local(name).exists():
        person = Image.open(local(name)).convert("RGB")
        bgr = np.asarray(person)[:, :, ::-1].copy()
        mask, count = blur.person_mask(bgr)
        # The same region blur.blur_people blurs, saved as a mask: the site
        # blurs it in the browser rather than us storing a copy of the photo.
        rgba = np.zeros((*mask.shape, 4), np.uint8)
        rgba[mask > 0] = (255, 255, 255, 255)
        OUTLINES.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(OUTLINES / "privacy-people.png"), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
        out["privacy"] = {
            "src": url(image_id),
            "mask_url": "/site/outlines/privacy-people.png",
            "people_blurred": count,
            "width": person.width,
            "height": person.height,
            "credit": credit(name, photographer, page_id),
        }
        print(f"privacy: {count} people found")

    DATA.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {DATA}")


if __name__ == "__main__":
    main()
