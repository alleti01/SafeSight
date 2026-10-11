"""SafeSight analysis service (the "brain") that the website talks to. Contract: shared/README.md.

Analysis runs as a background job, so the website can show each step as it happens:
  POST /analyze             multipart: room + photos (one or more) or video (one)  -> 202 {job_id, status, step, done, total}
  GET  /analyze/{job_id}    {job_id, status: queued|working|done|failed, step, done, total, result?, detail?}
                            steps in order: frames, people, objects, contrast (videos: contrast also covers cutting clips)
  POST /live                multipart: room + frame (one camera frame)            -> {"hazards": [...]} (boxes as fractions)
  POST /fix                 json {job_id, hazard_id}                              -> {"hazard_id", "after_url"}
  GET  /jobs/{job_id}/frames/..., /outlines/..., /clips/..., /after/...
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
from analyze import SEV_COLOR, Analyzer, analyze_frame, lab_image, lrv_image, merge, outline_png, ring  # noqa: E402
from blur_people import blur_people, load_model as load_blur, person_boxes  # noqa: E402
from clips import make_clips  # noqa: E402
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
# How sure the detector must be for a finding to be listed as "sure" (the website puts the rest under
# "less sure, check in person"). Measured on our two hand-labeled test homes (Oct 11): the lowest confidence where
# at least about 60% of that object type's detections were right. Bins and glass doors had no reliable detections
# there, so they need a very high score; cables never reach 60%, and a missed cable is worse, so 0.5.
SURE_AT = {"rug": 0.3, "toilet": 0.3, "toilet_roll_holder": 0.4, "towel": 0.5, "mirror": 0.5, "stairs": 0.3,
           "cable": 0.5, "floor_clutter": 0.7, "bin": 0.85, "bed": 0.3, "sofa": 0.4, "chair": 0.3, "table": 0.3,
           "door": 0.4, "window": 0.3, "glass_door": 0.6}
MAX_FRAMES = 40  # long videos: this many frames, evenly spread (neighbouring frames of a slow tour mostly repeat)

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


@app.on_event("startup")
def warm_up():
    """Load the models in the background at start, so the first check doesn't wait for them."""
    def load():
        with _models_lock:
            models()

    if os.environ.get("WARM", "1") == "1":
        threading.Thread(target=load, daemon=True).start()


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
    def progress(step, done, total, **extra):
        _set(job_id, status="working", step=step, done=done, total=total, **extra)

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
        if len(paths) > MAX_FRAMES:
            paths = [paths[round(i * (len(paths) - 1) / (MAX_FRAMES - 1))] for i in range(MAX_FRAMES)]
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

        # 2. people: blur everyone before anything is kept (each frame is written only once it's blurred)
        ims = []
        for k, p in enumerate(paths):
            progress("people", k, len(paths))
            img, _ = blur_people(np.array(Image.open(p).convert("RGB")), blur, dev)
            im = Image.fromarray(img)
            im.thumbnail((MAX_SIDE, MAX_SIDE))
            im.save(out / "frames" / f"f{k + 1:02d}.jpg", quality=90)
            ims.append(im)

        # 3. objects: fine-tuned detector + outlines, per frame (the website shows the frame being checked)
        per_frame = []
        for k, im in enumerate(ims):
            progress("objects", k, len(ims), preview=f"{prefix}/frames/f{k + 1:02d}.jpg",
                     found=len(merge(per_frame)) if per_frame else 0)
            hs = analyze_frame(an, im, room)
            for h in hs:
                h["video"], h["frame_idx"] = ("video", k) if times else (None, k)
            per_frame.append(hs)

    # 4. contrast verdicts are in; merge repeats of the same thing across frames, then write the results
    progress("contrast", 0, 1)
    hazards = merge(per_frame)
    progress("contrast", 0, 1, found=len(hazards))
    frames = []
    for k, im in enumerate(ims):  # every checked frame (blurred) is kept so the app can show what was looked at
        fid = f"f{k + 1:02d}"
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
                "object": h["object"], "evidence": h["evidence"], **measure(ims[k], h["mask"]),
                # surfaces (floor, wall) are measured, not detected: they count as sure
                "sure": h["confidence"] >= SURE_AT.get(h["object"], 0.0)}
        if times:
            item["time_s"] = times[k]
        out_h.append(item)
    # 5. clips (videos): a few seconds around each moment a hazard was seen, people blurred, plus a box track
    if video_path is not None and out_h:
        try:
            with _models_lock:
                make_clips(video_path, out_h, frames, out / "clips", f"{prefix}/clips", an,
                           lambda img: person_boxes(img, blur, dev), dev,
                           lambda d, t: progress("contrast", d, t, found=len(out_h)))
        except Exception:  # clips are a bonus: without them the website shows the best photo of each finding
            log.exception("clips for %s failed", job_id)
            for h in out_h:
                for k in ("clip_url", "clip_start_s", "track"):
                    h.pop(k, None)
            shutil.rmtree(out / "clips", ignore_errors=True)
    progress("contrast", 1, 1)
    result = {"job_id": job_id, "room": room, "frames": frames, "hazards": out_h}
    json.dump(result, open(out / "result.json", "w"), indent=2)
    return result


def _hex(rgb):
    return "#" + "".join(f"{int(round(v)):02x}" for v in rgb)


def measure(im, mask):
    """The object's color and lightness next to its surroundings', for the website's swatches.
    lrv: light reflectance (0-100) as the design guides use it; measure: CIE L* and delta E (76)."""
    rgb = np.array(im)
    around = ring(mask)
    if mask.sum() < 50 or around.sum() < 50:
        return {}
    lab, lrv = lab_image(rgb), lrv_image(rgb)
    lin, lout = np.median(lab[mask], axis=0), np.median(lab[around], axis=0)
    return {"colors": {"inside": _hex(np.median(rgb[mask], axis=0)), "around": _hex(np.median(rgb[around], axis=0))},
            "lrv": {"object": round(float(np.median(lrv[mask])), 1), "around": round(float(np.median(lrv[around])), 1)},
            "measure": {"lightness": round(float(lin[0]), 1), "around_lightness": round(float(lout[0]), 1),
                        "delta_e": round(float(np.linalg.norm(lin - lout)), 1)}}


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
    for k in ("preview", "found"):  # the frame being checked and how many things were found so far
        if k in job:
            out[k] = job[k]
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
