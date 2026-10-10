"""SafeSight backend: the requests the app sends (see shared/README.md).

Run locally:  .venv/bin/uvicorn server:app --reload --port 8000
Demo mode:    SAFESIGHT_DEMO=1 returns shared/contract.json for any upload.

Analysis runs as a background job: POST /analyze checks the upload and answers
straight away with a job id; the app then asks GET /analyze/{job_id} until the
job is done. That lets the app show which step is running, and keeps every
request short enough to pass through a tunnel.
"""

import json
import logging
import os
import secrets
import shutil
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import pipeline

HERE = Path(__file__).resolve().parent
JOBS = HERE / "jobs"
JOBS.mkdir(exist_ok=True)

DEMO = os.environ.get("SAFESIGHT_DEMO") == "1"
APP_ORIGINS = os.environ.get("APP_ORIGIN", "http://localhost:3000").split(",")
JOB_TTL_SECONDS = 60 * 60
ROOMS = {"bathroom", "bedroom", "hallway"}
MAX_PHOTOS = 60
MAX_PHOTO_BYTES = 25 * 1024 * 1024
MAX_VIDEO_BYTES = 500 * 1024 * 1024

log = logging.getLogger("safesight")

app = FastAPI(title="SafeSight backend")
app.add_middleware(CORSMiddleware, allow_origins=APP_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])
app.mount("/jobs", StaticFiles(directory=JOBS), name="jobs")
app.mount("/frames", StaticFiles(directory=HERE / "demo" / "frames"), name="demo-frames")
app.mount("/outlines", StaticFiles(directory=HERE / "demo" / "outlines"), name="demo-outlines")

# One analysis at a time: the models share one GPU, so later jobs queue.
worker = ThreadPoolExecutor(max_workers=1)
# job_id -> {"status", "step", "done", "total", "result", "detail", "created"}
jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()


@app.get("/health")
def health():
    return {"ok": True, "demo": DEMO, "detector": pipeline.DETECTOR}


@app.post("/analyze", status_code=202)
async def analyze(
    room: str = Form(...),
    photos: list[UploadFile] = File(default=[]),
    video: UploadFile | None = File(default=None),
):
    room = room.lower()
    if room not in ROOMS:
        raise HTTPException(422, f"Pick one of: {', '.join(sorted(ROOMS))}.")
    if bool(photos) == bool(video):
        raise HTTPException(422, "Send either photos or one video.")
    if len(photos) > MAX_PHOTOS:
        raise HTTPException(422, f"Send at most {MAX_PHOTOS} photos at a time.")

    clean_old_jobs()
    job_id = secrets.token_hex(4)

    if DEMO:
        result = json.loads((pipeline.REPO / "shared" / "contract.json").read_text())
        result.update(job_id=job_id, room=room)
        _set(job_id, status="done", step="contrast", done=0, total=0, result=result, created=time.time())
        return _public(job_id)

    # Photos are held in memory only; nothing but the processed frames is written.
    photo_data = []
    for p in photos:
        data = await p.read()
        if len(data) > MAX_PHOTO_BYTES:
            raise HTTPException(422, f"{p.filename} is over 25 MB.")
        photo_data.append((p.filename or "photo", data))

    job_dir = JOBS / job_id
    frames_dir = job_dir / "frames"
    frames_dir.mkdir(parents=True)

    # A video is streamed to a temporary file (the decoder needs a path) and
    # deleted as soon as its frames are picked.
    video_path = None
    if video:
        video_path = job_dir / ("upload" + Path(video.filename or "").suffix.lower())
        size = 0
        with video_path.open("wb") as out:
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_VIDEO_BYTES:
                    shutil.rmtree(job_dir, ignore_errors=True)
                    raise HTTPException(422, "That video is over 500 MB. Try a shorter clip.")
                out.write(chunk)

    _set(job_id, status="queued", step="frames", done=0, total=0, result=None, created=time.time())
    worker.submit(_run, job_id, room, frames_dir, photo_data, video_path)
    return _public(job_id)


@app.get("/analyze/{job_id}")
def analysis_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "That check has expired. Check the room again.")
    return _public(job_id)


def _run(job_id: str, room: str, frames_dir: Path, photos, video_path: Path | None):
    def progress(step: str, done: int, total: int):
        _set(job_id, status="working", step=step, done=done, total=total)

    try:
        result = pipeline.analyze(room, frames_dir, f"/jobs/{job_id}", photos, video_path, progress)
        _set(job_id, status="done", result={"job_id": job_id, **result})
    except pipeline.BadUpload as e:
        _fail(job_id, frames_dir.parent, str(e))
    except pipeline.PrivacyUnavailable:
        _fail(job_id, frames_dir.parent, "We can't blur people in photos right now, so nothing was saved. Try again soon.")
    except Exception:
        log.exception("analysis %s failed", job_id)
        _fail(job_id, frames_dir.parent, "Something went wrong while checking the room. Try again in a moment.")
    finally:
        if video_path:
            video_path.unlink(missing_ok=True)


def _fail(job_id: str, job_dir: Path, detail: str):
    shutil.rmtree(job_dir, ignore_errors=True)
    _set(job_id, status="failed", detail=detail)


def _set(job_id: str, **fields):
    with jobs_lock:
        jobs.setdefault(job_id, {}).update(fields)


def _public(job_id: str) -> dict:
    job = jobs[job_id]
    out = {"job_id": job_id, "status": job["status"], "step": job.get("step"),
           "done": job.get("done", 0), "total": job.get("total", 0)}
    if job["status"] == "done":
        out["result"] = job["result"]
    if job["status"] == "failed":
        out["detail"] = job["detail"]
    return out


class FixRequest(BaseModel):
    job_id: str
    hazard_id: str


@app.post("/fix")
def fix(req: FixRequest):
    result = (jobs.get(req.job_id) or {}).get("result") or {}
    hazard = next((h for h in result.get("hazards", []) if h["hazard_id"] == req.hazard_id), None)
    if hazard is None:
        raise HTTPException(404, "That result has expired. Check the room again.")

    # TODO(be-after): repaint the hazard's box with an inpainting model on the H100.
    # Until then the "after" picture is the original frame.
    frame = next(f for f in result["frames"] if f["frame_id"] == hazard["frame_id"])
    return {"hazard_id": req.hazard_id, "after_url": frame["image_url"], "placeholder": True}


def clean_old_jobs():
    cutoff = time.time() - JOB_TTL_SECONDS
    for job_dir in JOBS.iterdir():
        if job_dir.is_dir() and job_dir.stat().st_mtime < cutoff:
            shutil.rmtree(job_dir, ignore_errors=True)
    with jobs_lock:
        for job_id in [j for j, job in jobs.items() if job.get("created", 0) < cutoff]:
            jobs.pop(job_id, None)
