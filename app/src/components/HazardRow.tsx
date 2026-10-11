"use client";

import { useState } from "react";
import Link from "next/link";
import ContrastSwatches from "@/components/ContrastSwatches";
import HazardClip from "@/components/HazardClip";
import { SeverityPill, spotHazard, spotPhoto } from "@/components/HazardCard";
import { FindingTags, fixLine, Spotlight, useSize } from "@/components/v5/Finding";
import { assetUrl } from "@/lib/brain";
import { FIX_PLANS } from "@/lib/costs";
import type { Frame, Hazard } from "@/lib/contract";
import { guideFor, LRV_BAD, LRV_POOR } from "@/lib/guide";
import { hazardText } from "@/lib/hazards";
import { plainContrast, type MeasuredHazard } from "@/lib/measure";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const roomName = (room: string) => room.replace(/_/g, " ");
const OBJECT_NAME: Record<string, string> = {
  toilet_roll_holder: "Toilet roll holder",
  floor_clutter: "Clutter",
  glass_door: "Glass door",
  "floor+wall": "Floor and wall",
};
const objectLabel = (o?: string) => (o ? OBJECT_NAME[o] ?? o.charAt(0).toUpperCase() + o.slice(1).replace(/_/g, " ") : "");

// What the light reflectance numbers mean, in a sentence.
function lrvSentence(h: Hazard): string | null {
  const l = h.lrv;
  if (!l) return null;
  const d = Math.abs(l.object - l.around);
  if (!["bathroom_fitting_blends_in", "furniture_blends_in", "door_blends_in"].includes(h.type)) return null;
  return `Light reflectance ${Math.round(l.object)} against ${Math.round(l.around)}: a difference of ${Math.round(d)}. Design guides flag under ${LRV_POOR}${d < LRV_BAD ? `, and under ${LRV_BAD} is very hard to see` : ""}.`;
}

/** What was measured, in words, for findings that count because of what they are. */
function evidenceSentence(h: Hazard): string | null {
  const e = h.evidence ?? {};
  if (typeof e.darker_than_floor_by === "number") return `About ${Math.round(e.darker_than_floor_by)} points darker than the floor around it (light reflectance).`;
  if (h.type === "floor_transition" && typeof e.lrv_difference === "number")
    return `The two floors differ by about ${Math.round(e.lrv_difference)} points of light reflectance; guides suggest 10 or less.`;
  if (h.type === "floor_wall_blend" && typeof e.lrv_difference === "number")
    return `Floor and wall differ by only about ${Math.round(e.lrv_difference)} points of light reflectance.`;
  if (e.on_floor) return "Low in the picture, on the floor where feet go.";
  return null;
}

/**
 * One finding, as a row: on the left what we saw (the photo with the finding
 * spotlit, or a few seconds of the video with a frame that follows it), on the
 * right why it may be a problem, what we measured, what the guide says and a
 * cheap fix.
 */
