"""SafeSight analysis service (the "brain") that the website talks to. Contract: shared/README.md.

Analysis runs as a background job, so the website can show each step as it happens:
  POST /analyze             multipart: room + photos (one or more) or video (one)  -> 202 {job_id, status, step, done, total}
  GET  /analyze/{job_id}    {job_id, status: queued|working|done|failed, step, done, total, result?, detail?}
                            steps in order: frames, people, objects, contrast
  POST /live                multipart: room + frame (one camera frame)            -> {"hazards": [...]} (boxes as fractions)
  POST /fix                 json {job_id, hazard_id}                              -> {"hazard_id", "after_url"}
  GET  /jobs/{job_id}/frames/..., /jobs/{job_id}/outlines/..., /jobs/{job_id}/after/...
  GET  /health

Detection: the fine-tuned detector (DETECTOR, default combo -> combo.json: best fine-tuned run per object type).
Hazards: SAM 2 outlines + light-reflectance (LRV) contrast rules from the dementia design guides (scripts/analyze.py).
Privacy: people are blurred before any frame is written; the upload is deleted when the job ends; old jobs are pruned.

Run: DETECTOR=combo uvicorn service:app --host 0.0.0.0 --port 8000   (or scripts/serve.sh for a public link)
"""
import io
import json
import logging
import os
import shutil
import sys
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "scripts"))
from analyze import SEV_COLOR, Analyzer, analyze_frame, merge, outline_png  # noqa: E402
from blur_people import blur_people, load_model as load_blur  # noqa: E402
from extract_frames import extract  # noqa: E402

try:  # HEIC photos straight from iPhones
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

JOBS = ROOT / "data" / "jobs"
JOBS.mkdir(parents=True, exist_ok=True)
KEEP_JOBS = 30
ROOMS = {"bathroom", "bedroom", "hallway", "living_room", "kitchen", "stairs"}
MAX_PHOTOS = 40
MAX_SIDE = 1280
MAX_VIDEO_BYTES = 500 * 1024 * 1024
MAX_LIVE_BYTES = 3 * 1024 * 1024
VIDEO_FPS = 1.0  # one sharp, distinct frame per second (extract_frames drops blurry and repeated ones)

log = logging.getLogger("safesight")
app = FastAPI(title="SafeSight brain")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["*"])
app.mount("/jobs", StaticFiles(directory=JOBS), name="jobs")

worker = ThreadPoolExecutor(max_workers=1)  # one analysis at a time: the models share one GPU
_models_lock = threading.Lock()              # the live camera and the worker share the models
_an = None
_blur = None
jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()


def models():
    global _an, _blur
    if _an is None:
        _an = Analyzer(os.environ.get("DETECTOR", "combo"))
        _blur = load_blur()
    return _an, _blur


def prune():
    old = sorted((p for p in JOBS.iterdir() if p.is_dir()), key=lambda p: p.stat().st_mtime)
    for p in old[:-KEEP_JOBS]:
        shutil.rmtree(p, ignore_errors=True)


@app.get("/health")
def health():
    return {"ok": True, "detector": os.environ.get("DETECTOR", "combo"), "models_loaded": _an is not None}


# --- full check ---------------------------------------------------------------------------------------

@app.post("/analyze", status_code=202)
async def analyze(room: str = Form(...), photos: list[UploadFile] | None = File(None),
                  video: UploadFile | None = File(None)):
    room = room.lower()
    if room not in ROOMS:
        raise HTTPException(422, f"Pick one of: {', '.join(sorted(ROOMS))}.")
    if not photos and not video:
        raise HTTPException(422, "Add some photos or one video of the room.")
    job_id = uuid.uuid4().hex[:8]
    tmp = Path(tempfile.mkdtemp(prefix=f"safesight_{job_id}_"))
    photo_data, video_path = [], None
    if video is not None:
        video_path = tmp / ("upload" + (Path(video.filename or "v.mov").suffix.lower() or ".mov"))
        size = 0
        with video_path.open("wb") as out:
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_VIDEO_BYTES:
                    shutil.rmtree(tmp, ignore_errors=True)
                    raise HTTPException(422, "That video is over 500 MB. Try a shorter clip.")
                out.write(chunk)
    else:
        photo_data = [(p.filename or "photo", await p.read()) for p in photos[:MAX_PHOTOS]]
    _set(job_id, status="queued", step="frames", done=0, total=0, created=time.time())
    worker.submit(_run, job_id, room, tmp, photo_data, video_path)
    return _public(job_id)


