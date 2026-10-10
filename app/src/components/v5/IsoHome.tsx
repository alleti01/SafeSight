"use client";

import { motion, useReducedMotion } from "motion/react";

// An isometric line drawing of a home, in the style of gradient-labs.ai's
// hero: cream blocks with black outlines, stairs, a few small people, and pill
// labels on the things that may be a problem for someone living with dementia.
// Everything is drawn from 3D boxes, so the scene is easy to rearrange.

const S = 30; // one unit, in pixels
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
const OX = 560; // where (0, 0, 0) sits in the drawing
const OY = 150;

type P = [number, number, number];
const iso = ([x, y, z]: P): [number, number] => [OX + (x - y) * COS * S, OY + (x + y) * SIN * S - z * S];
const pts = (ps: P[]) => ps.map((p) => iso(p).join(",")).join(" ");

type Tone = "cream" | "sand" | "ink" | "navy" | "white" | "orange" | "blue" | "stripe";
const TONES: Record<Tone, [string, string, string]> = {
  // top, left (front-left), right (front-right)
  cream: ["#fbf8f2", "#ece4d6", "#ddd2bf"],
  sand: ["#efe7da", "#ddd1bd", "#cdbfa7"],
  ink: ["#2a2a28", "#1b1b1a", "#121211"],
  navy: ["#2e3a66", "#232d52", "#1b2342"],
  white: ["#ffffff", "#f1efea", "#e4e0d8"],
  orange: ["#b58457", "#9a6c41", "#865d36"],
  blue: ["#b9d4f0", "#8fb4dc", "#7aa2cf"],
  stripe: ["#efe2c8", "#d9c9a8", "#c9b792"],
};

type Box = { x: number; y: number; z: number; w: number; d: number; h: number; tone?: Tone; key?: string };

function Block({ x, y, z, w, d, h, tone = "cream" }: Omit<Box, "key">) {
  const [top, left, right] = TONES[tone];
  const stroke = { stroke: "#1d1d1b", strokeWidth: 1.1, strokeLinejoin: "round" as const };
  return (
    <g>
      <polygon points={pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])} fill={left} {...stroke} />
      <polygon points={pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])} fill={right} {...stroke} />
      <polygon points={pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])} fill={top} {...stroke} />
    </g>
  );
}

// Unit cubes filling a box, so masses read as stacked blocks like the reference.
function cubes(x: number, y: number, z: number, w: number, d: number, h: number, tone: Tone = "cream"): Box[] {
  const out: Box[] = [];
  for (let k = 0; k < h; k++) for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) out.push({ x: x + i, y: y + j, z: z + k, w: 1, d: 1, h: 1, tone });
  return out;
}

