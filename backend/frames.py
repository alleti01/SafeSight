"""Video to frames: about one sharp, distinct photo per second of video.

For each second we look at a few candidate frames and keep the sharpest.
Then we drop seconds that are much blurrier than the rest of the video, and
seconds that show almost the same view as a frame we already kept.
"""

from pathlib import Path

import cv2
import numpy as np

MAX_SECONDS = 180
MAX_FRAMES = 30
CANDIDATES_PER_SECOND = 4
# A second is "blurry" if its best frame is less than this fraction as sharp
# as the video's median second.
BLUR_RATIO = 0.35
# Two frames show "the same view" if their 64x36 grayscale thumbnails differ
# by less than this on average (0-255 scale).
DUPLICATE_DIFF = 8.0


class VideoError(ValueError):
    """A video we can't use. The message is shown to the caregiver."""


def sharpness(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _gray_small(frame: np.ndarray, width: int) -> np.ndarray:
    h, w = frame.shape[:2]
    small = cv2.resize(frame, (width, max(1, round(h * width / w))), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)


def _thumb(frame: np.ndarray) -> np.ndarray:
    return cv2.resize(_gray_small(frame, 320), (64, 36), interpolation=cv2.INTER_AREA).astype(np.float32)


def extract(path: Path) -> list[tuple[float, np.ndarray]]:
    """Return (seconds into the video, BGR frame) for each frame worth keeping."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise VideoError("We couldn't open that video. Try an MP4 or MOV file.")

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        if not (1 <= fps <= 240):
            fps = 30.0
        count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        if count > 0 and count / fps > MAX_SECONDS:
            raise VideoError(f"That video is over {MAX_SECONDS // 60} minutes. A 1-minute walk-through is plenty.")

        step = max(1, round(fps / CANDIDATES_PER_SECOND))
        seconds = []  # (sharpness, t, jpeg bytes, thumbnail), one per second of video
        best = None  # (sharpness, t, frame) for the second being read
        i = 0
        while cap.grab():
            t = i / fps
            if t > MAX_SECONDS + 1:
                raise VideoError(f"That video is over {MAX_SECONDS // 60} minutes. A 1-minute walk-through is plenty.")
            if best is not None and int(t) != int(best[1]):
                seconds.append(_finish(best))
                best = None
            if i % step == 0:
                ok, frame = cap.retrieve()
                if ok:
                    s = sharpness(_gray_small(frame, 640))
                    if best is None or s > best[0]:
                        best = (s, t, frame)
            i += 1
        if best is not None:
            seconds.append(_finish(best))
    finally:
        cap.release()

    if not seconds:
        raise VideoError("We couldn't read any frames from that video. Try an MP4 or MOV file.")

    median = float(np.median([s[0] for s in seconds]))
    kept, thumbs = [], []
    for s, t, jpeg, thumb in seconds:
        if s < BLUR_RATIO * median:
            continue
        if any(float(np.abs(thumb - other).mean()) < DUPLICATE_DIFF for other in thumbs):
            continue
        kept.append((t, jpeg))
        thumbs.append(thumb)

    if len(kept) > MAX_FRAMES:
        idx = np.linspace(0, len(kept) - 1, MAX_FRAMES).round().astype(int)
        kept = [kept[j] for j in idx]

    return [(t, cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)) for t, jpeg in kept]


def _finish(best: tuple[float, float, np.ndarray]):
    """Keep only a compressed copy of a second's best frame, to bound memory."""
    s, t, frame = best
    h, w = frame.shape[:2]
    scale = min(1.0, 1280 / max(h, w))
    if scale < 1:
        frame = cv2.resize(frame, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    ok, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return s, t, jpeg.tobytes(), _thumb(frame)
