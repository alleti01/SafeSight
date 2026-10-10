"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { GuideLink, HazardExplanation, SeverityPill } from "@/components/HazardCard";
import LabeledPhoto from "@/components/LabeledPhoto";
import { BlurFade } from "@/components/ui/blur-fade";
import PageShell, { BLACK_PILL, Panel, PILL } from "@/components/v4/PageShell";
import { HAZARD_TEXT } from "@/lib/hazards";
import { detailHref, galleryItems, useScans } from "@/lib/results";

export default function HazardDetailPage() {
  const params = useParams<{ job: string; hazard: string }>();
  const state = useScans();
  if (state === null) return null;

  const jobId = decodeURIComponent(params.job);
  const hazardId = decodeURIComponent(params.hazard);
  const items = galleryItems(state.scans);
  const index = items.findIndex((i) => i.jobId === jobId && i.hazard.hazard_id === hazardId);

  if (index === -1) {
    return (
      <PageShell>
        <Panel>
          <div className="flex flex-col items-start gap-4">
            <h1 className="m-0 text-[clamp(32px,4vw,52px)] leading-tight font-normal tracking-[-0.02em]">This result isn&apos;t available anymore</h1>
            <p className="m-0 text-[var(--ss-ink-2)]">Results are kept only while this browser tab is open.</p>
            <Link href="/#check" className={BLACK_PILL}>
              Check the room again
            </Link>
          </div>
        </Panel>
      </PageShell>
    );
  }

  const { hazard, frame, room } = items[index];
  const scan = state.scans.find((s) => s.job_id === jobId)!;
  const sameFrame = scan.hazards.filter((h) => h.frame_id === frame.frame_id);
  const others = sameFrame.filter((h) => h.hazard_id !== hazardId);
  const prev = items[index - 1];
  const next = items[index + 1];
  const name = HAZARD_TEXT[hazard.type]?.name ?? hazard.type;

  return (
    <PageShell>
      <Panel className="!py-8 sm:!py-10">
        <nav className="mb-8 flex flex-wrap items-center justify-between gap-3 text-[14px]" aria-label="Hazards">
          <Link href={state.isExample ? "/results?example" : "/results"} className={PILL}>
            ← All results
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-2 text-[var(--ss-ink-3)] tabular-nums">
              {index + 1} of {items.length}
            </span>
            {prev && (
              <Link href={detailHref(prev.jobId, prev.hazard.hazard_id, state.isExample)} className={PILL}>
                Previous
              </Link>
            )}
            {next && (
              <Link href={detailHref(next.jobId, next.hazard.hazard_id, state.isExample)} className={PILL}>
                Next
              </Link>
            )}
          </div>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] lg:items-start">
          <div className="overflow-hidden rounded-[24px] shadow-[0_20px_50px_rgba(62,54,46,0.12)]">
            <LabeledPhoto
              key={hazardId}
              frame={frame}
              hazards={sameFrame}
              focusId={hazardId}
              hrefFor={(h) => detailHref(jobId, h.hazard_id, state.isExample)}
            />
          </div>

          <section className="flex min-w-0 flex-col gap-4 rounded-[28px] bg-white/80 p-6 shadow-[0_20px_50px_rgba(62,54,46,0.1)] backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-full bg-[var(--ss-chip)] px-3 py-1 capitalize">{room}</span>
              <SeverityPill severity={hazard.severity} />
            </div>
            <h1 key={hazardId} className="m-0 text-[clamp(30px,3vw,42px)] leading-[1.1] font-normal tracking-[-0.02em]">
              {name}
            </h1>
            <BlurFade key={`text-${hazardId}`} delay={0.15} className="flex flex-col gap-4">
              <HazardExplanation hazard={hazard} />
              <GuideLink className="text-[14px]" />
            </BlurFade>

            {others.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-[var(--ss-line)] pt-4">
                <h2 className="m-0 text-[13px] font-medium text-[var(--ss-ink-3)]">Also in this photo</h2>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {others.map((h) => (
                    <li key={h.hazard_id}>
                      <Link href={detailHref(jobId, h.hazard_id, state.isExample)} className={`${PILL} !py-1.5 text-[13px]`}>
                        {HAZARD_TEXT[h.type]?.name ?? h.type}
                        <SeverityPill severity={h.severity} plain />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </Panel>
    </PageShell>
  );
}
