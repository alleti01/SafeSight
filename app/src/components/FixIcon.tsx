// Small line drawings, on a 24×24 grid, of what each fix uses, so a fix can be
// recognized at a glance without reading it. Same style as v5/ItemIcon.

import type { FixIconName } from "@/lib/costs";

export function FixIcon({ name, size = 28, className = "" }: { name: FixIconName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className}>
      <g fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        {SHAPES[name]}
      </g>
    </svg>
  );
}

const SHAPES: Record<FixIconName, React.ReactNode> = {
  // A plain rug with fringe.
  rug: (
    <>
      <rect x="5" y="6" width="14" height="12" rx="1" />
      <path d="M5 8H3M5 11H3M5 14H3M5 17H3M19 8h2M19 11h2M19 14h2M19 17h2" />
    </>
  ),
  // A long, narrow runner seen at an angle.
  runner: (
    <>
      <path d="M8 3h8l2 18H6z" />
      <path d="M8 3V1.8M12 3V1.8M16 3V1.8M6 21v1.2M12 21v1.2M18 21v1.2" />
    </>
  ),
  // A rug, crossed out.
  "no-rug": (
    <>
      <rect x="5" y="6" width="14" height="12" rx="1" strokeDasharray="2 2" />
      <path d="M4 4l16 16" />
    </>
  ),
  // A gripper pad under a rug corner.
  pad: (
    <>
      <path d="M4 18V8q0-2 2-2h14" />
      <rect x="6.5" y="9" width="7" height="7" rx="1.5" />
      <path d="M8.5 11h3M8.5 13.5h3" />
    </>
  ),
  // A roll of tape.
  tape: (
    <>
      <circle cx="10" cy="12" r="5.5" />
      <circle cx="10" cy="12" r="2" />
      <path d="M15.5 12H21v3h-5" />
    </>
  ),
  // A window pane with its lower half frosted.
  film: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M5 12h14M7 14.5l3-2.5M7 18l6-6M10 21l9-7.5M14 21l5-4" />
    </>
  ),
  // A spray bottle.
  spray: (
    <>
      <path d="M9 9h6v11a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" />
      <path d="M10 9V6h4v3M10 6V4h5l2 2M14 5h-4" />
    </>
  ),
  // Four plain floor tiles.
  tiles: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M12 4v16M4 12h16" />
    </>
  ),
  // A toilet lid with a soft cover.
  lid: (
    <>
      <ellipse cx="12" cy="13" rx="6.5" ry="6" />
      <ellipse cx="12" cy="13" rx="4.5" ry="4" strokeDasharray="1.5 1.5" />
    </>
  ),
  // A grab rail on the wall.
  rail: (
    <>
      <path d="M5 9h14" strokeWidth={2.2} />
      <path d="M6 9v3M18 9v3M4 12h3M17 12h3" />
    </>
  ),
  // A sofa with a cover.
  sofa: (
    <>
      <path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
      <path d="M3 12a1.5 1.5 0 0 1 3 0v2h12v-2a1.5 1.5 0 0 1 3 0v5H3z" />
      <path d="M5 17v2M19 17v2" />
    </>
  ),
  // A square cushion.
  cushion: (
    <>
      <path d="M5 6q7-2 14 0q2 6 0 12q-7 2-14 0q-2-6 0-12z" />
      <circle cx="12" cy="12" r="0.8" />
    </>
  ),
  // Something carried away: a box and an arrow.
  move: (
    <>
      <rect x="3" y="9" width="9" height="9" rx="1" />
      <path d="M14 13.5h7M18 10.5l3 3-3 3" />
    </>
  ),
  // A roller blind, half down.
  blind: (
    <>
      <path d="M4 4h16" strokeWidth={2} />
      <path d="M5 5v9h14V5M5 8h14M5 11h14M12 14v3" />
      <circle cx="12" cy="18" r="1" />
    </>
  ),
  // A step with a nosing strip on its edge.
  nosing: (
    <>
      <path d="M3 18h6v-6h6V6h6" />
      <path d="M9 12h3M15 6h3" strokeWidth={2.4} />
    </>
  ),
  // Stairs with a tread on each step.
  stairs: (
    <>
      <path d="M3 20h5v-5h5v-5h5V5h3" />
      <path d="M3.5 19h4M8.5 14h4M13.5 9h4" strokeDasharray="1 1" />
    </>
  ),
  // A light with rays.
  light: (
    <>
      <path d="M9 15a5 5 0 1 1 6 0v2H9z" />
      <path d="M10 20h4M12 1.5V3M4.5 4.5l1 1M19.5 4.5l-1 1M2 11h1.5M20.5 11H22" />
    </>
  ),
  // A cable held by two clips.
  clip: (
    <>
      <path d="M3 18h18" />
      <path d="M3 15c6 0 12 0 18 0" />
      <path d="M7 13v4M10 13v4M7 13h3M15 13v4M18 13v4M15 13h3" />
    </>
  ),
  // A woven basket.
  basket: (
    <>
      <path d="M4 10h16l-2 10H6z" />
      <path d="M8 10a4 4 0 0 1 8 0M8 13v5M12 13v5M16 13v5" />
    </>
  ),
  // A pedal bin with a lid.
  bin: (
    <>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M5 8q7-4 14 0M10 20v1.5h4V20" />
    </>
  ),
  // A lever door handle.
  handle: (
    <>
      <rect x="9" y="4" width="4" height="16" rx="2" />
      <path d="M11 9h9" strokeWidth={2.2} />
    </>
  ),
  // A paint roller.
  paint: (
    <>
      <rect x="4" y="3" width="13" height="5" rx="1.5" />
      <path d="M17 5.5h2v5h-7v3" />
      <path d="M11 13.5h2v7.5h-2z" />
    </>
  ),
  // A plug-in timer.
  timer: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="3" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 9.5V12l1.8 1" />
    </>
  ),
  // A framed picture.
  picture: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1" />
      <path d="M4 16l5-5 4 4 2-2 5 5" />
      <path d="M12 5l0-2" />
    </>
  ),
  // A cord in a cover running along the wall.
  cord: (
    <>
      <path d="M3 16h18v3H3z" />
      <path d="M8 16v-4a2 2 0 0 1 2-2h2" />
      <rect x="12" y="8" width="4" height="4" rx="1" />
    </>
  ),
  // An extension lead with outlets.
  plug: (
    <>
      <rect x="3" y="11" width="15" height="6" rx="2" />
      <path d="M7 13v2M11 13v2M15 13v2M18 14h2a1 1 0 0 0 1-1V6" />
    </>
  ),
  // A wall hook.
  hook: (
    <>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <path d="M12 8v7a3 3 0 0 1-6 0" />
    </>
  ),
  // A small side table.
  table: (
    <>
      <path d="M4 9h16M6 9v11M18 9v11M6 14h12" />
      <rect x="9" y="5" width="6" height="4" rx="1" />
    </>
  ),
  // A toilet roll on a wall holder, a sheet hanging down.
  roll: (
    <>
      <path d="M3 4v8M3 8h4" />
      <circle cx="11" cy="8" r="4" />
      <circle cx="11" cy="8" r="1.3" />
      <path d="M15 8v11H8v-7.5" />
    </>
  ),
  // A curtain on a rail.
  curtain: (
    <>
      <path d="M3 4h18" />
      <path d="M5 4v16M9 4c0 5 1 11 0 16M15 4c0 5-1 11 0 16M19 4v16" />
    </>
  ),
  // A toilet seat and lid.
  seat: (
    <>
      <ellipse cx="12" cy="13" rx="6" ry="5" />
      <ellipse cx="12" cy="13" rx="3" ry="2.4" />
      <path d="M8 6h8v3H8z" />
    </>
  ),
  // A folded throw.
  throw: (
    <>
      <path d="M4 6.5h16v9H4z" />
      <path d="M4 10.5h16M7 15.5v2M10 15.5v2M13 15.5v2M16 15.5v2" />
    </>
  ),
  // A mirror being taken off its hook.
  mirror: (
    <>
      <path d="M12 2v3" />
      <rect x="7" y="7" width="10" height="14" rx="5" />
      <path d="M10 11l3-2M10 14l4-3" />
    </>
  ),
  // Dots stuck across a pane of glass.
  decal: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <circle cx="8.5" cy="11" r="1" />
      <circle cx="12" cy="11" r="1" />
      <circle cx="15.5" cy="11" r="1" />
    </>
  ),
  // A flat threshold strip between two floors.
  strip: (
    <>
      <path d="M2 16h20" />
      <path d="M9 16q0-2 3-2t3 2" />
      <path d="M4 18l1-2M7 18l1-2M16 18l1-2M19 18l1-2" />
    </>
  ),
  // A skirting strip at the foot of a wall.
  baseboard: (
    <>
      <path d="M3 3v15h18" />
      <path d="M3 15h18" strokeWidth={2.2} />
    </>
  ),
  // A towel on a rail.
  towel: (
    <>
      <path d="M4 5h16" strokeWidth={2} />
      <path d="M7 5v13h10V5M7 15h10" />
    </>
  ),
  // A picture sign on a door.
  sign: (
    <>
      <path d="M6 21V3h12v18" />
      <rect x="9" y="7" width="6" height="5" rx="0.5" />
      <path d="M15 14v2" />
    </>
  ),
};
