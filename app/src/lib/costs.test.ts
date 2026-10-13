import { describe, expect, it } from "vitest";
import type { HazardType } from "./contract";
import { duration, FIX_PLANS, HANDYMAN_RATE, labor, materials, money, planFor, planTotals, shopLinks } from "./costs";

const ALL: HazardType[] = [
  "dark_rug", "loose_rug", "shiny_floor", "patterned_floor", "bathroom_fitting_blends_in",
  "furniture_blends_in", "mirror", "stair_edge_hard_to_see", "floor_clutter", "toilet_lookalike",
];

describe("fix plans", () => {
  it("cover every hazard type with sane numbers", () => {
    for (const type of ALL) {
      const plan = FIX_PLANS[type];
      expect(plan.fix.length).toBeGreaterThan(5);
      for (const item of plan.items) {
        expect(item.low).toBeGreaterThan(0);
        expect(item.high).toBeGreaterThanOrEqual(item.low);
        expect(item.shop).toBeTruthy();
      }
      expect(plan.diyMinutes[1]).toBeGreaterThanOrEqual(plan.diyMinutes[0]);
    }
  });

  it("price a dark rug as rug plus grippers", () => {
    expect(materials(FIX_PLANS.dark_rug)).toEqual([45, 59]);
    expect(labor(FIX_PLANS.dark_rug)).toEqual([0, 0]);
  });

  it("charge handyman hours at the low and high rate", () => {
    expect(labor(FIX_PLANS.stair_edge_hard_to_see)).toEqual([1 * HANDYMAN_RATE[0], 2 * HANDYMAN_RATE[1]]);
  });
});

describe("plan totals", () => {
  it("add up materials, labor and free steps across hazards", () => {
    const t = planTotals(["dark_rug", "bathroom_fitting_blends_in", "mirror"]);
    expect(t.diy).toEqual([45 + 18, 59 + 21]);
    expect(t.hired).toEqual([45 + 18 + 30 + 30, 59 + 21 + 90 + 90]);
    expect(t.freeSteps).toBe(3);
    expect(t.minutes).toEqual([10 + 15 + 10, 20 + 30 + 20]);
  });

  it("count a repeated hazard twice", () => {
    expect(planTotals(["furniture_blends_in", "furniture_blends_in"]).diy).toEqual([8, 20]);
  });

  it("is zero for nothing", () => {
    expect(planTotals([])).toEqual({ diy: [0, 0], hired: [0, 0], minutes: [0, 0], freeSteps: 0 });
  });
});

describe("formatting", () => {
  it("shows money ranges and free items", () => {
    expect(money([45, 59])).toBe("$45–$59");
    expect(money([20, 20])).toBe("$20");
    expect(money([0, 0])).toBe("$0");
    expect(money([1200, 1500])).toBe("$1,200–$1,500");
  });

  it("shows minutes and hours", () => {
    expect(duration([10, 20])).toBe("10–20 min");
    expect(duration([45, 90])).toBe("45 min–1.5 hr");
    expect(duration([60, 150])).toBe("1–2.5 hr");
  });

  it("builds cheapest-first shop links", () => {
    const [walmart, amazon] = shopLinks("rug grippers");
    expect(walmart.url).toBe("https://www.walmart.com/search?q=rug%20grippers&sort=price_low");
    expect(amazon.url).toBe("https://www.amazon.com/s?k=rug%20grippers&s=price-asc-rank");
  });
});

describe("planFor", () => {
  it("gives a cable a cord plan, with nothing about shoes", () => {
    const p = planFor({ type: "floor_clutter", object: "cable" });
    expect(p.fix).toMatch(/cord cover/i);
    expect(JSON.stringify(p)).not.toMatch(/shoe/i);
  });
  it("gives other floor clutter a put-it-away plan, with nothing about shoes", () => {
    const p = planFor({ type: "floor_clutter", object: "floor_clutter" });
    expect(p.fix).toMatch(/basket or bin/i);
    expect(JSON.stringify(p)).not.toMatch(/shoe/i);
  });
  it("keeps the example room's plan when nothing says what was seen", () => {
    expect(planFor({ type: "floor_clutter" })).toBe(FIX_PLANS.floor_clutter);
  });
  it("leaves other hazards alone", () => {
    expect(planFor({ type: "dark_rug", object: "rug" })).toBe(FIX_PLANS.dark_rug);
  });
  it("totals use what was seen", () => {
    const [cable] = planTotals([{ type: "floor_clutter", object: "cable" }]).diy;
    expect(cable).toBe(20);
  });
});

describe("planFor with a room", () => {
  it("gives a towel outside the bathroom a towel fix, not a toilet seat", () => {
    const p = planFor({ type: "bathroom_fitting_blends_in", object: "towel", room: "kitchen" });
    expect(p.fix).toMatch(/towel/i);
    expect(JSON.stringify(p)).not.toMatch(/toilet/i);
  });
  it("keeps the toilet seat fix in the bathroom", () => {
    expect(planFor({ type: "bathroom_fitting_blends_in", object: "toilet", room: "bathroom" })).toBe(FIX_PLANS.bathroom_fitting_blends_in);
  });
});

describe("detailed fixes", () => {
  const plans = [
    ...Object.values(FIX_PLANS),
    ...["cable", "floor_clutter"].map((object) => planFor({ type: "floor_clutter", object })),
    ...["towel", "toilet_roll_holder"].map((object) => planFor({ type: "bathroom_fitting_blends_in", object, room: "bathroom" })),
    planFor({ type: "bathroom_fitting_blends_in", object: "towel", room: "kitchen" }),
  ];
  it("give every fix steps and at least one alternative with a sane price", () => {
    for (const plan of plans) {
      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
      expect(plan.alternatives.length).toBeGreaterThanOrEqual(1);
      for (const alt of plan.alternatives) {
        expect(alt.high).toBeGreaterThanOrEqual(alt.low);
        if (alt.high > 0) expect(alt.shop).toBeTruthy();
      }
    }
  });
  it("gives a bathroom towel a towel fix and a roll holder a holder fix", () => {
    expect(planFor({ type: "bathroom_fitting_blends_in", object: "towel", room: "bathroom" }).fix).toMatch(/towels/i);
    expect(planFor({ type: "bathroom_fitting_blends_in", object: "toilet_roll_holder", room: "bathroom" }).fix).toMatch(/holder/i);
  });
});
