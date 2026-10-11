"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { GuideLink, HazardExplanation, SeverityPill, spotHazard, spotPhoto } from "@/components/HazardCard";
import { FindingTags, fixLine, Spotlight } from "@/components/v5/Finding";
import { BlurFade } from "@/components/ui/blur-fade";
import PageShell, { BLACK_PILL, Panel, PILL } from "@/components/v4/PageShell";
import { HAZARD_TEXT } from "@/lib/hazards";
import { detailHref, listedItems, useScans } from "@/lib/results";

export default function HazardDetailPage() {
  const params = useParams<{ job: string; hazard: string }>();
  const state = useScans();
  if (state === null) return null;

  const jobId = decodeURIComponent(params.job);
  const hazardId = decodeURIComponent(params.hazard);
  const items = listedItems(state.scans);
  const index = items.findIndex((i) => i.jobId === jobId && i.hazard.hazard_id === hazardId);

  if (index === -1) {
    return (
      <PageShell>
        <Panel>
          <div className="flex flex-col items-start gap-4">
            <h1 className="m-0 text-[clamp(32px,4vw,52px)] leading-tight font-v5 font-medium tracking-[-0.03em]">This result isn&apos;t available anymore</h1>
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
  const photo = spotPhoto(frame);

  return (
    <PageShell>
      <Panel className="!py-8 sm:!py-10">
        <nav className="mb-8 flex flex-wrap items-center justify-between gap-3 text-[14px]" aria-label="Hazards">
          <Link href={state.isExample ? "/results?example" : "/results"} className={PILL}>
            ← All results
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-2 text-[var(--ss-ink-3)]">
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
          <div
            key={hazardId}
            className="relative w-full overflow-hidden rounded-[20px] bg-[var(--ss-line)] shadow-[0_20px_50px_rgba(62,54,46,0.12)]"
            style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
          >
            <Spotlight
              photo={photo}
              hazard={spotHazard(hazard)}
              w={frame.width}
              h={frame.height}
              zoom={false}
              others={others.map((h) => ({
                hazard: h,
                label: (
                  <Link
                    href={detailHref(jobId, h.hazard_id, state.isExample)}
                    className="absolute top-2 left-2 rounded-[6px] bg-white/90 px-2 py-0.5 text-[12px] font-medium whitespace-nowrap text-[var(--ss-ink)] hover:underline"
                  >
                    {HAZARD_TEXT[h.type]?.name ?? h.type}
                  </Link>
                ),
              }))}
            />
          </div>

          <section className="flex min-w-0 flex-col gap-4 rounded-[20px] bg-white p-6 shadow-[0_20px_50px_rgba(62,54,46,0.1)]">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-full bg-[var(--ss-chip)] px-3 py-1 capitalize">{room}</span>
              <SeverityPill severity={hazard.severity} />
            </div>
            <h1 key={hazardId} className="m-0 text-[clamp(30px,3vw,42px)] leading-[1.1] font-v5 font-medium tracking-[-0.03em]">
              {name}
            </h1>
            <BlurFade key={`text-${hazardId}`} delay={0.15} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <FindingTags hazard={hazard} photo={photo} />
              </div>
              <HazardExplanation hazard={hazard} />
              <p className="m-0 text-[14px] font-medium text-[var(--ss-ink-2)]">{fixLine(hazard.type)}</p>
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
