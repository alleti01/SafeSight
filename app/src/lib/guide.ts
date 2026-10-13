import type { HazardType } from "./contract";

// What the dementia design guides say about each hazard, in our own short
// words, with the source to read more. Sources and the points drawn from them
// are listed in model/HAZARD_RESEARCH.md.

export interface Source {
  name: string;
  url: string;
}

export const SOURCES = {
  ASH: {
    name: "Alzheimer's Society, Making your home dementia friendly",
    url: "https://www.alzheimers.org.uk/sites/default/files/migrate/downloads/making_your_home_dementia_friendly.pdf",
  },
  ASP: {
    name: "Alzheimer's Society, Changes in perception",
    url: "https://alzheimers.org.uk/downloads/file/3369/sight_perception_and_hallucinations_in_dementia",
  },
  DSDC: {
    name: "University of Stirling DSDC, Improving the design of housing for people with dementia",
    url: "https://www.housinglin.org.uk/_assets/Resources/Housing/OtherOrganisation/DSDC_dementia_design.pdf",
  },
  LRV: {
    name: "University of Stirling DSDC, Light reflectance values",
    url: "https://dementia.stir.ac.uk/newsblog/dementia-design-toolkit-lrvs",
  },
  NHS: {
    name: "NHS, Making your home dementia friendly",
    url: "https://www.nhs.uk/conditions/dementia/living-with-dementia/home-environment/",
  },
  NIA: {
    name: "National Institute on Aging, Home safety tips",
    url: "https://www.nia.nih.gov/health/safety/alzheimers-caregiving-home-safety-tips",
  },
} satisfies Record<string, Source>;

export interface GuideNote {
  /** The guides' point, in a sentence or two. */
  says: string;
  source: Source;
}

export const GUIDE: Record<HazardType, GuideNote> = {
  dark_rug: {
    says: "Dark rugs and mats can look like holes in the floor. Take them away, or choose a mat close in tone to the floor.",
    source: SOURCES.ASH,
  },
  loose_rug: {
    says: "Rugs and mats are a common trip hazard. Remove them where you can, especially ones that slide or have curled edges.",
    source: SOURCES.ASH,
  },
  shiny_floor: {
    says: "Shiny, reflective floors can look wet or slippery. Matt finishes and blinds that cut glare make floors easier to read.",
    source: SOURCES.ASP,
  },
  patterned_floor: {
    says: "Busy patterns and stripes on the floor can look like steps, holes or objects. Plain floor coverings are easier to understand.",
    source: SOURCES.ASH,
  },
  bathroom_fitting_blends_in: {
    says: "White fittings against white walls are hard to pick out. A colored toilet seat, towels and grab rails that stand out from the wall help.",
    source: SOURCES.ASH,
  },
  furniture_blends_in: {
    says: "Furniture that contrasts with the floor and walls is easier to see and find. A bright throw or cover can be enough.",
    source: SOURCES.NHS,
  },
  mirror: {
    says: "Some people stop recognizing their own reflection and may think there's a stranger in the room. Cover or remove a mirror only if it causes distress.",
    source: SOURCES.ASH,
  },
  stair_edge_hard_to_see: {
    says: "Step edges that stand out from the rest of the stair make depth easier to judge. Contrasting edge strips or tape help.",
    source: SOURCES.NIA,
  },
  floor_clutter: {
    says: "Keep walkways clear and run cables along the walls, so there's less to trip over or be distracted by.",
    source: SOURCES.NIA,
  },
  toilet_lookalike: {
    says: "A bin, basket or storage box in the bathroom may be mistaken for the toilet. Move it somewhere else.",
    source: SOURCES.ASH,
  },
  glass_door: {
    says: "Clear glass can be hard to see. Stickers or a frosted band at eye level make glass doors and panels visible.",
    source: SOURCES.NIA,
  },
  door_blends_in: {
    says: "Doors that contrast with the walls around them are easier to find. A sign at eye level showing what's behind the door helps too.",
    source: SOURCES.DSDC,
  },
  window_reflection: {
    says: "After dark, an uncovered window reflects the room like a mirror, and the reflection may look like someone outside. Close curtains at dusk.",
    source: SOURCES.ASH,
  },
  floor_transition: {
    says: "Adjoining floors should be close in tone, about 10 points of light reflectance or less, so the change doesn't look like a step.",
    source: SOURCES.LRV,
  },
  floor_wall_blend: {
    says: "When floor and walls are a similar shade, it's hard to see where the floor ends. A contrasting skirting board marks the edge.",
    source: SOURCES.DSDC,
  },
  patterned_wall: {
    says: "Strongly patterned wallpaper can be confusing, and some people see shapes or creatures in it. Plain walls are calmer.",
    source: SOURCES.ASH,
  },
};

/** The guide note for any hazard type, including ones newer than this app. */
export function guideFor(type: string, room?: string): GuideNote {
  if (type === "bathroom_fitting_blends_in" && room && room !== "bathroom")
    return { says: "Things that stand out in color from the wall behind them are easier to see and find.", source: SOURCES.ASH };
  return (GUIDE as Record<string, GuideNote>)[type] ?? { says: "See the guide for ideas that may help.", source: SOURCES.ASH };
}

/** Light reflectance difference that the design guides flag as poor contrast. */
export const LRV_POOR = 20;
export const LRV_BAD = 10;
