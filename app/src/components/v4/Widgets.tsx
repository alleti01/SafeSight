"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import { HAZARD_TEXT } from "@/lib/hazards";
import ContrastSwatches from "@/components/ContrastSwatches";
import { plainContrast, type MeasuredHazard } from "@/lib/measure";

export interface Room {
  name: string;
  photo: SitePhoto;
  hazard: MeasuredHazard;
}

const position = (p: SitePhoto, h: MeasuredHazard) => {
  const [x0, y0, x1, y1] = h.box;
  return `${(((x0 + x1) / 2) / p.width) * 100}% ${(((y0 + y1) / 2) / p.height) * 100}%`;
};

// The room the way they might see it: grey, with only the finding in color,
// fading into the page at the bottom.
export function Lens({ room }: { room: Room }) {
  const reduceMotion = useReducedMotion();
  const pos = position(room.photo, room.hazard);
  const outline = `url("${room.hazard.outline_url}")`;
  // Most findings are on the floor, so only the last sliver fades.
  const fade = "linear-gradient(to bottom, #000 86%, transparent 100%)";
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-t-[999px]"
      style={{ maskImage: fade, WebkitMaskImage: fade }}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={room.name}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={room.photo.src} alt="" className="absolute inset-0 h-full w-full object-cover grayscale" style={{ objectPosition: pos }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={room.photo.src}
            alt={`A ${room.name} in grey; only the ${HAZARD_TEXT[room.hazard.type].name.toLowerCase()} is in color`}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: pos,
              maskImage: outline,
              WebkitMaskImage: outline,
              maskSize: "cover",
              WebkitMaskSize: "cover",
              maskPosition: pos,
              WebkitMaskPosition: pos,
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
            }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// The finding in the lens, in words: its name, and either the colors being
// compared (for contrast hazards) or why it matters.
export function ProfileCard({ hazard }: { hazard: MeasuredHazard }) {
  const contrast = plainContrast(hazard);
  return (
    <div className="w-[250px] rounded-[18px] bg-white/85 p-4 shadow-[0_20px_50px_rgba(62,54,46,0.12)] backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[18px] leading-tight font-medium">{HAZARD_TEXT[hazard.type].name}</span>
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--ss-accent)]" />
      </div>
      <div className="mt-3">
        {contrast ? <ContrastSwatches c={contrast} size="sm" /> : <p className="m-0 text-[13px] leading-snug text-[var(--ss-ink-2)]">{HAZARD_TEXT[hazard.type].why}</p>}
      </div>
    </div>
  );
}

// Severity in the middle of a slowly turning ring of text.
export function SeverityBadge({ hazard }: { hazard: MeasuredHazard }) {
  const reduceMotion = useReducedMotion();
  const text = "SAFESIGHT HOME CHECK · MAY BE A PROBLEM · ";
  return (
    <div className="relative grid size-[150px] place-items-center">
      <motion.svg
        viewBox="0 0 150 150"
        className="absolute inset-0"
        aria-hidden="true"
        initial={{ rotate: 0 }}
        animate={reduceMotion ? { rotate: 0 } : { rotate: 360 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 24, repeat: Infinity, ease: "linear" }}
      >
        <defs>
          <path id="v4-ring" d="M75,75 m-58,0 a58,58 0 1,1 116,0 a58,58 0 1,1 -116,0" />
        </defs>
        <text fontSize="11.5" letterSpacing="2" fill="var(--ss-ink)" fontWeight={500}>
          <textPath href="#v4-ring">{text}</textPath>
        </text>
      </motion.svg>
      <div className="grid size-[92px] place-items-center rounded-full bg-white/70 text-center shadow-[0_10px_30px_rgba(62,54,46,0.1)] backdrop-blur">
        <span>
          <span className="block text-[26px] leading-none font-medium capitalize">{hazard.severity}</span>
          <span className="text-[11px] text-[var(--ss-ink-3)]">severity</span>
        </span>
      </div>
    </div>
  );
}

// Round room thumbnails; the chosen one is lifted and ringed.
export function RoomPicker({ rooms, active, onPick }: { rooms: Room[]; active: number; onPick: (i: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Room" className="flex items-center gap-3 rounded-full bg-white/60 p-2 shadow-[0_16px_40px_rgba(62,54,46,0.12)] backdrop-blur-md">
      {rooms.map((r, i) => (
        <button
          key={r.name}
          type="button"
          role="radio"
          aria-checked={i === active}
          aria-label={r.name}
          onClick={() => onPick(i)}
          className={`relative size-[68px] overflow-hidden rounded-full transition-[transform,box-shadow] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ss-ink)] sm:size-[76px] ${
            i === active ? "scale-110 shadow-[0_0_0_3px_#fff,0_10px_24px_rgba(62,54,46,0.25)]" : "opacity-80 grayscale hover:opacity-100"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.photo.src} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position(r.photo, r.hazard) }} />
        </button>
      ))}
    </div>
  );
}
