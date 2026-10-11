"use client";

import { useState } from "react";
import Link from "next/link";
import HazardClip from "@/components/HazardClip";
import { spotHazard, spotPhoto } from "@/components/HazardCard";
import { Spotlight, useSize } from "@/components/v5/Finding";
import { assetUrl } from "@/lib/brain";
import { materials, money, planFor } from "@/lib/costs";
import type { Frame, Hazard } from "@/lib/contract";
import { guideFor, LRV_BAD, LRV_POOR } from "@/lib/guide";
import { hazardText, SEVERITY_LABEL, roomName } from "@/lib/hazards";
import { plainContrast, type MeasuredHazard } from "@/lib/measure";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const OBJECT_NAME: Record<string, string> = {
  toilet_roll_holder: "Toilet roll holder",
  floor_clutter: "Clutter",
  glass_door: "Glass door",
  "floor+wall": "Floor and wall",
};
const objectLabel = (o?: string) => (o ? OBJECT_NAME[o] ?? o.charAt(0).toUpperCase() + o.slice(1).replace(/_/g, " ") : "");

const CLIP_FIRST = 0.75; // in view at least this much of the clip: show the clip first
const CLIP_OFFER = 0.4; // less than this: photo only

// Findings decided by the contrast check, with the measured gap in light
// reflectance points (0-100), for a tag in the row's header.
const pts = (n: number) => `${Math.round(n)} ${Math.round(n) === 1 ? "pt" : "pts"}`;
const points = (n: number) => `${Math.round(n)} ${Math.round(n) === 1 ? "point" : "points"}`;

function contrastNote(h: Hazard): string | null {
  const e = h.evidence ?? {};
  if (h.type === "dark_rug" && typeof e.darker_than_floor_by === "number") return `Darker than floor · ${pts(e.darker_than_floor_by)}`;
  const byContrast = ["bathroom_fitting_blends_in", "furniture_blends_in", "door_blends_in", "floor_wall_blend", "floor_transition"];
  if (!byContrast.includes(h.type)) return null;
  const d = typeof e.lrv_difference === "number" ? e.lrv_difference : h.lrv ? Math.abs(h.lrv.object - h.lrv.around) : null;
  if (d === null) return "Low contrast";
  return h.type === "floor_transition" ? `Floor change · ${pts(d)}` : `Low contrast · ${pts(d)}`;
}

// Whether the object-vs-around numbers (`lrv`, measured against everything
// around the object) tell the same story as the number the finding was decided
// on (`evidence.lrv_difference`, e.g. a door against the wall only). When they
// don't (a dark doorway next to a light door), showing them would contradict
// the finding, so only the deciding number is shown.
function lrvAgrees(h: Hazard): boolean {
  const e = h.evidence ?? {};
  if (!h.lrv || typeof e.lrv_difference !== "number") return Boolean(h.lrv);
  return Math.abs(Math.abs(h.lrv.object - h.lrv.around) - e.lrv_difference) <= 3;
}

// What the light reflectance numbers mean, in a sentence.
function lrvSentence(h: Hazard): string | null {
  if (!["bathroom_fitting_blends_in", "furniture_blends_in", "door_blends_in"].includes(h.type)) return null;
  const e = h.evidence ?? {};
  const l = h.lrv;
  const flag = (d: number) => `Design guides flag under ${LRV_POOR}${d < LRV_BAD ? `, and under ${LRV_BAD} is very hard to see` : ""}.`;
  if (l && lrvAgrees(h)) {
    const d = Math.abs(l.object - l.around);
    return `Light reflectance ${Math.round(l.object)} against ${Math.round(l.around)}: a difference of ${Math.round(d)}. ${flag(d)}`;
  }
  if (typeof e.lrv_difference !== "number") return null;
  const against = h.type === "door_blends_in" ? "the wall right around it" : "what's right around it";
  return `Light reflectance differs from ${against} by only about ${points(e.lrv_difference)}. ${flag(e.lrv_difference)}`;
}

/** What was measured, in words, for findings that count because of what they are. */
function evidenceSentence(h: Hazard): string | null {
  const e = h.evidence ?? {};
  if (typeof e.darker_than_floor_by === "number") return `About ${points(e.darker_than_floor_by)} darker than the floor around it (light reflectance).`;
  if (h.type === "floor_transition" && typeof e.lrv_difference === "number")
    return `The two floors differ by about ${points(e.lrv_difference)} of light reflectance; guides suggest 10 or less.`;
  if (h.type === "floor_wall_blend" && typeof e.lrv_difference === "number")
    return `Floor and wall differ by only about ${points(e.lrv_difference)} of light reflectance; guides look for 30 or more.`;
  if (e.on_floor) return "Low in the picture, on the floor where feet go.";
  return null;
}

/**
 * One finding, as a row: on the left what we saw (the photo with the finding
 * spotlit, or a few seconds of the video with a frame that follows it), on the
 * right why it may be a problem and, as a short list, what we saw, what we
 * measured, what the guide says and a cheap fix.
 */
