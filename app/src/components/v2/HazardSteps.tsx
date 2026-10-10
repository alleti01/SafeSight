"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import type { Hazard } from "@/lib/contract";

export interface HazardStep {
  photo: SitePhoto;
  hazard: Hazard;
  title: string;
  body: string;
  note: string;
}

const DOTS = 28;

// The page scrolls past a pinned card; each stretch of scrolling brings up the
// next hazard: its photo (grey, with the hazard in color), what it can mean,
// and the cheapest fix.
export default function HazardSteps({ steps }: { steps: HazardStep[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    setProgress(p);
    setActive(Math.min(steps.length - 1, Math.floor(p * steps.length)));
  });
  const step = steps[active];
  const fade = reduceMotion ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div ref={ref} className="relative" style={{ height: `${steps.length * 90}svh` }}>
      <div className="sticky top-2.5 h-[calc(100svh-20px)] overflow-hidden rounded-[18px] bg-[#e9eaec]">
        {/* The current photo, blurred, as the room's light behind everything. */}
        <AnimatePresence initial={false}>
          <motion.img
            key={step.photo.src}
            src={step.photo.src}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-[60px] saturate-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={fade}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-white/40" />

        <div className="relative flex h-full flex-col items-center px-4 pt-[clamp(20px,5svh,48px)] sm:px-10">
          <h2 className="m-0 text-center font-v2-display text-[clamp(34px,7.4vw,112px)] leading-[0.86] font-semibold tracking-[-0.01em] text-[#101113] uppercase">
            What can it find?
            <br />
            <span className="text-[#101113]/85">More than you&apos;d notice.</span>
          </h2>

          <div className="relative mt-4 grid w-full flex-1 md:mt-[-0.4em] grid-cols-1 items-start gap-6 pb-10 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-10">
            {/* Step number and how far through the list we are. */}
            <div className="hidden items-center gap-3 md:flex" aria-hidden="true">
              <span className="font-v2-display text-2xl text-[#101113]">0{active + 1}</span>
              <span className="flex flex-1 items-center gap-[5px]">
                {Array.from({ length: DOTS }, (_, i) => (
                  <span
                    key={i}
                    className={`size-[3px] rounded-full transition-colors ${i / DOTS <= progress ? "bg-[#101113]" : "bg-[#101113]/25"}`}
                  />
                ))}
              </span>
            </div>

            <div className="relative mx-auto aspect-[3/4] w-[min(240px,52vw)] overflow-hidden rounded-[10px] bg-[#cfd1d4] shadow-[0_30px_60px_rgba(0,0,0,0.25)] md:w-[min(320px,24vw)]">
              <AnimatePresence initial={false}>
                <motion.div
                  key={active}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fade}
                >
                  <Card step={step} />
                </motion.div>
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                className="mx-auto flex max-w-[340px] flex-col gap-3 text-center md:mx-0 md:text-left"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={fade}
              >
                <span className="font-v2-body text-[11px] tracking-[0.12em] text-[#101113]/60 uppercase md:hidden">
                  0{active + 1} / 0{steps.length}
                </span>
                <h3 className="m-0 font-v2-display text-[clamp(24px,2.2vw,32px)] leading-none font-normal text-[#101113]">{step.title}</h3>
                <p className="m-0 font-v2-body text-[14px] leading-[1.5] text-[#101113]/75">{step.body}</p>
                <p className="m-0 font-v2-body text-[12px] tracking-wide text-[#e0261f] uppercase">{step.note}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// Portrait crop centered on the hazard: grey photo, hazard in color. The mask
// is sized and placed exactly like the photo so the color stays on its object.
function Card({ step }: { step: HazardStep }) {
  const { photo, hazard } = step;
  const [x0, y0, x1, y1] = hazard.box;
  const position = `${(((x0 + x1) / 2) / photo.width) * 100}% ${(((y0 + y1) / 2) / photo.height) * 100}%`;
  const mask = `url("${hazard.outline_url}")`;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt="" className="absolute inset-0 h-full w-full object-cover grayscale" style={{ objectPosition: position }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={step.title}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          objectPosition: position,
          maskImage: mask,
          WebkitMaskImage: mask,
          maskSize: "cover",
          WebkitMaskSize: "cover",
          maskPosition: position,
          WebkitMaskPosition: position,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }}
      />
    </>
  );
}
