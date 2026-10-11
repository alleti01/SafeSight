import { describe, expect, it } from "vitest";
import { biggest, boxCenter, colorCheck, confidenceNote, measureText, plainContrast, type MeasuredHazard } from "./measure";
import siteImages from "./site-images.json";

const hazard = (over: Partial<MeasuredHazard>): MeasuredHazard => ({
  hazard_id: "h1",
  type: "dark_rug",
  severity: "high",
  confidence: 0.6,
  frame_id: "f1",
  box: [0, 0, 10, 10],
  outline_url: "",
  ...over,
});

describe("measureText", () => {
  it("shows lightness for rugs", () => {
    const m = { lightness: 14, around_lightness: 79, delta_e: 71 };
    expect(measureText(hazard({ type: "dark_rug", measure: m }))).toBe("L* 14 vs 79");
    expect(measureText(hazard({ type: "loose_rug", measure: m }))).toBe("L* 14 vs 79");
  });

  it("shows nothing for hazards that count because of what they are", () => {
    const m = { lightness: 55, around_lightness: 48, delta_e: 7 };
    expect(measureText(hazard({ type: "mirror", measure: m }))).toBe("");
    expect(measureText(hazard({ type: "floor_clutter", measure: m }))).toBe("");
    expect(measureText(hazard({ type: "toilet_lookalike", measure: m }))).toBe("");
  });

  it("shows color difference for things that blend in", () => {
    const m = { lightness: 78, around_lightness: 78, delta_e: 1 };
    expect(measureText(hazard({ type: "bathroom_fitting_blends_in", measure: m }))).toBe("ΔE 1");
    expect(measureText(hazard({ type: "furniture_blends_in", measure: m }))).toBe("ΔE 1");
  });

  it("is empty without a measurement", () => {
    expect(measureText(hazard({}))).toBe("");
  });
});

describe("biggest", () => {
  it("picks the hazard with the largest box", () => {
    const small = hazard({ hazard_id: "a", box: [643, 408, 778, 450] });
    const large = hazard({ hazard_id: "b", box: [579, 476, 889, 720] });
    expect(biggest([small, large])?.hazard_id).toBe("b");
    expect(biggest([])).toBeUndefined();
  });
});

describe("boxCenter", () => {
  it("returns percentages of the photo", () => {
    expect(boxCenter([0, 0, 640, 360], 1280, 720)).toEqual({ x: 25, y: 25 });
  });
});

describe("site photos", () => {
  it("carry the measurements the homepage shows", () => {
    const site = siteImages as unknown as Record<string, { hazards?: MeasuredHazard[] }>;
    const rug = site["bath-rug"].hazards!.find((h) => h.type === "dark_rug")!;
    expect(measureText(rug)).toBe("L* 9 vs 44");
    const runner = biggest(site["dark-rug"].hazards!.filter((h) => h.type === "dark_rug"))!;
    expect(measureText(runner)).toBe("L* 48 vs 77");
    const toilet = site["bath-white"].hazards!.find((h) => h.type === "bathroom_fitting_blends_in")!;
    expect(measureText(toilet)).toBe("ΔE 12");
  });
});

describe("plainContrast", () => {
  const colors = { inside: "#111111", around: "#777777" };

  it("says a dark rug may look like a hole", () => {
    const p = plainContrast(hazard({ type: "dark_rug", colors, measure: { lightness: 9, around_lightness: 44, delta_e: 37 } }));
    expect(p?.sentence).toMatch(/look like a hole/);
    expect(p?.objectColor).toBe("#111111");
    expect(p?.backgroundColor).toBe("#777777");
  });

  it("says a rug close to the floor won't look like a hole", () => {
    const p = plainContrast(hazard({ type: "loose_rug", colors, measure: { lightness: 59, around_lightness: 73, delta_e: 17 } }));
    expect(p?.sentence).toMatch(/won't look like a hole/);
  });

  it("tells almost the same from merely close", () => {
    const almost = plainContrast(hazard({ type: "bathroom_fitting_blends_in", colors, measure: { lightness: 78, around_lightness: 78, delta_e: 1 } }));
    const close = plainContrast(hazard({ type: "bathroom_fitting_blends_in", colors, measure: { lightness: 78, around_lightness: 70, delta_e: 12 } }));
    expect(almost?.sentence).toMatch(/^Almost the same/);
    expect(close?.sentence).toMatch(/^Close in color/);
  });

  it("has nothing to say for hazards that count because of what they are", () => {
    expect(plainContrast(hazard({ type: "mirror", colors, measure: { lightness: 1, around_lightness: 2, delta_e: 3 } }))).toBeNull();
    expect(plainContrast(hazard({ type: "dark_rug" }))).toBeNull();
  });
});

describe("confidenceNote", () => {
  const h = (confidence: number, box: [number, number, number, number]) =>
    ({ type: "loose_rug", severity: "low", confidence, frame_id: "f", box, hazard_id: "h" }) as MeasuredHazard;

  it("rates by the detector's score", () => {
    expect(confidenceNote(h(0.8, [100, 100, 400, 300]), 1000, 600).level).toBe("High");
    expect(confidenceNote(h(0.5, [100, 100, 400, 300]), 1000, 600).level).toBe("Medium");
    expect(confidenceNote(h(0.3, [100, 100, 400, 300]), 1000, 600).level).toBe("Low");
  });

  it("lists what affected it", () => {
    expect(confidenceNote(h(0.8, [100, 100, 400, 300]), 1000, 600).checks).toEqual([
      { ok: true, text: "Fully in view" },
      { ok: true, text: "Big enough to see clearly" },
      { ok: true, text: "Clear shape" },
    ]);
    const cut = confidenceNote(h(0.5, [600, 300, 1000, 600]), 1000, 600);
    expect(cut.checks[0]).toEqual({ ok: false, text: "Cut off at the bottom and right edge" });
    expect(cut.percent).toBe(50);
    expect(confidenceNote(h(0.3, [100, 100, 150, 150]), 1000, 600).checks[1]).toEqual({ ok: false, text: "Small in the photo" });
  });
});

describe("colorCheck", () => {
  const h = (type: string, delta_e: number) =>
    ({ type, severity: "medium", confidence: 0.7, frame_id: "f", box: [0, 0, 1, 1], hazard_id: "h", measure: { lightness: 40, around_lightness: 42, delta_e } }) as MeasuredHazard;

  it("answers the color question for hazards decided by color", () => {
    expect(colorCheck(h("furniture_blends_in", 2))).toBe("almost the same color");
    expect(colorCheck(h("bathroom_fitting_blends_in", 12))).toBe("close in color");
    expect(colorCheck(h("dark_rug", 30))).toBe("much darker than the floor");
  });

  it("skips hazards that count because of what they are", () => {
    expect(colorCheck(h("mirror", 15))).toBeNull();
    expect(colorCheck(h("loose_rug", 15))).toBeNull();
  });
});
