"use client";

import Link from "next/link";
import HazardCard from "@/components/HazardCard";
import { BlurFade } from "@/components/ui/blur-fade";
import { Eyebrow } from "@/components/v4/Sections";
import PageShell, { BLACK_PILL, Panel } from "@/components/v4/PageShell";
import { assetUrl } from "@/lib/brain";
import { detailHref, galleryItems, useScans } from "@/lib/results";

export default function ResultsPage() {
  const state = useScans();
  if (state === null) return null;

  const { scans, isExample } = state;
  const items = galleryItems(scans);
  const rooms = [...new Set(scans.map((s) => s.room))];
  const photoCount = scans.reduce((n, s) => n + s.frames.length, 0);
  const heading =
    items.length === 0
      ? scans.length > 0
        ? "Nothing flagged"
        : "Nothing flagged yet"
      : `${items.length} ${items.length === 1 ? "thing" : "things"} may be a problem`;

  return (
    <PageShell>
      <Panel className="bg-[radial-gradient(ellipse_at_90%_0%,var(--ss-glow)_0%,var(--ss-sheet)_55%)]">
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
          <div className="flex flex-col items-start gap-5">
            <Eyebrow>{isExample ? "Example results" : "Your results"}</Eyebrow>
            <h1 className="m-0 text-[clamp(36px,4.6vw,64px)] leading-[1.08] font-normal tracking-[-0.02em]">
              <span className="capitalize">{rooms.length > 0 ? rooms.join(", ") : "Results"}</span>
              <span className="flex items-center gap-4 text-[var(--ss-ink-2)]">
                <svg viewBox="0 0 60 24" className="h-[0.45em] w-[1em] shrink-0 text-[var(--ss-faint)]" aria-hidden="true">
                  <path d="M2 12h54M44 2l12 10-12 10" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {heading}
              </span>
            </h1>
          </div>
          {scans.length > 0 && (
            <BlurFade delay={0.2} className="flex flex-col items-start gap-5">
              <p className="m-0 text-[15px] leading-relaxed text-[var(--ss-ink-2)]">
                {photoCount} photo{photoCount === 1 ? "" : "s"} checked. Every home and person is different, so treat these as suggestions, not a
                safety inspection.
                {isExample && " Check a room to see your own."}
              </p>
              {items.length > 0 && (
                <Link href={isExample ? "/report?example" : "/report"} className={BLACK_PILL}>
                  Fix plan and costs (PDF) →
                </Link>
              )}
            </BlurFade>
          )}
        </header>
      </Panel>

      {items.length === 0 ? (
        <Panel>
          <p className="m-0 text-[20px]">
            {scans.length > 0 ? (
              "We didn't spot anything that may be a problem in these photos."
            ) : (
              <>
                <Link href="/#check" className="underline underline-offset-4">
                  Check a room
                </Link>{" "}
                to see what may need attention.
              </>
            )}
          </p>
        </Panel>
      ) : (
        <section className="mx-auto grid w-full max-w-[1440px] grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-3 sm:gap-6" aria-label="Flagged hazards">
          {items.map((item, i) => (
            <BlurFade key={item.key} delay={0.1 + i * 0.1}>
              <HazardCard
                hazard={item.hazard}
                frame={item.frame}
                room={item.room}
                number={i + 1}
                href={detailHref(item.jobId, item.hazard.hazard_id, isExample)}
              />
            </BlurFade>
          ))}
        </section>
      )}

      {scans.map((scan) =>
        scan.frames.length === 0 ? null : (
          <Panel key={scan.job_id} className="!py-8">
            <details open={items.length === 0}>
              <summary className="cursor-pointer text-[18px] font-medium">
                Photos we checked in the <span className="capitalize">{scan.room}</span> ({scan.frames.length})
              </summary>
              <ul className="m-0 mt-6 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-6">
                {scan.frames.map((f) => (
                  <li key={f.frame_id} className="flex flex-col gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetUrl(f.image_url)}
                      alt=""
                      className="w-full rounded-[16px] bg-[var(--ss-line)] object-cover grayscale"
                      style={{ aspectRatio: `${f.width} / ${f.height}` }}
                    />
                    {f.time_s !== undefined && (
                      <span className="text-[13px] text-[var(--ss-ink-3)] tabular-nums">
                        {Math.floor(f.time_s / 60)}:{String(Math.floor(f.time_s % 60)).padStart(2, "0")} into the video
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </Panel>
        ),
      )}
    </PageShell>
  );
}
