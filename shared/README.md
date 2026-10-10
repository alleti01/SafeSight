# The doorway between model/ and app/

Changes here only when both of you are on a call and agree. Add fields; never rename or remove one.

## Endpoints (proposed, confirm on the 11:30 PM call)

| Request | Sends | Gets back |
|---|---|---|
| `POST /analyze` | multipart form: `room` (`bathroom` / `bedroom` / `hallway`) plus either several `photos` or one `video` | JSON in the shape of `contract.json` |
| `POST /fix/{hazard_id}` | nothing else | `{ "hazard_id": "h1", "after_url": "/after/h1.jpg" }` |

All `*_url` paths are relative to the brain's base address, which the app reads from one setting.

## Fields

- `type`: one of `dark_rug`, `loose_rug`, `shiny_floor`, `patterned_floor`, `bathroom_fitting_blends_in`, `furniture_blends_in`, `mirror`, `stair_edge_hard_to_see`, `floor_clutter`, `toilet_lookalike`
- `severity`: `high`, `medium` or `low`
- `confidence`: 0 to 1
- `box`: `[left, top, right, bottom]` in pixels of the frame named by `frame_id`
- `outline_url`: PNG mask/outline of the object, same size as the frame

The brain only says which hazard it found. All caregiver-facing wording (name, reason, fix) lives in `app/`, keyed by `type`.
