# model/ plan (Person A)

Everything in `model/`. The app never sees object labels, only the 10 hazard codes in `shared/contract.json`.

## Decisions (locked Fri Oct 9)

- **Detector:** YOLO11-m, fine-tuned.
- **Labels are objects, not hazards (13, frozen order, changed Oct 10):**
  `rug, toilet, toilet_roll_holder, towel, mirror, stairs, cable, floor_clutter, bin, bed, sofa, chair, table`
  (`stair_edge` became `stairs` because every dataset boxes the whole staircase; `toilet_seat` merged into
  `toilet` because no dataset labels seats. Edge and seat contrast are checked inside the SAM 2 outline.)
- **Rules turn objects into the 10 hazard codes** (SAM 2 outline + contrast with surroundings):

  | Object | Rule | Hazard code |
  |---|---|---|
  | rug | much darker than surrounding floor | `dark_rug` |
  | rug | otherwise (low severity) | `loose_rug` |
  | toilet, toilet_roll_holder, towel | low contrast with wall/floor next to it | `bathroom_fitting_blends_in` |
  | bed, sofa, chair, table | low contrast with wall/floor next to it | `furniture_blends_in` |
  | mirror | always | `mirror` |
  | stairs | low contrast along step edges | `stair_edge_hard_to_see` |
  | cable, floor_clutter | on the floor | `floor_clutter` |
  | bin | room is bathroom | `toilet_lookalike` |
  | floor (Grounding DINO + SAM 2, untrained) | glare | `shiny_floor` |
  | floor (Grounding DINO + SAM 2, untrained) | busy texture/stripes | `patterned_floor` |

- **Baseline for the fine-tune comparison:** untrained Grounding DINO with the same 14 labels as text prompts (prompt list frozen in Phase 2).
- **Training data:** public datasets (Open Images V7, ADE20K, Roboflow Universe), credited in the README.
- **Test set:** one room in our own home, filmed and labeled by us, never trained on. Demo video is our own too.
- **Compute:** Mac (M4 Max) for downloads, data prep and pipeline dev. Brev H100 (Nebius, $5.40/hr, stoppable) only for training, the live service and FLUX. Stop it whenever a phase ends.

## Phase 0: Setup (done)

- Repo cloned, branch `abhijandyala`, git identity set
- `model/.gitignore` pushed
- Python 3.11 env in `model/.venv` (`requirements.txt`), Mac GPU (MPS) works
- Roboflow key in `model/.env` (never committed)

## Phase 1: Downloads (done Sat ~2 AM, Mac, $0)

- Models in `model/weights/`: `yolo11m.pt`, `grounding-dino-base/`, `sam2.1-hiera-large/`
- Open Images V7 (`scripts/download_openimages.py`): 7,088 images, 19,148 boxes in `data/open-images/` (`images/`, `boxes.csv`). No rug class exists in Open Images.
- ADE20K 150-class (`data/ade20k/ADEChallengeData2016/`): semantic masks, ~4,800 home-scene images (bedroom, living_room, bathroom, kitchen, dining_room, corridor, staircase, hallway...). Main source of rugs.
- Roboflow Universe (`scripts/download_roboflow.py`, list in `data/roboflow/sources.json`): 12 datasets, YOLO format. Augmented copies stay in train only.

### Source class -> our label (used in Phase 2)

| Our label | Open Images | ADE20K (objectInfo150 name) | Roboflow |
|---|---|---|---|
| rug | (none) | rug, carpet, carpeting | asdasd carpet, ai-dataset Carpet, ethan carpet |
| toilet | Toilet | toilet | sapiens Toilet, svalab12 wc, adrian wc |
| toilet_roll_holder | Toilet paper | (none) | practicas Toilet-paper |
| towel | Towel | towel | svalab12 towel, adrian towel |
| mirror | Mirror | mirror | svalab12 mirror, adrian mirror |
| stairs | Stairs | stairs/steps, stairway/staircase, step/stair | bcpmodel1commona, tom-lai, kaist stairs |
| cable | (none) | (none) | bartu cables (drop overhead power lines) |
| floor_clutter | (none) | (none) | hoarding-support: all classes except furniture |
| bin | Waste container | ashcan, trash can | (none) |
| bed | Bed, Sofa bed | bed | (none) |
| sofa | Couch, Studio couch, Loveseat | sofa, couch; armchair | (none) |
| chair | Chair | chair, swivel chair | (none) |
| table | Table, Coffee table, Kitchen & dining room table | table, coffee table | (none) |

Dropped: Roboflow sink, soap, Door-handle, the junk class names in adrian/asdasd; ADE20K classes not listed.

## Phase 2: Build the dataset (Sat 8-11 AM, Mac, $0)

1. Convert all sources to YOLO format, remap to the 14 labels
2. Drop duplicates; train/val split
3. Count images per label; flag weak labels
4. Freeze the Grounding DINO prompt list (baseline)
5. Film the test room + one demo video (~10 min)
6. Label the test room in Roboflow; top up weak labels from Grounding DINO pre-labels (with Anish)

Done when: one `data.yaml`, a per-label count table, test room labeled.
1 PM check-in: send Anish real results from 5 photos in contract format.

## Phase 3: Baseline + fine-tune (Sat 12-6 PM, H100 ~4-5 hrs, ~$25)

1. Start Brev H100, copy the dataset up
2. Baseline: untrained Grounding DINO on the test room, save scores
3. Fine-tune YOLO11-m, 2-3 runs with different settings
4. Score each run on the test room, keep the best
5. Stop the H100

Done when: trained model beats baseline on the test room, numbers saved.

## Phase 4: Analysis service (Sat 7 PM-1 AM, Mac then H100 ~3 hrs, ~$16)

1. Video to frames (1/sec, drop blurry and near-duplicate)
2. Blur people
3. Detector -> SAM 2 outlines -> contrast rules -> 10 hazard codes
4. Merge repeats across frames, pick best frame, rate severity
5. FastAPI service: `POST /analyze`, `POST /fix/{hazard_id}` (stub), contract format
6. Run on the H100 behind a tunnel, send Anish the URL

Done when (9 PM hookup): Anish's app shows real hazards from a real room video.

## Phase 5: Fixes + "after" pictures (Sun 9 AM-2 PM, H100 ~3 hrs, ~$16)

1. Add examples of misses, retrain once
2. FLUX.1 Fill on the H100 for `/fix`
3. Accuracy chart (baseline vs trained, per label) + a few honest mistakes

2 PM: feature freeze.

## Phase 6: Wrap-up (Sun 2-9 PM, H100 ~2 hrs, ~$11)

1. `model/` section of the README: data sources, training, results, credits for every dataset and model
2. Keep the service up for the demo recording, then stop the H100
3. Merge branch into `main`; confirm the repo is public
4. After submitting, delete the H100 instance

## Budget

| Phase | H100 hours | Cost |
|---|---|---|
| 3 | ~4-5 | ~$25 |
| 4 | ~3 | ~$16 |
| 5 | ~3 | ~$16 |
| 6 | ~2 | ~$11 |
| Buffer | ~5 | ~$30 |
| **Total** | **~18** | **~$100** |
