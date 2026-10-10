from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

import contrast
import pipeline
import server
from conftest import run_analysis

DEMO = Path(server.__file__).parent / "demo" / "frames"
RUG_BOX = [410, 520, 880, 700]       # the dark rug drawn in f07.jpg
TOILET_BOX = [560, 300, 820, 640]    # the white toilet drawn in f12.jpg
MIRROR_BOX = [180, 60, 470, 380]     # the mirror drawn in f12.jpg


def scene(background, thing, size=(300, 400), rect=(100, 120, 200, 280)):
    """A flat background with one flat-colored object; returns (lab, mask)."""
    rgb = np.full((*size, 3), background, np.uint8)
    y0, x0, y1, x1 = rect
    rgb[y0:y1, x0:x1] = thing
    mask = np.zeros(size, bool)
    mask[y0:y1, x0:x1] = True
    return contrast.to_lab(rgb), mask


def test_dark_rug_on_a_light_floor_is_high():
    assert contrast.judge("rug", *scene((205, 184, 150), (38, 42, 58))) == ("dark_rug", "high")


def test_rug_close_to_the_floor_is_only_a_trip_risk():
    assert contrast.judge("rug", *scene((205, 184, 150), (180, 165, 140))) == ("loose_rug", "low")


def test_white_toilet_on_white_blends_in_badly():
    assert contrast.judge("toilet", *scene((236, 236, 232), (244, 244, 242))) == ("bathroom_fitting_blends_in", "high")


def test_pale_grey_fitting_on_white_blends_in():
    assert contrast.judge("bathroom_fitting", *scene((236, 236, 232), (205, 205, 200))) == ("bathroom_fitting_blends_in", "medium")


def test_dark_toilet_seat_on_white_stands_out():
    assert contrast.judge("toilet", *scene((236, 236, 232), (30, 60, 140))) is None


def test_furniture_matching_the_wall_blends_in_and_a_red_sofa_does_not():
    assert contrast.judge("furniture", *scene((150, 150, 150), (145, 147, 150))) == ("furniture_blends_in", "medium")
    assert contrast.judge("furniture", *scene((150, 150, 150), (180, 40, 40))) is None


def stairs(edge_color):
    rgb = np.full((300, 300, 3), (200, 190, 175), np.uint8)
    for y in range(40, 260, 44):
        rgb[y:y + 6, 40:260] = edge_color
    mask = np.zeros((300, 300), bool)
    mask[30:270, 40:260] = True
    return contrast.to_lab(rgb), mask


def test_stairs_with_marked_edges_are_fine_and_plain_ones_are_flagged():
    assert contrast.judge("stair_edge", *stairs((40, 40, 40))) is None
    assert contrast.judge("stair_edge", *stairs((196, 186, 171))) == ("stair_edge_hard_to_see", "high")


def iou(a, b):
    return (a & b).sum() / (a | b).sum()


def test_sam_traces_the_drawn_rug():
    rgb = np.asarray(Image.open(DEMO / "f07.jpg").convert("RGB"))
    (mask,) = contrast.outline(rgb, [RUG_BOX])
    truth = np.zeros(mask.shape, bool)
    truth[520:700, 410:880] = True
    assert iou(mask, truth) > 0.9


def test_widened_box_finds_the_rest_of_a_rug_cut_short():
    rgb = np.asarray(Image.open(DEMO / "f07.jpg").convert("RGB"))
    truth = np.zeros(rgb.shape[:2], bool)
    truth[520:700, 410:880] = True
    tight = [470, 530, 820, 690]  # a detector box that misses both ends
    (short,) = contrast.outline(rgb, [tight])
    (full,) = contrast.outline(rgb, [tight], ["rug"])
    assert iou(short, truth) < 0.8
    assert iou(full, truth) > iou(short, truth) + 0.1


def test_hazard_box_grows_to_the_traced_rug():
    rgb = np.asarray(Image.open(DEMO / "f07.jpg").convert("RGB"))
    tight = [470, 530, 820, 690]
    objects = [{"label": "rug", "box": tight, "score": 0.6}]
    (hazard,) = pipeline.objects_to_hazards("bedroom", {"frame_id": "f07"}, objects, rgb)
    x0, y0, x1, y1 = hazard["box"]
    assert x0 < tight[0] and x1 > tight[2]
    assert abs(x0 - RUG_BOX[0]) < 25 and abs(x1 - RUG_BOX[2]) < 25


def test_holes_inside_an_outline_are_filled_but_the_outside_is_not():
    ring = np.zeros((60, 60), bool)
    ring[10:50, 10:50] = True
    ring[20:40, 20:40] = False      # a hole, like a mirror's reflection
    filled = contrast.fill_holes(ring)
    assert filled[30, 30] and filled[10:50, 10:50].all()
    assert not filled[0:10].any() and not filled[:, 50:].any()
    notch = np.zeros((60, 60), bool)
    notch[10:50, 10:50] = True
    notch[40:50, 40:50] = False     # a bite out of the edge stays open
    assert not contrast.fill_holes(notch)[45, 45]


def test_only_rugs_get_a_wider_box():
    shape = (720, 1280, 3)
    assert contrast.prompt_box([100, 100, 200, 140], "mirror", shape) == [100, 100, 200, 140]
    assert contrast.prompt_box([100, 100, 200, 140], "rug", shape) == [90, 96, 210, 144]
    assert contrast.prompt_box([0, 600, 1279, 719], "rug", shape) == [0, 589, 1279, 719]


def test_upload_flags_by_contrast_and_saves_outlines(monkeypatch):
    boxes = {"f01": [{"label": "rug", "box": RUG_BOX, "score": 0.9}],
             "f02": [{"label": "toilet", "box": TOILET_BOX, "score": 0.8},
                     {"label": "mirror", "box": MIRROR_BOX, "score": 0.7}]}
    calls = iter(["f01", "f02"])
    monkeypatch.setattr(pipeline, "detect", lambda img: boxes[next(calls)])

    client = TestClient(server.app)
    _, status, _ = run_analysis(client, {"room": "bathroom"}, [
        ("photos", ("rug.jpg", (DEMO / "f07.jpg").read_bytes(), "image/jpeg")),
        ("photos", ("toilet.jpg", (DEMO / "f12.jpg").read_bytes(), "image/jpeg")),
    ])
    assert status["status"] == "done", status
    hazards = status["result"]["hazards"]
    assert [(h["type"], h["severity"]) for h in hazards] == [
        ("dark_rug", "high"), ("bathroom_fitting_blends_in", "high"), ("mirror", "low")]

    rug = hazards[0]
    r = client.get(rug["outline_url"])
    assert r.headers["content-type"] == "image/png"
    outline = Image.open(server.JOBS / status["job_id"] / "outlines" / Path(rug["outline_url"]).name)
    assert outline.mode == "RGBA" and outline.size == (1280, 720)
    alpha = np.asarray(outline)[:, :, 3] > 0
    truth = np.zeros(alpha.shape, bool)
    truth[520:700, 410:880] = True
    assert iou(alpha, truth) > 0.9
