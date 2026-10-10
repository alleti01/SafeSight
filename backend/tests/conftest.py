import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

W, H, FPS = 640, 360, 30


def _panorama(width: int, seed: int = 7) -> np.ndarray:
    """A wide 'room' of random colored blocks, so every view has real detail."""
    rng = np.random.default_rng(seed)
    pano = np.full((H, width, 3), 200, np.uint8)
    for _ in range(width // 6):
        x, y = int(rng.integers(0, width - 40)), int(rng.integers(0, H - 40))
        w, h = int(rng.integers(15, 120)), int(rng.integers(15, 120))
        color = tuple(int(c) for c in rng.integers(0, 255, 3))
        cv2.rectangle(pano, (x, y), (x + w, y + h), color, -1)
    return pano


def write_video(path: Path, positions: list[float], blurred_seconds: set[int] = frozenset(), size=(W, H)):
    """One frame per entry in positions: the x offset of the camera into the panorama."""
    pano = _panorama(int(max(positions)) + size[0] + 1)
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), FPS, size)
    for i, x in enumerate(positions):
        frame = pano[: size[1], int(x): int(x) + size[0]].copy()
        if i // FPS in blurred_seconds:
            frame = cv2.GaussianBlur(frame, (41, 41), 0)
        writer.write(frame)
    writer.release()
    return path


def walkthrough_positions() -> list[float]:
    """20 s: pan for 8 s, hold still 8-13 s, pan again 13-20 s."""
    pos = []
    for i in range(20 * FPS):
        t = i / FPS
        if t < 8:
            pos.append(t * 100)
        elif t < 13:
            pos.append(800)
        else:
            pos.append(800 + (t - 13) * 100)
    return pos


@pytest.fixture(scope="session")
def walkthrough(tmp_path_factory) -> Path:
    """Seconds 15 and 16 are badly blurred."""
    path = tmp_path_factory.mktemp("video") / "walk.mp4"
    return write_video(path, walkthrough_positions(), blurred_seconds={15, 16})


@pytest.fixture(scope="session")
def walkthrough_hevc(walkthrough, tmp_path_factory) -> Path:
    """The same walk-through re-encoded as an iPhone-style HEVC .mov."""
    if not shutil.which("avconvert"):
        pytest.skip("avconvert (macOS) not available")
    out = tmp_path_factory.mktemp("hevc") / "walk.mov"
    subprocess.run(["avconvert", "-s", str(walkthrough), "-o", str(out), "-p", "PresetHEVCHighestQuality",
                    "--replace"], check=True, capture_output=True)
    return out


def run_analysis(client, data, files, timeout=60.0):
    """POST /analyze, then poll until the job finishes. Returns every status
    seen (so tests can check progress) and the final one."""
    import time as _time

    r = client.post("/analyze", data=data, files=files)
    if r.status_code != 202:
        return r, None, []
    job_id = r.json()["job_id"]
    seen = [r.json()]
    deadline = _time.time() + timeout
    while _time.time() < deadline:
        status = client.get(f"/analyze/{job_id}").json()
        seen.append(status)
        if status["status"] in ("done", "failed"):
            return r, status, seen
        _time.sleep(0.02)
    raise AssertionError(f"job {job_id} did not finish: {seen[-1]}")
