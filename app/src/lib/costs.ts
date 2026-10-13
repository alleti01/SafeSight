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

/** A small drawing of what a fix uses (see components/FixIcon). */
export type FixIconName =
  | "rug" | "runner" | "no-rug" | "pad" | "tape" | "film" | "spray" | "tiles" | "lid" | "rail" | "sofa"
  | "cushion" | "move" | "blind" | "nosing" | "stairs" | "light" | "clip" | "basket" | "bin" | "handle"
  | "paint" | "timer" | "picture" | "cord" | "plug" | "hook" | "table" | "roll" | "curtain" | "seat"
  | "throw" | "mirror" | "decal" | "strip" | "baseboard" | "towel" | "sign";

/** Another way to fix the same thing, and when it's the better pick. */
export interface Alternative {
  icon: FixIconName;
  fix: string;
  when: string;
  /** What it costs in materials; 0 and 0 when it's free. */
  low: number;
  high: number;
  shop?: string;
}

export interface FixPlan {
  /** A no-cost first step, when there is one. */
  free?: string;
  /** The low-cost fix this plan prices out. */
  fix: string;
  icon: FixIconName;
  /** How to do that fix, one step at a time. */
  steps: string[];
  items: CostItem[];
  /** Doing it yourself, in minutes. */
  diyMinutes: [number, number];
  /** Hours if you'd rather hire a handyman; absent when it's a two-minute job. */
  handymanHours?: [number, number];
  /** Other ways to fix it, cheapest first. */
  alternatives: Alternative[];
  /** Things that can add cost or are worth knowing. */
  other: string[];
}

const SHIPPING =
  "Shipping is usually free on Walmart orders over $35; smaller orders may add a few dollars.";

const LIGHT_RUG: CostItem = { name: "Plain light 5×7 ft rug", low: 39, high: 47, shop: "5x7 area rug beige plain" };
const GRIPPERS: CostItem = { name: "Rug grippers", low: 6, high: 12, shop: "rug grippers" };
const PAINT_KIT: CostItem = { name: "Brush, roller and tape", low: 8, high: 15, shop: "paint brush roller kit" };

