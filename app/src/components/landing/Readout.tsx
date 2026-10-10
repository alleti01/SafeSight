"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { HAZARD_TEXT } from "@/lib/hazards";
import { boxCenter, type MeasuredHazard } from "@/lib/measure";
import type { SitePhoto } from "./ModelStrip";

const DARK_RUG_GAP = 20; // backend/contrast.py

const SEVERITY_ON_DARK = { high: "#ef7a6d", medium: "#f0b443", low: "#7fb0e6" } as const;

// One hazard, read like an instrument: a crosshair on the object, and the
// numbers the contrast check actually measured, drawn as bars.
export default function Readout({ photo, hazard, title }: { photo: SitePhoto; hazard: MeasuredHazard; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  // Same first frame on server and client; reduced motion makes it instant.
  const quiet = !!useReducedMotion();
  const show = inView;
  const { src, width: w, height: h } = photo;
  const m = hazard.measure;
  const [x0, y0, x1, y1] = hazard.box;
  const c = boxCenter(hazard.box, w, h);
  const cx = (c.x / 100) * w;
  const cy = (c.y / 100) * h;
  const ease = { duration: quiet ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] as const };
  const mask = `url("${hazard.outline_url}")`;

  return (
    <div ref={ref} className="grid gap-6 rounded-[4px] bg-night p-4 text-[#f6f8f7] sm:p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${w} / ${h}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`A hallway in grey; only the ${title.toLowerCase()} is in color`} className="absolute inset-0 h-full w-full object-cover grayscale" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ maskImage: mask, WebkitMaskImage: mask, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
        />
        <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="absolute inset-0 h-full w-full">
          <motion.line
            y1={0}
            y2={h}
            stroke="#f6f8f7"
            strokeOpacity={0.55}
            initial={{ x1: 0, x2: 0 }}
            animate={show ? { x1: cx, x2: cx } : undefined}
            transition={ease}
          />
          <motion.line
            x1={0}
            x2={w}
            stroke="#f6f8f7"
            strokeOpacity={0.55}
            initial={{ y1: 0, y2: 0 }}
            animate={show ? { y1: cy, y2: cy } : undefined}
            transition={ease}
          />
          <motion.g initial={{ opacity: 0 }} animate={show ? { opacity: 1 } : undefined} transition={{ delay: quiet ? 0 : 1, duration: 0.4 }}>
            <circle cx={cx} cy={cy} r={22} fill="none" stroke="var(--danger)" strokeWidth={2} />
            <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="none" stroke="var(--danger)" strokeWidth={1.5} strokeDasharray="6 5" />
          </motion.g>
        </svg>
        <span className="absolute top-3 left-3 bg-night/75 px-2 py-1 font-mono text-[11px] tracking-wide">
          {w}×{h} · {photo.room}
        </span>
      </div>

      <div className="flex flex-col gap-5 lg:border-l lg:border-[#313131] lg:pl-6">
        <span className="font-mono text-[11px] tracking-[0.08em] text-[#969696] uppercase">Readout · {title}</span>
        {m && (
          <>
            <Bar label={`${title.toLowerCase()} L*`} value={m.lightness} color="var(--danger)" show={show} quiet={quiet} />
            <Bar label="around it L*" value={m.around_lightness} color="#f6f8f7" show={show} quiet={quiet} />
            <div className="flex items-baseline justify-between border-t border-[#313131] pt-4">
              <span className="font-mono text-[13px] text-[#969696]">gap</span>
              <span className="font-display text-6xl leading-none font-light tabular-nums">{m.around_lightness - m.lightness}</span>
            </div>
          </>
        )}
        <p className="m-0 text-[15px] leading-normal text-[#d6d6d6]">
          Anything {DARK_RUG_GAP} or more darker than the floor around it can look like a hole.{" "}
          <span style={{ color: SEVERITY_ON_DARK[hazard.severity] }}>
            {HAZARD_TEXT[hazard.type].name} · {hazard.severity}.
          </span>
        </p>
        <span className="mt-auto font-mono text-[11px] text-[#969696]">L* is lightness, 0 black to 100 white, measured inside the outline and in a ring just outside it.</span>
      </div>
    </div>
  );
}

function Bar({ label, value, color, show, quiet }: { label: string; value: number; color: string; show: boolean; quiet: boolean }) {
  return (
    <div>
      <div className="flex justify-between font-mono text-[13px] text-[#969696]">
        <span>{label}</span>
        <span className="text-[#f6f8f7] tabular-nums">{value}</span>
      </div>
      <div className="mt-1.5 h-2 bg-[#313131]">
        <motion.div
          className="h-full"
          style={{ background: color }}
          initial={{ width: "0%" }}
          animate={show ? { width: `${value}%` } : undefined}
          transition={{ duration: quiet ? 0 : 0.9, delay: quiet ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