@app.get("/analyze/{job_id}")
def analysis_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "That check has expired. Check the room again.")
    return _public(job_id)


class BadUpload(ValueError):
    pass


def _run(job_id, room, tmp: Path, photo_data, video_path):
    def progress(step, done, total):
        _set(job_id, status="working", step=step, done=done, total=total)

    try:
        _set(job_id, result=analyze_job(job_id, room, tmp, photo_data, video_path, progress), status="done")
    except BadUpload as e:
        _fail(job_id, str(e))
    except Exception:
        log.exception("analysis %s failed", job_id)
        _fail(job_id, "Something went wrong while checking the room. Try again in a moment.")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)  # the upload and every unblurred frame are gone
        prune()


def analyze_job(job_id, room, tmp: Path, photo_data, video_path, progress):
    out = JOBS / job_id
    (out / "frames").mkdir(parents=True, exist_ok=True)
    (out / "outlines").mkdir(exist_ok=True)
    prefix = f"/jobs/{job_id}"

    # 1. frames: about one sharp, distinct frame per second of video, or the photos (upright, <= 1280 px)
    progress("frames", 0, 0)
    raw = tmp / "raw"
    raw.mkdir()
    times = []
    if video_path is not None:
        kept = extract(video_path, raw, fps=VIDEO_FPS, prefix="v")
        paths = [p for p, _ in kept]
        times = [round(int(p.stem.rsplit("_f", 1)[1]) / VIDEO_FPS, 1) for p in paths]
        if not paths:
            raise BadUpload("We couldn't find clear frames in that video. Try filming a little slower.")
    else:
        paths = []
        for k, (name, data) in enumerate(photo_data):
            try:
                im = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
            except Exception:
                continue
            im.thumbnail((MAX_SIDE, MAX_SIDE))
            p = raw / f"p{k:03d}.jpg"
            im.save(p, quality=92)
            paths.append(p)
        if not paths:
            raise BadUpload("We couldn't open those photos. Try JPG, PNG or HEIC.")

    with _models_lock:
        an, blur = models()
        dev = 0 if an.dev == "cuda" else an.dev

        # 2. people: blur everyone before anything is kept
        ims = []
        for k, p in enumerate(paths):
            progress("people", k, len(paths))
            img, _ = blur_people(np.array(Image.open(p).convert("RGB")), blur, dev)
            im = Image.fromarray(img)
            im.thumbnail((MAX_SIDE, MAX_SIDE))
            ims.append(im)

        # 3. objects: fine-tuned detector + outlines, per frame
        per_frame = []
        for k, im in enumerate(ims):
            progress("objects", k, len(ims))
            hs = analyze_frame(an, im, room)
            for h in hs:
                h["video"], h["frame_idx"] = ("video", k) if times else (None, k)
            per_frame.append(hs)

    # 4. contrast verdicts are in; merge repeats of the same thing across frames, then write the results
    progress("contrast", 0, 1)
    hazards = merge(per_frame)
    frames = []
    for k, im in enumerate(ims):  # every checked frame (blurred) is kept so the app can show what was looked at
        fid = f"f{k + 1:02d}"
        im.save(out / "frames" / f"{fid}.jpg", quality=90)
        f = {"frame_id": fid, "image_url": f"{prefix}/frames/{fid}.jpg", "width": im.size[0], "height": im.size[1]}
        if times:
            f["time_s"] = times[k]
        frames.append(f)
    out_h = []
    for n, h in enumerate(hazards, 1):
        hid = f"h{n}"
        outline_png(h["mask"], SEV_COLOR[h["severity"]], out / "outlines" / f"{hid}.png")
        k = h["frame"]
        item = {"hazard_id": hid, "type": h["type"], "severity": h["severity"], "confidence": h["confidence"],
                "frame_id": f"f{k + 1:02d}", "box": [int(round(v)) for v in h["box"]],
                "outline_url": f"{prefix}/outlines/{hid}.png",
                # additions (shared/README.md is add-only): what the object is, the measured evidence, and when
                "object": h["object"], "evidence": h["evidence"]}
        if times:
            item["time_s"] = times[k]
        out_h.append(item)
    progress("contrast", 1, 1)
    result = {"job_id": job_id, "room": room, "frames": frames, "hazards": out_h}
    json.dump(result, open(out / "result.json", "w"), indent=2)
    return result


