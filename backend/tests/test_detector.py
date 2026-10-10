from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

import detector
import pipeline
import server
from conftest import run_analysis

ASSETS = Path(detector.__file__).parent / ".venv/lib/python3.11/site-packages/ultralytics/assets"
BUS = ASSETS / "bus.jpg"  # a bus with several people beside it, 810x1080
PHOTO = Path(server.__file__).parent / "demo" / "frames" / "f12.jpg"


@pytest.fixture(scope="module")
def bus_detector():
    # Same wrapper, prompted for what's in the sample photo, with two prompts
    # feeding one class the way "rug" and "bath mat" both feed rug.
    return detector.Detector({"vehicle": ["bus", "coach"], "person": ["person"]})


def test_real_model_finds_and_names_objects(bus_detector):
    rgb = np.asarray(Image.open(BUS).convert("RGB"))
    found = bus_detector(rgb)
    labels = [o["label"] for o in found]
    assert labels.count("vehicle") == 1, found  # "bus" and "coach" boxes merged into one
    assert labels.count("person") >= 3, found
    h, w = rgb.shape[:2]
    for o in found:
        x0, y0, x1, y1 = o["box"]
        assert 0 <= x0 < x1 <= w and 0 <= y0 < y1 <= h
        assert 0 < o["score"] <= 1


def test_every_prompt_maps_to_a_known_object_class():
    known = {"rug", "patterned_floor", "floor_glare", "toilet", "bathroom_fitting",
             "furniture", "mirror", "stair_edge", "floor_clutter", "bin"}
    assert set(detector.PROMPTS) <= known


def test_dedupe_keeps_the_best_of_overlapping_boxes_per_class():
    objs = [
        {"label": "rug", "box": [0, 0, 100, 100], "score": 0.5},
        {"label": "rug", "box": [5, 5, 100, 100], "score": 0.8},
        {"label": "mirror", "box": [5, 5, 100, 100], "score": 0.4},
        {"label": "rug", "box": [300, 300, 400, 400], "score": 0.3},
    ]
    kept = detector.dedupe(objs)
    assert sorted((o["label"], o["score"]) for o in kept) == [("mirror", 0.4), ("rug", 0.3), ("rug", 0.8)]


FRAME = {"frame_id": "f01"}


def hazards(room, *objects):
    return pipeline.objects_to_hazards(room, FRAME, [{"box": [1, 2, 30, 40], "score": 0.7, **o} for o in objects])


def test_mirrors_and_clutter_are_always_hazards():
    out = hazards("bedroom", {"label": "mirror"}, {"label": "floor_clutter"})
    assert [(h["type"], h["severity"]) for h in out] == [("mirror", "low"), ("floor_clutter", "high")]
    assert out[0] == {"type": "mirror", "severity": "low", "confidence": 0.7, "frame_id": "f01",
                      "box": [1, 2, 30, 40], "outline_url": ""}


def test_bin_is_a_hazard_only_in_the_bathroom():
    assert [h["type"] for h in hazards("bathroom", {"label": "bin"})] == ["toilet_lookalike"]
    assert hazards("bedroom", {"label": "bin"}) == []


def test_contrast_dependent_objects_need_the_photo():
    assert hazards("bathroom", {"label": "rug"}, {"label": "toilet"}, {"label": "furniture"}) == []


def test_detected_hazards_reach_the_app_with_ids(monkeypatch):
    monkeypatch.setattr(pipeline, "detect", lambda img: [
        {"label": "mirror", "box": [180, 60, 470, 380], "score": 0.86},
        {"label": "bin", "box": [900, 400, 1000, 600], "score": 0.5},
    ])
    client = TestClient(server.app)
    _, status, _ = run_analysis(client, {"room": "bathroom"}, [("photos", ("b.jpg", PHOTO.read_bytes(), "image/jpeg"))])
    result = status["result"]
    assert [(h["hazard_id"], h["type"], h["frame_id"]) for h in result["hazards"]] == [
        ("h1", "mirror", "f01"), ("h2", "toilet_lookalike", "f01")]
    assert result["hazards"][0]["box"] == [180, 60, 470, 380]


def test_a_decoy_on_the_same_spot_removes_a_false_hazard():
    basket_as_rug = {"label": "rug", "box": [1071, 535, 1268, 663], "score": 0.51}
    real_rug = {"label": "rug", "box": [421, 585, 943, 669], "score": 0.63}
    decoys = [{"label": None, "box": [1070, 530, 1270, 665], "score": 0.78}]
    assert detector.drop_decoyed([basket_as_rug, real_rug], decoys) == [real_rug]


def test_a_less_sure_decoy_does_not_remove_a_hazard():
    rug = {"label": "rug", "box": [0, 0, 100, 100], "score": 0.8}
    assert detector.drop_decoyed([rug], [{"label": None, "box": [0, 0, 100, 100], "score": 0.5}]) == [rug]


def test_a_basket_is_a_bin_not_a_rug():
    basket_as_rug = {"label": "rug", "box": [1071, 535, 1268, 663], "score": 0.51}
    basket_as_bin = {"label": "bin", "box": [1070, 530, 1270, 665], "score": 0.76}
    real_rug = {"label": "rug", "box": [421, 585, 943, 669], "score": 0.63}
    assert detector.one_name_each([basket_as_rug, basket_as_bin, real_rug]) == [basket_as_bin, real_rug]


def test_a_basket_in_the_bathroom_may_be_mistaken_for_the_toilet():
    basket = {"label": "bin", "box": [12, 471, 247, 665], "score": 0.76}
    (hazard,) = pipeline.objects_to_hazards("bathroom", {"frame_id": "f1"}, [basket])
    assert hazard["type"] == "toilet_lookalike"
    assert pipeline.objects_to_hazards("bedroom", {"frame_id": "f1"}, [basket]) == []
