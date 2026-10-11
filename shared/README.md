# The doorway between model/ and app/

Changes here only when both of you are on a call and agree. Add fields; never rename or remove one.

## Endpoints (app/ → backend/)

| Request | Sends | Gets back |
|---|---|---|
| `POST /analyze` | multipart form: `room` (`bathroom` / `bedroom` / `hallway` / `living_room` / `kitchen` / `stairs`) plus either several `photos` or one `video` | `202` with a job: `{ "job_id", "status": "queued" }` (bad input is a `422` straight away) |
| `GET /analyze/{job_id}` | nothing | `{ "job_id", "status": "queued" \| "working" \| "done" \| "failed", "step", "done", "total" }`, plus `result` (the shape of `contract.json`) when done or `detail` when failed |
| `POST /fix` | JSON `{ "job_id": "abc123", "hazard_id": "h1" }` (hazard ids are only unique within a job) | `{ "hazard_id": "h1", "after_url": "/...", "placeholder": true }` |

Errors come back as `{ "detail": "<message for the caregiver>" }`.

All `*_url` paths are relative to the brain's base address, which the app reads from one setting.

## Fields

- `type`: one of `dark_rug`, `loose_rug`, `shiny_floor`, `patterned_floor`, `bathroom_fitting_blends_in`, `furniture_blends_in`, `mirror`, `stair_edge_hard_to_see`, `floor_clutter`, `toilet_lookalike`
- `severity`: `high`, `medium` or `low`
- `confidence`: 0 to 1
- `box`: `[left, top, right, bottom]` in pixels of the frame named by `frame_id`
- `outline_url`: PNG mask/outline of the object, same size as the frame

## Model hand-off (proposed: model/ → backend/)

Abhi's `model/` exposes one function the backend imports:

```python
detect(image: numpy.ndarray) -> list[dict]
# [{"label": "rug", "box": [x0, y0, x1, y1], "score": 0.87}, ...]
```

Labels are the 10 object classes: `rug`, `patterned_floor`, `floor_glare`, `toilet`, `bathroom_fitting`, `furniture`, `mirror`, `stair_edge`, `floor_clutter`, `bin`. The backend turns objects into the hazard codes above. Swapping in newly trained weights must not change this signature.

## Wording

The backend only says which hazard it found. All caregiver-facing wording (name, reason, fix) lives in `app/`, keyed by `type`.

## Added fields (Oct 11, add-only)

Frames:
- `time_s` (videos): seconds into the video this frame was taken.

Hazards:
- `object`: what the object is, one of the model's 16 object types (`toilet`, `rug`, `cable`, ...) or `floor` / `wall` / `floor+wall` for surface hazards.
- `evidence`: what was measured, e.g. `{"lrv_difference": 4.4}` (light-reflectance difference to its surroundings; under 20 is hard to see, under 10 very hard) or `{"darker_than_floor_by": 49.4}`.
- `time_s` (videos): seconds into the video where it was seen.
- `clip_url` (videos): a 3-second H.264 mp4 around that moment, people blurred, no sound.
- `clip_start_s` (videos): where the clip starts in the original video, in seconds.
- `track` (videos): the box over the clip, `[[t, left, top, right, bottom, seen], ...]`. `t` is seconds into the clip, the box is fractions of the clip frame, `seen` is 1 when the object is in view and 0 when it isn't (hide the box then). About 5 entries per second; interpolate between them.

`type` also takes: `glass_door`, `door_blends_in`, `window_reflection`, `floor_transition`, `floor_wall_blend`, `patterned_wall`.

`POST /live` (multipart `room` + one camera `frame`) returns `{"hazards": [{type, severity, confidence, object, box}]}` with boxes as fractions of the frame.
