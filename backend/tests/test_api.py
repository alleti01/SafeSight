from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import server
from conftest import run_analysis

HERE = Path(__file__).resolve().parent
PHOTO = HERE.parent / "demo" / "frames" / "f07.jpg"


@pytest.fixture
def client():
    return TestClient(server.app)


def job_dirs():
    return {p.name for p in server.JOBS.iterdir() if p.is_dir()}


def test_analyze_answers_at_once_with_a_job_id(client):
    r = client.post("/analyze", data={"room": "bathroom"},
                    files=[("photos", ("a.jpg", PHOTO.read_bytes(), "image/jpeg"))])
    assert r.status_code == 202
    body = r.json()
    assert body["status"] in ("queued", "working", "done") and body["job_id"]


def test_photos_come_back_as_frames(client):
    _, status, _ = run_analysis(client, {"room": "Bathroom"}, [("photos", ("a.jpg", PHOTO.read_bytes(), "image/jpeg"))])
    assert status["status"] == "done", status
    result = status["result"]
    assert result["room"] == "bathroom"
    assert result["job_id"] == status["job_id"]
    assert [f["frame_id"] for f in result["frames"]] == ["f01"]
    assert client.get(result["frames"][0]["image_url"]).headers["content-type"] == "image/jpeg"


def test_progress_moves_through_the_steps_in_order(client, walkthrough):
    _, status, seen = run_analysis(client, {"room": "hallway"},
                                   {"video": ("walk.mp4", walkthrough.read_bytes(), "video/mp4")})
    assert status["status"] == "done"
    order = ["frames", "people", "objects", "contrast"]
    steps = [s["step"] for s in seen if s["status"] == "working"]
    assert steps, "the app should see at least one working step"
    assert [order.index(s) for s in steps] == sorted(order.index(s) for s in steps), steps
    people = [s for s in seen if s["step"] == "people" and s["status"] == "working"]
    assert all(s["total"] == len(status["result"]["frames"]) for s in people)


def test_video_comes_back_as_frames_and_upload_is_deleted(client, walkthrough):
    _, status, _ = run_analysis(client, {"room": "hallway"},
                                {"video": ("walk.mp4", walkthrough.read_bytes(), "video/mp4")})
    result = status["result"]
    assert 11 <= len(result["frames"]) <= 16
    assert all("time_s" in f for f in result["frames"])
    for f in result["frames"][:3]:
        assert client.get(f["image_url"]).status_code == 200
    assert not list((server.JOBS / status["job_id"]).glob("upload*")), "the uploaded video should be deleted"


def test_iphone_hevc_mov_upload(client, walkthrough_hevc):
    _, status, _ = run_analysis(client, {"room": "bedroom"},
                                {"video": ("IMG_0001.MOV", walkthrough_hevc.read_bytes(), "video/quicktime")})
    assert status["status"] == "done"
    assert len(status["result"]["frames"]) >= 11


def test_broken_video_fails_with_a_clear_message_and_leaves_nothing_behind(client):
    before = job_dirs()
    _, status, _ = run_analysis(client, {"room": "hallway"}, {"video": ("x.mp4", b"not a video", "video/mp4")})
    assert status["status"] == "failed"
    assert "video" in status["detail"]
    assert job_dirs() == before


def test_bad_photo_fails_with_its_name(client):
    _, status, _ = run_analysis(client, {"room": "hallway"}, [("photos", ("notes.txt", b"hello", "text/plain"))])
    assert status["status"] == "failed"
    assert "notes.txt" in status["detail"]


def test_unknown_job_is_a_404(client):
    r = client.get("/analyze/nope1234")
    assert r.status_code == 404


def test_photos_and_video_together_are_refused(client, walkthrough):
    r = client.post("/analyze", data={"room": "hallway"},
                    files=[("photos", ("a.jpg", PHOTO.read_bytes(), "image/jpeg")),
                           ("video", ("w.mp4", walkthrough.read_bytes(), "video/mp4"))])
    assert r.status_code == 422


def test_unknown_room_is_refused(client):
    r = client.post("/analyze", data={"room": "garage"}, files=[("photos", ("a.jpg", PHOTO.read_bytes(), "image/jpeg"))])
    assert r.status_code == 422


def test_fix_finds_a_finished_job(client):
    server.jobs["demo1234"] = {"status": "done", "created": 1e12, "result": {
        "frames": [{"frame_id": "f01", "image_url": "/jobs/demo1234/frames/f01.jpg"}],
        "hazards": [{"hazard_id": "h1", "frame_id": "f01"}]}}
    r = client.post("/fix", json={"job_id": "demo1234", "hazard_id": "h1"})
    assert r.json() == {"hazard_id": "h1", "after_url": "/jobs/demo1234/frames/f01.jpg", "placeholder": True}
    assert client.post("/fix", json={"job_id": "demo1234", "hazard_id": "h9"}).status_code == 404
