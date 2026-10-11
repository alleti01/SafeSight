"use client";

import type { SitePhoto } from "@/components/landing/ModelStrip";
import { ItemShape } from "@/components/v5/ItemIcon";
import { ACCENT, Callout, Line, LINE, PanelSteps } from "@/components/v5/Steppers";
import { FIX_PLANS, materials, money } from "@/lib/costs";
import type { HazardType } from "@/lib/contract";

const STEPS = [
  { title: "Film the room", body: "Walk slowly through the room with your phone, or take a few photos.", tag: "Your phone" },
  { title: "We hide anyone in it", body: "If a person appears, they're blurred straight away. If we can't blur them, we stop.", tag: "Blurred" },
  {
    title: "We spot what's there",
    body: "Our detector names each object and says how sure it is. It's less sure when something is cut off, small or hard to make out.",
    tag: "Spotted",
  },
  {
    title: "We measure the color",
    body: "We compare each object's color with what's around it. This part is measured from the photo, not guessed.",
    tag: "Measured",
  },
  {
    title: "We check the guide",
    body: "We only flag what the Alzheimer's Society guide says may be a problem, and every fix follows its advice.",
    tag: "In the guide",
  },
  { title: "You get a fix list", body: "What may be a problem, why, a free step for today, and the cheapest fix.", tag: "Fix list" },
];

// Hazards drawn in the room (step 3) are framed in a soft red.
const HAZARD = "#e8796c";

// "How it works": the four steps beside a dark panel with a glowing drawing
// of each one, pinned while you scroll (PanelSteps). The drawings use the
// example room's own results: the detector's scores (step 3), the sofa's
// measured colors (step 4), and its first three fixes with prices (step 6).
export default function HowItWorks({ room }: { room: SitePhoto }) {
  const order = { high: 0, medium: 1, low: 2 };
  const fixes = [...room.hazards].sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 3).map((h) => h.type);
  const score = (t: HazardType) => {
    const h = room.hazards.find((x) => x.type === t);
    return h ? ` ${Math.round(h.confidence * 100)}%` : "";
  };
  const sofa = room.hazards.find((h) => h.type === "furniture_blends_in")?.colors ?? { inside: "#726963", around: "#776958" };
  return (
    <PanelSteps
      eyebrow="How it works"
      title="About a minute of your time"
      intro="Six steps from your phone to a fix list. Here's what happens to your video."
      steps={STEPS}
      boxes={[
        [104, 130, 496, 350],
        [122, 90, 478, 370],
        [60, 80, 540, 430],
        [96, 140, 504, 462],
        [140, 100, 460, 390],
        [150, 70, 450, 410],
      ]}
      drawing={(i, draw) =>
        [
          <Filming key="f" draw={draw} />,
          <Blurred key="b" draw={draw} />,
          <Looking key="l" draw={draw} labels={[`Dark rug${score("dark_rug")}`, `Mirror${score("mirror")}`, `Shoes${score("floor_clutter")}`]} />,
          <Measuring key="m" draw={draw} colors={sofa} />,
          <Guide key="g" draw={draw} />,
          <FixList key="x" draw={draw} fixes={fixes} />,
        ][i]
      }
    />
  );
}

const FRAME = "M140 90 h320 a18 18 0 0 1 18 18 v244 a18 18 0 0 1 -18 18 h-320 a18 18 0 0 1 -18 -18 v-244 a18 18 0 0 1 18 -18 z";

// 1. A phone held sideways, filming a room: a window, a sofa and a rug on its
// screen, and a recording dot.
function Filming({ draw }: { draw: boolean }) {
  return (
    <>
      <Line d="M130 130 h340 a26 26 0 0 1 26 26 v168 a26 26 0 0 1 -26 26 h-340 a26 26 0 0 1 -26 -26 v-168 a26 26 0 0 1 26 -26 z" draw={draw} width={2.6} />
      <Line d="M150 150 h300 v180 h-300 z" draw={draw} delay={0.15} width={1.4} />
      {/* The room on screen. */}
      <Line d="M150 285 L210 245 H390 L450 285 M210 245 V170 M390 245 V170 M210 170 H390" draw={draw} delay={0.3} width={1.4} />
      <Line d="M230 182 h46 v36 h-46 z M253 182 v36" draw={draw} delay={0.45} width={1.4} />
      <Line d="M300 245 v-22 a8 8 0 0 1 8 -8 h60 a8 8 0 0 1 8 8 v22" draw={draw} delay={0.5} width={1.4} />
      <Line d="M240 275 L370 275 L392 300 L218 300 Z" draw={draw} dash="5 6" color={ACCENT} />
      <Line d="M160 162 v-6 h6 M440 162 v-6 h-6 M160 318 v6 h6 M440 318 v6 h-6" draw={draw} delay={0.4} color={ACCENT} width={1.6} />
      <circle cx="176" cy="176" r="6" fill={HAZARD} />
      <Callout x={40} y={176} to={[168, 176]}>
        Recording
      </Callout>
      <Callout x={560} y={120} to={[470, 140]}>
        Walk slowly
      </Callout>
      <Callout x={560} y={300} to={[392, 296]}>
        The whole floor
      </Callout>
    </>
  );
}

