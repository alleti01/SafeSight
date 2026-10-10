"use client";

import { motion, useReducedMotion } from "motion/react";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import type { Hazard } from "@/lib/contract";

// One hazard lifted out of its photo by the outline SAM traced, floating in
// place, with the detector's box drawn around it in thin red.
export default function Cutout({
  photo,
  hazard,
  label,
  tag,
  at,
  width,
  phone,
  bob = 0,
}: {
  photo: SitePhoto;
  hazard: Hazard;
  label: string;
  tag: string;
  /** Center of the cutout, in % of the stage. */
  at: [number, number];
  /** Width, in % of the stage. */
  width: number;
  /** Center and width on phones, where the stage is tall and narrow. */
  phone: { at: [number, number]; width: number };
  /** Phase for the float, so the pieces don't move in step. */
  bob?: number;
}) {
  const reduceMotion = useReducedMotion();
  const { width: W, height: H } = photo;
  const [x0, y0, x1, y1] = hazard.box;
  // A little room around the box so the outline's edges aren't cut.
  const px = (x1 - x0) * 0.08;
  const py = (y1 - y0) * 0.08;
  const X0 = Math.max(0, x0 - px);
  const Y0 = Math.max(0, y0 - py);
  const X1 = Math.min(W, x1 + px);
  const Y1 = Math.min(H, y1 + py);
  const cw = X1 - X0;
  const ch = Y1 - Y0;
  const mask = `url("${hazard.outline_url}")`;
  const pct = (n: number) => `${n}%`;

  return (
    <motion.div
      className="absolute top-(--py) left-(--px) w-(--pw) md:top-(--y) md:left-(--x) md:w-(--w)"
      style={
        {
          "--x": pct(at[0]),
          "--y": pct(at[1]),
          "--w": pct(width),
          "--px": pct(phone.at[0]),
          "--py": pct(phone.at[1]),
          "--pw": pct(phone.width),
          aspectRatio: `${cw} / ${ch}`,
          translateX: "-50%",
          translateY: "-50%",
        } as React.CSSProperties
      }
      initial={{ y: 0 }}
      animate={reduceMotion ? { y: 0 } : { y: [0, -10, 0, 8, 0] }}
      transition={reduceMotion ? { duration: 0 } : { duration: 9 + bob * 1.7, repeat: Infinity, ease: "easeInOut", delay: bob * 0.6 }}
    >
      <div className="absolute inset-0 [filter:drop-shadow(0_22px_22px_rgba(0,0,0,0.35))]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt=""
          className="absolute max-w-none"
          style={{
            width: pct((W / cw) * 100),
            height: pct((H / ch) * 100),
            left: pct((-X0 / cw) * 100),
            top: pct((-Y0 / ch) * 100),
            maskImage: mask,
            WebkitMaskImage: mask,
            maskSize: "100% 100%",
            WebkitMaskSize: "100% 100%",
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute border border-[#e0261f]/80"
        style={{
          left: pct(((x0 - X0) / cw) * 100),
          top: pct(((y0 - Y0) / ch) * 100),
          width: pct(((x1 - x0) / cw) * 100),
          height: pct(((y1 - y0) / ch) * 100),
        }}
      >
        <span className="absolute -top-4 left-0 hidden font-v2-body text-[9px] tracking-wide whitespace-nowrap text-[#e0261f] md:block">{tag}</span>
      </div>
      <span className="pointer-events-none absolute inset-0 grid place-items-center text-center font-v2-display text-[clamp(14px,1.9vw,34px)] leading-[0.9] font-bold tracking-tight text-white uppercase [text-shadow:0_2px_14px_rgba(0,0,0,0.55)]">
        {label}
      </span>
    </motion.div>
  );
}
