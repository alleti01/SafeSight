import type { Hazard, HazardType } from "./contract";

// What contrast.measure found for a hazard on a site photo
// (backend/tools/measure_site_images.py). L* is lightness, 0 black to 100
// white; delta E is how different two colors look.
export interface Measure {
  lightness: number;
  around_lightness: number;
  delta_e: number;
}

/** Lightness along a line through the object (measure_site_images.py). */
export type MeasuredHazard = Hazard & { measure?: Measure; profile?: number[]; colors?: { inside: string; around: string } };

// Thresholds from backend/contrast.py, so the words match the decision.
const DARK_RUG_GAP = 20;
const BLENDS_IN_BADLY = 9;

export interface PlainContrast {
  object: string;
  objectColor: string;
  background: string;
  backgroundColor: string;
  sentence: string;
}

/**
 * What the contrast check found, in words anyone can follow: the object's
 * color next to the color around it, and what that may mean. Only for
 * hazards decided by contrast; mirrors, clutter and look-alikes count because
 * of what they are.
 */
export function plainContrast(h: MeasuredHazard): PlainContrast | null {
  const m = h.measure;
  const c = h.colors;
  if (!m || !c) return null;
  const pair = (object: string, background: string, sentence: string): PlainContrast => ({
    object,
    objectColor: c.inside,
    background,
    backgroundColor: c.around,
    sentence,
  });
  const almost = m.delta_e < BLENDS_IN_BADLY;
  switch (h.type) {
    case "dark_rug":
      return pair("The rug", "The floor", "Much darker than the floor around it. It may look like a hole or a step.");
    case "loose_rug":
      return m.around_lightness - m.lightness >= DARK_RUG_GAP
        ? pair("The rug", "The floor", "Darker than the floor, and it can slide or catch a foot.")
        : pair("The rug", "The floor", "Close to the floor's color, so it won't look like a hole, but it can slide or catch a foot.");
    case "bathroom_fitting_blends_in":
      return pair(
        "The fitting",
        "Around it",
        `${almost ? "Almost the same color" : "Close in color"} to the wall and floor around it. It may be hard to find.`,
      );
    case "furniture_blends_in":
      return pair(
        "The furniture",
        "Around it",
        `${almost ? "Almost the same color" : "Close in color"} to the wall and floor behind it. It may be easy to miss or bump into.`,
      );
    default:
      return null;
  }
}

// Only hazards the contrast check decides get a number: things that blend in
// by color difference, rugs by lightness. Mirrors, clutter and look-alikes
// count because of what they are, so a measurement would mislead.
const BY_COLOR: HazardType[] = ["bathroom_fitting_blends_in", "furniture_blends_in"];
const BY_LIGHTNESS: HazardType[] = ["dark_rug", "loose_rug"];

export function measureText(hazard: MeasuredHazard): string {
  const m = hazard.measure;
  if (!m) return "";
  if (BY_COLOR.includes(hazard.type)) return `ΔE ${m.delta_e}`;
  if (BY_LIGHTNESS.includes(hazard.type)) return `L* ${m.lightness} vs ${m.around_lightness}`;
  return "";
}

const area = ([x0, y0, x1, y1]: Hazard["box"]) => (x1 - x0) * (y1 - y0);

/** The biggest hazard: the one a photo is most clearly about. */
export function biggest<T extends Hazard>(hazards: T[]): T | undefined {
  return hazards.reduce<T | undefined>((best, h) => (!best || area(h.box) > area(best.box) ? h : best), undefined);
}

/** Center of a hazard's box, as percentages of the photo. */
export function boxCenter(box: Hazard["box"], width: number, height: number) {
  const [x0, y0, x1, y1] = box;
  return { x: ((x0 + x1) / 2 / width) * 100, y: ((y0 + y1) / 2 / height) * 100 };
}

// What each hazard's object is, for "how sure we are that this is ___".
const OBJECT: Record<HazardType, string> = {
  dark_rug: "a rug",
  loose_rug: "a rug",
  shiny_floor: "a shiny floor",
  patterned_floor: "a patterned floor",
  bathroom_fitting_blends_in: "a bathroom fitting",
  furniture_blends_in: "furniture",
  mirror: "a mirror",
  stair_edge_hard_to_see: "a step",
  floor_clutter: "clutter on the floor",
  toilet_lookalike: "something that looks like a toilet",
  glass_door: "a glass door",
  door_blends_in: "a door",
  window_reflection: "a window",
  floor_transition: "a change in the floor",
  floor_wall_blend: "where the floor meets the wall",
  patterned_wall: "a patterned wall",
};

/** "a rug", "a mirror", "furniture": what the detector says the object is. */
export const objectName = (type: HazardType) => OBJECT[type] ?? "this";

export interface Confidence {
  level: "High" | "Medium" | "Low";
  /** The detector's score as a whole percent. */
  percent: number;
  /** What the score means, for the info tip. */
  meaning: string;
  /** What raised or lowered it. */
  checks: { ok: boolean; text: string }[];
}

/**
 * How sure the detector was about a hazard, and what affected it: whether the
 * whole object is in the photo, how much of the photo it takes up, and how
 * clear its shape is.
 */
export function confidenceNote(h: Hazard, width: number, height: number): Confidence {
  const level = h.confidence >= 0.7 ? "High" : h.confidence >= 0.45 ? "Medium" : "Low";
  const [l, t, r, b] = h.box;
  const near = 0.01;
  const edges = [
    t <= height * near && "top",
    b >= height * (1 - near) && "bottom",
    l <= width * near && "left",
    r >= width * (1 - near) && "right",
  ].filter(Boolean) as string[];
  const area = ((r - l) * (b - t)) / (width * height);
  return {
    level,
    percent: Math.round(h.confidence * 100),
    meaning: `How sure our detector is that this is ${OBJECT[h.type]}. It's only about what the object is, not whether it's a problem.`,
    checks: [
      edges.length ? { ok: false, text: `Cut off at the ${edges.join(" and ")} edge` } : { ok: true, text: "Fully in view" },
      area < 0.02 ? { ok: false, text: "Small in the photo" } : { ok: true, text: "Big enough to see clearly" },
      h.confidence >= 0.7 ? { ok: true, text: "Clear shape" } : { ok: false, text: "Shape less clear" },
    ],
  };
}

/**
 * For hazards decided by color, what the measurement found, in a few words
 * ("almost the same color"). Unlike the detector's score this is measured from
 * the photo, not a guess. Null for hazards that count because of what they are.
 */
export function colorCheck(h: MeasuredHazard): string | null {
  const m = h.measure;
  if (!m) return null;
  switch (h.type) {
    case "dark_rug":
      return "much darker than the floor";
    case "furniture_blends_in":
    case "bathroom_fitting_blends_in":
      return m.delta_e < BLENDS_IN_BADLY ? "almost the same color" : "close in color";
    case "stair_edge_hard_to_see":
      return "step edges hard to see";
    default:
      return null;
  }
}
