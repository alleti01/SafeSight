import type { HazardType, Severity } from "./contract";

// Everything the caregiver reads about a hazard lives here, keyed by the type
// code the brain sends. Based on the Alzheimer's Society guide.

export const GUIDE_URL =
  "https://www.alzheimers.org.uk/sites/default/files/migrate/downloads/making_your_home_dementia_friendly.pdf";

export interface HazardText {
  name: string;
  why: string;
  fix: string;
}

export const HAZARD_TEXT: Record<HazardType, HazardText> = {
  dark_rug: {
    name: "Dark rug or mat",
    why: "A dark patch on the floor can look like a hole or a step. Someone may stop suddenly or try to step over it.",
    fix: "Swap it for a plain, lighter rug, or take it away.",
  },
  loose_rug: {
    name: "Loose rug",
    why: "Rugs that slide or have curled edges are easy to trip on.",
    fix: "Remove it. In the bath or shower, use a non-slip mat only.",
  },
  shiny_floor: {
    name: "Shiny floor",
    why: "Glare on a glossy floor can look wet or slippery, so someone may avoid it or walk unsteadily.",
    fix: "Choose matt, plain flooring, and close blinds to cut down glare.",
  },
  patterned_floor: {
    name: "Patterned floor",
    why: "Stripes and busy patterns can look like steps, holes or objects, making the floor seem uneven.",
    fix: "Choose plain floor coverings.",
  },
  bathroom_fitting_blends_in: {
    name: "Toilet or fitting that blends in",
    why: "When the toilet seat, roll holder or towels are the same color as the wall or floor, they can be hard to find.",
    fix: "Add contrast, such as a colored toilet seat or bright towels.",
  },
  furniture_blends_in: {
    name: "Furniture that blends in",
    why: "Furniture the same color as the wall or floor is harder to see, so it's easier to bump into or miss when sitting down.",
    fix: "Add a contrasting throw, cover or cushion.",
  },
  mirror: {
    name: "Mirror",
    why: "Someone may not recognize their own reflection and think a stranger is in the home.",
    fix: "If it causes distress, cover it with a cloth or take it down.",
  },
  stair_edge_hard_to_see: {
    name: "Stair edge hard to see",
    why: "If the edge of each step doesn't stand out, it's easy to misjudge and miss a step.",
    fix: "Mark each edge with bright tape or contrasting edge strips.",
  },
  floor_clutter: {
    name: "Clutter on the floor",
    why: "Cables and things left on the floor are easy to trip on and can be distracting.",
    fix: "Clear walkways and run cables along the walls.",
  },
  toilet_lookalike: {
    name: "Could be mistaken for a toilet",
    why: "A bin, basket or storage box in the bathroom may be mistaken for the toilet.",
    fix: "Move it out of the bathroom.",
  },
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  high: "Look at this first",
  medium: "Worth fixing",
  low: "Keep an eye on",
};
