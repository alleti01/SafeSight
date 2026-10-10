import pytest

import frames
from conftest import FPS, write_video


def kept_times(path):
    return [t for t, _ in frames.extract(path)]


def test_walkthrough_keeps_about_one_frame_per_distinct_second(walkthrough):
    times = kept_times(walkthrough)
    # 8 s of panning + 1 still view + 5 sharp seconds of panning, give or take.
    assert 11 <= len(times) <= 16, times


def test_still_stretch_collapses_to_one_frame(walkthrough):
    still = [t for t in kept_times(walkthrough) if 8.5 <= t < 13]
    assert len(still) <= 1, still


def test_blurry_seconds_are_dropped(walkthrough):
    assert not [t for t in kept_times(walkthrough) if 15 <= t < 17]


def test_frames_are_full_size_color_images(walkthrough):
    _, frame = frames.extract(walkthrough)[0]
    assert frame.shape == (360, 640, 3)


def test_iphone_style_hevc_mov_is_read(walkthrough_hevc):
    times = kept_times(walkthrough_hevc)
    assert 11 <= len(times) <= 16, times


def test_video_of_one_still_view_gives_one_frame(tmp_path):
    path = write_video(tmp_path / "still.mp4", [0.0] * (5 * FPS))
    assert len(kept_times(path)) == 1


def test_long_video_is_capped_at_max_frames(tmp_path):
    # 60 s of steady panning would give ~60 distinct seconds.
    path = write_video(tmp_path / "long.mp4", [i * 4.0 for i in range(60 * FPS)], size=(320, 180))
    assert len(kept_times(path)) == frames.MAX_FRAMES


def test_too_long_video_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(frames, "MAX_SECONDS", 3)
    path = write_video(tmp_path / "long.mp4", [i * 3.0 for i in range(5 * FPS)])
    with pytest.raises(frames.VideoError, match="over"):
        frames.extract(path)


def test_file_that_is_not_a_video_is_refused(tmp_path):
    path = tmp_path / "notes.mp4"
    path.write_text("not a video")
    with pytest.raises(frames.VideoError):
        frames.extract(path)
