# SafeSight

BananaHacks project. A caregiver uploads photos or a short video of a home; a detector fine-tuned on the H100 flags things that are risky or confusing for a person with dementia; the app shows a gallery of hazards with a reason, a cheap fix and an "after" picture. Hazards come from the Alzheimer's Society guide *Making your home dementia friendly*.

Submit on Devpost by Sun Oct 11, 2026, 9:00 PM EDT (hard deadline 11:59 PM EDT). Feature freeze Sun 2:00 PM.

## Ownership (keeps main conflict-free)

- `model/`: Person A (Abhi). Labeling, fine-tuning the detector, accuracy results, and a `detect(image)` function that returns object labels, boxes and scores.
- `backend/`: Person B (Anish). The analysis web service: video to frames, people blurring, calling `detect`, SAM 2 outlines, contrast checks that turn objects into hazard codes, merging repeats, severity, "after" pictures, any database.
- `app/`, `docs/`, `README.md`: Person B (Anish). Upload page, gallery, filters, before/after view, printable report, all caregiver-facing text, hosting.
- `app/src/components/room-tour/`: Abhi, handed over Oct 10 2026. The moving room at the top of the home page. Anish doesn't edit it until Abhi's work is merged back; see its README.
- `shared/`: changes only when both agree. Add fields; never rename or remove. See `shared/README.md`.

Never edit files outside the current person's folders without asking.

## Rules

- The brain returns hazard `type` codes only; wording lives in the app, keyed by `type`.
- Wording says "may be a problem", not "is dangerous", and links the guide.
- The app finds the brain through one setting (its base URL); until then it reads `shared/contract.json`.
- Hold out every photo from one room in one home as the test set; never train on it. Synthetic images stay out of it too.
- Never commit videos, photos of real homes, or weights (see `.gitignore`).
- All commits must fall inside the hacking window. README must credit every open-source model, dataset, library and AI tool.

## Cut order if behind (cut from the bottom)

1. Fine-tuned detector with baseline vs. trained results (never cut)
2. Upload → gallery with reasons and fixes
3. Contrast checks
4. Printable report
5. "After" pictures
6. Video input
7. Dim-lighting check