def _fail(job_id, detail):
    shutil.rmtree(JOBS / job_id, ignore_errors=True)
    _set(job_id, status="failed", detail=detail)


def _set(job_id, **fields):
    with jobs_lock:
        jobs.setdefault(job_id, {}).update(fields)


def _public(job_id):
    job = jobs[job_id]
    out = {"job_id": job_id, "status": job["status"], "step": job.get("step"),
           "done": job.get("done", 0), "total": job.get("total", 0)}
    if job["status"] == "done":
        out["result"] = job["result"]
    if job["status"] == "failed":
        out["detail"] = job["detail"]
    return out


# --- live camera --------------------------------------------------------------------------------------

@app.post("/live")
def live(room: str = Form(...), frame: UploadFile = File(...)):
    """One frame from the website's live camera: what may be a problem in it right now, to mark on the video
    while filming. Held in memory only. Uses the fast detector + a box-level contrast check (no SAM)."""
    room = room.lower()
    if room not in ROOMS:
        raise HTTPException(422, f"Pick one of: {', '.join(sorted(ROOMS))}.")
    data = frame.file.read(MAX_LIVE_BYTES + 1)
    if len(data) > MAX_LIVE_BYTES:
        raise HTTPException(422, "That frame is too large.")
    try:
        im = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(422, "That frame isn't a picture.")
    im.thumbnail((640, 640))
    from detect import live_hazards
    with _models_lock:
        an, _ = models()
        return {"hazards": live_hazards(an, im, room)}


# --- after pictures -----------------------------------------------------------------------------------

class FixRequest(BaseModel):
    job_id: str
    hazard_id: str


@app.post("/fix")
def fix(req: FixRequest):
    """'After' picture: the flagged area recoloured toward the fix (lighter rug, contrasting fitting, covered
    mirror), keeping the rest of the photo exactly as it is. Generative inpainting (SDXL, scripts/fix_sdxl.py)
    was tried and not used: it often changed the room itself (redrew a toilet, erased a staircase)."""
    job = JOBS / req.job_id
    if not (job / "result.json").exists():
        raise HTTPException(404, "That result has expired. Check the room again.")
    res = json.load(open(job / "result.json"))
    h = next((x for x in res["hazards"] if x["hazard_id"] == req.hazard_id), None)
    if h is None:
        raise HTTPException(404, "That result has expired. Check the room again.")
    (job / "after").mkdir(exist_ok=True)
    dest = job / "after" / f"{req.hazard_id}.jpg"
    if not dest.exists():
        from fix_preview import preview
        mask = np.array(Image.open(job / "outlines" / f"{req.hazard_id}.png"))[..., 3] > 0
        preview(Image.open(job / "frames" / f"{h['frame_id']}.jpg").convert("RGB"), mask, h["type"]).save(dest, quality=92)
    return {"hazard_id": req.hazard_id, "after_url": f"/jobs/{req.job_id}/after/{req.hazard_id}.jpg"}