// 2. A person in the video frame, soft and blurred, with their outline dashed
// over it.
function Blurred({ draw }: { draw: boolean }) {
  return (
    <>
      <defs>
        <filter id="ss-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <Line d={FRAME} draw={draw} />
      <Line d="M150 120 v-14 h14 M450 120 v-14 h-14 M150 340 v14 h14 M450 340 v14 h-14" draw={draw} delay={0.3} color={ACCENT} />
      <g filter="url(#ss-soft)" opacity={0.55}>
        <circle cx="300" cy="185" r="40" fill={LINE} />
        <path d="M215 370 C 215 290, 250 255, 300 255 C 350 255, 385 290, 385 370 Z" fill={LINE} />
      </g>
      <Line d="M300 145 a40 40 0 1 1 -0.1 0" draw={draw} dash="6 7" color={ACCENT} />
      <Line d="M215 368 C 215 290, 250 255, 300 255 C 350 255, 385 290, 385 368" draw={draw} dash="6 7" color={ACCENT} />
      <Callout x={560} y={170} to={[342, 182]}>
        Face
      </Callout>
      <Callout x={560} y={300} to={[382, 320]}>
        Body
      </Callout>
    </>
  );
}

// Red corner brackets around a box.
function Brackets({ x, y, w, h, draw, delay }: { x: number; y: number; w: number; h: number; draw: boolean; delay: number }) {
  const a = 14;
  const d = `M${x} ${y + a} V${y} H${x + a} M${x + w - a} ${y} H${x + w} V${y + a} M${x} ${y + h - a} V${y + h} H${x + a} M${x + w - a} ${y + h} H${x + w} V${y + h - a}`;
  return <Line d={d} draw={draw} delay={delay} color={HAZARD} width={2.6} />;
}

// 3. The room drawn in lines, with what the detector found framed and named
// with how sure it is: a dark rug, a floor mirror, shoes in the way.
function Looking({ draw, labels }: { draw: boolean; labels: string[] }) {
  return (
    <>
      {/* Walls and floor. */}
      <Line d="M170 80 V270 H430 V80 M170 270 L60 430 M430 270 L540 430" draw={draw} />
      <Line d="M200 110 h80 v70 h-80 z M240 110 v70" draw={draw} delay={0.2} width={1.6} />
      {/* Sofa against the back wall. */}
      <Line d="M300 270 v-36 a10 10 0 0 1 10 -10 h96 a10 10 0 0 1 10 10 v36 M300 250 h116" draw={draw} delay={0.3} width={1.6} />
      {/* The dark rug. */}
      <Line d="M200 315 L390 315 L425 385 L165 385 Z" draw={draw} delay={0.35} fill="rgba(217,185,143,0.12)" width={1.6} />
      {/* A floor mirror leaning on the right wall. */}
      <Line d="M462 150 L500 140 L500 330 L462 316 Z" draw={draw} delay={0.4} width={1.6} />
      {/* Shoes. */}
      <Line d="M430 400 c0 -8 6 -12 14 -12 l10 8 h14 c5 0 8 3 8 8 z M470 420 c0 -8 6 -12 14 -12 l10 8 h14 c5 0 8 3 8 8 z" draw={draw} delay={0.45} width={1.6} />
      <Brackets x={152} y={302} w={286} h={96} draw={draw} delay={0.8} />
      <Brackets x={450} y={128} w={62} h={214} draw={draw} delay={0.95} />
      <Brackets x={420} y={378} w={110} h={54} draw={draw} delay={1.1} />
      <Callout x={40} y={330} to={[150, 350]}>
        {labels[0]}
      </Callout>
      <Callout x={600} y={160} to={[514, 180]}>
        {labels[1]}
      </Callout>
      <Callout x={600} y={420} to={[532, 410]}>
        {labels[2]}
      </Callout>
    </>
  );
}

// 4. The sofa, the ring of room around it, and the two colors measured from
// the photo, side by side.
function Measuring({ draw, colors }: { draw: boolean; colors: { inside: string; around: string } }) {
  return (
    <>
      {/* The ring around it. */}
      <Line d="M120 140 h360 a24 24 0 0 1 24 24 v130 a24 24 0 0 1 -24 24 h-360 a24 24 0 0 1 -24 -24 v-130 a24 24 0 0 1 24 -24 z" draw={draw} dash="6 8" color={ACCENT} />
      {/* The sofa. */}
      <Line d="M190 250 v-50 a14 14 0 0 1 14 -14 h192 a14 14 0 0 1 14 14 v50" draw={draw} width={2.4} />
      <Line d="M160 250 a14 14 0 0 1 28 0 v34 h224 v-34 a14 14 0 0 1 28 0 v40 a8 8 0 0 1 -8 8 h-264 a8 8 0 0 1 -8 -8 z" draw={draw} delay={0.15} width={2.4} />
      <Line d="M300 190 v58 M190 252 h220 M180 298 v14 M420 298 v14" draw={draw} delay={0.3} width={1.6} />
      {/* The two colors. */}
      <rect x="120" y="360" width="56" height="56" rx="12" fill={colors.inside} stroke={LINE} strokeWidth={1.5} />
      <text x="188" y="394" fill={LINE} fontSize={18}>
        The sofa
      </text>
      <text x="300" y="394" fill={LINE} fillOpacity={0.6} fontSize={16} textAnchor="middle">
        vs.
      </text>
      <text x="412" y="394" fill={LINE} fontSize={18} textAnchor="end">
        Around it
      </text>
      <rect x="424" y="360" width="56" height="56" rx="12" fill={colors.around} stroke={LINE} strokeWidth={1.5} />
      <text x="300" y="452" fill={ACCENT} fontSize={20} textAnchor="middle" style={{ fontFamily: "var(--font-v5)" }}>
        Almost the same color
      </text>
      <Callout x={70} y={200} to={[188, 220]}>
        {"The sofa's color"}
      </Callout>
      <Callout x={520} y={250} to={[505, 250]}>
        {"The room's color"}
      </Callout>
    </>
  );
}

