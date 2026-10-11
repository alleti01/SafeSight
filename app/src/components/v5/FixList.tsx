"use client";

import { useRef, useState } from "react";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import { FindingTags, fixLine, Spotlight, useSize } from "@/components/v5/Finding";
import type { HazardType } from "@/lib/contract";
import { HAZARD_TEXT } from "@/lib/hazards";
import type { MeasuredHazard } from "@/lib/measure";

export interface Finding {
  type: HazardType;
  room: string;
  photo: SitePhoto;
  hazard: MeasuredHazard;
}

// The findings as one row across the whole screen (trajectory.ai's platform
// row), as tall as its container. At rest the six columns share the width, each with its name and a
// strip of its photo. Pointing at one (or tabbing to it) widens it and lifts
// it above the row to show the photo with the finding spotlit, why it may be
// a problem, how sure we are and the fix; moving off the row closes it again.
// Phones get a rail of open cards to swipe through.
export function FindingsRow({ findings }: { findings: Finding[] }) {
  const [active, setActive] = useState<number | null>(null);
  const n = findings.length;
  // The open card is laid out at its final size (36% of the row, full height)
  // the moment it opens, and its column slides open over it like a drawer, so
  // the photo inside is drawn once and never resized mid-animation.
  const [row, { w: rowW, h: rowH }] = useSize<HTMLDivElement>();
  // Open the column under the pointer only when the pointer itself moves: a
  // column opening slides its neighbours' edges, and reacting to that (a still
  // pointer suddenly over another column) made two columns flick back and
  // forth. A short pause after each switch keeps a wobble at an edge steady.
  const last = useRef({ x: -1, y: -1, at: 0 });
  const point = (i: number, e: React.MouseEvent) => {
    const l = last.current;
    if (e.clientX === l.x && e.clientY === l.y) return;
    l.x = e.clientX;
    l.y = e.clientY;
    if (i === active) return;
    const now = performance.now();
    if (now - l.at < 150) return;
    l.at = now;
    setActive(i);
  };
  const width = (i: number) => (active === null ? `${100 / n}%` : i === active ? "36%" : `${64 / (n - 1)}%`);
  const height = (i: number) => (active === null || i === active ? "100%" : "52%");

  return (
    <>
      <div
        className="hidden h-full min-h-[380px] items-end border-y border-[var(--ss-ink)]/20 lg:flex"
        ref={row}
        role="region"
        aria-label="What we found in the example room"
        onMouseLeave={() => setActive(null)}
      >
        {findings.map((f, i) => {
          const on = i === active;
          return (
            <div
              key={`${f.type}-${f.hazard.hazard_id}`}
              tabIndex={0}
              aria-expanded={on}
              aria-label={HAZARD_TEXT[f.type].name}
              className="relative shrink-0 overflow-hidden border-l border-[var(--ss-ink)]/20 transition-[width,height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none first:border-l-0 focus-visible:ring-2 focus-visible:ring-[var(--ss-accent)] focus-visible:ring-inset motion-reduce:transition-none"
              style={{ width: width(i), height: height(i) }}
              onMouseMove={(e) => point(i, e)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setActive((a) => (a === i ? null : a))}
            >
              {on ? (
                rowW > 0 && (
                  <div className="absolute bottom-0 left-0" style={{ width: Math.round(rowW * 0.36), height: rowH }}>
                    <Open f={f} n={i + 1} total={n} />
                  </div>
                )
              ) : (
                <span className="flex h-full w-full cursor-pointer flex-col bg-[var(--ss-soft)] transition-colors hover:bg-[#e9dccb]">
                  <span className="self-end p-4 font-v5 text-[13px] text-[var(--ss-ink-3)]">
                    {i + 1} of {n}
                  </span>
                  <Vertical text={POINTS[f.type]} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <Strips findings={findings} />
    </>
  );
}

// Narrow screens: the row turned on its side. Each finding is a strip across
// the screen with its name in large type; tapping one opens it into its card
// (one open at a time). It opens with a CSS row transition, not a measured
// height animation, so it can't interrupt a scroll under way.
function Strips({ findings }: { findings: Finding[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const n = findings.length;
  return (
    <div className="border-y border-[var(--ss-ink)]/20 lg:hidden">
      {findings.map((f, i) => {
        const on = open === i;
        return (
          <div key={`${f.type}-${f.hazard.hazard_id}`} className="border-t border-[var(--ss-ink)]/20 first:border-t-0">
            <button
              type="button"
              aria-expanded={on}
              onClick={() => setOpen(on ? null : i)}
              className={`flex w-full items-end justify-between gap-3 px-5 text-left transition-colors duration-300 ${
                on ? "bg-white pt-5 pb-1" : "bg-[var(--ss-soft)] py-4 active:bg-[#e9dccb]"
              }`}
            >
              <span className="font-v5 text-[clamp(28px,9vw,40px)] leading-[0.95] font-medium tracking-[-0.02em]">{POINTS[f.type]}</span>
              <span className="shrink-0 pb-1 font-v5 text-[13px] text-[var(--ss-ink-3)]">
                {i + 1} of {n}
              </span>
            </button>
            <div
              aria-hidden={!on}
              inert={!on}
              className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <Open f={f} n={i + 1} total={n} strip />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// What each finding points out, in a few words, for the closed columns.
const POINTS: Record<HazardType, string> = {
  dark_rug: "Dark rug",
  loose_rug: "Loose rug",
  shiny_floor: "Shiny floor",
  patterned_floor: "Busy pattern",
  bathroom_fitting_blends_in: "White on white",
  furniture_blends_in: "Sofa blends in",
  mirror: "Mirror",
  stair_edge_hard_to_see: "Step edge",
  floor_clutter: "Shoes & cords",
  toilet_lookalike: "Looks like a toilet",
};

// A closed column's label: large, reading bottom to top, sized to fill the
// column's height without spilling out of its width.
function Vertical({ text }: { text: string }) {
  // Sized from the column's own box in CSS (container units), so nothing has
  // to be measured or redrawn while the columns widen and shrink.
  const size = `max(14px, min(72px, calc(90cqh / ${(text.length * 0.6).toFixed(2)}), 62cqw))`;
  return (
    <span className="relative block min-h-0 flex-1 overflow-hidden [container-type:size]">
      <span
        className="absolute bottom-4 left-3 font-v5 leading-[0.9] font-medium tracking-[-0.02em] whitespace-nowrap text-[var(--ss-ink)] [writing-mode:vertical-rl]"
        style={{ fontSize: size, transform: "rotate(180deg)" }}
      >
        {text}
      </span>
    </span>
  );
}

// An open finding: its name, why it may be a problem, the photo spotlit, and
// the answers as tags (open each for why), with the fix price.
// `strip`: inside a phone strip, which already shows the name and number.
function Open({ f, n, total, strip = false }: { f: Finding; n: number; total: number; strip?: boolean }) {
  const [frame, { w: fw, h: fh }] = useSize<HTMLDivElement>();
  return (
    <div className={`relative flex h-full flex-col gap-3 bg-white p-5 ${strip ? "pt-2" : "shadow-[0_-20px_50px_rgba(62,54,46,0.08)]"}`}>
      <div className={`flex items-start justify-between gap-3 ${strip ? "hidden" : ""}`}>
        <span className="font-v5 text-[24px] leading-tight font-medium tracking-[-0.01em]">{HAZARD_TEXT[f.type].name}</span>
        <span className="shrink-0 pt-1 font-v5 text-[13px] text-[var(--ss-ink-3)]">
          {n} of {total}
        </span>
      </div>
      <p className="m-0 line-clamp-2 text-[14px] leading-relaxed text-[var(--ss-ink-2)]">{HAZARD_TEXT[f.type].why}</p>
      {/* The photo takes whatever height the card has left (16:9 on phones). */}
      <div ref={frame} className="relative w-full overflow-hidden rounded-[12px] bg-[var(--ss-line)] max-lg:aspect-video lg:min-h-0 lg:flex-1">
        {fw > 0 && fh > 0 && <Spotlight photo={f.photo} hazard={f.hazard} w={fw} h={fh} />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <FindingTags up hazard={f.hazard} photo={f.photo} />
        <span className="ml-auto text-[13px] font-medium text-[var(--ss-ink-2)]">{fixLine(f.type)}</span>
      </div>
    </div>
  );
}
