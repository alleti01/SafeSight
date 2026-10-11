"""SafeSight analysis service (the "brain"). Contract: shared/README.md + shared/contract.json.

  POST /analyze           multipart: room + photos (one or more) or video (one)  -> contract JSON
  POST /fix/{hazard_id}   query/form: job_id                                      -> {"hazard_id", "after_url"}
  GET  /frames/..., /outlines/..., /after/...  static files of the most recent jobs
  GET  /health

People are blurred before anything is stored. Uploads are deleted after analysis; only the frames used
by hazards (blurred) and the outline PNGs are kept, and old jobs are pruned.

Run: DETECTOR=runs/run3_world/weights/best.pt uvicorn service:app --host 0.0.0.0 --port 8000
"""
import json
import os
import shutil
import sys
import tempfile
import threading
import uuid
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "scripts"))
from analyze import Analyzer, run  # noqa: E402
from blur_people import blur_people, load_model as load_blur  # noqa: E402
from extract_frames import extract  # noqa: E402

JOBS = ROOT / "data" / "jobs"
JOBS.mkdir(parents=True, exist_ok=True)
KEEP_JOBS = 30
ROOMS = {"bathroom", "bedroom", "hallway", "living_room", "kitchen", "stairs"}
VIDEO_EXT = {".mov", ".mp4", ".m4v", ".avi"}
MAX_PHOTOS = 40

app = FastAPI(title="SafeSight brain")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
_lock = threading.Lock()  # one analysis at a time on the GPU
_an = None
_blur = None
LATEST = {"job": None}


def models():
    global _an, _blur
    if _an is None:
        _an = Analyzer(os.environ.get("DETECTOR", "gdino"))
        _blur = load_blur()
    return _an, _blur


def prune():
    jobs = sorted((p for p in JOBS.iterdir() if p.is_dir()), key=lambda p: p.stat().st_mtime)
    for p in jobs[:-KEEP_JOBS]:
        shutil.rmtree(p, ignore_errors=True)


@app.get("/health")
def health():
    return {"ok": True, "detector": os.environ.get("DETECTOR", "gdino"), "models_loaded": _an is not None}


@app.post("/analyze")
async def analyze(room: str = Form(...), photos: list[UploadFile] | None = File(None), video: UploadFile | None = File(None)):
    if room not in ROOMS:
        raise HTTPException(400, f"room must be one of {sorted(ROOMS)}")
    if not photos and not video:
        raise HTTPException(400, "send photos or a video")
    job_id = uuid.uuid4().hex[:8]
    out = JOBS / job_id
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        frames_dir = tmp / "frames"
        frames_dir.mkdir()
        info = None
        if video is not None:
            src = tmp / f"upload{Path(video.filename or 'v.mov').suffix.lower() or '.mov'}"
            src.write_bytes(await video.read())
            kept = extract(src, frames_dir, fps=1.0, prefix="v")
            paths = [p for p, _ in kept]
            info = [("video", int(p.stem.rsplit("_f", 1)[1])) for p in paths]
        else:
            paths = []
            for k, ph in enumerate(photos[:MAX_PHOTOS]):
                try:
                    im = Image.open(ph.file).convert("RGB")
                except Exception:
                    continue
                im.thumbnail((1280, 1280))
                p = frames_dir / f"p{k:03d}.jpg"
                im.save(p, quality=92)
                paths.append(p)
        if not paths:
            raise HTTPException(400, "no usable frames")
        with _lock:
            an, blur = models()
            dev = 0 if an.dev == "cuda" else an.dev
            for p in paths:  # blur people before anything is kept
                img, n = blur_people(np.array(Image.open(p).convert("RGB")), blur, dev)
                if n:
                    Image.fromarray(img).save(p, quality=92)
            result = run(an, paths, room, out, job_id=job_id, video_info=info)
    # uploads (tmp) are gone; keep only result frames + outlines
    LATEST["job"] = job_id
    prune()
    return result


def _job_file(kind, name, job_id=None):
    job = job_id or LATEST["job"]
    if job is None:
        raise HTTPException(404, "no job yet")
    p = JOBS / job / kind / name
    if not p.exists():
        # fall back to searching recent jobs (URLs in the contract are not job-prefixed)
        for j in sorted(JOBS.iterdir(), key=lambda q: -q.stat().st_mtime):
            if (j / kind / name).exists():
                return j / kind / name
        raise HTTPException(404, f"{kind}/{name} not found")
    return p


@app.get("/frames/{name}")
def frame(name: str, job_id: str | None = None):
    return FileResponse(_job_file("frames", name, job_id))


@app.get("/outlines/{name}")
def outline(name: str, job_id: str | None = None):
    return FileResponse(_job_file("outlines", name, job_id))


@app.get("/after/{name}")
def after(name: str, job_id: str | None = None):
    return FileResponse(_job_file("after", name, job_id))


@app.post("/fix/{hazard_id}")
def fix(hazard_id: str, job_id: str | None = None):
    """'After' picture: the flagged area recoloured to show the fix direction (lighter rug, contrasting fitting,
    covered mirror), keeping the rest of the photo exactly as it is. Generative inpainting (SDXL, scripts/fix_sdxl.py)
    was tried and not used: it often changed the room itself (redrew a toilet, erased a staircase)."""
    job = job_id or LATEST["job"]
    if job is None or not (JOBS / job / "result.json").exists():
        raise HTTPException(404, "unknown job")
    res = json.load(open(JOBS / job / "result.json"))
    h = next((x for x in res["hazards"] if x["hazard_id"] == hazard_id), None)
    if h is None:
        raise HTTPException(404, "unknown hazard")
    (JOBS / job / "after").mkdir(exist_ok=True)
    dest = JOBS / job / "after" / f"{hazard_id}.jpg"
    if not dest.exists():
        from fix_preview import preview
        frame = JOBS / job / "frames" / f"{h['frame_id']}.jpg"
        mask = np.array(Image.open(JOBS / job / "outlines" / f"{hazard_id}.png"))[..., 3] > 0
        preview(Image.open(frame).convert("RGB"), mask, h["type"]).save(dest, quality=92)
    return {"hazard_id": hazard_id, "after_url": f"/after/{hazard_id}.jpg"}