export const FIX_PLANS: Record<HazardType, FixPlan> = {
  dark_rug: {
    free: "Take the rug away.",
    fix: "Swap it for a plain, lighter rug held down with grippers",
    icon: "rug",
    steps: [
      "Measure the rug you have, so the new one covers the same spot.",
      "Pick a plain rug close to the color of the floor around it: no dark border, no pattern.",
      "Put a rug gripper under each corner and press the rug down firmly.",
      "Walk over the edges. If one still lifts, add another gripper there.",
    ],
    items: [LIGHT_RUG, GRIPPERS],
    diyMinutes: [10, 20],
    alternatives: [
      { icon: "no-rug", fix: "No rug at all", when: "Simplest and safest, if the floor is warm enough without one.", low: 0, high: 0 },
      { icon: "runner", fix: "A light runner instead of a full rug", when: "In a hallway or beside a bed, where only a strip of floor needs covering.", low: 18, high: 30, shop: "runner rug beige non slip" },
      { icon: "rug", fix: "A washable low-pile rug in a light, solid color", when: "Near a kitchen or bathroom, where it will need washing often.", low: 25, high: 45, shop: "washable low pile rug light solid" },
    ],
    other: [SHIPPING],
  },
  loose_rug: {
    free: "Take the rug away.",
    fix: "Hold it flat with rug grippers (in a bathroom, use a non-slip bath mat instead)",
    icon: "pad",
    steps: [
      "Sweep or wipe the floor under the rug so the grippers stick.",
      "Put a gripper under each corner, and one in the middle of each long edge if the rug is big.",
      "Flatten any curled edge: roll it the other way for a few hours, or put something heavy on it overnight.",
      "In a bathroom, swap the rug for a rubber-backed non-slip bath mat instead.",
    ],
    items: [{ name: "Rug grippers or a non-slip bath mat", low: 6, high: 15, shop: "rug grippers non slip" }],
    diyMinutes: [5, 10],
    alternatives: [
      { icon: "pad", fix: "A rug pad cut to size under the whole rug", when: "For a big rug that still creeps with grippers.", low: 12, high: 25, shop: "non slip rug pad" },
      { icon: "tape", fix: "Double-sided carpet tape along every edge", when: "For a rug that stays where it is and won't be washed.", low: 7, high: 12, shop: "double sided carpet tape" },
      { icon: "rug", fix: "Replace it with a rubber-backed rug", when: "If the rug is thin and worn, or the edges won't stay flat.", low: 20, high: 40, shop: "rubber backed rug non slip" },
    ],
    other: [SHIPPING],
  },
  shiny_floor: {
    free: "Close blinds when the sun hits the floor.",
    fix: "Hang a sheer curtain to soften glare",
    icon: "curtain",
    steps: [
      "Notice when the floor shines most, and which window the light comes from.",
      "Measure the window's width; get panels that add up to about twice that, so they hang gathered.",
      "Hang the sheer panels on the window's rod, or on a tension rod inside the frame.",
      "Look at the floor again at the same time of day. If it still shines, close the blinds then too.",
    ],
    items: [{ name: "Sheer curtain panel (per window)", low: 8, high: 16, shop: "sheer curtain panel" }],
    diyMinutes: [10, 20],
    handymanHours: [0.5, 1],
    alternatives: [
      { icon: "film", fix: "Frosted window film on the lower half of the glass", when: "If a curtain would be in the way, like over a sink or a radiator.", low: 10, high: 20, shop: "frosted window film" },
      { icon: "spray", fix: "Switch to a matt floor cleaner instead of polish", when: "If the floor is polished or waxed and is shinier than it needs to be.", low: 5, high: 10, shop: "no shine floor cleaner" },
      { icon: "rug", fix: "A plain, light rug over the shiniest patch", when: "In a sitting area where a rug can stay put.", low: 45, high: 59, shop: "5x7 area rug beige plain" },
    ],
    other: [
      "If there's no curtain rod, add a tension rod or have one fitted.",
      "Replacing the floor with a matt one is a bigger job: get local quotes.",
    ],
  },
  patterned_floor: {
    fix: "Cover the busiest part with a plain, light rug held down with grippers",
    icon: "rug",
    steps: [
      "Find the patch of floor that's walked on most, like the path from door to chair or bed.",
      "Pick a plain rug in a single light color that covers that path.",
      "Put a rug gripper under each corner and press it down firmly.",
      "Check that the rug's edge doesn't line up with a stripe in the floor, which can look like a step.",
    ],
    items: [LIGHT_RUG, GRIPPERS],
    diyMinutes: [10, 20],
    alternatives: [
      { icon: "runner", fix: "A plain runner along the main walking path", when: "In a hallway or a narrow room.", low: 18, high: 30, shop: "runner rug beige non slip" },
      { icon: "tiles", fix: "Plain peel-and-stick vinyl tiles over the pattern", when: "In a small bathroom or entry, if you own the home.", low: 30, high: 60, shop: "peel and stick vinyl floor tiles plain" },
    ],
    other: [
      "Replacing patterned flooring with plain flooring is a bigger job: get local quotes.",
      SHIPPING,
    ],
  },
  bathroom_fitting_blends_in: {
    free: "Keep the lid up and leave a light on at night, so the toilet is easier to recognize.",
    fix: "Fit a colored toilet seat",
    icon: "seat",
    steps: [
      "Check whether the toilet bowl is round or elongated (longer than it is wide) and buy the matching seat.",
      "Pick a strong color that stands out from the toilet and the wall, like dark blue, black or red.",
      "Unscrew the old seat: flip up the caps behind the lid and undo the two nuts under the bowl.",
      "Bolt on the new seat and tighten by hand so it doesn't wobble.",
    ],
    items: [{ name: "Colored toilet seat", low: 18, high: 21, shop: "colored toilet seat" }],
    diyMinutes: [15, 30],
    handymanHours: [0.5, 1],
    alternatives: [
      { icon: "lid", fix: "A colored toilet lid cover and matching mat", when: "If you can't change the seat, like in a rented home.", low: 8, high: 15, shop: "toilet lid cover colored" },
      { icon: "rail", fix: "A grab rail in a contrasting color next to the toilet", when: "If getting up and down is hard too: it marks the spot and helps them stand.", low: 20, high: 35, shop: "grab bar contrasting color" },
      { icon: "tape", fix: "Colored tape around the edge of the cistern lid", when: "A quick, cheap marker while you wait for a new seat.", low: 5, high: 8, shop: "colored duct tape" },
    ],
    other: ["Check whether the toilet is round or elongated before buying.", SHIPPING],
  },
  furniture_blends_in: {
    fix: "Drape a throw in a contrasting color",
    icon: "throw",
    steps: [
      "Hold the throw against the furniture: it should look clearly darker or lighter, not just a different color.",
      "Lay it over the seat and front edge, where someone sits down, so the edge of the seat is easy to see.",
      "Tuck it in at the back so it doesn't slide when someone sits.",
      "Add a cushion in the same color to mark the back of the seat.",
    ],
    items: [{ name: "Contrasting throw", low: 4, high: 10, shop: "throw blanket" }],
    diyMinutes: [2, 5],
    alternatives: [
      { icon: "sofa", fix: "A stretch slipcover in a contrasting color", when: "For a sofa or chair used every day, where a throw keeps slipping.", low: 25, high: 45, shop: "stretch sofa slipcover" },
      { icon: "cushion", fix: "Cushions in a strong color", when: "For a chair that only needs its seat marked.", low: 8, high: 16, shop: "throw pillow covers solid color" },
      { icon: "move", fix: "Move it against a wall of a different shade", when: "If there's a better spot in the room, at no cost.", low: 0, high: 0 },
    ],
    other: [SHIPPING],
  },
  mirror: {
    free: "If it causes distress, cover it with a towel or cloth.",
    fix: "Take it down",
    icon: "mirror",
    steps: [
      "Watch first: only change it if the reflection seems to upset or confuse them.",
      "Lift it off its hooks with two people if it's large or heavy.",
      "Store it face to the wall somewhere they don't go.",
      "Fill the hook holes, or hang a picture there so the wall doesn't look empty.",
    ],
    items: [],
    diyMinutes: [10, 20],
    handymanHours: [0.5, 1],
    alternatives: [
      { icon: "blind", fix: "A roller blind fitted above it", when: "For a bathroom mirror still needed for shaving or makeup: pull down when not in use.", low: 15, high: 25, shop: "small roller blind" },
      { icon: "film", fix: "Frosted window film over the glass", when: "For a mirrored wardrobe door that can't come off.", low: 10, high: 20, shop: "frosted window film" },
    ],
    other: ["Heavy or wall-fixed mirrors are a two-person job; a handyman may patch and paint the wall too."],
  },
  stair_edge_hard_to_see: {
    fix: "Mark every step edge with high-visibility anti-slip tape",
    icon: "tape",
    steps: [
      "Count the steps and measure their width, so you know how much tape you need.",
      "Clean each edge with soapy water and let it dry fully.",
      "Stick a strip along the front edge of every step, not only the top and bottom ones.",
      "Use one color that stands out from the stair covering, like yellow on dark wood or black on light carpet.",
      "Press it down hard, then keep off the stairs for an hour if the tape says so.",
    ],
    items: [{ name: "Anti-slip stair tape, 3 rolls (about 13 steps)", low: 28, high: 45, shop: "anti slip stair tape yellow" }],
    diyMinutes: [45, 75],
    handymanHours: [1, 2],
    alternatives: [
      { icon: "nosing", fix: "Screw-on stair nosing in a contrasting color", when: "For a lasting fix on wooden or tiled stairs.", low: 60, high: 120, shop: "stair nosing contrasting" },
      { icon: "stairs", fix: "Stair treads in a contrasting color", when: "On slippery wooden stairs, where grip matters as much as seeing the edge.", low: 30, high: 60, shop: "non slip stair treads" },
      { icon: "light", fix: "Motion-sensor stair lights", when: "If the stairs are used at night, alongside marked edges.", low: 20, high: 40, shop: "motion sensor stair lights" },
    ],
    other: ["Tape wears and may need replacing; screw-on contrasting nosing lasts longer but costs more."],
  },
  floor_clutter: {
    free: "Clear walkways and keep shoes off the floor.",
    fix: "Run cables along the wall in a cord cover, and give shoes a rack",
    icon: "cord",
    steps: [
      "Unplug any cable that crosses a walkway and reroute it along the wall.",
      "Stick the cord cover along the bottom of the wall and clip the cable inside.",
      "Put a shoe rack by the door where shoes usually come off.",
      "Walk the room's main path and pick up anything left on it.",
    ],
    items: [
      { name: "Cord cover kit, 10–16 ft", low: 20, high: 23, shop: "cord cover raceway kit" },
      { name: "Shoe rack", low: 6, high: 24, shop: "shoe rack" },
    ],
    diyMinutes: [20, 40],
    alternatives: [
      { icon: "clip", fix: "Cable clips along the skirting board", when: "For a single thin cable.", low: 5, high: 10, shop: "adhesive cable clips" },
      { icon: "basket", fix: "A basket by the door for shoes", when: "If there's no room for a rack.", low: 10, high: 20, shop: "storage basket" },
    ],
    other: [SHIPPING],
  },
  toilet_lookalike: {
    free: "Move it out of the bathroom.",
    fix: "Move it out of the bathroom",
    icon: "move",
    steps: [
      "Take the bin, basket or box out of the bathroom.",
      "If you need a bin in there, use a small one with a lid that doesn't look like a seat.",
      "Keep anything that stays in a color that's clearly different from the toilet.",
    ],
    items: [],
    diyMinutes: [1, 2],
    alternatives: [
      { icon: "bin", fix: "A small pedal bin with a lid, in a strong color", when: "If you need a bin in the bathroom.", low: 10, high: 20, shop: "small pedal bin colored" },
    ],
    other: [],
  },
  glass_door: {
    fix: "Put window decals across the glass at eye level",
    icon: "decal",
    steps: [
      "Clean the glass where the decals go and let it dry.",
      "Mark eye height for the person living there, about 4 to 5 ft up.",
      "Stick a row of decals across the full width of the glass at that height.",
      "Add a second row lower down, about 3 ft up, if they use a walker or wheelchair.",
    ],
    items: [{ name: "Window decals or frosted film strip", low: 8, high: 15, shop: "window decals glass door" }],
    diyMinutes: [10, 20],
    alternatives: [
      { icon: "film", fix: "A frosted film band across the glass", when: "For a neater look that's easy to see from any angle.", low: 10, high: 20, shop: "frosted window film strip" },
      { icon: "tape", fix: "Colored masking tape in a band", when: "A quick test before buying anything.", low: 3, high: 6, shop: "colored masking tape" },
    ],
    other: [SHIPPING],
  },
  door_blends_in: {
    free: "Hang a simple picture sign at eye level showing what's behind the door.",
    fix: "Paint the door or its frame a contrasting color",
    icon: "paint",
    steps: [
      "Pick a color clearly darker or lighter than the wall, like dark blue on a white wall.",
      "Take off the handle, or cover it with tape.",
      "Lightly sand, wipe clean, and tape along the wall's edge around the frame.",
      "Paint two thin coats, waiting for each to dry, then put the handle back.",
    ],
    items: [{ name: "Quart of door paint", low: 15, high: 25, shop: "interior door paint quart" }, PAINT_KIT],
    diyMinutes: [90, 180],
    handymanHours: [2, 3],
    alternatives: [
      { icon: "tape", fix: "Colored tape around the door frame", when: "A quick, cheap test before painting, and it peels off.", low: 5, high: 10, shop: "wide colored masking tape" },
      { icon: "handle", fix: "A handle in a contrasting color", when: "If you can't paint, like in a rented home.", low: 10, high: 25, shop: "black door handle" },
      { icon: "paint", fix: "Paint only the frame", when: "Quicker than the whole door and still shows where it is.", low: 15, high: 25, shop: "interior trim paint quart" },
    ],
    other: ["Two coats are usually needed; allow drying time between them."],
  },
  window_reflection: {
    free: "Close the curtains or blinds as it gets dark.",
    fix: "Hang curtains or a blind if the window has none",
    icon: "curtain",
    steps: [
      "Measure the window's width and height.",
      "Pick curtains or a blind that cover all of the glass when closed.",
      "Hang them on the existing rod, or put a tension rod inside the frame.",
      "Make closing them part of the evening routine, before the lights go on.",
    ],
    items: [{ name: "Curtain panel (per window)", low: 10, high: 25, shop: "blackout curtain panel" }],
    diyMinutes: [10, 20],
    handymanHours: [0.5, 1],
    alternatives: [
      { icon: "blind", fix: "A cordless roller blind", when: "For a window where curtains would be in the way.", low: 15, high: 30, shop: "cordless roller blind" },
      { icon: "film", fix: "Frosted film on the lower half of the glass", when: "If the window must stay uncovered in the day.", low: 10, high: 20, shop: "frosted window film" },
      { icon: "timer", fix: "A plug-in timer for a lamp near the window", when: "To soften the reflection at dusk, alongside curtains.", low: 8, high: 15, shop: "plug in light timer" },
    ],
    other: ["If there's no curtain rod, add a tension rod or have one fitted.", SHIPPING],
  },
  floor_transition: {
    fix: "Use a flat threshold strip close to the floor's color",
    icon: "strip",
    steps: [
      "Measure the width of the doorway where the floors meet.",
      "Pick a flat strip in a shade between the two floors, not a bright contrasting one.",
      "Clean the floor, then stick or screw the strip down over the join.",
      "Check it lies flat with no edge to catch a toe.",
    ],
    items: [{ name: "Threshold transition strip", low: 10, high: 20, shop: "floor transition strip" }],
    diyMinutes: [15, 30],
    handymanHours: [0.5, 1],
    alternatives: [
      { icon: "runner", fix: "A plain rug in a middle shade across the doorway", when: "If a rug can stay there safely, held down with grippers.", low: 24, high: 42, shop: "runner rug beige non slip" },
      { icon: "light", fix: "Brighter light at the doorway", when: "If the change looks darker than it is because that spot is dim.", low: 10, high: 20, shop: "motion sensor night light" },
    ],
    other: ["Re-flooring so both areas match is a bigger job: get local quotes."],
  },
  floor_wall_blend: {
    fix: "Add a contrasting skirting strip along the bottom of the wall",
    icon: "baseboard",
    steps: [
      "Measure along the bottom of each wall that blends into the floor.",
      "Pick a strip clearly darker or lighter than both the floor and the wall.",
      "Clean the bottom of the wall, then peel and press the strip along it.",
      "Cut neatly at corners and door frames with a utility knife.",
    ],
    items: [{ name: "Peel-and-stick vinyl baseboard, 20 ft", low: 15, high: 30, shop: "peel and stick vinyl baseboard" }],
    diyMinutes: [30, 60],
    handymanHours: [1, 2],
    alternatives: [
      { icon: "paint", fix: "Paint the existing skirting board a contrasting color", when: "If there's a skirting board already.", low: 23, high: 40, shop: "interior trim paint quart" },
      { icon: "tape", fix: "Wide colored tape along the bottom of the wall", when: "A quick, cheap test that peels off.", low: 6, high: 12, shop: "wide colored masking tape" },
      { icon: "rug", fix: "A rug in a contrasting color in the middle of the room", when: "To show where the floor is, if you can't change the walls.", low: 45, high: 59, shop: "5x7 area rug plain" },
    ],
    other: [SHIPPING],
  },
  patterned_wall: {
    fix: "Paint the wall a plain, light color",
    icon: "paint",
    steps: [
      "If it's wallpaper, check whether it peels off or needs stripping first.",
      "Pick a plain, matt paint a little lighter than the floor so the two stand apart.",
      "Tape the edges, then paint two coats, letting the first dry.",
      "Keep pictures to a few simple ones in plain frames.",
    ],
    items: [{ name: "Gallon of wall paint", low: 25, high: 40, shop: "interior wall paint gallon" }, PAINT_KIT],
    diyMinutes: [180, 300],
    handymanHours: [3, 5],
    alternatives: [
      { icon: "picture", fix: "Cover the busiest patch with a large plain picture or wall hanging", when: "If painting isn't possible, like in a rented home.", low: 15, high: 40, shop: "large canvas wall art plain" },
      { icon: "move", fix: "Move a bookcase or wardrobe in front of it", when: "For one busy wall, at no cost.", low: 0, high: 0 },
    ],
    other: ["Wallpaper may need stripping first, which adds time."],
  },
};

