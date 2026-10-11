"use client";

import { useEffect, useRef, useState } from "react";
import ContrastSwatches from "@/components/ContrastSwatches";
import type { Hazard, HazardType } from "@/lib/contract";
import { materials, money, planFor } from "@/lib/costs";
import {
  colorCheck,
  confidenceNote,
  objectName,
  plainContrast,
  type MeasuredHazard,
} from "@/lib/measure";

// The pieces of a finding shared by the home page and the results: the photo
// with the finding spotlit and framed by red corner brackets, and the tags
// that say how sure we are and what was measured.

export interface Photo {
  src: string;
  width: number;
  height: number;
}

export const fixLine = (type: HazardType, object?: string) => {
  const plan = planFor({ type, object });
  const cost = materials(plan);
  if (cost[1] === 0) return "Free to fix";
  return `Fix from ${money(cost)}${plan?.free ? " · free step today" : ""}`;
};

// Size of an element, kept up to date.
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({
        w: Math.round(e.contentRect.width),
        h: Math.round(e.contentRect.height),
      }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

// How far to zoom a w×h frame (filled by the photo) so the finding takes up
// most of it, but never so far that a small photo goes soft. Only the frame's
// shape matters, not its size.
function cardZoom(photo: Photo, box: Hazard["box"], w: number, h: number) {
  const [x0, y0, x1, y1] = box;
  const s = Math.max(w / photo.width, h / photo.height);
  return Math.min(
    2,
    Math.max(1, 0.7 * Math.min(w / s / (x1 - x0), h / s / (y1 - y0))),
  );
}

const r2 = (v: number) => Math.round(v * 100) / 100;

const center = (photo: Photo, box: Hazard["box"]): [number, number] => [
  (box[0] + box[2]) / 2 / photo.width,
  (box[1] + box[3]) / 2 / photo.height,
];

/**
 * Where a box sits in a w×h frame, as percentages of the frame: the photo
 * covers the frame centered on `focus` (the finding), then is zoomed about
 * that point. Clipped to the frame.
 */
export function place(
  photo: Photo,
  focus: Hazard["box"],
  box: Hazard["box"],
  w: number,
  h: number,
  zoom: number,
) {
  const { width: W, height: H } = photo;
  const s = Math.max(w / W, h / H);
  const [px, py] = center(photo, focus);
  const ox = (w - W * s) * px;
  const oy = (h - H * s) * py;
  const at = (x: number, y: number) => [
    px * w + zoom * (ox + x * s - px * w),
    py * h + zoom * (oy + y * s - py * h),
  ];
  const [l, t] = at(box[0], box[1]);
  const [r, b] = at(box[2], box[3]);
  const pc = (v: number, of: number) =>
    Math.round((Math.min(of, Math.max(0, v)) / of) * 10000) / 100;
  return { l: pc(l, w), t: pc(t, h), r: pc(r, w), b: pc(b, h) };
}

// The photo, cropped like `object-cover` around the finding and zoomed about
// it; in grey, in color, or in color through the finding's outline.
function Layer({
  photo,
  pos,
  zoom,
  gray = false,
  outline,
  clip,
}: {
  photo: Photo;
  pos: string;
  zoom: number;
  gray?: boolean;
  outline?: string;
  clip?: string;
}) {
  const mask = outline
    ? {
        maskImage: `url("${outline}")`,
        WebkitMaskImage: `url("${outline}")`,
        maskSize: "cover",
        WebkitMaskSize: "cover",
        maskPosition: pos,
        WebkitMaskPosition: pos,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }
    : {};
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      alt=""
      aria-hidden="true"
      className={`absolute inset-0 h-full w-full object-cover ${gray ? "grayscale" : ""}`}
      style={{
        objectPosition: pos,
        ...(zoom === 1
          ? {}
          : { transform: `scale(${zoom})`, transformOrigin: pos }),
        ...mask,
        ...(clip ? { clipPath: clip } : {}),
      }}
    />
  );
}

