# Room tour (owned by Abhi)

`RoomTour.tsx` is the moving room at the very top of the home page (`/`) and of `/v5`. The room fades to grey, the camera pans left to right, and each thing that may be a problem pops back into color with a label. Clicking a label or chip opens a card explaining it; "Replay" plays it again.

**This folder is Abhi's while he works on it.** Anish won't edit it until it's merged back. Everything outside this folder stays as it is. If you need something changed elsewhere (a hazard's wording, a price, the photo data), ask Anish rather than editing it.

## How it's used

```tsx
import RoomTour from "@/components/room-tour/RoomTour";

<RoomTour photo={SITE["room-wide"]} />
```

The parent decides the size: the component fills its container (`h-full w-full`). On `/v5` that container is the full screen.

Anything passed as children is drawn over the room and hidden while a card is open (the home page uses this for its title; `/v5` passes nothing).

## The data it reads

`photo` is one entry from `app/src/lib/site-images.json`, here `"room-wide"`:

- `src`, `width`, `height`: the room photo (`app/public/site/room-wide.jpg`, AI-generated).
- `hazards`: what the pipeline found and we checked. Each has a `type`, `severity`, `box` (`[left, top, right, bottom]` in photo pixels), `outline_url` (a PNG mask: white where the object is), and `colors` (the object's color and the color around it).

Those come from `backend/tools/annotate_site_images.py` and `backend/tools/measure_site_images.py`.

## Things it borrows (please don't change these from here)

- `HAZARD_TEXT` (`lib/hazards.ts`): each hazard's name, why it matters and the fix.
- `FIX_PLANS`, `materials`, `money` (`lib/costs.ts`): the free step and the cheapest fix's price.
- `plainContrast` (`lib/measure.ts`) and `ContrastSwatches`: the "rug color vs. floor color" line on the card.
- `SeverityPill` (`components/HazardCard.tsx`).

## Pace

The timings are constants at the top of `RoomTour.tsx`: `START_AFTER`, `PAN` and `HOLD` (seconds). With "reduce motion" turned on, every hazard shows at once with no movement.

## Running it

```bash
cd app
npm install
npm run dev
```

Then open http://localhost:3000/v5 (full screen) or http://localhost:3000 (on the home page).