export default function HazardRow({
  hazard,
  frame,
  room,
  href,
  number,
  onDismiss,
}: {
  hazard: MeasuredHazard;
  frame: Frame;
  room: string;
  href: string;
  number: number;
  onDismiss?: () => void;
}) {
  const text = hazardText(hazard.type);
  const guide = guideFor(hazard.type);
  const photo = spotPhoto(frame);
  // How much of the clip the object is actually in view. Short sightings show
  // the photo first (a box that's mostly hidden isn't worth watching); very
  // short ones don't offer the clip at all.
  const track = hazard.track ?? [];
  const inView = track.length ? track.filter((e) => e[5]).length / track.length : 0;
  const hasClip = Boolean(hazard.clip_url) && inView >= CLIP_OFFER;
  const [view, setView] = useState<"clip" | "photo">(hasClip && inView >= CLIP_FIRST ? "clip" : "photo");
  const contrastTag = contrastNote(hazard);
  const [media, size] = useSize<HTMLDivElement>();
  const contrast = plainContrast(hazard);
  const lrv = lrvSentence(hazard);
  const evidence = evidenceSentence(hazard);
  const plan = planFor(hazard) as ReturnType<typeof planFor> | undefined;
  const label = [objectLabel(hazard.object) || text.name, `${Math.round(hazard.confidence * 100)}%`].join(" · ");

  const guideRepeatsWhy = similar(guide.says, text.why);
  const cost = plan ? materials(plan) : null;
  const free = plan?.free && !similar(plan.free, plan.fix) ? plan.free : null;

  return (
    <article className="grid overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(62,54,46,0.06),0_12px_32px_rgba(62,54,46,0.06)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 p-3">
        <div
          ref={media}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] bg-[var(--ss-line)] lg:aspect-auto lg:min-h-[340px] lg:flex-1"
        >
          {view === "clip" && hasClip ? (
            <HazardClip src={assetUrl(hazard.clip_url!)} poster={photo.src} track={hazard.track!} label={label} />
          ) : size.w > 0 ? (
            <Spotlight photo={photo} hazard={spotHazard(hazard)} w={size.w} h={size.h} color />
          ) : null}
        </div>
        {hasClip && (
          <div className="flex items-center gap-1 px-1 text-[13px]" role="tablist" aria-label="Show">
            {(["clip", "photo"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                type="button"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  view === v ? "bg-[var(--ss-chip)] font-medium text-[var(--ss-ink)]" : "text-[var(--ss-ink-3)] hover:text-[var(--ss-ink)]"
                }`}
              >
                {v === "clip" ? "Video" : "Photo"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-6 p-6 sm:p-8">
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--ss-ink-3)]">
          <span className="font-v5">{String(number).padStart(2, "0")}</span>
          <span aria-hidden="true">·</span>
          <span className="capitalize">{roomName(room)}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 text-[var(--ss-ink-2)]">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: SEVERITY_DOT[hazard.severity] }} />
            {SEVERITY_LABEL[hazard.severity]}
          </span>
          {contrastTag && (
            <>
              <span aria-hidden="true">·</span>
              <span>{contrastTag}</span>
            </>
          )}
        </p>

        <div className="flex flex-col gap-2.5">
          <h2 className="m-0 font-v5 text-[clamp(24px,2.3vw,30px)] leading-[1.15] font-medium tracking-[-0.02em]">{text.name}</h2>
          <p className="m-0 text-[15px] leading-relaxed text-[var(--ss-ink-2)]">{text.why}</p>
        </div>

        <dl className="m-0 flex flex-col border-t border-[var(--ss-line)] text-[14px] leading-relaxed">
          <Row term="Seen">
            {SURFACES.has(hazard.object ?? "")
              ? `${objectLabel(hazard.object)}, measured from the photo`
              : `${objectLabel(hazard.object) || text.name}, ${Math.round(hazard.confidence * 100)}% sure`}
            {hazard.time_s !== undefined && <span className="text-[var(--ss-ink-3)]"> · {clock(hazard.time_s)} into your video</span>}
          </Row>
          {(contrast || lrv || evidence) && (
            <Row term="Measured">
              {contrast && lrvAgrees(hazard) && (
                <span className="mb-1.5 flex items-center gap-2">
                  <Swatch color={contrast.objectColor} /> {contrast.object}
                  <span className="text-[var(--ss-ink-3)]">vs</span>
                  <Swatch color={contrast.backgroundColor} /> {contrast.background}
                </span>
              )}
              <span className="text-[var(--ss-ink-2)]">{lrv ?? evidence ?? contrast?.sentence}</span>
            </Row>
          )}
          <Row term="Guide">
            {!guideRepeatsWhy && <span className="block">{guide.says}</span>}
            <a href={guide.source.url} target="_blank" rel="noreferrer" className="text-[var(--ss-ink-3)] underline underline-offset-4 hover:text-[var(--ss-ink)]">
              {guide.source.name}{"\u00a0"}↗
            </a>
          </Row>
          <Row term="Fix">
            {free && <span className="block">{free} Free.</span>}
            <span className="block">
              {plan ? `${plan.fix}.` : text.fix}
              {cost && cost[1] > 0 && <span className="whitespace-nowrap text-[var(--ss-ink-3)]"> From {money(cost)}.</span>}
            </span>
          </Row>
        </dl>

        <div className="mt-auto flex items-center gap-5 text-[13px]">
          <Link href={href} className="font-medium text-[var(--ss-ink)] hover:underline hover:underline-offset-4">
            See the full photo →
          </Link>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="ml-auto text-[var(--ss-ink-3)] hover:text-[var(--ss-ink)]">
              Not right? Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// Surface findings are measured from the photo, not detected, so they have no "how sure" number.
const SURFACES = new Set(["floor", "wall", "floor+wall"]);

const SEVERITY_DOT = { high: "var(--danger)", medium: "var(--warn)", low: "var(--calm)" } as const;

const words = (t: string) => new Set(t.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3));
/** Two texts whose first sentences share most of their words (showing both would repeat ourselves). */
function similar(a: string, b: string) {
  const [x, y] = [words(a.split(".")[0]), words(b.split(".")[0])];
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / Math.max(1, Math.min(x.size, y.size)) >= 0.6;
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block size-4 rounded-[4px] border border-black/10" style={{ background: color }} />;
}

// One line of the finding's details: a quiet label on the left, the detail on the right.
function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--ss-line)] py-3 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] text-[var(--ss-ink-3)]">{term}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}
