import { describe, expect, it } from "vitest";
import { range } from "./SeeItTheirWay";

describe("scroll story keyframes", () => {
  const cases: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3], [0, 1], [2, 3]];
  it.each(cases)("steps %i..%i stay inside 0..1 and strictly increase", (first, last) => {
    const { input, output } = range(first, last, 4);
    expect(input.length).toBe(output.length);
    for (const v of input) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < input.length; i++) expect(input[i]).toBeGreaterThan(input[i - 1]);
    expect(input[0]).toBe(0);
    expect(input[input.length - 1]).toBe(1);
  });

  it("hides a middle step at both ends of the scroll", () => {
    const { output } = range(1, 1, 4);
    expect(output[0]).toBe(0);
    expect(output[output.length - 1]).toBe(0);
  });

  it("keeps the first photo shown at the very top and the last at the very bottom", () => {
    expect(range(0, 1, 4).output).toEqual([1, 1, 0, 0]);
    expect(range(2, 3, 4).output).toEqual([0, 0, 1, 1]);
  });
});
