import type { HazardType } from "@/lib/contract";

// Small line drawings, on a 24×24 grid, of the main thing each fix asks you to
// get (or, for a free fix, use): a plain rug, grippers, a shoe rack, a throw,
// a cloth over a mirror... Drawn bare, for placing inside another SVG.
export function ItemShape({ type, width = 1.3, color = "currentColor" }: { type: HazardType; width?: number; color?: string }) {
  const p = { fill: "none", stroke: color, strokeWidth: width, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "dark_rug":
    case "patterned_floor":
      // A plain light rug with fringe.
      return (
        <>
          <rect x="5" y="6" width="14" height="12" rx="1" {...p} />
          <path d="M5 8H3M5 11H3M5 14H3M5 17H3M19 8h2M19 11h2M19 14h2M19 17h2" {...p} />
        </>
      );
    case "loose_rug":
      // A rug corner held down by a gripper pad.
      return (
        <>
          <path d="M4 18 L4 8 Q4 6 6 6 L20 6" {...p} />
          <rect x="6.5" y="9" width="7" height="7" rx="1.5" {...p} />
          <path d="M8.5 11h3M8.5 13.5h3" {...p} />
        </>
      );
    case "floor_clutter":
      // A two-shelf shoe rack with a shoe on each shelf.
      return (
        <>
          <path d="M4 4v16M20 4v16M4 11h16M4 19h16" {...p} />
          <path d="M6 11V8.2c0-.4.3-.7.7-.7h1.6l1.4 1.6c.2.2.5.3.8.3h2.3c.7 0 1.2.6 1.2 1.3V11" {...p} />
          <path d="M10 19v-2.8c0-.4.3-.7.7-.7h1.6l1.4 1.6c.2.2.5.3.8.3h2.3c.7 0 1.2.6 1.2 1.3V19" {...p} />
        </>
      );
    case "furniture_blends_in":
      // A folded throw blanket.
      return (
        <>
          <path d="M4 6.5h16v9H4z" {...p} />
          <path d="M4 10.5h16M7 15.5v2M10 15.5v2M13 15.5v2M16 15.5v2" {...p} />
        </>
      );
    case "mirror":
      // A cloth draped over a mirror.
      return (
        <>
          <path d="M8 4h8v16H8z" {...p} />
          <path d="M6 7c3-1.5 9-1.5 12 0l-1 7c-3 1-7 1-10 0z" {...p} />
        </>
      );
    case "bathroom_fitting_blends_in":
    case "toilet_lookalike":
      // A toilet seat and lid.
      return (
        <>
          <ellipse cx="12" cy="13" rx="6" ry="5" {...p} />
          <ellipse cx="12" cy="13" rx="3" ry="2.4" {...p} />
          <path d="M8 6h8v3H8z" {...p} />
        </>
      );
    case "stair_edge_hard_to_see":
      // A roll of tape.
      return (
        <>
          <circle cx="10" cy="12" r="5.5" {...p} />
          <circle cx="10" cy="12" r="2" {...p} />
          <path d="M15.5 12H21v3h-5" {...p} />
        </>
      );
    case "shiny_floor":
      // A sheer curtain on a rail.
      return (
        <>
          <path d="M4 5h16" {...p} />
          <path d="M6 5v14M10 5c0 5 1 9 0 14M14 5c0 5-1 9 0 14M18 5v14" {...p} />
        </>
      );
  }
}
