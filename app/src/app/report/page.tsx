"use client";

import Link from "next/link";
import { SeverityPill } from "@/components/HazardCard";
import LabeledPhoto from "@/components/LabeledPhoto";
import { Eyebrow } from "@/components/v4/Sections";
import PageShell, { BLACK_PILL, Panel, PILL } from "@/components/v4/PageShell";
import {
  CHECKED,
  duration,
  FIX_PLANS,
  HANDYMAN_RATE,
  labor,
  materials,
  money,
  planTotals,
  shopLinks,
  SOURCES,
} from "@/lib/costs";
import { GUIDE_URL, HAZARD_TEXT } from "@/lib/hazards";
import { galleryItems, useScans } from "@/lib/results";

export default function ReportPage() {
  const state = useScans();
  if (state === null) return null;

  const items = galleryItems(state.scans);
  const rooms = [...new Set(state.scans.map((s) => s.room))];
  const totals = planTotals(items.map((i) => i.hazard.type));
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (items.length === 0) {
    return (
      <PageShell>
        <Panel>
          <div className="flex flex-col items-start gap-4">
            <h1 className="m-0 text-[clamp(32px,4vw,52px)] leading-tight font-normal tracking-[-0.02em]">
              Nothing to fix yet
            </h1>
            <p className="m-0 text-[var(--ss-ink-2)]">
              The fix plan lists the hazards from your last check, with what
              each fix costs.
            </p>
            <Link href="/#check" className={BLACK_PILL}>
              Check a room
            </Link>
          </div>
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Panel className="bg-[radial-gradient(ellipse_at_90%_0%,var(--ss-glow)_0%,var(--ss-sheet)_50%)] print:bg-none">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-10 print:max-w-none print:gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <Link
              href={state.isExample ? "/results?example" : "/results"}
              className={PILL}
            >
              ← Back to results
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className={BLACK_PILL}
            >
              Save as PDF
            </button>
          </div>

          <header className="flex flex-col items-start gap-4 border-b border-[var(--ss-line)] pb-8 print:gap-1 print:border-[var(--ss-ink)] print:pb-3">
            <span className="print:hidden">
              <Eyebrow>SafeSight fix plan · {today}</Eyebrow>
            </span>
            <span className="hidden text-sm text-[var(--ss-ink-2)] print:block">
              SafeSight fix plan · {today}
            </span>
            <h1 className="m-0 text-[clamp(36px,4.6vw,60px)] leading-[1.05] font-normal tracking-[-0.02em] print:text-4xl">
              Fix plan for the {rooms.join(", ")}
            </h1>
            <p className="m-0 max-w-[640px] text-[15px] leading-relaxed text-[var(--ss-ink-2)]">
              {items.length} {items.length === 1 ? "thing" : "things"} that may
              be a problem for someone living with dementia, the cheapest way to
              fix each one, and what it costs to do it yourself or hire help.
            </p>
          </header>

          <section
            className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 print:grid-cols-3 print:gap-px print:border print:border-[var(--ss-faint)] print:bg-[var(--ss-faint)]"
            aria-label="Totals"
          >
            <Total
              label="Free first steps"
              value={`${totals.freeSteps} of ${items.length}`}
              note="Things you can do today at no cost."
            />
            <Total
              label="Do it yourself"
              value={money(totals.diy)}
              note={`About ${duration(totals.minutes)} of work, materials only.`}
            />
            <Total
              label="With a handyman"
              value={money(totals.hired)}
              note={`Materials plus labor at $${HANDYMAN_RATE[0]}–$${HANDYMAN_RATE[1]}/hour where it helps.`}
            />
          </section>

          <ol className="m-0 flex list-none flex-col gap-10 p-0 print:gap-3">
            {items.map((item, i) => {
              const plan = FIX_PLANS[item.hazard.type];
              const text = HAZARD_TEXT[item.hazard.type];
              const mat = materials(plan);
              const lab = labor(plan);
              return (
                <li
                  key={item.key}
                  className="grid gap-6 rounded-[28px] bg-[var(--ss-card)] p-4 shadow-[0_14px_34px_rgba(62,54,46,0.08)] break-inside-avoid sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] print:grid-cols-[minmax(0,0.75fr)_minmax(0,2fr)] print:gap-4 print:rounded-none print:border-t print:border-[var(--ss-faint)] print:p-0 print:pt-3 print:shadow-none"
                >
                  <div className="flex flex-col gap-2">
                    <div className="overflow-hidden rounded-[18px] print:rounded-none">
                      <LabeledPhoto
                        frame={item.frame}
                        hazards={[item.hazard]}
                        still
                        tags={false}
                      />
                    </div>
                    <span className="text-sm text-[var(--ss-ink-3)] capitalize">
                      {item.room}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-col gap-3 print:gap-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="grid size-7 place-items-center rounded-full bg-[var(--ss-ink)] text-[12px] text-white tabular-nums print:size-auto print:bg-transparent print:text-[var(--ss-ink-3)]">
                        {i + 1}
                      </span>
                      <SeverityPill severity={item.hazard.severity} />
                    </div>
                    <h2 className="m-0 text-[24px] leading-tight font-medium tracking-[-0.01em] print:text-lg">
                      {text?.name ?? item.hazard.type}
                    </h2>
                    {text && (
                      <p className="m-0 text-[15px] leading-relaxed text-[var(--ss-ink-2)] print:text-[9.5pt]">
                        {text.why}
                      </p>
                    )}

                    {plan.free && (
                      <p className="m-0 print:text-[9.5pt]">
                        <span className="font-medium">Free first step: </span>
                        {plan.free}
                      </p>
                    )}
                    <p className="m-0 print:text-[9.5pt]">
                      <span className="font-medium">Cheapest fix: </span>
                      {plan.fix}.
                    </p>

                    <table className="w-full border-collapse text-[15px] print:text-[9.5pt]">
                      <tbody>
                        {plan.items.map((c) => (
                          <tr
                            key={c.name}
                            className="border-t border-[var(--ss-line)] align-top"
                          >
                            <td className="py-2 pr-3 print:py-1">
                              {c.name}
                              {c.shop && (
                                <span className="block text-sm text-[var(--ss-ink-3)] print:hidden">
                                  Cheapest first:{" "}
                                  {shopLinks(c.shop).map((s, k) => (
                                    <span key={s.store}>
                                      {k > 0 && " · "}
                                      <a
                                        href={s.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="underline underline-offset-2 hover:text-[var(--ss-ink)]"
                                      >
                                        {s.store}
                                      </a>
                                    </span>
                                  ))}
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-right print:py-1 tabular-nums whitespace-nowrap">
                              {money([c.low, c.high])}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-[var(--ss-line)] align-top">
                          <td className="py-2 pr-3 print:py-1">
                            Do it yourself · {duration(plan.diyMinutes)}
                          </td>
                          <td className="py-2 text-right print:py-1 tabular-nums">
                            {money(mat)}
                          </td>
                        </tr>
                        {plan.handymanHours && (
                          <tr className="border-t border-[var(--ss-line)] align-top">
                            <td className="py-2 pr-3 print:py-1">
                              Or hire a handyman · {plan.handymanHours[0]}–
                              {plan.handymanHours[1]} hr
                            </td>
                            <td className="py-2 text-right print:py-1 tabular-nums whitespace-nowrap">
                              {money([mat[0] + lab[0], mat[1] + lab[1]])}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {plan.other.length > 0 && (
                      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-[var(--ss-ink-3)] print:gap-0 print:text-[8.5pt]">
                        {plan.other.map((o) => (
                          <li key={o}>· {o}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <footer className="flex flex-col gap-3 border-t border-[var(--ss-line)] pt-6 text-sm text-[var(--ss-ink-3)] break-inside-avoid print:gap-1 print:border-[var(--ss-ink)] print:pt-3 print:text-[8pt]">
            <p className="m-0">
              Prices are US averages from retail listings checked in {CHECKED},
              and change often; the shop links show today&apos;s cheapest
              options. Handyman rates vary by area, and many charge a minimum
              visit. This is a plan, not a quote or a safety inspection: every
              home and person is different.
            </p>
            <p className="m-0">
              Hazards and fixes follow the Alzheimer&apos;s Society guide{" "}
              <i>Making your home dementia friendly</i>:{" "}
              <a href={GUIDE_URL} className="underline underline-offset-2">
                alzheimers.org.uk
              </a>
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {SOURCES.map((s) => (
                <li key={s.url}>
                  {s.label}:{" "}
                  <a
                    href={s.url}
                    className="underline underline-offset-2 break-all"
                  >
                    {s.url.replace(/^https:\/\//, "")}
                  </a>
                </li>
              ))}
            </ul>
          </footer>
        </div>
      </Panel>
    </PageShell>
  );
}

function Total({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[22px] bg-[var(--ss-card)] p-5 shadow-[0_10px_30px_rgba(62,54,46,0.07)] print:rounded-none print:p-3 print:shadow-none">
      <span className="text-[13px] text-[var(--ss-ink-3)]">{label}</span>
      <span className="text-[32px] leading-tight font-normal tabular-nums print:text-2xl">
        {value}
      </span>
      <span className="text-sm text-[var(--ss-ink-3)]">{note}</span>
    </div>
  );
}
