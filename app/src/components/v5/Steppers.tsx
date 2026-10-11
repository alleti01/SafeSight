"use client";

import { motion, useReducedMotion } from "motion/react";
import { Eyebrow, H2 } from "@/components/v5/Chrome";
import { useStepScroll } from "@/lib/useStepScroll";

// A section told in steps: it pins and moves one step per stretch of scrolling
// (useStepScroll), on every screen; a step can also be tapped.

export interface Step {
  title: string;
  body: string;
  /** A short tag shown on the panel, e.g. "Your phone". */
  tag?: string;
}

interface Intro {
  eyebrow: string;
  title: string;
  intro: string;
  steps: Step[];
}

// Line color and glow for drawings on the dark panel.
export const LINE = "#f3e6d3";
export const ACCENT = "#d9b98f";
export const PANEL = "#2b2520";
const GLOW =
  "drop-shadow(0 0 6px rgba(243,230,211,0.55)) drop-shadow(0 0 18px rgba(243,230,211,0.18))";

/**
 * Laid out like trajectory.ai's "The Vision": the heading top left, the steps
 * as numbers along the bottom left (the current one large, with its title and
 * sentence), and on the right a dark panel with a glowing line drawing of
 * that step and its tag. The drawings sit on one loop, joined by arrows from
 * each to the next, and the view pans along it as the step changes. Each
 * drawing uses a 600×480 frame (with room to the sides for labels), gets
 * `draw` to animate its lines in, and gives the box of its main shape in
 * `boxes`, so the arrows meet its edges.
 */
