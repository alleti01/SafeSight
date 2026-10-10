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

- **Baseline for the fine-tune comparison:** untrained Grounding DINO with the same 13 labels as text prompts (prompt list frozen in Phase 2).
- **Training data:** public datasets (Open Images V7, ADE20K, Roboflow Universe), credited in the README.
- **Test set:** Abhi's whole home, filmed and labeled by us, never trained on ("a home it never saw"). Anish's home is a small training top-up for weak labels (cables, roll holders, clutter). Demo video is from Abhi's home.
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

### Weak-label top-up (Sat ~3 AM)

- **LVIS v1** (`scripts/download_lvis.py`, COCO photos, `data/lvis/`): 3,325 images. toilet_tissue -> toilet_roll_holder; bath_mat/doormat/runner -> rug; shoes, socks, toys, boxes, bags, newspapers -> floor_clutter only in home photos and not on a person; plus our other classes in those images.
- **Roboflow messy homes:** `sasya-0ullp/messy-room-y5qsc`, `sds-first-workspace/messy-imgs` (loose items -> floor_clutter, furniture keeps its label), `superfish-5k9sp/robot-vacuum-cleaner` (its wire class is not in any exported version, so only glasses/mouse/nail -> floor_clutter).
- **Split fix:** Roboflow's own valid/test images go to val (floor_clutter val went 4 -> 352). The pasted-wire cable set is train only.
- **Cables (no real dataset exists):** `scripts/pseudo_label_cables.py` runs untrained Grounding DINO ("power cord. electrical cable. extension cord. charging cable.") over 4,791 ADE20K home photos + 2,500 LVIS home photos with outlets/lamps/TVs/laptops (`data/lvis/cable_pool/`). Candidates in `data/cable_search/candidates.json`; every box is checked by eye and only approved ones go to `data/cable_search/approved.json`, which `build_dataset.py` merges into those photos. Rejected Grounding DINO mistakes are mostly wall outlets, plugs and furniture edges.
  Result: 2,352 candidates reviewed on 24 sheets (decisions in `data/cable_search/review_decisions.txt`), 1,440 approved (61%), 180 overlapping duplicates merged -> **1,260 cable boxes in 962 real home photos** (231 ADE20K, 731 LVIS). Cords held by people, shower hoses, lamp poles and outlets alone were rejected.

### Dataset after top-up (`data/yolo/counts.txt`)

| Label | Train img | Val img |
|---|---|---|
| rug | 1,626 | 374 |
| toilet | 4,937 | 304 |
| toilet_roll_holder | 1,464 | 152 |
| towel | 1,128 | 100 |
| mirror | 2,447 | 232 |
| stairs | 4,288 | 558 |
| cable | 995 | 92 |
| floor_clutter | 2,404 | 352 |
| bin | 1,288 | 136 |
| bed | 2,633 | 270 |
| sofa | 2,538 | 303 |
| chair | 2,662 | 307 |
| table | 4,270 | 509 |

23,167 train + 2,575 val images.

## Phase 2: Build the dataset + test set (Sat 8 AM-1 PM, Mac, $0)

Goal by 1 PM: one clean 13-label training set, a hand-labeled test set from a real home, frozen baseline prompts, real results to Anish.

### 2.1 Build the training set (Claude, Mac, ~1.5 hrs)

1. Open Images: boxes to YOLO; drop images with "group" boxes (one box over many objects)
2. ADE20K: home scenes only; masks to boxes by splitting each class into connected pieces; drop specks
3. Roboflow: outlines to boxes, remap to 13 labels, drop overhead power-line images from the cable set (checked by eye)
4. Remove near-duplicate images across sources
5. Train/val split 90/10; Roboflow augmented copies stay with their original (train only)
6. Visual check: 30 random images with boxes drawn, plus a per-label count table

Known gap: sources only box their own classes (stairs sets don't box chairs). Fixed by the missing-box pass at the start of Phase 3.

### 2.2 Film (Abhi + Anish, ~40 min, 8:00 AM)

- **Abhi's home = test set, never trained on.** One slow 1-minute video + 15-20 photos per room; every label must appear somewhere. Stage some hazards (dark mat on light floor, cable across walkway, clothes on floor, bin next to toilet) and some safe versions (light rug, tidy floor). One video doubles as the demo video.
- **Anish's home = training top-up, ~100 photos:** mostly cables on floors (~40), toilet roll holders, floor clutter.
- iPhone: Most Compatible format, 1080p, nobody in frame.

### 2.3 Label (Abhi + Anish in Roboflow, ~2 hrs, 9:30-11:30)

1. Claude turns videos into frames (1/sec, drop blurry and near-duplicate)
2. Claude pre-labels all photos with Grounding DINO and uploads them to a Roboflow project
3. Abhi fixes his home (~150-200 test images); Anish fixes his (~100)
4. Claude pulls the corrected labels: Abhi's home -> `test/`, Anish's -> train

### 2.4 Freeze baseline prompts (Claude, ~20 min)

Try 2-3 wordings per label on 10 of Abhi's photos, save the best to `model/prompts.json`, commit, never change. These prompts are the "before" in the accuracy chart.

### 2.5 Quick checks (Claude, ~15 min)

- SAM 2 outlines on 5 objects (confirms the video-checkpoint warning is harmless)
- First contrast numbers on one dark rug and one white toilet

### 2.6 1 PM check-in

5 of Abhi's photos -> Grounding DINO + SAM 2 + simple rules -> `contract.json` format with the 10 hazard codes -> Anish loads it in the gallery.

### Timeline

| Time | Abhi | Anish | Claude |
|---|---|---|---|
| 8:00-8:40 | Film whole home | Film ~100 top-up photos | 2.1 build training set |
| 8:40-9:30 | AirDrop to Mac | Upload photos | Frames, pre-labels, Roboflow upload |
| 9:30-11:30 | Fix test boxes | Fix top-up boxes | 2.4 prompts, 2.5 checks |
| 11:30-12:30 | | | Pull labels, final dataset + counts |
| 1:00 PM | Check-in | Check-in | 5-photo contract output |

### Done when

- [ ] `model/data/yolo/data.yaml` with train/val/test, 13 labels
- [ ] Per-label count table for each split
- [ ] Test set = Abhi's home only, hand-labeled, never trained on
- [ ] `model/prompts.json` committed
- [ ] Anish's gallery shows real results

## Phase 3: Baseline + fine-tune (Sat 1-6 PM, H100 ~4-5 hrs, ~$25)

1. Start Brev H100, copy the dataset up
2. Missing-box pass: Grounding DINO fills in our labels that a source never annotated (e.g. chairs in stairs datasets); high confidence only (~20 min, ~$2)
3. Baseline: untrained Grounding DINO on the test set, save scores
4. Fine-tune YOLO11-m, 2-3 runs with different settings
5. Score each run on the test set, keep the best
6. Stop the H100

Done when: trained model beats baseline on the test set, numbers saved.

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
