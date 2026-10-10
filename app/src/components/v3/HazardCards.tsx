"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import type { Hazard, HazardType } from "@/lib/contract";
import { HAZARD_TEXT } from "@/lib/hazards";
import { measureText, type MeasuredHazard } from "@/lib/measure";

export interface HazardCardData {
  type: HazardType;
  photo: SitePhoto;
  /** Missing when the starting model can't find this kind yet. */
  hazard?: MeasuredHazard;
}

const TABS: { label: string; types: HazardType[] | null }[] = [
  { label: "All", types: null },
  { label: "Floors", types: ["dark_rug", "loose_rug", "shiny_floor", "patterned_floor", "floor_clutter"] },
  { label: "Bathroom", types: ["bathroom_fitting_blends_in", "toilet_lookalike"] },
  { label: "Furniture", types: ["furniture_blends_in"] },
  { label: "Mirrors", types: ["mirror"] },
  { label: "Stairs", types: ["stair_edge_hard_to_see"] },
];

const PASTELS = ["#fdbb8d", "#a2c98b", "#c4c4c4", "#9fa1c6"];

// The ten hazards as cards, filtered by tab. Where the pipeline found the
// hazard, the object sits on its card, lifted out of the photo by its outline.
export default function HazardCards({ cards }: { cards: HazardCardData[] }) {
  const [tab, setTab] = useState(0);
  const reduceMotion = useReducedMotion();
  const shown = cards.filter((c) => !TABS[tab].types || TABS[tab].types!.includes(c.type));

  return (
    <div className="flex flex-col gap-10">
      <div role="tablist" aria-label="Kinds of hazard" className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[15px]">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={tab === i}
            onClick={() => setTab(i)}
            className={`relative pb-2 transition-colors ${tab === i ? "font-medium text-[#1e1b33]" : "text-[#1e1b33]/65 hover:text-[#1e1b33]"}`}
          >
            {t.label}
            {tab === i && <motion.span layoutId="v3-tab" className="absolute inset-x-0 bottom-0 h-[2px] bg-[#1e1b33]" transition={reduceMotion ? { duration: 0 } : undefined} />}
          </button>
        ))}
      </div>

      <motion.ul layout={!reduceMotion} className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((c) => {
            const i = cards.indexOf(c);
            const measured = c.hazard ? measureText(c.hazard) : "";
            return (
              <motion.li
                key={c.type}
                layout={!reduceMotion}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.35 }}
                className="flex flex-col gap-3"
              >
                <div className="relative aspect-[4/5] overflow-hidden rounded-[18px]" style={{ background: PASTELS[i % PASTELS.length] }}>
                  {c.hazard ? (
                    <div className="absolute inset-[12%] grid place-items-center">
                      <Lifted photo={c.photo} hazard={c.hazard} />
                    </div>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.photo.src} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90 mix-blend-multiply grayscale" />
                      <span className="absolute inset-x-4 bottom-4 rounded-full bg-white/85 px-3 py-1.5 text-center text-xs text-[#1e1b33]">
                        Coming with our fine-tuned model
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="m-0 text-lg leading-tight font-medium text-[#1e1b33]">{HAZARD_TEXT[c.type].name}</h3>
                  {measured && <span className="shrink-0 font-mono text-xs text-[#1e1b33]/60">{measured}</span>}
                </div>
                <p className="m-0 text-[14px] leading-normal text-[#1e1b33]/70">{HAZARD_TEXT[c.type].why}</p>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}

// The object alone, cut from its photo by its outline, sized to fit the card.
function Lifted({ photo, hazard }: { photo: SitePhoto; hazard: Hazard }) {
  const { width: W, height: H } = photo;
  const [x0, y0, x1, y1] = hazard.box;
  const cw = x1 - x0;
  const ch = y1 - y0;
  const mask = `url("${hazard.outline_url}")`;
  const pct = (n: number) => `${n}%`;
  // Fit the box inside the card's square-ish center, keeping its shape, but
  // never blow a small object up so far that it blurs.
  const wide = cw / ch > 0.8;
  return (
    <div
      className="relative [filter:drop-shadow(0_18px_18px_rgba(30,27,51,0.28))]"
      style={{
        aspectRatio: `${cw} / ${ch}`,
        width: wide ? "100%" : "auto",
        height: wide ? "auto" : "100%",
        maxWidth: cw * 2,
        maxHeight: ch * 2,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={HAZARD_TEXT[hazard.type].name}
        className="absolute max-w-none"
        style={{
          width: pct((W / cw) * 100),
          height: pct((H / ch) * 100),
          left: pct((-x0 / cw) * 100),
          top: pct((-y0 / ch) * 100),
          maskImage: mask,
          WebkitMaskImage: mask,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
        }}
      />
    </div>
  );
}
