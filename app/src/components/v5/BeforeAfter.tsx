"use client";

import { useRef, useState } from "react";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import { Eyebrow, H2 } from "@/components/v5/Chrome";
import { fixLine } from "@/components/v5/Finding";
import type { HazardType } from "@/lib/contract";
import { FIX_PLANS } from "@/lib/costs";
import { HAZARD_TEXT } from "@/lib/hazards";

// The fixes shown, with their "after" pictures: Abhi's fix preview run on the
// example room through our outlines (backend/tools/make_after_previews.py).
const SHOWN: { type: HazardType; label: string; after: string }[] = [
  { type: "dark_rug", label: "Dark rug", after: "/site/after/room-wide-7.jpg" },
  { type: "mirror", label: "Mirror", after: "/site/after/room-wide-3.jpg" },
];

/**
 * The example room now and after its cheapest fix, on one photo with a divider
 * to drag (or arrow keys on the handle). The divider starts through the middle
 * of the finding, so it's half fixed; on narrow screens the photo is cropped
 * around the finding, and the finding's middle stays at the same place in both
 * pictures (object-position puts that point of the photo at that point of the
 * frame), so they always line up.
 */
export default function BeforeAfter({ room }: { room: SitePhoto }) {
  const options = SHOWN.flatMap((s) => {
    const hazard = room.hazards.find((h) => h.type === s.type);
    return hazard ? [{ ...s, hazard }] : [];
  });
  const [pick, setPick] = useState(0);
  const shown = options[pick];
  const middle = (o: (typeof options)[number]) => [
    ((o.hazard.box[0] + o.hazard.box[2]) / 2 / room.width) * 100,
    ((o.hazard.box[1] + o.hazard.box[3]) / 2 / room.height) * 100,
  ];
  const [pos, setPos] = useState(() =>
    options[0] ? middle(options[0])[0] : 50,
  );
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  if (!shown) return null;

  const [cx, cy] = middle(shown);
  const at = `${cx.toFixed(2)}% ${cy.toFixed(2)}%`;
  const moveTo = (clientX: number) => {
    const r = frame.current?.getBoundingClientRect();
    if (r)
      setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };
  const choose = (i: number) => {
    setPick(i);
    setPos(middle(options[i])[0]);
  };
  const plan = FIX_PLANS[shown.type];

  return (
    <div className="flex w-full flex-col gap-8 px-5 py-20 sm:px-10 sm:py-28">
      <div>
        <Eyebrow>Before and after</Eyebrow>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <H2>See the fix before you buy it</H2>
          <p className="m-0 max-w-[460px] shrink-0 text-[16px] leading-relaxed text-[var(--ss-ink-2)]">
            Drag across the photo to compare the room now with the room after
            the cheapest fix.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {options.length > 1 && (
          <div
            role="group"
            aria-label="Which fix"
            className="flex flex-wrap gap-2"
          >
            {options.map((o, i) => (
              <button
                key={o.type}
                type="button"
                aria-pressed={i === pick}
                onClick={() => choose(i)}
                className={`rounded-full border px-4 py-2 text-[14px] transition-colors ${
                  i === pick
                    ? "border-[var(--ss-ink)] bg-[var(--ss-ink)] text-white"
                    : "border-[var(--ss-line)] bg-white text-[var(--ss-ink-2)] hover:border-[var(--ss-ink)]/40 hover:text-[var(--ss-ink)]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        <div
          ref={frame}
          className="relative aspect-[4/3] w-full cursor-ew-resize touch-pan-y overflow-hidden rounded-[20px] bg-[var(--ss-line)] select-none sm:aspect-[16/9] lg:aspect-[1916/821]"
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            moveTo(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && moveTo(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={room.src}
            alt={`The room now, with the ${shown.label.toLowerCase()}`}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: at }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={shown.after}
            src={shown.after}
            alt={`The room after: ${plan.fix.toLowerCase()}`}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: at, clipPath: `inset(0 0 0 ${pos}%)` }}
          />

          <span className="pointer-events-none absolute top-4 left-4 rounded-full bg-black/55 px-3 py-1 text-[13px] font-medium text-white backdrop-blur-md">
            Before
          </span>
          <span className="pointer-events-none absolute top-4 right-4 rounded-full bg-white/90 px-3 py-1 text-[13px] font-medium text-[var(--ss-ink)]">
            After
          </span>

          {/* The divider and its handle. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(0,0,0,0.35)]"
            style={{ left: `${pos}%` }}
          />
          <button
            type="button"
            role="slider"
            aria-label="Compare before and after"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            aria-valuetext={`${Math.round(100 - pos)}% after`}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 20 : 5;
              const next = {
                ArrowLeft: pos - step,
                ArrowRight: pos + step,
                Home: 0,
                End: 100,
              }[e.key];
              if (next === undefined) return;
              e.preventDefault();
              setPos(Math.min(100, Math.max(0, next)));
            }}
            className="absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[var(--ss-ink)] shadow-[0_6px_20px_rgba(0,0,0,0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ left: `${pos}%` }}
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path
                d="M9 7l-5 5 5 5M15 7l5 5-5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <p className="m-0 text-[17px]">
            <span className="font-medium">{HAZARD_TEXT[shown.type].name}:</span>{" "}
            {plan.fix.charAt(0).toLowerCase() + plan.fix.slice(1)}.
          </p>
          <p className="m-0 shrink-0 text-[14px] text-[var(--ss-ink-3)]">
            {fixLine(shown.type)} · preview drawn on the photo
          </p>
        </div>
      </div>
    </div>
  );
}
