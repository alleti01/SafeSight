import { describe, expect, it } from "vitest";
import { findingText, HAZARD_TEXT } from "./hazards";

describe("findingText", () => {
  it("calls a towel outside the bathroom a towel", () => {
    const t = findingText({ type: "bathroom_fitting_blends_in", object: "towel", room: "kitchen" });
    expect(t.name).toBe("Towel that blends in");
    expect(`${t.why} ${t.fix}`).not.toMatch(/toilet/i);
  });
  it("keeps the usual words in the bathroom and for other types", () => {
    expect(findingText({ type: "bathroom_fitting_blends_in", room: "bathroom" })).toEqual(HAZARD_TEXT.bathroom_fitting_blends_in);
    expect(findingText({ type: "mirror", room: "kitchen" })).toEqual(HAZARD_TEXT.mirror);
  });
});

describe("findingText in the bathroom", () => {
  it("names the fitting the model saw", () => {
    expect(findingText({ type: "bathroom_fitting_blends_in", object: "towel", room: "bathroom" }).name).toBe("Towel that blends in");
    expect(findingText({ type: "bathroom_fitting_blends_in", object: "toilet", room: "bathroom" }).name).toBe("Toilet that blends in");
    expect(findingText({ type: "bathroom_fitting_blends_in", object: "toilet_roll_holder", room: "bathroom" }).name).toBe(
      "Toilet roll holder that blends in",
    );
  });
});
