import Link from "next/link";
import type { Frame, Hazard, Severity } from "@/lib/contract";
import { assetUrl } from "@/lib/brain";
import { findingText, GUIDE_URL, SEVERITY_LABEL, roomName } from "@/lib/hazards";
import { FindingTags, fixLine, Spotlight } from "@/components/v5/Finding";

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

export function HazardExplanation({ hazard, room }: { hazard: Hazard; room?: string }) {
  const text = findingText({ ...hazard, room });
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

// A finding from a scan, ready for the spotlight: the photo and outline
// resolved against the brain.
export const spotPhoto = (frame: Frame) => ({ src: assetUrl(frame.image_url), width: frame.width, height: frame.height });
export const spotHazard = (hazard: Hazard) => ({ ...hazard, outline_url: hazard.outline_url ? assetUrl(hazard.outline_url) : "" });

export default function HazardCard({
  hazard,
  frame,
  room,
  href,
  number,
  total,
}: {
  hazard: Hazard;
  frame: Frame;
  room: string;
  href: string;
  number: number;
  total: number;
}) {
  const text = findingText({ ...hazard, room });
  const name = text.name;
  const photo = spotPhoto(frame);

  return (
    <article className="flex h-full min-w-0 flex-col gap-3 rounded-[20px] bg-white p-5 shadow-[0_14px_34px_rgba(62,54,46,0.08)]">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="rounded-full bg-[var(--ss-chip)] px-3 py-1 capitalize">{roomName(room)}</span>
        <SeverityPill severity={hazard.severity} />
        <span className="ml-auto font-v5 text-[13px] text-[var(--ss-ink-3)]">
          {number} of {total}
        </span>
      </div>

      <h2 className="m-0 font-v5 text-[24px] leading-tight font-medium tracking-[-0.01em]">
        <Link href={href} className="hover:underline hover:underline-offset-4">
          {name}
        </Link>
      </h2>
      {text && <p className="m-0 text-[14px] leading-relaxed text-[var(--ss-ink-2)]">{text.why}</p>}

      <Link
        href={href}
        aria-label={`See ${name} in the full photo`}
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-[12px] bg-[var(--ss-line)]"
      >
        <Spotlight photo={photo} hazard={spotHazard(hazard)} w={4} h={3} color />
      </Link>

      <div className="flex flex-wrap items-center gap-1.5">
        <FindingTags up hazard={hazard} photo={photo} />
        <span className="ml-auto text-[13px] font-medium text-[var(--ss-ink-2)]">{fixLine(hazard.type, hazard.object, room)}</span>
      </div>

      {text && (
        <p className="m-0 rounded-[12px] bg-[var(--ss-soft)] px-4 py-3 text-[14px] leading-relaxed">
          <span className="font-medium">Try this: </span>
          {text.fix}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-4 pt-1 text-[14px]">
        <Link href={href} className="rounded-full bg-[var(--ss-ink)] px-4 py-2 font-medium text-white hover:bg-[var(--ss-ink-hover)]">
          See it in the photo
        </Link>
        <GuideLink />
      </div>
    </article>
  );
}