export function PanelSteps({
  eyebrow,
  title,
  intro,
  steps,
  drawing,
  boxes = [],
}: Intro & {
  drawing: (i: number, draw: boolean) => React.ReactNode;
  boxes?: Box[];
}) {
  const reduce = useReducedMotion();
  const { track, active, pick } = useStepScroll(steps.length);
  const st = steps[active];
  return (
    <>
      {/* Narrow screens: the heading scrolls by first, and only the drawing
          and the steps pin, so they fit the screen. */}
      <div className="px-5 pt-20 sm:px-10 sm:pt-24 lg:hidden">
        <Eyebrow>{eyebrow}</Eyebrow>
        <H2>{title}</H2>
        <p className="m-0 mt-5 max-w-[400px] text-[17px] leading-relaxed text-[var(--ss-ink-2)]">
          {intro}
        </p>
      </div>
      {/* The pinned stretch gets a little longer with each step. */}
      <div
        ref={track}
        className="relative h-[var(--track)]"
        style={
          { "--track": `${120 + 25 * steps.length}vh` } as React.CSSProperties
        }
      >
        <div className="sticky top-0 h-svh">
          {/* Wide screens: the screen's full width with 40px gutters, and the
            height of the screen below the header, so the steps never fall
            off the bottom. Narrow screens: the drawing, the step numbers in
            a row, then the current step, centred under the header. */}
          <div className="grid h-full w-full gap-10 px-5 sm:px-10 max-lg:flex max-lg:flex-col max-lg:justify-center max-lg:gap-5 max-lg:pt-[84px] max-lg:pb-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-12 lg:pt-[96px] lg:pb-6">
            <div className="flex min-h-0 flex-col justify-between gap-6 max-lg:contents">
              <div className="max-lg:hidden">
                <Eyebrow>{eyebrow}</Eyebrow>
                <H2>{title}</H2>
                <p className="m-0 mt-5 max-w-[400px] text-[17px] leading-relaxed text-[var(--ss-ink-2)] lg:[@media(max-height:820px)]:hidden">
                  {intro}
                </p>
              </div>

              <ol className="m-0 flex list-none flex-col gap-1 p-0 max-lg:order-2 max-lg:flex-row max-lg:items-end max-lg:gap-5">
                {steps.map((p, i) => {
                  const on = i === active;
                  return (
                    <li key={p.title}>
                      <button
                        type="button"
                        aria-current={on ? "step" : undefined}
                        onClick={() => pick(i)}
                        className={`block w-full border-l-2 pl-5 text-left transition-[padding,border-color] duration-500 max-lg:border-b-2 max-lg:border-l-0 max-lg:pb-1 max-lg:pl-0 ${on ? "border-[var(--ss-ink)] py-1" : "border-transparent"}`}
                      >
                        <span
                          className={`block font-v5 leading-none tracking-[-0.03em] transition-[font-size,color] duration-500 motion-reduce:transition-none ${on ? "text-[56px] text-[var(--ss-ink)] max-lg:text-[40px]" : "text-[26px] text-[var(--ss-faint)] hover:text-[var(--ss-ink-3)] max-lg:text-[22px]"}`}
                        >
                          {i + 1}
                        </span>
                        {on && (
                          <motion.span
                            key={p.title}
                            className="block max-lg:hidden"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={
                              reduce
                                ? { duration: 0 }
                                : { duration: 0.4, delay: 0.1 }
                            }
                          >
                            <span className="mt-2 block font-v5 text-[24px] leading-tight font-medium tracking-[-0.01em]">
                              {p.title}
                            </span>
                            <span className="mt-2 block max-w-[400px] text-[16px] leading-relaxed text-[var(--ss-ink-2)]">
                              {p.body}
                            </span>
                          </motion.span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <motion.div
                key={`now-${active}`}
                className="min-h-[8.5rem] max-lg:order-3 lg:hidden"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.4 }}
                aria-live="polite"
              >
                <span className="block font-v5 text-[22px] leading-tight font-medium tracking-[-0.01em]">
                  {st.title}
                </span>
                <span className="mt-2 block text-[16px] leading-relaxed text-[var(--ss-ink-2)]">
                  {st.body}
                </span>
              </motion.div>
            </div>

            {/* The panel: grid lines, the drawings on their loop, and the tag. */}
            <div
              className="relative shrink-0 overflow-hidden rounded-[20px] max-lg:order-1 max-lg:aspect-[4/3] lg:h-full lg:min-h-[360px]"
              style={{ background: PANEL }}
            >
              <span className="absolute inset-y-0 left-[16%] w-px bg-white/[0.06]" />
              <span className="absolute inset-y-0 right-[10%] w-px bg-white/[0.06]" />
              <span className="absolute inset-x-0 top-[14%] h-px bg-white/[0.06]" />
              <span className="absolute inset-x-0 bottom-[14%] h-px bg-white/[0.06]" />

              <div className="absolute inset-0 grid place-items-center">
                <svg
                  viewBox="-90 0 780 480"
                  className="h-[78%] w-[94%] overflow-visible"
                  role="img"
                  aria-label={`${st.title}: ${st.body}`}
                >
                  {/* The world: every step's drawing on one loop, the view panning to the current one. */}
                  <motion.g
                    initial={false}
                    animate={{
                      x: 300 - spot(active, steps.length)[0],
                      y: 240 - spot(active, steps.length)[1],
                    }}
                    transition={{
                      duration: reduce ? 0 : 1.1,
                      ease: [0.65, 0, 0.35, 1],
                    }}
                  >
                    <Loop count={steps.length} boxes={boxes} />
                    {steps.map((_, i) => {
                      const [x, y] = spot(i, steps.length);
                      const on = i === active;
                      return (
                        <motion.g
                          key={i}
                          transform={`translate(${x - 300} ${y - 240})`}
                          initial={false}
                          animate={{ opacity: on ? 1 : 0.22 }}
                          transition={{ duration: reduce ? 0 : 0.6 }}
                          style={{ filter: GLOW }}
                        >
                          {/* Re-mounted when it becomes current, so its lines draw in again. */}
                          <g key={on ? `on-${active}` : "off"}>
                            {drawing(i, on && !reduce)}
                          </g>
                        </motion.g>
                      );
                    })}
                  </motion.g>
                </svg>
              </div>

              {st.tag && (
                <span
                  className="absolute bottom-[6%] left-[16%] -translate-x-1/2 rounded-[12px] border border-[#f3e6d3]/60 px-4 py-1.5 font-v5 text-[22px] whitespace-nowrap text-[#f3e6d3] max-lg:left-6 max-lg:translate-x-0 max-lg:text-[16px]"
                  style={{ textShadow: "0 0 12px rgba(243,230,211,0.6)" }}
                >
                  {st.tag}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** A line that draws itself in (or is simply there, with reduced motion). */
export function Line({
  d,
  draw,
  delay = 0,
  dash,
  width = 2.2,
  color = LINE,
  fill = "none",
}: {
  d: string;
  draw: boolean;
  delay?: number;
  dash?: string;
  width?: number;
  color?: string;
  fill?: string;
}) {
  return (
    <motion.path
      d={d}
      fill={fill}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dash}
      // The same first frame on the server and in the browser; when it
      // shouldn't animate (reduced motion, or not the current step) it just
      // finishes at once.
      initial={dash ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
      animate={dash ? { opacity: 1 } : { pathLength: 1, opacity: 1 }}
      transition={
        draw
          ? { duration: 1, delay, ease: [0.22, 1, 0.36, 1] }
          : { duration: 0 }
      }
    />
  );
}

/** A small label with a dot and a leader line to what it names. */
export function Callout({
  x,
  y,
  to,
  children,
}: {
  x: number;
  y: number;
  to: [number, number];
  children: string;
}) {
  const left = to[0] > x;
  return (
    <g>
      <path
        d={`M${x + (left ? 6 : -6)} ${y - 5} L${to[0]} ${to[1]}`}
        stroke={LINE}
        strokeOpacity={0.45}
        strokeWidth={1.2}
        fill="none"
      />
      <circle
        cx={x + (left ? 6 : -6)}
        cy={y - 5}
        r={3.5}
        fill={LINE}
        fillOpacity={0.6}
      />
      <text
        x={x + (left ? -4 : 4)}
        y={y}
        fill={LINE}
        fontSize={19}
        textAnchor={left ? "end" : "start"}
        style={{ fontFamily: "var(--font-v5)" }}
      >
        {children}
      </text>
    </g>
  );
}

// The steps' drawings sit on one big loop (an ellipse), the first at the
// left and the rest going round clockwise; each drawing is 600×480 around its
// spot. The view pans along the loop from one to the next.
// The loop grows with the number of steps so neighbours stay well apart.
const radii = (n: number) =>
  [1000 + 200 * Math.max(0, n - 4), 650 + 125 * Math.max(0, n - 4)] as const;
const angle = (i: number, n: number) => Math.PI + (2 * Math.PI * i) / n;
// Rounded, so the server and the browser draw exactly the same numbers.
const r2 = (v: number) => Math.round(v * 100) / 100;
function spot(i: number, n: number): [number, number] {
  const a = angle(i, n);
  const [rx, ry] = radii(n);
  return [r2(rx * Math.cos(a)), r2(ry * Math.sin(a))];
}

export type Box = [number, number, number, number];

// The loop's connectors: from the edge of each drawing's main shape (`boxes`,
// in its 600×480 frame) to the edge of the next one's, starting at a small
// ring and ending in an arrow; the last leads back to the first.
function Loop({ count, boxes }: { count: number; boxes: Box[] }) {
  const pad = 10;
  // Is a point (on the loop) inside drawing k's main shape?
  const inside = (k: number, x: number, y: number) => {
    const [cx, cy] = spot(k % count, count);
    const [x0, y0, x1, y1] = boxes[k % count] ?? [120, 80, 480, 400];
    const lx = x - cx + 300;
    const ly = y - cy + 240;
    return lx > x0 - pad && lx < x1 + pad && ly > y0 - pad && ly < y1 + pad;
  };
  const parts = Array.from({ length: count }, (_, i) => {
    const a0 = angle(i, count);
    const a1 = angle(i + 1, count);
    const [rx, ry] = radii(count);
    const all = Array.from({ length: 401 }, (_, k) => {
      const a = a0 + ((a1 - a0) * k) / 400;
      return [r2(rx * Math.cos(a)), r2(ry * Math.sin(a))] as const;
    });
    const pts = all.filter(
      ([x, y]) => !inside(i, x, y) && !inside(i + 1, x, y),
    );
    const d = pts
      .map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(" ");
    // The arrowhead, along the curve's direction at its end.
    const [ex, ey] = pts[pts.length - 1];
    const [px, py] = pts[pts.length - 6];
    const len = Math.hypot(ex - px, ey - py);
    const [ux, uy] = [(ex - px) / len, (ey - py) / len];
    const head = `M${r2(ex - ux * 18 - uy * 11)} ${r2(ey - uy * 18 + ux * 11)} L${ex} ${ey} L${r2(ex - ux * 18 + uy * 11)} ${r2(ey - uy * 18 - ux * 11)}`;
    return { d, head, start: pts[0], mid: pts[Math.floor(pts.length / 2)] };
  });
  return (
    <g
      fill="none"
      stroke={LINE}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: GLOW }}
      opacity={0.8}
    >
      {parts.map((p, i) => (
        <g key={i}>
          <path d={p.d} />
          <path d={p.head} />
          <circle cx={p.start[0]} cy={p.start[1]} r={6} fill={PANEL} />
          <circle cx={p.mid[0]} cy={p.mid[1]} r={11} fill={PANEL} />
        </g>
      ))}
    </g>
  );
}
