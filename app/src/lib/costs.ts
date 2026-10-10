import type { HazardType } from "./contract";

// What each fix costs, in US dollars. Material prices are ranges from US
// retail listings (mostly Walmart) checked in October 2026; labor uses a
// typical independent handyman rate. Shop links search the retailer sorted by
// lowest price, so the caregiver always sees today's cheapest option.

export const CHECKED = "October 2026";

/** Typical independent handyman rate, US, dollars per hour. */
export const HANDYMAN_RATE: [number, number] = [60, 90];

export interface CostItem {
  name: string;
  low: number;
  high: number;
  /** Search words for the shop links. */
  shop?: string;
}

export interface FixPlan {
  /** A no-cost first step, when there is one. */
  free?: string;
  /** The low-cost fix this plan prices out. */
  fix: string;
  items: CostItem[];
  /** Doing it yourself, in minutes. */
  diyMinutes: [number, number];
  /** Hours if you'd rather hire a handyman; absent when it's a two-minute job. */
  handymanHours?: [number, number];
  /** Things that can add cost or are worth knowing. */
  other: string[];
}

const SHIPPING = "Shipping is usually free on Walmart orders over $35; smaller orders may add a few dollars.";

export const FIX_PLANS: Record<HazardType, FixPlan> = {
  dark_rug: {
    free: "Take the rug away.",
    fix: "Swap it for a plain, lighter rug held down with grippers",
    items: [
      { name: "Plain light 5×7 ft rug", low: 39, high: 47, shop: "5x7 area rug beige plain" },
      { name: "Rug grippers", low: 6, high: 12, shop: "rug grippers" },
    ],
    diyMinutes: [10, 20],
    other: [SHIPPING],
  },
  loose_rug: {
    free: "Take the rug away.",
    fix: "Hold it flat with rug grippers (in a bathroom, use a non-slip bath mat instead)",
    items: [{ name: "Rug grippers or a non-slip bath mat", low: 6, high: 15, shop: "rug grippers non slip" }],
    diyMinutes: [5, 10],
    other: [SHIPPING],
  },
  shiny_floor: {
    free: "Close blinds when the sun hits the floor.",
    fix: "Hang a sheer curtain to soften glare",
    items: [{ name: "Sheer curtain panel (per window)", low: 8, high: 16, shop: "sheer curtain panel" }],
    diyMinutes: [10, 20],
    handymanHours: [0.5, 1],
    other: ["If there's no curtain rod, add a tension rod or have one fitted.", "Replacing the floor with a matt one is a bigger job: get local quotes."],
  },
  patterned_floor: {
    fix: "Cover the busiest part with a plain, light rug held down with grippers",
    items: [
      { name: "Plain light 5×7 ft rug", low: 39, high: 47, shop: "5x7 area rug beige plain" },
      { name: "Rug grippers", low: 6, high: 12, shop: "rug grippers" },
    ],
    diyMinutes: [10, 20],
    other: ["Replacing patterned flooring with plain flooring is a bigger job: get local quotes.", SHIPPING],
  },
  bathroom_fitting_blends_in: {
    free: "Use the brightest towels you already have.",
    fix: "Fit a colored toilet seat",
    items: [{ name: "Colored toilet seat", low: 18, high: 21, shop: "colored toilet seat" }],
    diyMinutes: [15, 30],
    handymanHours: [0.5, 1],
    other: ["Check whether the toilet is round or elongated before buying.", SHIPPING],
  },
  furniture_blends_in: {
    fix: "Drape a throw in a contrasting color",
    items: [{ name: "Contrasting throw", low: 4, high: 10, shop: "throw blanket" }],
    diyMinutes: [2, 5],
    other: [SHIPPING],
  },
  mirror: {
    free: "If it causes distress, cover it with a towel or cloth.",
    fix: "Take it down",
    items: [],
    diyMinutes: [10, 20],
    handymanHours: [0.5, 1],
    other: ["Heavy or wall-fixed mirrors are a two-person job; a handyman may patch and paint the wall too."],
  },
  stair_edge_hard_to_see: {
    fix: "Mark every step edge with high-visibility anti-slip tape",
    items: [{ name: "Anti-slip stair tape, 3 rolls (about 13 steps)", low: 28, high: 45, shop: "anti slip stair tape yellow" }],
    diyMinutes: [45, 75],
    handymanHours: [1, 2],
    other: ["Tape wears and may need replacing; screw-on contrasting nosing lasts longer but costs more."],
  },
  floor_clutter: {
    free: "Clear walkways and keep shoes off the floor.",
    fix: "Run cables along the wall in a cord cover, and give shoes a rack",
    items: [
      { name: "Cord cover kit, 10–16 ft", low: 20, high: 23, shop: "cord cover raceway kit" },
      { name: "Shoe rack", low: 6, high: 24, shop: "shoe rack" },
    ],
    diyMinutes: [20, 40],
    other: [SHIPPING],
  },
  toilet_lookalike: {
    free: "Move it out of the bathroom.",
    fix: "Move it out of the bathroom",
    items: [],
    diyMinutes: [1, 2],
    other: [],
  },
};

