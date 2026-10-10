"use client";

import LabeledPhoto from "@/components/LabeledPhoto";
import { BlurFade } from "@/components/ui/blur-fade";
import { HAZARD_TEXT } from "@/lib/hazards";
import type { HazardType } from "@/lib/contract";
import { biggest, measureText } from "@/lib/measure";
import type { SitePhoto } from "./ModelStrip";

// A photo for each thing we look for. When the pipeline found that hazard in
// the photo, the photo is grey and the hazard is in color. When it didn't
// (the starting model can't see every kind yet), the photo stays as it is and
// says so. The reason shows on hover or focus so the grid stays mostly pictures.
export default function HazardGrid({ tiles }: { tiles: { type: HazardType; photo: SitePhoto }[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-6 p-0 md:grid-cols-3 lg:grid-cols-5">
      {tiles.map(({ type, photo }, i) => {
        const found = photo.hazards.length > 0;
        const measured = found ? measureText(biggest(photo.hazards)!) : "";
        return (
          <BlurFade as="li" key={type} delay={(i % 5) * 0.06}>
            <div tabIndex={0} className="group flex flex-col gap-2 outline-none" data-found={found}>
              <div className="relative">
                {found ? (
                  <LabeledPhoto
                    frame={{ frame_id: type, image_url: photo.src, width: photo.width, height: photo.height }}
                    hazards={photo.hazards}
                    src={photo.src}
                    tags={false}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.src}
                    alt=""
                    className="w-full rounded-[4px] object-cover"
                    style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                  />
                )}
                <p className="pointer-events-none absolute inset-0 m-0 flex items-end rounded-[4px] bg-foreground/80 p-3 text-sm leading-snug text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {HAZARD_TEXT[type].why}
                </p>
              </div>
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-base leading-tight">
                {HAZARD_TEXT[type].name}
                {measured && <span className="font-mono text-xs text-muted">{measured}</span>}
              </span>
              {!found && <span className="-mt-1 text-xs text-muted">needs our fine-tuned model</span>}
            </div>
          </BlurFade>
        );
      })}
    </ul>
  );
}
