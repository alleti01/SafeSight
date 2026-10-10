"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { SeverityPill } from "@/components/HazardCard";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import { FIX_PLANS, materials, money } from "@/lib/costs";
import { HAZARD_TEXT } from "@/lib/hazards";
import ContrastSwatches from "@/components/ContrastSwatches";
import { plainContrast, type MeasuredHazard } from "@/lib/measure";

// The tour's pace, in seconds.
const START_AFTER = 1.2; // the room in full color first
const PAN = 1.6; // gliding from one thing to the next
const HOLD = 1.1; // pausing on each one after it pops

type Box = MeasuredHazard["box"];
const center = ([x0, y0, x1, y1]: Box) => [(x0 + x1) / 2, (y0 + y1) / 2] as const;
const keepIn = (v: number, half: number, total: number) => (half * 2 >= total ? total / 2 : Math.min(Math.max(v, half), total - half));
const GLIDE = [0.45, 0, 0.55, 1] as const; // ease in and out, gently
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

// The room, as the first thing on the page. The whole height of the photo is
// in view. When it appears it plays by itself: the room softens to grey, the
// camera pans left to right, and each thing that may be a problem pops back
// into color with a label as the camera reaches it. Click a label (or a chip)
// to read why it matters and the cheapest fix.
export default function RoomTour({ photo, children }: { photo: SitePhoto; children?: React.ReactNode }) {
  const reduceMotion = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { width: iw, height: ih } = photo;
  const order = useMemo(() => [...(photo.hazards as MeasuredHazard[])].sort((a, b) => center(a.box)[0] - center(b.box)[0]), [photo.hazards]);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [popped, setPopped] = useState(0); // how many have popped, left to right
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState<number | null>(null); // the one whose card is showing
  const run = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The whole height of the photo fits; it also always covers the width.
  const base = size.w ? Math.max(size.h / ih, size.w / iw) : 1;
  const half = size.w / 2 / base;
  const panTo = useCallback((x: number) => keepIn(x, half, iw), [half, iw]);

  // The camera: which part of the room is in the middle of the view.
  const camX = useMotionValue(iw / 2);
  const grey = useMotionValue(0);
  const transform = useTransform(camX, (x) => {
    if (!size.w) return "none";
    const cx = keepIn(x, half, iw);
    return `translate(${size.w / 2 - cx * base}px, ${size.h / 2 - (ih / 2) * base}px) scale(${base})`;
  });
  // A slight turn of the head toward where we're looking.
  const rotateY = useTransform(camX, [0, iw], [3, -3]);

  // The tour: start at the left, pop each hazard as we reach it, then show the whole room.
  const play = useCallback(async () => {
    if (!size.w) return;
    const me = ++run.current;
    const still = () => run.current === me;
    setOpen(null);
    setPopped(0);
    if (reduceMotion) {
      grey.set(0.7);
      camX.set(iw / 2);
      setPopped(order.length);
      return;
    }
    setPlaying(true);
    grey.set(0);
    camX.set(panTo(0));
    await sleep(START_AFTER);
    if (!still()) return;
    animate(grey, 0.7, { duration: 1.4, ease: GLIDE });
    for (let i = 0; i < order.length; i++) {
      // Each step takes the same calm time, whether or not the room has to pan.
      await Promise.all([animate(camX, panTo(center(order[i].box)[0]), { duration: PAN, ease: GLIDE }), sleep(PAN)]);
      if (!still()) return;
      setPopped(i + 1);
      await sleep(HOLD);
      if (!still()) return;
    }
    await animate(camX, iw / 2, { duration: PAN * 1.2, ease: GLIDE });
    if (still()) setPlaying(false);
  }, [size.w, reduceMotion, grey, camX, iw, order, panTo]);

  // Play once, as soon as we know how big the view is.
  const started = useRef(false);
  useEffect(() => {
    if (size.w && !started.current) {
      started.current = true;
      play();
    }
  }, [size.w, play]);
  useEffect(() => () => void run.current++, []);

  // Clicking a label or chip stops the tour there and opens that one's card.
  const show = useCallback(
    (i: number) => {
      run.current++;
      setPlaying(false);
      grey.set(0.7);
      setPopped((p) => Math.max(p, i + 1));
      setOpen(i);
      const [hx] = center(order[i].box);
      // Keep the object clear of the card: shift the view toward the card's side.
      const side = size.w >= 640 ? (Math.min(340, size.w - 32) / 2) / base : 0;
      animate(camX, panTo(hx + (hx > iw * 0.55 ? -side : side)), reduceMotion ? { duration: 0 } : { duration: 1, ease: GLIDE });
    },
    [order, size.w, base, iw, camX, grey, panTo, reduceMotion],
  );

  const hazard = open !== null ? order[open] : undefined;
  const cardOnLeft = hazard ? center(hazard.box)[0] > iw * 0.55 : false;
  const fade = reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div
      ref={ref}
      role="region"
      aria-label="A room with five things that may be a problem for someone living with dementia, shown one by one."
      className="relative h-full w-full overflow-hidden bg-[var(--ss-ink)] select-none"
      style={{ perspective: 1600 }}
    >
      <motion.div className="absolute inset-0" style={{ rotateY, transformStyle: "preserve-3d" }}>
        <motion.div className="absolute top-0 left-0 origin-top-left" style={{ width: iw, height: ih, transform }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt="A living room with a dark rug, a sofa, shoes on the floor, a floor mirror and a striped runner"
            draggable={false}
            className="absolute inset-0 h-full w-full"
          />
          <motion.img src={photo.src} alt="" draggable={false} className="absolute inset-0 h-full w-full grayscale" style={{ opacity: grey }} />
          {order.map((h, i) => (
            <HazardLayer key={h.hazard_id} photo={photo} hazard={h} on={i < popped} reduceMotion={reduceMotion} />
          ))}
        </motion.div>
      </motion.div>

      {/* Soft edges, like the edge of what you can see. */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_30px_rgba(30,24,18,0.4)]" />

      {/* A label on each thing as it pops. */}
      {order.map((h, i) =>
        i < popped ? (
          <Tag key={h.hazard_id} hazard={h} camX={camX} base={base} size={size} iw={iw} ih={ih} active={open === i} onClick={() => (open === i ? setOpen(null) : show(i))} reduceMotion={reduceMotion} />
        ) : null,
      )}

      {/* Anything the page wants over the room: a title, say. */}
      <AnimatePresence>
        {open === null && (
          <motion.div className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      <span
        className="absolute bottom-[68px] left-4 rounded-full bg-white/85 px-3.5 py-1.5 text-[13px] font-medium backdrop-blur sm:top-4 sm:right-4 sm:bottom-auto sm:left-auto"
        aria-live="polite"
      >
        Found {popped} of {order.length}
      </span>

      {/* What we're looking at. */}
      <AnimatePresence>
        {hazard && (
          <motion.div
            key={hazard.hazard_id}
            className={`absolute bottom-[112px] w-[calc(100%-32px)] sm:top-4 sm:bottom-20 sm:flex sm:w-[340px] sm:flex-col sm:justify-center ${
              cardOnLeft ? "left-4" : "left-4 sm:right-4 sm:left-auto"
            }`}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={fade}
          >
            <FindingCard hazard={hazard} onClose={() => setOpen(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Every thing found, in order; replay the tour. */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4">
        <ul className="m-0 flex min-w-0 flex-1 list-none gap-2 overflow-x-auto p-0 [scrollbar-width:none] sm:justify-center" aria-label="Things that may be a problem, left to right">
          {order.map((h, i) => {
            const isFound = i < popped;
            return (
              <li key={h.hazard_id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => (open === i ? setOpen(null) : show(i))}
                  aria-pressed={open === i}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] whitespace-nowrap shadow-[0_6px_16px_rgba(30,24,18,0.2)] backdrop-blur transition-colors ${
                    open === i ? "bg-[var(--ss-ink)] text-white" : "bg-white/85 hover:bg-white"
                  }`}
                >
                  <span className={`grid size-5 place-items-center rounded-full text-[11px] ${isFound ? "bg-[var(--ss-accent)] text-white" : "border border-current"}`}>
                    {isFound ? "✓" : i + 1}
                  </span>
                  {isFound ? HAZARD_TEXT[h.type].name : "…"}
                </button>
              </li>
            );
          })}
        </ul>
        {/* Hidden by CSS (not by a check in the browser) so server and browser agree. */}
        <button
          type="button"
          onClick={play}
          disabled={playing}
          className="shrink-0 rounded-full bg-white/85 px-4 py-2 text-[13px] whitespace-nowrap shadow-[0_6px_16px_rgba(30,24,18,0.2)] backdrop-blur hover:bg-white disabled:opacity-0 motion-reduce:hidden"
        >
          ↻ Replay
        </button>
      </div>
    </div>
  );
}

// One hazard over the room: back in color, with a soft glow, once it pops.
function HazardLayer({ photo, hazard, on, reduceMotion }: { photo: SitePhoto; hazard: MeasuredHazard; on: boolean; reduceMotion: boolean }) {
  const mask = `url("${hazard.outline_url}")`;
  const masked = { maskImage: mask, WebkitMaskImage: mask, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" };
  return (
    <>
      <motion.img
        src={photo.src}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full"
        style={masked}
        initial={false}
        animate={{ opacity: on ? 1 : 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="absolute inset-0 bg-white"
        style={masked}
        initial={false}
        animate={on && !reduceMotion ? { opacity: [0, 0.4, 0] } : { opacity: 0 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />
    </>
  );
}

// A label that pops up on its object and moves with the room.
function Tag({
  hazard,
  camX,
  base,
  size,
  iw,
  ih,
  active,
  onClick,
  reduceMotion,
}: {
  hazard: MeasuredHazard;
  camX: MotionValue<number>;
  base: number;
  size: { w: number; h: number };
  iw: number;
  ih: number;
  active: boolean;
  onClick: () => void;
  reduceMotion: boolean;
}) {
  const [hx, hy] = center(hazard.box);
  // Keep the label inside the view even when its object is at the edge.
  const x = useTransform(camX, (c) => Math.min(Math.max((hx - keepIn(c, size.w / 2 / base, iw)) * base + size.w / 2, 110), size.w - 110));
  const y = (hy - ih / 2) * base + size.h / 2;
  const dot = { high: "var(--danger)", medium: "var(--warn)", low: "var(--calm)" }[hazard.severity];
  return (
    <motion.div className="absolute top-0 left-0" style={{ x, y }}>
      <motion.button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium whitespace-nowrap shadow-[0_10px_24px_rgba(30,24,18,0.3)] backdrop-blur ${
          active ? "bg-[var(--ss-ink)] text-white" : "bg-white/92 text-[var(--ss-ink)] hover:bg-white"
        }`}
        initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 18 }}
      >
        <span className="size-2.5 rounded-full" style={{ background: dot }} />
        {HAZARD_TEXT[hazard.type].name}
      </motion.button>
    </motion.div>
  );
}

// Why it may be a problem and the cheapest fix.
function FindingCard({ hazard, onClose }: { hazard: MeasuredHazard; onClose: () => void }) {
  return (
    <div className="flex max-h-full flex-col gap-3 overflow-auto rounded-[22px] bg-[var(--ss-card)]/92 p-5 text-[var(--ss-ink)] shadow-[0_20px_50px_rgba(30,24,18,0.35)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <SeverityPill severity={hazard.severity} />
      </div>
      <h3 className="m-0 text-[22px] leading-tight font-medium">{HAZARD_TEXT[hazard.type].name}</h3>
      {plainContrast(hazard) ? (
        <ContrastSwatches c={plainContrast(hazard)!} size="sm" />
      ) : (
        <p className="m-0 text-[14px] leading-relaxed text-[var(--ss-ink-2)]">{HAZARD_TEXT[hazard.type].why}</p>
      )}
      <p className="m-0 rounded-[14px] bg-[var(--ss-soft)] px-3 py-2 text-[14px] leading-relaxed">
        {FIX_PLANS[hazard.type].free ? (
          <>
            <span className="font-medium">Free today:</span> {FIX_PLANS[hazard.type].free}
          </>
        ) : (
          <>
            <span className="font-medium">Try this:</span> {HAZARD_TEXT[hazard.type].fix}
          </>
        )}
        {materials(FIX_PLANS[hazard.type])[1] > 0 && (
          <span className="block text-[var(--ss-ink-3)]">Cheapest fix: {money(materials(FIX_PLANS[hazard.type]))}</span>
        )}
      </p>
      <button type="button" onClick={onClose} className="self-start text-[14px] font-medium underline underline-offset-4">
        Close
      </button>
    </div>
  );
}