export type Range = [number, number];

// Clutter depends on what was actually on the floor: the model tells cables
// apart from other things (it has no idea about shoes), so a check's own
// findings get a plan for what was seen. The fixed floor_clutter plan above,
// shoes and all, is for when nothing says what was seen.
const CLUTTER_BY_OBJECT: Record<string, FixPlan> = {
  cable: {
    free: "Move loose cords out of walkways.",
    fix: "Run cords along the wall in a cord cover",
    icon: "cord",
    steps: [
      "Unplug the cord and find a route along the wall instead of across the floor.",
      "Measure that route and cut the cord cover to length.",
      "Peel and stick the cover along the bottom of the wall.",
      "Clip the cord inside, snap the lid shut and plug it back in.",
    ],
    items: [{ name: "Cord cover kit, 10–16 ft", low: 20, high: 23, shop: "cord cover raceway kit" }],
    diyMinutes: [15, 30],
    alternatives: [
      { icon: "clip", fix: "Adhesive cable clips along the skirting board", when: "For one thin cord.", low: 5, high: 10, shop: "adhesive cable clips" },
      { icon: "cord", fix: "A floor cord protector", when: "When a cord has to cross the floor, like to a lamp in the middle of the room.", low: 12, high: 20, shop: "floor cord protector" },
      { icon: "plug", fix: "An extension lead on the other side of the room", when: "So the cord never has to cross a walkway.", low: 10, high: 18, shop: "extension cord with outlets" },
    ],
    other: [SHIPPING],
  },
  other: {
    free: "Clear the walkway and put things away.",
    fix: "Give things a home off the floor, like a basket or bin where they pile up",
    icon: "basket",
    steps: [
      "Notice where things pile up, like by the bed, the door or a chair.",
      "Put a basket or bin right there, so putting things away takes no extra walking.",
      "Keep the path from the bed or chair to the door completely clear.",
      "Do a quick pick-up each evening, so nothing is left out at night.",
    ],
    items: [{ name: "Storage basket or bin", low: 10, high: 20, shop: "storage basket" }],
    diyMinutes: [5, 15],
    alternatives: [
      { icon: "hook", fix: "Wall hooks by the door", when: "For bags, coats and clothes that end up on the floor.", low: 8, high: 15, shop: "adhesive wall hooks" },
      { icon: "table", fix: "A small shelf or side table", when: "For things that need to stay within reach of a chair or bed.", low: 20, high: 40, shop: "small side table" },
    ],
    other: [SHIPPING],
  },
};

