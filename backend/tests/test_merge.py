from pipeline import merge_repeats


def frame(fid, t=None, w=1280, h=720):
    f = {"frame_id": fid, "width": w, "height": h}
    if t is not None:
        f["time_s"] = t
    return f


def hz(fid, box, kind="dark_rug", conf=0.8, severity="high"):
    return {"type": kind, "severity": severity, "confidence": conf, "frame_id": fid, "box": box, "outline_url": f"/outlines/{fid}.png"}


def test_same_rug_across_a_pan_is_one_hazard_in_its_clearest_frame():
    frames = [frame("f01", 0), frame("f02", 1), frame("f03", 2)]
    hazards = [
        hz("f01", [900, 400, 1280, 700], conf=0.9),  # cut off at the right edge
        hz("f02", [600, 400, 1000, 680], conf=0.85),  # whole and big: the clearest
        hz("f03", [300, 420, 600, 600], conf=0.6),
    ]
    out = merge_repeats(hazards, frames)
    assert len(out) == 1
    assert out[0]["frame_id"] == "f02"
    assert out[0]["hazard_id"] == "h1"


def test_two_rugs_in_one_frame_stay_two():
    frames = [frame("f01", 0)]
    out = merge_repeats([hz("f01", [100, 400, 400, 600]), hz("f01", [800, 400, 1100, 600])], frames)
    assert [h["hazard_id"] for h in out] == ["h1", "h2"]


def test_one_rug_boxed_twice_in_a_frame_is_one():
    frames = [frame("f01", 0), frame("f02", 1)]
    hazards = [
        hz("f01", [18, 278, 893, 606], conf=0.51),
        hz("f01", [72, 280, 1183, 606], conf=0.25),  # the same rug, boxed wider
        hz("f02", [0, 267, 780, 605], conf=0.55),
    ]
    out = merge_repeats(hazards, frames)
    assert len(out) == 1


def test_two_rugs_followed_through_a_pan_stay_two():
    frames = [frame("f01", 0), frame("f02", 1)]
    hazards = [
        hz("f01", [100, 400, 400, 600]),
        hz("f01", [800, 400, 1100, 600]),
        hz("f02", [0, 400, 250, 600]),  # the left rug, moved left
        hz("f02", [650, 400, 950, 600]),  # the right rug, moved left
    ]
    assert len(merge_repeats(hazards, frames)) == 2


def test_far_apart_in_time_is_not_merged():
    frames = [frame("f01", 0), frame("f20", 30)]
    assert len(merge_repeats([hz("f01", [100, 400, 400, 600]), hz("f20", [100, 400, 400, 600])], frames)) == 2


def test_jump_across_the_frame_is_not_merged():
    frames = [frame("f01", 0), frame("f02", 1)]
    assert len(merge_repeats([hz("f01", [0, 0, 200, 150]), hz("f02", [1080, 570, 1280, 720])], frames)) == 2


def test_different_kinds_in_the_same_place_stay_apart():
    frames = [frame("f01", 0), frame("f02", 1)]
    out = merge_repeats([hz("f01", [100, 400, 400, 600]), hz("f02", [100, 400, 400, 600], kind="loose_rug")], frames)
    assert {h["type"] for h in out} == {"dark_rug", "loose_rug"}


def test_photos_merge_only_when_the_box_is_in_the_same_place():
    frames = [frame("f01"), frame("f02"), frame("f03")]
    hazards = [
        hz("f01", [100, 400, 400, 600]),
        hz("f02", [110, 410, 410, 610]),  # a burst shot of the same view
        hz("f03", [700, 100, 1000, 300]),  # elsewhere: could be another rug
    ]
    assert len(merge_repeats(hazards, frames)) == 2


def test_photos_of_different_sizes_compare_by_share_of_the_frame():
    frames = [frame("f01", w=1280, h=720), frame("f02", w=640, h=360)]
    assert len(merge_repeats([hz("f01", [100, 400, 400, 600]), hz("f02", [50, 200, 200, 300])], frames)) == 1


def test_keeps_the_most_serious_severity_and_first_seen_order():
    frames = [frame("f01", 0), frame("f02", 1), frame("f03", 2)]
    hazards = [
        hz("f03", [100, 100, 300, 300], kind="mirror", severity="low"),
        hz("f01", [100, 400, 400, 600], severity="medium", conf=0.9),
        hz("f02", [120, 400, 420, 600], severity="high", conf=0.5),
    ]
    out = merge_repeats(hazards, frames)
    assert [h["type"] for h in out] == ["dark_rug", "mirror"]
    assert out[0]["severity"] == "high"
    assert out[0]["frame_id"] == "f01"  # the surer sighting is still the clearer one
    assert [h["hazard_id"] for h in out] == ["h1", "h2"]


def test_nothing_in_nothing_out():
    assert merge_repeats([], [frame("f01", 0)]) == []