/**
 * A photo with a spotlight on one finding: the room in grey, dimmed and
 * softened, the area just around the finding sharp, the finding itself in
 * color on top, framed by red corner brackets. The bigger the finding, the
 * darker the room around it; a dark finding (a navy rug) gets a lighter room
 * and is lifted itself, so dimming doesn't make it blend in.
 *
 * Fills its (positioned) container, whose shape is w×h; only the shape
 * matters, so a fixed-shape frame can pass its aspect ratio. With `zoom`, the
 * photo is enlarged so the finding fills most of the frame. `others` are
 * further findings in the same photo, framed in white. With `color`, the room
 * stays in color too (only lightly dimmed, not softened): for people's own
 * photos, where seeing the real room matters more than the effect.
 */
export function Spotlight({
  photo,
  hazard,
  w,
  h,
  zoom: zoomIn = true,
  others = [],
  color = false,
}: {
  photo: Photo;
  hazard: MeasuredHazard;
  w: number;
  h: number;
  zoom?: boolean;
  others?: { hazard: Hazard; label: React.ReactNode }[];
  color?: boolean;
}) {
  const zoom = zoomIn ? cardZoom(photo, hazard.box, w, h) : 1;
  const { l, t, r, b } = place(photo, hazard.box, hazard.box, w, h, zoom);
  const [cx, cy] = center(photo, hazard.box);
  const pos = `${r2(cx * 100)}% ${r2(cy * 100)}%`;
  const cover = ((r - l) * (b - t)) / 10000;
  const dark = (hazard.measure?.lightness ?? 50) < 30;
  const dim = color
    ? dark
      ? 0.9
      : Math.max(0.7, 0.85 - 0.2 * cover)
    : dark
      ? 0.75
      : Math.max(0.38, 0.62 - 0.35 * cover);
  // The light reaches a little past the finding: 7% of the frame's width on
  // every side. (Chrome won't take calc() in a gradient's size, so it's all
  // in percentages of the frame.)
  const pad = 7;
  const rx = (r - l) / 2 + pad;
  const ry = (b - t) / 2 + (pad * w) / h;
  const light = `radial-gradient(ellipse ${r2(rx)}% ${r2(ry)}% at ${r2((l + r) / 2)}% ${r2((t + b) / 2)}%, #000 62%, transparent 100%)`;
  // Without a traced outline (things measured by their box), color fills the box.
  const box = `inset(${t}% ${100 - r}% ${100 - b}% ${l}%)`;
  const photoProps = { photo, pos, zoom };
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          filter: color
            ? `brightness(${dim})`
            : `brightness(${dim}) blur(1.5px)`,
        }}
      >
        <Layer {...photoProps} gray={!color} />
      </div>
      <div
        className="absolute inset-0"
        style={{ maskImage: light, WebkitMaskImage: light }}
      >
        <Layer {...photoProps} gray={!color} />
      </div>
      <div
        className="absolute inset-0"
        style={dark ? { filter: "brightness(1.35)" } : undefined}
      >
        {hazard.outline_url ? (
          <Layer {...photoProps} outline={hazard.outline_url} />
        ) : (
          <Layer {...photoProps} clip={box} />
        )}
      </div>
      {others.map((o) => {
        const p = place(photo, hazard.box, o.hazard.box, w, h, zoom);
        if (p.r - p.l < 2 || p.b - p.t < 2) return null;
        return (
          <Brackets key={o.hazard.hazard_id} {...p} tone="other">
            {o.label}
          </Brackets>
        );
      })}
      <Brackets l={l} t={t} r={r} b={b} />
    </>
  );
}

// Corner brackets framing a finding, like a camera's focus: red for the
// finding, white for others. Kept just inside the frame when the finding
// runs off it. Positions are percentages of the frame.
const CORNERS = [
  "top-0 left-0 border-t-2 border-l-2 rounded-tl-[8px]",
  "top-0 right-0 border-t-2 border-r-2 rounded-tr-[8px]",
  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-[8px]",
  "right-0 bottom-0 border-r-2 border-b-2 rounded-br-[8px]",
];

