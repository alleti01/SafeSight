from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

import blur
import server
from conftest import run_analysis

ASSETS = Path(blur.__file__).parent / ".venv/lib/python3.11/site-packages/ultralytics/assets"
TWO_PEOPLE = ASSETS / "zidane.jpg"  # two people, 1280x720
BUS = ASSETS / "bus.jpg"  # several people beside a bus
NO_PEOPLE = Path(blur.__file__).parent / "demo" / "frames" / "f07.jpg"


def sharpness(arr):
    return cv2.Laplacian(cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY), cv2.CV_64F).var()


def test_people_are_found():
    _, count = blur.blur_people(Image.open(TWO_PEOPLE))
    assert count == 2
    _, count = blur.blur_people(Image.open(BUS))
    assert count >= 4


def test_people_are_blurred_and_everything_else_is_untouched():
    img = Image.open(TWO_PEOPLE).convert("RGB")
    before = np.asarray(img)
    mask, _ = blur.person_mask(before[:, :, ::-1].copy())
    after = np.asarray(blur.blur_people(img)[0])

    people = mask == 255
    assert 0.05 < people.mean() < 0.9
    # Outside the people, not a single pixel changes.
    assert np.array_equal(before[~people], after[~people])
    # Inside, detail is wiped out: sharpness of each person's box drops by over 90%.
    ys, xs = np.where(people)
    box = (slice(ys.min(), ys.max()), slice(xs.min(), xs.max()))
    assert sharpness(after[box]) < 0.1 * sharpness(before[box])


def test_photo_without_people_is_returned_unchanged():
    img = Image.open(NO_PEOPLE)
    out, count = blur.blur_people(img)
    assert count == 0 and out is img


def test_uploaded_photo_is_saved_with_people_blurred():
    client = TestClient(server.app)
    _, status, _ = run_analysis(client, {"room": "bedroom"},
                                [("photos", ("p.jpg", TWO_PEOPLE.read_bytes(), "image/jpeg"))])
    assert status["status"] == "done", status
    frame = status["result"]["frames"][0]
    assert frame["people_blurred"] == 2

    saved = np.asarray(Image.open(server.JOBS / status["job_id"] / "frames" / "f01.jpg").convert("RGB"))
    original = np.asarray(Image.open(TWO_PEOPLE).convert("RGB"))
    # The right-hand person stands around x 750-1150; their face area must be blurred.
    face = (slice(40, 300), slice(800, 1100))
    assert sharpness(saved[face]) < 0.1 * sharpness(original[face])


def test_nothing_is_saved_if_people_cannot_be_blurred(monkeypatch):
    def broken():
        raise blur.BlurUnavailable("weights missing")

    monkeypatch.setattr(blur, "_get_model", broken)
    before = {p.name for p in server.JOBS.iterdir()}
    client = TestClient(server.app)
    _, status, _ = run_analysis(client, {"room": "bedroom"},
                                [("photos", ("p.jpg", TWO_PEOPLE.read_bytes(), "image/jpeg"))])
    assert status["status"] == "failed"
    assert "blur" in status["detail"]
    assert {p.name for p in server.JOBS.iterdir()} == before