export default function HazardRow({
  hazard,
  frame,
  room,
  href,
  number,
}: {
  hazard: MeasuredHazard;
  frame: Frame;
  room: string;
  href: string;
  number: number;
}) {
  const text = hazardText(hazard.type);
  const guide = guideFor(hazard.type);
  const photo = spotPhoto(frame);
  const hasClip = Boolean(hazard.clip_url && hazard.track?.length);
  const [view, setView] = useState<"clip" | "photo">(hasClip ? "clip" : "photo");
  const [media, size] = useSize<HTMLDivElement>();
  const contrast = plainContrast(hazard);
  const lrv = lrvSentence(hazard);
  const evidence = evidenceSentence(hazard);
  const plan = (FIX_PLANS as Partial<typeof FIX_PLANS>)[hazard.type];
  const label = [objectLabel(hazard.object) || text.name, `${Math.round(hazard.confidence * 100)}%`].join(" · ");

  return (
    <article className="grid overflow-hidden rounded-[20px] bg-white shadow-[0_14px_34px_rgba(62,54,46,0.08)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 p-3">
        <div
          ref={media}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] bg-[var(--ss-line)] lg:aspect-auto lg:min-h-[360px] lg:flex-1"
        >
          {view === "clip" && hasClip ? (
            <HazardClip src={assetUrl(hazard.clip_url!)} poster={photo.src} track={hazard.track!} label={label} />
          ) : size.w > 0 ? (
            <Spotlight photo={photo} hazard={spotHazard(hazard)} w={size.w} h={size.h} />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-1">
          {hasClip && (
            <div role="tablist" aria-label="Show" className="inline-flex rounded-full bg-[var(--ss-chip)] p-1 text-[13px]">
              {(["clip", "photo"] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  type="button"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-3.5 py-1 transition-colors ${
                    view === v ? "bg-white font-medium text-[var(--ss-ink)] shadow-[0_1px_3px_rgba(62,54,46,0.12)]" : "text-[var(--ss-ink-2)] hover:text-[var(--ss-ink)]"
                  }`}
                >
                  {v === "clip" ? "In your video" : "Best photo"}
                </button>
              ))}
            </div>
          )}
          {hazard.time_s !== undefined && (
            <span className="text-[13px] text-[var(--ss-ink-3)]">Seen {clock(hazard.time_s)} into your video</span>
          )}
          <Link href={href} className="ml-auto text-[13px] text-[var(--ss-ink-2)] underline underline-offset-4 hover:text-[var(--ss-ink)]">
            Full photo
          </Link>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-v5 text-[var(--ss-ink-3)]">{String(number).padStart(2, "0")}</span>
          <span className="rounded-full bg-[var(--ss-chip)] px-3 py-1 capitalize">{roomName(room)}</span>
          <SeverityPill severity={hazard.severity} />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="m-0 font-v5 text-[clamp(24px,2.4vw,30px)] leading-tight font-medium tracking-[-0.02em]">
            <Link href={href} className="hover:underline hover:underline-offset-4">
              {text.name}
            </Link>
          </h2>
          <p className="m-0 text-[15px] leading-relaxed text-[var(--ss-ink-2)]">{text.why}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <FindingTags up hazard={hazard} photo={photo} />
          </div>
        </div>

        {(contrast || lrv || evidence) && (
          <Section title="What we measured">
            {contrast && <ContrastSwatches c={contrast} />}
            {lrv && <p className="m-0 text-[13px] leading-relaxed text-[var(--ss-ink-3)]">{lrv}</p>}
            {!contrast && evidence && <p className="m-0 text-[14px] leading-relaxed text-[var(--ss-ink-2)]">{evidence}</p>}
          </Section>
        )}

        <Section title="What the guide says">
          <p className="m-0 text-[15px] leading-relaxed">{guide.says}</p>
          <a href={guide.source.url} target="_blank" rel="noreferrer" className="text-[13px] text-[var(--ss-ink-3)] underline underline-offset-4 hover:text-[var(--ss-ink)]">
            {guide.source.name} ↗
          </a>
        </Section>

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 rounded-[12px] bg-[var(--ss-soft)] px-4 py-3 text-[15px] leading-relaxed">
            {plan?.free && (
              <p className="m-0">
                <span className="font-medium">Free today: </span>
                {plan.free}
              </p>
            )}
            <p className="m-0">
              <span className="font-medium">Try this: </span>
              {plan ? `${plan.fix}.` : text.fix}
            </p>
          </div>
          <span className="text-[14px] font-medium text-[var(--ss-ink-2)]">{fixLine(hazard.type)}</span>
        </div>
      </div>
    </article>
  );
}

// A titled part of the row, marked like the rest of the site's labels.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-[var(--ss-line)] pt-4">
      <h3 className="m-0 flex items-center gap-2 font-display text-[15px] font-normal text-[var(--ss-ink-2)] italic">
        <span aria-hidden="true" className="size-[7px] bg-[var(--ss-ink)]" />
        {title}
      </h3>
      {children}
    </section>
  );
}