// 5. The Alzheimer's Society guide, open, with what it lists ticked off.
function Guide({ draw }: { draw: boolean }) {
  const ticks = ["Dark rugs", "Mirrors", "Clutter", "Low contrast"];
  return (
    <>
      <Line d="M300 120 C 250 100, 190 100, 140 115 V 380 C 190 365, 250 365, 300 385 Z" draw={draw} fill="rgba(243,230,211,0.05)" />
      <Line d="M300 120 C 350 100, 410 100, 460 115 V 380 C 410 365, 350 365, 300 385 Z" draw={draw} delay={0.1} fill="rgba(243,230,211,0.05)" />
      <Line d="M165 160 h105 M165 186 h92 M165 212 h105 M165 238 h80 M165 264 h100 M165 290 h88 M165 316 h102" draw={draw} delay={0.3} width={1.4} color={ACCENT} />
      {ticks.map((t, i) => {
        const y = 156 + i * 52;
        return (
          <g key={t}>
            <Line d={`M322 ${y} h24 v24 h-24 z`} draw={draw} delay={0.35 + i * 0.12} width={1.6} />
            <Line d={`M327 ${y + 12} l6 7 l10 -14`} draw={draw} delay={0.6 + i * 0.12} width={2.2} color={ACCENT} />
            <text x="356" y={y + 18} fill={LINE} fontSize={17}>
              {t}
            </text>
          </g>
        );
      })}
      <text x="300" y="430" fill={LINE} fontSize={18} textAnchor="middle" style={{ fontFamily: "var(--font-v5)" }}>
        Making your home dementia friendly
      </text>
      <Callout x={490} y={80} to={[452, 112]}>
        {"The dementia guide"}
      </Callout>
      <Callout x={40} y={300} to={[140, 300]}>
        Only what it lists
      </Callout>
    </>
  );
}

// What each row's picture shows, if not the plan's first item.
const PICTURED: Partial<Record<HazardType, number>> = { floor_clutter: 1 };

// 4. The fix list: a card with what to get for each finding and the cheapest
// price.
function FixList({ draw, fixes }: { draw: boolean; fixes: HazardType[] }) {
  return (
    <>
      <Line d="M170 70 h260 a20 20 0 0 1 20 20 v300 a20 20 0 0 1 -20 20 h-260 a20 20 0 0 1 -20 -20 v-300 a20 20 0 0 1 20 -20 z" draw={draw} fill="rgba(243,230,211,0.05)" />
      <text x="180" y="118" fill={LINE} fontSize={24} style={{ fontFamily: "var(--font-v5)" }}>
        Living room
      </text>
      {fixes.map((type, i) => {
        const plan = FIX_PLANS[type];
        const cost = materials(plan);
        const name = plan.items[PICTURED[type] ?? 0]?.name ?? "Free step";
        const y = 150 + i * 80;
        return (
          <g key={type}>
            <Line d={`M180 ${y - 12} H420`} draw={draw} delay={0.2 + i * 0.1} width={1} color={ACCENT} />
            <Line d={`M188 ${y} h44 a8 8 0 0 1 8 8 v44 a8 8 0 0 1 -8 8 h-44 a8 8 0 0 1 -8 -8 v-44 a8 8 0 0 1 8 -8 z`} draw={draw} delay={0.3 + i * 0.1} width={1.4} />
            <g transform={`translate(186 ${y + 6}) scale(2)`}>
              <ItemShape type={type} color={LINE} width={0.9} />
            </g>
            <text x="252" y={y + 26} fill={LINE} fontSize={17}>
              {name.length > 18 ? `${name.slice(0, 17)}…` : name}
            </text>
            <text x="252" y={y + 50} fill={ACCENT} fontSize={16}>
              {cost[1] > 0 ? `from ${money(cost)}` : "Free"}
            </text>
          </g>
        );
      })}
      <Callout x={40} y={140} to={[150, 160]}>
        What to get
      </Callout>
      <Callout x={500} y={300} to={[452, 290]}>
        Cheapest price
      </Callout>
    </>
  );
}
