import { describe, expect, it } from "vitest";
import { biggest, boxCenter, measureText, plainContrast, type MeasuredHazard } from "./measure";
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