function Brackets({
  l,
  t,
  r,
  b,
  tone = "finding",
  children,
}: {
  l: number;
  t: number;
  r: number;
  b: number;
  tone?: "finding" | "other";
  children?: React.ReactNode;
}) {
  return (
    <span
      className={`absolute ${children ? "" : "pointer-events-none"}`}
      style={{
        left: `max(8px, calc(${l}% - 6px))`,
        top: `max(8px, calc(${t}% - 6px))`,
        right: `max(8px, calc(${100 - r}% - 6px))`,
        bottom: `max(8px, calc(${100 - b}% - 6px))`,
      }}
    >
      {CORNERS.map((c) => (
        <span
          key={c}
          aria-hidden="true"
          className={`pointer-events-none absolute ${tone === "finding" ? "border-[var(--danger)]" : "border-white/80"} ${c}`}
          style={{ width: "min(22px, 33%)", height: "min(22px, 33%)" }}
        />
      ))}
      {children}
    </span>
  );
}

const TONES = {
  good: "bg-[#e3eedc] text-[#3f6b2f]",
  warn: "bg-[#f6e6cf] text-[#8a5a12]",
  bad: "bg-[#f6dcd6] text-[#9a3a26]",
  plain: "bg-[var(--ss-chip)] text-[var(--ss-ink-2)]",
};

export function Tag({
  tone,
  onDark = false,
  children,
}: {
  tone: keyof typeof TONES;
  onDark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[6px] px-2 py-0.5 text-[12px] font-medium ${TONES[tone]} ${onDark ? "!text-[11px]" : ""}`}
    >
      {children}
    </span>
  );
}

// A tag that opens a short explanation on hover, focus or tap.
export function Info({
  tone,
  label,
  up = false,
  children,
}: {
  tone: keyof typeof TONES;
  label: string;
  up?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className={`inline-flex items-center gap-1.5 rounded-[6px] px-2 py-0.5 text-left text-[12px] font-medium ${TONES[tone]}`}
      >
        {label}
        <span
          aria-hidden="true"
          className="grid size-3.5 place-items-center rounded-full border border-current text-[9px] leading-none print:hidden"
        >
          i
        </span>
      </button>
      {open && (
        <span
          className={`absolute z-20 block ${up ? "bottom-full left-0 mb-2 w-[240px]" : "top-full left-0 mt-2 w-[260px]"} max-w-[calc(100vw-48px)] rounded-[12px] bg-[var(--ss-ink)] p-3.5 text-[12px] leading-relaxed text-white shadow-lg`}
        >
          {children}
        </span>
      )}
    </span>
  );
}

// What we can say about a finding, as tags: how sure we are that it's the
// thing we think (and why), and what the color check measured. Each opens
// for the reasons.
export function FindingTags({
  hazard,
  photo,
  up = false,
  sure,
}: {
  hazard: MeasuredHazard;
  photo: Photo;
  up?: boolean;
  /** The results page's call (the service's per-object cutoff); overrides the level from confidence alone. */
  sure?: boolean;
}) {
  const c = confidenceNote(hazard, photo.width, photo.height);
  const low = sure === undefined ? c.level === "Low" : !sure;
  const color = colorCheck(hazard);
  const contrast = plainContrast(hazard);
  return (
    <>
      <Info
        up={up}
        tone={
          low ? "bad" : c.level === "High" ? "good" : "warn"
        }
        label={
          low
            ? `${c.percent}% sure · check in person`
            : `${c.percent}% sure it's ${objectName(hazard.type)}`
        }
      >
        <p className="m-0">{c.meaning}</p>
        <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
          {c.checks.map((k) => (
            <li key={k.text} className="flex items-center gap-2">
              <Tag tone={k.ok ? "good" : "warn"} onDark>
                {k.ok ? "Good" : "Check"}
              </Tag>
              {k.text}
            </li>
          ))}
        </ul>
      </Info>
      {color && contrast ? (
        <Info up={up} tone="good" label={`Measured: ${color}`}>
          <ContrastSwatches c={contrast} size="sm" dark />
          <p className="m-0 mt-2.5 text-white/70">
            Measured from the photo&apos;s colors, not guessed.
          </p>
        </Info>
      ) : (
        <Tag tone="plain">No color check needed</Tag>
      )}
    </>
  );
}