// Outside the bathroom, a "fitting that blends in" is usually a towel on a rail.
const TOWEL_PLAN: FixPlan = {
  free: "Use a towel you have in a color that stands out from what's behind it.",
  fix: "Hang a towel in a contrasting color",
  icon: "towel",
  steps: [
    "Hold the towel up against the wall or cupboard where it hangs: it should look clearly darker or lighter.",
    "Hang it in the same spot every time, so it's where they expect it.",
  ],
  items: [{ name: "Hand towel in a contrasting color", low: 5, high: 12, shop: "hand towel" }],
  diyMinutes: [1, 2],
  alternatives: [
    { icon: "hook", fix: "A towel rail or hook in a contrasting color", when: "If the towel itself has to match the room.", low: 8, high: 15, shop: "black towel hook" },
  ],
  other: [],
};

// In the bathroom, what to do depends on which fitting blends in.
const FITTING_BY_OBJECT: Record<string, FixPlan> = {
  towel: {
    free: "Hang the most strongly colored towel you have, like a dark blue one on a white wall.",
    fix: "Get towels in one strong color that stands out from the wall",
    icon: "towel",
    steps: [
      "Hold a towel up against the wall where it hangs: it should look clearly darker or lighter.",
      "Pick one strong color, like dark blue, red or green, and use it for every towel.",
      "Hang them in the same spot every time, so they're where they're expected.",
    ],
    items: [{ name: "Bath and hand towel set, one strong color", low: 15, high: 30, shop: "bath towel set navy" }],
    diyMinutes: [1, 2],
    alternatives: [
      { icon: "rail", fix: "A towel rail in a contrasting color", when: "If the towels themselves have to stay light.", low: 15, high: 25, shop: "black towel bar" },
    ],
    other: [SHIPPING],
  },
  toilet_roll_holder: {
    free: "Until the new holder arrives, keep a roll on the back of the toilet where it's easy to see.",
    fix: "Swap the holder for one in a contrasting color",
    icon: "roll",
    steps: [
      "Pick a holder clearly darker or lighter than the wall, like black on a white wall.",
      "Mount it on the same side as now, within easy reach of the toilet.",
      "Use plain, single-color toilet paper so the roll shows up against it too.",
    ],
    items: [{ name: "Toilet roll holder, contrasting color", low: 10, high: 20, shop: "black toilet paper holder" }],
    diyMinutes: [10, 20],
    handymanHours: [0.5, 1],
    alternatives: [
      { icon: "roll", fix: "A freestanding holder in a strong color", when: "If you can't drill into the wall.", low: 15, high: 25, shop: "freestanding toilet paper holder black" },
      { icon: "tiles", fix: "A colored tile or plate on the wall behind it", when: "If you'd rather keep the holder you have.", low: 6, high: 12, shop: "colored adhesive wall tile" },
    ],
    other: [SHIPPING],
  },
};