// A tiny person: legs, body and head, standing at (x, y, z).
function Person({ at, shirt = "#865d36", delay = 0 }: { at: P; shirt?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const [sx, sy] = iso(at);
  return (
    <motion.g
      initial={{ y: 0 }}
      animate={reduce ? undefined : { y: [0, -2, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay }}
    >
      <g transform={`translate(${sx} ${sy})`} stroke="#1d1d1b" strokeWidth={1.1} strokeLinejoin="round">
        <path d="M-3 0 L-2.5 -12 M3 0 L2.5 -12" strokeLinecap="round" />
        <rect x={-5} y={-25} width={10} height={14} rx={3} fill={shirt} />
        <circle cx={0} cy={-30} r={4.2} fill="#f3d9c2" />
        <path d="M-4.2 -31 Q0 -37 4.2 -31 Z" fill="#1d1d1b" />
      </g>
    </motion.g>
  );
}

type Label = { text: string; at: P; delay: number };

export default function IsoHome() {
  const reduce = useReducedMotion();

  // Lower-left: the hallway, with a door, opening onto the living room floor.
  const hall = cubes(-7, 4, 0, 3, 4, 3, "cream");
  const living = cubes(-4, 4, 0, 8, 4, 1, "sand");
  // Stairs from the living room up to the bathroom at the back: plain steps
  // with no marked edges, which is the hazard. They climb away from us so
  // each riser faces the viewer.
  const stairs: Box[] = [0, 1, 2, 3].flatMap((k) => cubes(4, 7 - k, 0, 3, 1, 2 + k, k % 2 ? "cream" : "sand"));
  // The bathroom platform behind the stairs, with a low wall along its back.
  const bath = cubes(4, -1, 0, 5, 4, 5, "cream");
  const walls: Box[] = [{ x: 4, y: -1, z: 5, w: 5, d: 0.3, h: 2.2, tone: "cream", key: "wallBack" }];
  // A bedroom block at the back, and loose cubes for rhythm.
  const bedroom = cubes(-3, -3, 0, 3, 3, 3, "cream");
  const loose = [...cubes(10, 5, 0, 2, 2, 1, "cream"), ...cubes(11, 1, 0, 2, 2, 2, "cream"), ...cubes(-9, 9, 0, 2, 2, 1, "cream")];

  // Painter's order for unit cubes: back to front (x + y + z).
  const masses = [...bedroom, ...hall, ...living, ...stairs, ...bath, ...loose].sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z));

  // Things that may be a problem, drawn on top of the surfaces they sit on.
  const items: Box[] = [
    { x: -3.4, y: 4.5, z: 1, w: 4.2, d: 2.4, h: 0.06, tone: "navy", key: "rug" },
    { x: -3.6, y: 7.2, z: 1, w: 1.4, d: 0.6, h: 0.7, tone: "cream", key: "chairSeat" },
    { x: -3.6, y: 7.5, z: 1.7, w: 1.4, d: 0.3, h: 0.7, tone: "cream", key: "chairBack" },
    { x: 1.8, y: 7.1, z: 1, w: 0.45, d: 0.3, h: 0.22, tone: "orange", key: "shoe1" },
    { x: 2.4, y: 7.35, z: 1, w: 0.45, d: 0.3, h: 0.22, tone: "orange", key: "shoe2" },
    { x: 5, y: -0.6, z: 5, w: 1, d: 1.3, h: 0.8, tone: "white", key: "toilet" },
    { x: 5.1, y: -0.7, z: 5.8, w: 0.8, d: 0.3, h: 0.8, tone: "white", key: "tank" },
    { x: 7, y: -0.7, z: 5.6, w: 1.4, d: 0.12, h: 1.5, tone: "blue", key: "mirror" },
  ];
  const things = [...walls, ...items].sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z));

  const labels: Label[] = [
    { text: "Dark rug", at: [-1.3, 5.7, 2.3], delay: 0.6 },
    { text: "Furniture blends in", at: [-3.2, 7.5, 3.6], delay: 0.9 },
    { text: "Clutter on the floor", at: [2.3, 7.4, 2.2], delay: 1.2 },
    { text: "Stair edges", at: [7.4, 6.6, 4.6], delay: 1.5 },
    { text: "Toilet blends in", at: [5, 0.6, 7.6], delay: 1.8 },
    { text: "Mirror", at: [9.2, -0.4, 7.6], delay: 2.1 },
  ];

  // Fit the drawing to what's in it.
  const corners = [...masses, ...things].flatMap((b) => [
    iso([b.x, b.y, b.z + b.h]),
    iso([b.x + b.w, b.y, b.z]),
    iso([b.x, b.y + b.d, b.z]),
    iso([b.x + b.w, b.y + b.d, b.z]),
  ]);
  const pad = 40;
  const minX = Math.min(...corners.map((c) => c[0])) - pad;
  const minY = Math.min(...corners.map((c) => c[1])) - pad - 30;
  const maxX = Math.max(...corners.map((c) => c[0])) + pad;
  const maxY = Math.max(...corners.map((c) => c[1])) + pad;

  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="h-auto w-full overflow-visible" role="img" aria-label="An isometric drawing of a home with labels on a dark rug, clutter, stair edges, a toilet that blends in, a mirror and furniture that blends in">
      {[...masses, ...things].map((b, i) => (
        <Block key={b.key ?? `b${i}`} x={b.x} y={b.y} z={b.z} w={b.w} d={b.d} h={b.h} tone={b.tone} />
      ))}
      {/* A door in the hall. */}
      <polygon points={pts([[-6.2, 8, 0], [-5.2, 8, 0], [-5.2, 8, 2.2], [-6.2, 8, 2.2]])} fill="#1d1d1b" opacity={0.85} />
      <Person at={[0.6, 6.4, 1]} delay={0} />
      <Person at={[5.6, 5.5, 4]} shirt="#ffffff" delay={0.5} />
      <Person at={[7.6, 2, 5]} delay={1} />
      <Person at={[-1.6, -1.6, 3]} shirt="#ffffff" delay={1.5} />

      {labels.map((l) => {
        const [lx, ly] = iso(l.at);
        const w = l.text.length * 7.1 + 26;
        return (
          <motion.g
            key={l.text}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: reduce ? 0 : l.delay, ease: [0.22, 1, 0.36, 1] }}
          >
            <rect x={lx - w / 2} y={ly - 15} width={w} height={30} rx={9} fill="#efe5d8" />
            <text x={lx} y={ly + 5} textAnchor="middle" fontSize={13} fontWeight={500} fill="#1d1d1b" fontFamily="var(--font-inter5), sans-serif">
              {l.text}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}
