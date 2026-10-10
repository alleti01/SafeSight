"use client";

import LabeledPhoto from "@/components/LabeledPhoto";
import { BlurFade } from "@/components/ui/blur-fade";
import type { MeasuredHazard } from "@/lib/measure";

export interface SiteObject {
  label: string;
  box: [number, number, number, number];
  score: number;
  outline_url?: string;
}

export interface SitePhoto {
  src: string;
  width: number;
  height: number;
  room: string;
  objects: SiteObject[];
  hazards: MeasuredHazard[];
  credit?: { by: string; url: string; site: string };
}

const pct = (n: number) => `${n}%`;

function boxStyle(box: number[], w: number, h: number) {
  const [x0, y0, x1, y1] = box;
  return { left: pct((x0 / w) * 100), top: pct((y0 / h) * 100), width: pct(((x1 - x0) / w) * 100), height: pct(((y1 - y0) / h) * 100) };
}

// One photo at each stage of the pipeline, from the backend's real output.
export default function ModelStrip({ photo }: { photo: SitePhoto }) {
  const { src, width: w, height: h } = photo;
  const frame = { frame_id: "strip", image_url: src, width: w, height: h };

  const stages = [
    {
      label: "The photo",
      body: (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ),
    },
    {
      label: "Objects found",
      body: (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover grayscale" />
          {photo.objects.map((o, i) => (
            <div key={i} className="absolute outline-2 outline-foreground" style={{ ...boxStyle(o.box, w, h), outlineStyle: "solid" }}>
              <span className="absolute -top-5 left-0 hidden bg-foreground px-1 text-[11px] whitespace-nowrap text-background lg:block">
                {o.label.replace(/_/g, " ")} {Math.round(o.score * 100)}%
              </span>
            </div>
          ))}
        </>
      ),
    },
    {
      label: "Exact outlines",
      body: (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover grayscale brightness-75" />
          {photo.objects.map(
            (o, i) =>
              o.outline_url && (
                <div
                  key={i}
                  className="absolute inset-0 bg-white/80"
                  style={{
                    maskImage: `url("${o.outline_url}")`,
                    WebkitMaskImage: `url("${o.outline_url}")`,
                    maskSize: "100% 100%",
                    WebkitMaskSize: "100% 100%",
                  }}
                />
              ),
          )}
        </>
      ),
    },
    {
      label: "What may be a problem",
      body: <LabeledPhoto frame={frame} hazards={photo.hazards} src={src} still tags={false} />,
    },
  ];

  return (
    <ol className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
      {stages.map((s, i) => (
        <BlurFade as="li" key={s.label} delay={i * 0.12} className="flex flex-col gap-2">
          <div className="relative w-full overflow-hidden rounded-[4px] bg-line" style={{ aspectRatio: `${w} / ${h}` }}>
            {s.body}
          </div>
          <span className="text-sm text-muted">
            <span className="tabular-nums">{i + 1}</span> · {s.label}
          </span>
        </BlurFade>
      ))}
    </ol>
  );
}
