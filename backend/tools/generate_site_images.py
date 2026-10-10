"""Generate the photos for the website with Stable Diffusion XL 1.0 (CreativeML Open RAIL++-M).

Run from backend/:
    .venv/bin/python tools/generate_site_images.py            # every shot
    .venv/bin/python tools/generate_site_images.py bath-rug   # just these

Each shot is rendered with a couple of seeds; pick the best in
annotate_site_images.CHOSEN. Output: app/public/site/<name>-<seed>.jpg
"""

import sys
import time
from pathlib import Path

import torch

OUT = Path(__file__).resolve().parents[2] / "app" / "public" / "site"
MODEL = "stabilityai/stable-diffusion-xl-base-1.0"

# Shared look so the site's photos feel like one home.
STYLE = (
    "realistic photograph, ordinary lived-in family home of an older person, soft natural daylight, "
    "eye-level wide shot, sharp focus, true-to-life colors, no text, no watermark"
)

SHOTS: dict[str, dict] = {
    # The scroll story and hero: one bathroom, then an all-white one.
    "bath-rug": {"prompt": "a small bright bathroom with a light oak wooden floor, a dark navy blue rectangular bath mat lying "
                           "flat on the floor in front of a white bathtub, white walls, a window, no people"},
    "bath-white": {"prompt": "a bathroom where everything is white: a white toilet on white square floor tiles against white "
                             "walls, white towels on a rail, a large mirror above a white sink, no people"},
    # One tile per hazard.
    "dark-rug": {"prompt": "a hallway with pale cream carpet and a long dark charcoal runner rug down the middle, no people"},
    "loose-rug": {"prompt": "close view of a small thin throw rug with a curled-up corner on a polished hardwood floor, no people"},
    "shiny-floor": {"prompt": "a kitchen with a glossy polished floor showing a bright white glare of sunlight reflected from a window, no people"},
    "patterned-floor": {"prompt": "a hallway with bold black and white striped carpet running along the floor, no people"},
    "furniture-blends": {"prompt": "a living room with a light grey sofa against a light grey wall of exactly the same color, grey carpet, no people"},
    "mirror": {"prompt": "a bedroom with a tall full-length mirror leaning against the wall facing the bed, no people"},
    "stairs": {"prompt": "a staircase covered in plain beige carpet where every step is the same color and the step edges are hard to see, no people"},
    "clutter": {"prompt": "a living room floor with phone charging cables stretched across the walkway and a pair of shoes and a bag left on the floor, no people"},
    "lookalike": {"prompt": "a bathroom with a white round laundry basket and a white bin standing right next to a white toilet, no people"},
    # How it works and privacy.
    "filming": {"prompt": "over-the-shoulder view of a hand holding a smartphone up, filming a living room, the phone screen shows the room, no face visible"},
    "hallway-person": {"prompt": "an older woman with grey hair walking down a narrow hallway at home, seen from a few meters away"},
}

NEGATIVE = (
    "cartoon, illustration, painting, render, CGI, text, letters, watermark, logo, distorted, deformed, "
    "blurry, low quality, oversaturated"
)
SEEDS = [11, 42]
# SDXL's native 16:9 size; saved at 1280x720 to match video frames.
GEN_SIZE, SAVE_SIZE = (1344, 768), (1280, 720)


def main(names: list[str]) -> None:
    from diffusers import StableDiffusionXLPipeline

    device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
    pipe = StableDiffusionXLPipeline.from_pretrained(
        MODEL, torch_dtype=torch.float16, variant="fp16", use_safetensors=True
    ).to(device)
    OUT.mkdir(parents=True, exist_ok=True)

    for name in names:
        for seed in SEEDS:
            path = OUT / f"{name}-{seed}.jpg"
            if path.exists():
                continue
            started = time.time()
            image = pipe(
                prompt=f"{SHOTS[name]['prompt']}. {STYLE}",
                negative_prompt=NEGATIVE,
                width=GEN_SIZE[0],
                height=GEN_SIZE[1],
                num_inference_steps=30,
                guidance_scale=6.5,
                generator=torch.Generator("cpu").manual_seed(seed),
            ).images[0]
            image.resize(SAVE_SIZE).save(path, quality=90)
            print(f"{path.name}  {time.time() - started:.0f}s", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:] or list(SHOTS))
