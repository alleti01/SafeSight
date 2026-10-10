"use client";

import { motion, useReducedMotion } from "motion/react";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import type { Hazard } from "@/lib/contract";

export interface RoomCard {
  room: string;
  photo: SitePhoto;
  /** The finding the card is cropped on and shows in color. */
  hazard: Hazard;
}

// A row of room photos. The chosen room moves to the front and opens into the
// big card: grey, with its main finding in color and how many things the
// pipeline flagged. The others stay narrow with their name turned on its
// side; click one to bring it forward.
export default function RoomCards({ cards, active, onPick }: { cards: RoomCard[]; active: number; onPick: (i: number) => void }) {
  const reduceMotion = useReducedMotion();
  const order = [active, ...cards.map((_, i) => i).filter((i) => i !== active)];
  return (
    <div className="flex h-full gap-3 sm:gap-5">
      {order.map((i) => {
        const c = cards[i];
        const on = i === active;
        const [x0, y0, x1, y1] = c.hazard.box;
        const position = `${(((x0 + x1) / 2) / c.photo.width) * 100}% ${(((y0 + y1) / 2) / c.photo.height) * 100}%`;
        const mask = `url("${c.hazard.outline_url}")`;
        const found = c.photo.hazards.length;
        return (
          <motion.button
            key={c.room}
            layout={!reduceMotion}
            transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
            type="button"
            onClick={() => onPick(i)}
            aria-pressed={on}
            aria-label={`${c.room}: ${found} things that may be a problem`}
            className={`relative min-w-0 overflow-hidden rounded-[18px] bg-[#d9d6d1] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1e1b33] ${
              on ? "flex-[3.3]" : "flex-1 cursor-pointer"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.photo.src} alt="" className="absolute inset-0 h-full w-full object-cover grayscale" style={{ objectPosition: position }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.photo.src}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${on ? "opacity-100" : "opacity-0"}`}
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
            <span className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-500 ${on ? "opacity-100" : "opacity-0"}`} />

            {/* Open: name and count along the bottom. */}
            <span
              // On wide screens the room bar overlaps this card's corner, so the text starts past it.
              className={`absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-5 text-white sm:flex-row sm:items-end sm:justify-between sm:gap-4 transition-opacity duration-500 sm:p-7 lg:pl-[110px] ${
                on ? "opacity-100 delay-300" : "pointer-events-none opacity-0"
              }`}
            >
              <span className="text-[clamp(22px,2.4vw,34px)] leading-[1.1] font-normal capitalize">
                {c.room}
                <br />
                check
              </span>
              <span className="sm:text-right">
                <span className="block text-[clamp(34px,3.6vw,52px)] leading-none font-light">{found}</span>
                <span className="text-[11px] tracking-[0.12em] uppercase">things found</span>
              </span>
            </span>

            {/* Closed: the name on its side in a dark tab. */}
            <span
              className={`absolute bottom-14 left-0 bg-[#1e1b33] px-2 py-4 text-[clamp(18px,1.8vw,28px)] leading-none text-white capitalize transition-opacity duration-300 [writing-mode:vertical-rl] rotate-180 ${
                on ? "opacity-0" : "opacity-100"
              }`}
            >
              {c.room}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