/** The fix plan for one finding, using what the model saw (clutter, fittings) and where. */
export function planFor(h: { type: HazardType; object?: string; room?: string }): FixPlan {
  if (h.type === "bathroom_fitting_blends_in" && h.room && h.room !== "bathroom") return TOWEL_PLAN;
  if (h.type === "bathroom_fitting_blends_in" && h.object && FITTING_BY_OBJECT[h.object]) return FITTING_BY_OBJECT[h.object];
  if (h.type === "floor_clutter" && h.object)
    return CLUTTER_BY_OBJECT[h.object === "cable" ? "cable" : "other"];
  return FIX_PLANS[h.type];
}

export function materials(plan: FixPlan | undefined): Range {
  if (!plan) return [0, 0];
  return plan.items.reduce<Range>(
    ([lo, hi], i) => [lo + i.low, hi + i.high],
    [0, 0],
  );
}

export function labor(plan: FixPlan): Range {
  const [lo, hi] = plan.handymanHours ?? [0, 0];
  return [lo * HANDYMAN_RATE[0], hi * HANDYMAN_RATE[1]];
}

/** Totals for a set of hazards: doing everything yourself, or hiring help where it makes sense. */
export function planTotals(
  findings: (HazardType | { type: HazardType; object?: string; room?: string })[],
) {
  let diy: Range = [0, 0];
  let hired: Range = [0, 0];
  let minutes: Range = [0, 0];
  let freeSteps = 0;
  for (const f of findings) {
    const plan = typeof f === "string" ? FIX_PLANS[f] : planFor(f);
    const [mLo, mHi] = materials(plan);
    const [lLo, lHi] = labor(plan);
    diy = [diy[0] + mLo, diy[1] + mHi];
    hired = [hired[0] + mLo + lLo, hired[1] + mHi + lHi];
    minutes = [
      minutes[0] + plan.diyMinutes[0],
      minutes[1] + plan.diyMinutes[1],
    ];
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
    {
      store: "Walmart",
      url: `https://www.walmart.com/search?q=${q}&sort=price_low`,
    },
    {
      store: "Amazon",
      url: `https://www.amazon.com/s?k=${q}&s=price-asc-rank`,
    },
  ];
}

export const SOURCES = [
  {
    label: "Handyman rates: Jobber handyman pricing guide",
    url: "https://getjobber.com/resources/salary-guides/handyman/",
  },
  {
    label: "Handyman rates: Housecall Pro, how to price handyman jobs",
    url: "https://www.housecallpro.com/resources/how-to-price-handyman-jobs/",
  },
  {
    label: "Materials: Walmart and Home Depot listings checked October 2026",
    url: "https://www.walmart.com",
  },
];
