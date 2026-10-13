"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "motion/react";
import type { Frame, Hazard, Severity } from "@/lib/contract";
import { assetUrl } from "@/lib/brain";
import { HAZARD_TEXT } from "@/lib/hazards";

export const SEVERITY_COLOR: Record<Severity, string> = {
  high: "var(--danger)",
  medium: "var(--warn)",
  low: "var(--calm)",
};

const TAG_TEXT: Record<Severity, string> = {
  high: "#ffffff",
  medium: "#1d1300",
  low: "#ffffff",
};

const pct = (n: number) => `${n.toFixed(3)}%`;

// The photo is grey; only the hazards are in color. When the photo scrolls
// into view, color grows out from the middle of each hazard to fill its box.
// With focusId, only that hazard is colored and the others are outlined.
export default function LabeledPhoto({
  frame,
  hazards,
  focusId,
  hrefFor,
  src,
  still = false,
  tags = true,
}: {
  frame: Frame;
  hazards: Hazard[];
  focusId?: string;
  hrefFor?: (hazard: Hazard) => string;
  src?: string;
  /** Render the finished state with no animation (for print). */
  still?: boolean;
  /** Name tags on the photo; off where the name is printed beside it. */
  tags?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduceMotion = useReducedMotion();
  // `still` is a prop, so server and client agree on it. Reduced motion is
  // only known in the browser: it makes the reveal instant, not skipped.
  const quiet = still;
  const instant = !!reduceMotion;
  const [broken, setBroken] = useState(false);
  const { width: w, height: h } = frame;
  const url = src ?? assetUrl(frame.image_url);
  const lit = (hz: Hazard) => focusId === undefined || hz.hazard_id === focusId;
  // Outlines come from the brain unless the photo is bundled with the site.
  const outlineUrl = (hz: Hazard) => (!hz.outline_url ? "" : src ? hz.outline_url : assetUrl(hz.outline_url));
  const outlines = useOutlines(hazards.map(outlineUrl));
  const show = inView || quiet;
  const appear = (delay: number) => ({
    initial: quiet ? false : { opacity: 0 },
    animate: show ? { opacity: 1 } : undefined,
    transition: instant ? { duration: 0 } : { duration: 0.4, delay },
  });

  return (
    <div
      ref={ref}
      className="relative w-full max-w-full overflow-hidden rounded-[4px] bg-line"
      style={{ aspectRatio: `${w} / ${h}` }}
    >
      {broken ? (
        <div className="absolute inset-0 grid place-items-center text-base text-muted">photo not available</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover grayscale"
          onError={() => setBroken(true)}
        />
      )}

      {!broken &&
        hazards.filter(lit).map((hz, i) => {
          const [x0, y0, x1, y1] = hz.box;
          const t = (y0 / h) * 100;
          const l = (x0 / w) * 100;
          const r = 100 - (x1 / w) * 100;
          const b = 100 - (y1 / h) * 100;
          const cx = (l + (100 - r)) / 2;
          const cy = (t + (100 - b)) / 2;
          return (
            <motion.img
              key={hz.hazard_id}
              data-color-reveal={hz.hazard_id}
              src={url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
              style={outlines.has(outlineUrl(hz)) ? maskStyle(outlineUrl(hz)) : undefined}
              initial={
                quiet
                  ? false
                  : { clipPath: `inset(${pct(cy)} ${pct(100 - cx)} ${pct(100 - cy)} ${pct(cx)})` }
              }
              animate={show ? { clipPath: `inset(${pct(t)} ${pct(r)} ${pct(b)} ${pct(l)})` } : undefined}
              transition={instant ? { duration: 0 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.25 + i * 0.15 }}
            />
          );
        })}

      {hazards.map((hz, i) => {
        const [x0, y0, x1, y1] = hz.box;
        const on = lit(hz);
        const left = (x0 / w) * 100;
        const right = 100 - (x1 / w) * 100;
        const top = (y0 / h) * 100;
        // Hang the tag from the box's left edge, or its right edge for boxes
        // near the right side; long names wrap instead of leaving the photo.
        const extendRight = left <= 65;
        const nearTop = top < 12;
        const name = (HAZARD_TEXT[hz.type]?.name ?? hz.type).toLowerCase();
        const href = !on && hrefFor ? hrefFor(hz) : undefined;
        const tag = {
          className: `absolute w-max px-2 py-0.5 leading-tight ${
            on ? "text-sm" : "bg-surface/90 text-xs text-foreground underline-offset-2 hover:underline"
          }`,
          style: {
            top: pct(top),
            ...(extendRight ? { left: pct(left) } : { right: pct(right) }),
            maxWidth: `calc(${100 - (extendRight ? left : right)}% - 4px)`,
            transform: nearTop ? "translateY(6px)" : "translateY(calc(-100% - 6px))",
            ...(on ? { background: SEVERITY_COLOR[hz.severity], color: TAG_TEXT[hz.severity] } : {}),
          },
        };

        return (
          <div key={hz.hazard_id} className="contents">
            <motion.div
              aria-hidden="true"
              data-hazard={hz.hazard_id}
              className="pointer-events-none absolute"
              style={{
                left: pct(left),
                top: pct(top),
                width: pct(((x1 - x0) / w) * 100),
                height: pct(((y1 - y0) / h) * 100),
                outline: on ? `2px solid ${SEVERITY_COLOR[hz.severity]}` : "1.5px dashed rgba(255,255,255,0.9)",
                outlineOffset: on ? 4 : 0,
              }}
              {...appear(0.9 + i * 0.15)}
            />
            {tags && (
            <motion.span className="absolute inset-0 pointer-events-none" {...appear(1 + i * 0.15)}>
              {href ? (
                <Link href={href} {...tag} className={`${tag.className} pointer-events-auto`}>
                  {name}
                </Link>
              ) : (
                <span {...tag}>{name}</span>
              )}
            </motion.span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// A CSS mask that fails to load hides everything, so only use outlines that
// have actually loaded; until then (or without one) color fills the box.
function useOutlines(urls: string[]): Set<string> {
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const key = urls.filter(Boolean).join("|");

  useEffect(() => {
    let cancelled = false;
    for (const url of key ? key.split("|") : []) {
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setLoaded((prev) => new Set(prev).add(url));
      };
      img.src = url;
    }
    return () => {
      cancelled = true;
    };
  }, [key]);

  return loaded;
}

function maskStyle(url: string): React.CSSProperties {
  const image = `url("${url}")`;
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };
}
