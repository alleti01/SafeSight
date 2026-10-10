import Link from "next/link";
import type { Frame, Hazard, Severity } from "@/lib/contract";
import { GUIDE_URL, HAZARD_TEXT, SEVERITY_LABEL } from "@/lib/hazards";
import LabeledPhoto from "./LabeledPhoto";

export const SEVERITY_TEXT_CLASS: Record<Severity, string> = {
  high: "text-danger",
  medium: "text-warn-text",
  low: "text-calm",
};

const SEVERITY_BG: Record<Severity, string> = {
  high: "var(--danger)",
  medium: "var(--warn)",
  low: "var(--calm)",
};

export function SeverityPill({ severity, plain = false }: { severity: Severity; plain?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] leading-none font-medium whitespace-nowrap text-white print:!bg-transparent print:px-0 print:py-0 print:text-[var(--ss-ink)]"
      style={{ background: SEVERITY_BG[severity] }}
    >
      {plain ? <span className="capitalize">{severity}</span> : SEVERITY_LABEL[severity]}
    </span>
  );
}

export function HazardExplanation({ hazard }: { hazard: Hazard }) {
  const text = HAZARD_TEXT[hazard.type];
  if (!text) return null;
  return (
    <>
      <p className="m-0 text-[15px] leading-relaxed text-[var(--ss-ink-2)]">{text.why}</p>
      <p className="m-0 rounded-[16px] bg-[var(--ss-soft)] px-4 py-3 text-[15px] leading-relaxed">
        <span className="font-medium">Try this: </span>
        {text.fix}
      </p>
    </>
  );
}

export function GuideLink({ className = "" }: { className?: string }) {
  return (
    <a href={GUIDE_URL} target="_blank" rel="noreferrer" className={`text-[var(--ss-ink-2)] underline underline-offset-4 hover:text-[var(--ss-ink)] ${className}`}>
      Alzheimer&apos;s Society guide
    </a>
  );
}

export default function HazardCard({
  hazard,
  frame,
  room,
  href,
  number,
}: {
  hazard: Hazard;
  frame: Frame;
  room: string;
  href: string;
  number: number;
}) {
  const name = HAZARD_TEXT[hazard.type]?.name ?? hazard.type;

  return (
    <article className="flex h-full min-w-0 flex-col gap-4 rounded-[28px] bg-[var(--ss-card)] p-3 shadow-[0_14px_34px_rgba(62,54,46,0.08)]">
      <Link href={href} aria-label={`See ${name} in the full photo`} className="block overflow-hidden rounded-[20px]">
        <LabeledPhoto frame={frame} hazards={[hazard]} />
      </Link>

      <div className="flex flex-1 flex-col gap-3 px-2 pb-2">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="grid size-7 place-items-center rounded-full bg-[var(--ss-ink)] text-[12px] text-white tabular-nums">{number}</span>
          <span className="rounded-full bg-[var(--ss-chip)] px-3 py-1 capitalize">{room}</span>
          <SeverityPill severity={hazard.severity} />
        </div>

        <h2 className="m-0 text-[24px] leading-tight font-medium tracking-[-0.01em]">
          <Link href={href} className="hover:underline hover:underline-offset-4">
            {name}
          </Link>
        </h2>

        <HazardExplanation hazard={hazard} />

        <div className="mt-auto flex flex-wrap items-center gap-4 pt-1 text-[14px]">
          <Link href={href} className="rounded-full bg-[var(--ss-ink)] px-4 py-2 font-medium text-white hover:bg-[var(--ss-ink-hover)]">
            See full photo
          </Link>
          <GuideLink />
        </div>
      </div>
    </article>
  );
}
