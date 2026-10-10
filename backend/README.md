# SafeSight backend

Answers the app's requests (see `shared/README.md`). Analysis runs as a background job, one at a time: `POST /analyze` answers at once with a job id, and the app polls `GET /analyze/{job_id}` for the current step until the result is ready. Runs on a laptop for development; moves to the H100 only once Abhi gives access.

## Run it

```bash
cd backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn server:app --reload --port 8000
```

Then set `NEXT_PUBLIC_BRAIN_URL=http://localhost:8000` in `app/.env.local`.

- `SAFESIGHT_DEMO=1` returns `shared/contract.json` for any upload, so the gallery has hazards to show before detection works.
- `APP_ORIGIN` sets which app addresses may call the backend (comma-separated; defaults to `http://localhost:3000`).
- `GET /health` reports demo mode and whether Abhi's detector (`model/detect.py`) was found.

## Pipeline (`pipeline.py`)

| Stage | Status |
|---|---|
| Photos to frames (upright, RGB, max 1280px) | Done |
| Video to frames (`frames.py`: sharpest frame per second, drop blurry and repeated views, max 30) | Done |
| Blur people (`blur.py`: YOLO11 segmentation, person outlines grown 3% and heavily blurred before a frame is written; if the detector can't load, nothing is saved) | Done |
| Detect objects (`model.detect.detect` when Abhi's model is present, else the YOLO-World baseline in `detector.py`) | Done (baseline) |
| Objects to hazards: mirrors and floor clutter always; bins only in bathrooms | Done |
| Outline each object (`contrast.py`: SAM 2.1 tiny, prompted with the detector's box; saved as a PNG mask at `outline_url`) | Done |
| Contrast checks (`contrast.py`: Lab color inside the outline vs. a ring around it): dark rug (≥20 L* darker than the floor) → high, other rugs → low; toilet or fitting ΔE < 9 → high, < 18 → medium; furniture ΔE < 18 → medium; stairs with no row-to-row lightness jump ≥ 10 → high | Done |
| Objects to hazards (SAM 2 outline + contrast checks) | TODO |
| Merge repeats, rate severity | TODO |
| "After" pictures (`/fix`) | Placeholder: returns the original frame |

Photos are read into memory. A video is written to a temporary file only while its frames are picked, then deleted. Processed frames live under `jobs/<job_id>/` and are deleted after an hour.

## Test it

```bash
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

Tests generate their own videos (a pan, a still stretch, a blurred stretch, and an iPhone-style HEVC .mov on macOS).

## Credits

- [Ultralytics YOLO11](https://github.com/ultralytics/ultralytics) (AGPL-3.0), `yolo11n-seg` COCO weights for finding people. Downloads into `weights/` on first run.
- [YOLO-World](https://github.com/AILab-CVC/YOLO-World) (GPL-3.0) via Ultralytics, `yolov8s-worldv2` weights, with OpenAI [CLIP](https://github.com/openai/CLIP) (MIT) for the text prompts: the baseline object detector. Weights download on first run.
- [SAM 2](https://github.com/facebookresearch/sam2) (Apache-2.0) by Meta, `sam2.1_t` weights via Ultralytics, for object outlines. Weights download on first run.
- [OpenCV](https://opencv.org) for reading video, [FastAPI](https://fastapi.tiangolo.com), [Pillow](https://python-pillow.org) and [pillow-heif](https://github.com/bigcat88/pillow_heif).
