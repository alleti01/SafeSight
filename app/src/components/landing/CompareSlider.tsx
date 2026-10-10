"use client";

import { useId, useState } from "react";

// Drag across one photo to compare two versions of it. The control is a real
// range input, so it works with a keyboard and a screen reader too. Each side
// is an image URL or anything else that fills the frame.
export default function CompareSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  width,
  height,
  alt,
  start = 50,
}: {
  before: string | React.ReactNode;
  after: string | React.ReactNode;
  beforeLabel: string;
  afterLabel: string;
  width: number;
  height: number;
  alt: string;
  start?: number;
}) {
  const [split, setSplit] = useState(start);
  const id = useId();
  const fill = (side: string | React.ReactNode, label?: string) =>
    typeof side === "string" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={side} alt={label ?? ""} className="absolute inset-0 h-full w-full object-cover" />
    ) : (
      side
    );

  return (
    <div className="relative w-full overflow-hidden rounded-[4px] bg-line select-none" style={{ aspectRatio: `${width} / ${height}` }}>
      <div className="absolute inset-0" role="img" aria-label={alt}>
        {fill(after)}
      </div>
      <div className="absolute inset-0" aria-hidden="true" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
        {fill(before)}
      </div>
      <span className="pointer-events-none absolute top-3 left-3 rounded-[4px] bg-foreground/80 px-2.5 py-1 text-sm text-background">{beforeLabel}</span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-[4px] bg-surface/95 px-2.5 py-1 text-sm">{afterLabel}</span>
      <div className="pointer-events-none absolute inset-y-0 w-[2px] -translate-x-1/2 bg-white" style={{ left: `${split}%` }}>
        <span className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-foreground shadow">
          ↔
        </span>
      </div>
      <label htmlFor={id} className="sr-only">
        Compare {beforeLabel.toLowerCase()} and {afterLabel.toLowerCase()}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
