"""'After' pictures with SDXL inpainting (diffusers/stable-diffusion-xl-1.0-inpainting-0.1, open weights).

For each flagged hazard: take the frame, grow the hazard's outline a little, inpaint only that area with a prompt
describing the cheap fix (from the Alzheimer's Society / DSDC guidance in HAZARD_RESEARCH.md), then paste the
result back with a soft edge so the rest of the photo is untouched. Hazards whose fix is not "repaint this
object" (floor/wall strips) fall back to fix_preview.

Input: analysis job folders (result.json, debug.json, frames/, outlines/). Output: <job>/after/<hazard_id>.jpg.
Usage (GPU): fix_sdxl.py <job dir> [<job dir> ...]
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from fix_preview import preview  # noqa: E402

NEG = "blurry, distorted, deformed, text, watermark, logo, people, person, cartoon, painting, oversaturated"
# (object or hazard type) -> prompt for the fixed look
PROMPTS = {
    "toilet": "a white toilet with a bright royal blue toilet seat and blue lid, clear colour contrast, real bathroom photo",
    "toilet_roll_holder": "a dark navy blue toilet paper holder with a white roll, contrasting with the light wall, real photo",
    "towel": "a bright deep red towel hanging, strong contrast with the wall, real photo",
    "door_blends_in": "a door painted dark navy blue with a white frame, strong contrast with the light wall, real photo",
    "mirror": "a mirror covered by a plain cream fabric cloth hanging over it, real photo",
    "dark_rug": "plain light beige floor, no rug, real photo",
    "patterned_floor": "plain light solid-colour floor with no pattern, real photo",
    "furniture_blends_in": "the same furniture covered with a deep red throw blanket, strong contrast with the floor and wall, real photo",
    "stair_edge_hard_to_see": "a staircase with bright yellow contrasting anti-slip strips along the front edge of every step, real photo",
    "shiny_floor": "a matte non-reflective floor with no glare or shine, real photo",
    "window_reflection": "a window with light plain curtains drawn closed, real photo",
    "glass_door": "a glass door with a row of bright white frosted circle decals at eye level, real photo",
    "floor_clutter": "clear empty floor, nothing on the floor, real photo",
    "cable": "clear empty floor, nothing on the floor, real photo",
}
TRIES = 4
FALLBACK = {"floor_wall_blend", "floor_transition", "patterned_wall"}


def load_pipe():
    from diffusers import AutoPipelineForInpainting
    pipe = AutoPipelineForInpainting.from_pretrained("diffusers/stable-diffusion-xl-1.0-inpainting-0.1",
                                                     torch_dtype=torch.float16, variant="fp16").to("cuda")
    pipe.set_progress_bar_config(disable=True)
    return pipe


def inpaint(pipe, im, mask, prompt, seed=0):
    W, H = im.size
    grown = cv2.dilate(mask.astype(np.uint8), np.ones((25, 25), np.uint8))
    # work at ~1024 on the long side, multiples of 8
    s = 1024 / max(W, H)
    w, h = int(W * s) // 8 * 8, int(H * s) // 8 * 8
    out = pipe(prompt=prompt, negative_prompt=NEG, image=im.resize((w, h)),
               mask_image=Image.fromarray(grown * 255).resize((w, h)), strength=0.99, guidance_scale=9.0,
               num_inference_steps=30, generator=torch.Generator("cuda").manual_seed(seed)).images[0].resize((W, H))
    soft = cv2.GaussianBlur(grown.astype(np.float32), (0, 0), 4)[..., None]
    return Image.fromarray((np.array(out) * soft + np.array(im) * (1 - soft)).astype(np.uint8))


def main():
    pipe = load_pipe()
    for job in map(Path, sys.argv[1:]):
        res = json.load(open(job / "result.json"))
        objs = {d["hazard_id"]: d.get("object") for d in json.load(open(job / "debug.json"))}
        (job / "after").mkdir(exist_ok=True)
        for h in res["hazards"]:
            im = Image.open(job / "frames" / f"{h['frame_id']}.jpg").convert("RGB")
            mask = np.array(Image.open(job / "outlines" / f"{h['hazard_id']}.png"))[..., 3] > 0
            key = objs.get(h["hazard_id"]) if h["type"] == "bathroom_fitting_blends_in" else h["type"]
            if h["type"] in FALLBACK or key not in PROMPTS or mask.sum() < 200:
                after, how = preview(im, mask, h["type"]), "preview"
            else:  # a few tries; keep the one that changes the flagged area most (the fix must be visible)
                tries = [inpaint(pipe, im, mask, PROMPTS[key], seed) for seed in range(TRIES)]
                diff = [float(np.abs(np.array(t, float) - np.array(im, float))[mask].mean()) for t in tries]
                after, how = tries[int(np.argmax(diff))], f"sdxl change={max(diff):.0f}"
            after.save(job / "after" / f"{h['hazard_id']}.jpg", quality=92)
            print(job.name, h["hazard_id"], h["type"], key, how, flush=True)


if __name__ == "__main__":
    main()