export type Range = [number, number];

export function materials(plan: FixPlan): Range {
  return plan.items.reduce<Range>(([lo, hi], i) => [lo + i.low, hi + i.high], [0, 0]);
}

export function labor(plan: FixPlan): Range {
  const [lo, hi] = plan.handymanHours ?? [0, 0];
  return [lo * HANDYMAN_RATE[0], hi * HANDYMAN_RATE[1]];
}

/** Totals for a set of hazards: doing everything yourself, or hiring help where it makes sense. */
export function planTotals(types: HazardType[]) {
  let diy: Range = [0, 0];
  let hired: Range = [0, 0];
  let minutes: Range = [0, 0];
  let freeSteps = 0;
  for (const type of types) {
    const plan = FIX_PLANS[type];
    const [mLo, mHi] = materials(plan);
    const [lLo, lHi] = labor(plan);
    diy = [diy[0] + mLo, diy[1] + mHi];
    hired = [hired[0] + mLo + lLo, hired[1] + mHi + lHi];
    minutes = [minutes[0] + plan.diyMinutes[0], minutes[1] + plan.diyMinutes[1]];
    if (plan.free) freeSteps++;
  }
  return { diy, hired, minutes, freeSteps };
}

export function money([lo, hi]: Range): string {
  const f = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  if (hi === 0) return "$0";
  return lo === hi ? f(lo) : `${f(lo)}–${f(hi)}`;
}

export function duration([lo, hi]: Range): string {
  const f = (m: number) => (m < 60 ? `${m} min` : `${+(m / 60).toFixed(1)} hr`);
  if (lo === hi) return f(lo);
  if (hi < 60) return `${lo}–${hi} min`;
  if (lo >= 60) return `${+(lo / 60).toFixed(1)}–${+(hi / 60).toFixed(1)} hr`;
  return `${f(lo)}–${f(hi)}`;
}

export function shopLinks(query: string) {
  const q = encodeURIComponent(query);
  return [
    { store: "Walmart", url: `https://www.walmart.com/search?q=${q}&sort=price_low` },
    { store: "Amazon", url: `https://www.amazon.com/s?k=${q}&s=price-asc-rank` },
  ];
}

export const SOURCES = [
  { label: "Handyman rates: Jobber handyman pricing guide", url: "https://getjobber.com/resources/salary-guides/handyman/" },
  { label: "Handyman rates: Housecall Pro, how to price handyman jobs", url: "https://www.housecallpro.com/resources/how-to-price-handyman-jobs/" },
  { label: "Materials: Walmart and Home Depot listings checked October 2026", url: "https://www.walmart.com" },
];
