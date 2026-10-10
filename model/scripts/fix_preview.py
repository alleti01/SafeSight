"""Placeholder 'after' pictures until FLUX.1 Fill inpainting is wired in: recolour the flagged area in the
direction of the fix, keeping its texture. Replaced by fix_flux.preview on the GPU service."""
import cv2
import numpy as np
from PIL import Image

# hazard type -> target colour (RGB) for the flagged area; None = blur/cover
FIX_COLOR = {
    "dark_rug": (205, 195, 180),               # lighter, plain rug close to the floor tone
    "patterned_floor": (190, 180, 165),        # plain same-tone runner
    "bathroom_fitting_blends_in": (40, 90, 170),  # contrasting (blue) seat / towel / roll holder
    "furniture_blends_in": (150, 60, 50),      # contrasting throw
    "door_blends_in": (60, 90, 140),           # contrasting door colour
    "stair_edge_hard_to_see": None,            # handled by edge strips below
    "mirror": None,                            # covered
    "glass_door": None,                        # decals at eye level
    "window_reflection": (200, 190, 170),      # curtains closed
    "patterned_wall": (225, 220, 210),         # plain paint
    "floor_wall_blend": None,                  # contrasting skirting strip
}


def preview(im: Image.Image, mask: np.ndarray, hazard_type: str) -> Image.Image:
    a = np.array(im).astype(np.float32)
    m = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 3)[..., None]
    gray = cv2.cvtColor(a.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)[..., None] / 255
    target = FIX_COLOR.get(hazard_type)
    if hazard_type in ("mirror",):
        cover = np.full_like(a, (230, 225, 215))
        out = a * (1 - m) + cover * m
    elif hazard_type in ("floor_clutter", "toilet_lookalike", "loose_rug"):
        # item removed: fill from surroundings
        inp = cv2.inpaint(a.astype(np.uint8), (mask > 0).astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA)
        out = inp.astype(np.float32) * m + a * (1 - m)
    elif hazard_type == "glass_door":
        out = a.copy()
        ys, xs = np.nonzero(mask)
        if len(ys):
            y = int(ys.min() + 0.45 * (ys.max() - ys.min()))
            band = np.zeros(mask.shape, bool)
            band[max(0, y - 6):y + 6] = True
            band &= mask
            out[band] = (230, 120, 40)
    elif hazard_type in ("stair_edge_hard_to_see", "floor_wall_blend"):
        out = a.copy()
        edges = cv2.Canny(gray[..., 0].astype(np.uint8) * 255 if gray.max() <= 1 else gray[..., 0].astype(np.uint8), 30, 90) > 0
        edges = cv2.dilate(edges.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        out[edges & mask] = (240, 200, 30)
    elif target is not None:
        tint = np.array(target, np.float32) * (0.55 + 0.9 * gray)
        out = a * (1 - m) + np.clip(tint, 0, 255) * m
    else:
        out = a
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
