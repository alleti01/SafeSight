"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SeverityPill, spotHazard, spotPhoto } from "@/components/HazardCard";
import { FixIcon } from "@/components/FixIcon";
import { Spotlight, useSize } from "@/components/v5/Finding";
import PageShell, { BLACK_PILL, Panel, PILL } from "@/components/v4/PageShell";
import type { Frame } from "@/lib/contract";
import { duration, labor, materials, money, planFor, shopLinks, type FixIconName, type Range } from "@/lib/costs";
import { guideFor } from "@/lib/guide";
import { findingText, roomName, SEVERITY_LABEL } from "@/lib/hazards";
import type { MeasuredHazard } from "@/lib/measure";
import { detailHref, fixHref, listedItems, useScans } from "@/lib/results";

/**
 * How to fix one finding, laid out like a listing page: the photo with the
 * fixes as picture tiles beside it, then one card per topic (why, key details,
 * steps, what to buy, other ways), and a panel that stays in view with the
 * free first step, jump links and the next finding.
 */
export default function FixPage() {
  const params = useParams<{ job: string; hazard: string }>();
  const state = useScans();
  if (state === null) return null;

  const jobId = decodeURIComponent(params.job);
  const hazardId = decodeURIComponent(params.hazard);
  const findings = listedItems(state.scans);
  const index = findings.findIndex((i) => i.jobId === jobId && i.hazard.hazard_id === hazardId);

  if (index === -1) {
    return (
      <PageShell>
        <Panel>
          <div className="flex flex-col items-start gap-4">
            <h1 className="m-0 font-v5 text-[clamp(32px,4vw,52px)] leading-tight font-medium tracking-[-0.03em]">
              This fix isn&apos;t available anymore
            </h1>
            <p className="m-0 text-[var(--ss-ink-2)]">Results are kept only while this browser tab is open.</p>
            <Link href="/#check" className={BLACK_PILL}>
              Check the room again
            </Link>
          </div>
        </Panel>
      </PageShell>
    );
  }

  const { hazard, frame, room } = findings[index];
  const prev = findings[index - 1];
  const next = findings[index + 1];
  const text = findingText({ ...hazard, room });
  const plan = planFor({ ...hazard, room });
  const guide = guideFor(hazard.type, room);
  const cost = materials(plan);
  const hired = labor(plan);
  const seen = hazard.object ? hazard.object.charAt(0).toUpperCase() + hazard.object.slice(1).replace(/_/g, " ") : text.name;
  const surface = ["floor", "wall", "floor+wall"].includes(hazard.object ?? "");

  // The fixes as picture tiles beside the photo: the suggested one, then the others.
  const tiles = [
    { href: "#fix", icon: plan.icon, label: "The fix we suggest", price: price(cost) },
    ...plan.alternatives.map((a, k) => ({ href: `#other-${k}`, icon: a.icon, label: a.fix, price: price([a.low, a.high]) })),
  ].slice(0, 4);

  const sections = [
    ["why", "Why"],
    ["details", "Key details"],
    ["fix", "Steps"],
    ...(plan.items.length ? [["buy", "What to buy"]] : []),
    ...(plan.alternatives.length ? [["other", "Other ways"]] : []),
    ...(plan.other.length ? [["know", "Good to know"]] : []),
  ];

  const details: [string, string][] = [
    ["Cost to fix", cost[1] > 0 ? money(cost) : "Free"],
    ["Time yourself", duration(plan.diyMinutes)],
    ["With a handyman", plan.handymanHours ? money([cost[0] + hired[0], cost[1] + hired[1]]) : "Not needed"],
    ["Free step today", plan.free ? "Yes" : "No"],
    ["Room", roomName(room).replace(/^./, (c) => c.toUpperCase())],
    ["Priority", SEVERITY_LABEL[hazard.severity]],
    ["Seen", surface ? `${seen}, measured` : `${seen}, ${Math.round(hazard.confidence * 100)}% sure`],
    ["In your video", hazard.time_s !== undefined ? `At ${clock(hazard.time_s)}` : "From a photo"],
  ];

  return (
    <PageShell>
      <Panel className="mx-auto max-w-[1440px] !py-8 sm:!py-10">
        <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 text-[14px]" aria-label="Findings">
          <Link href="/results" className={PILL}>
            ← All results
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-2 text-[13px] text-[var(--ss-ink-3)]">
              Finding {index + 1} of {findings.length}
            </span>
            {prev && (
              <Link href={fixHref(prev.jobId, prev.hazard.hazard_id)} className={PILL}>
                Previous
              </Link>
            )}
            {next && (
              <Link href={fixHref(next.jobId, next.hazard.hazard_id)} className={PILL}>
                Next
              </Link>
            )}
          </div>
        </nav>

        {/* 1. The photo, and the fixes as picture tiles that jump to each one. */}
        <div className="grid gap-2 lg:h-[460px] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <GalleryPhoto hazard={hazard} frame={frame} href={detailHref(jobId, hazardId)} />
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 lg:grid-rows-2">
            {tiles.map((t) => (
              <li key={t.href} className="min-h-0">
                <a
                  href={t.href}
                  className="group relative flex h-full min-h-[150px] flex-col justify-between rounded-[16px] bg-[var(--ss-chip)] p-4 transition-colors hover:bg-[var(--ss-soft)]"
                >
                  <span className="self-end rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-medium whitespace-nowrap">{t.price}</span>
                  <FixIcon name={t.icon} size={64} className="mx-auto text-[var(--ss-ink)] transition-transform group-hover:scale-105" />
                  <span className="line-clamp-2 text-[13px] leading-snug font-medium">{t.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* 2. What it is, at a glance. */}
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="m-0 font-v5 text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium tracking-[-0.03em]">{text.name}</h1>
                <SeverityPill severity={hazard.severity} />
              </div>
              <p className="m-0 mt-3 font-v5 text-[22px] font-medium tracking-[-0.01em]">
                {cost[1] > 0 ? `Fix from ${money(cost)}` : "Free to fix"}
              </p>
              <p className="m-0 mt-1 flex flex-wrap gap-x-2 text-[13px] text-[var(--ss-ink-3)]">
                <span className="capitalize">{roomName(room)}</span>
                <span aria-hidden="true">·</span>
                <span>{duration(plan.diyMinutes)} yourself</span>
                {hazard.time_s !== undefined && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{clock(hazard.time_s)} into your video</span>
                  </>
                )}
              </p>
            </Card>

            {/* On a phone the side panel's free step comes here instead. */}
            {plan.free && (
              <div className="lg:hidden">
                <FreeStep text={plan.free} />
              </div>
            )}

            <Card id="why" title="Why it may be a problem">
              <p className="m-0 text-[15px] leading-relaxed">{text.why}</p>
              <p className="m-0 mt-3 text-[14px] leading-relaxed text-[var(--ss-ink-2)]">
                {guide.says}{" "}
                <a href={guide.source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-[var(--ss-ink)]">
                  {guide.source.name}
                  {" "}↗
                </a>
              </p>
            </Card>

            <Card id="details" title="Key details">
              <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                {details.map(([term, value]) => (
                  <div key={term} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-[12px] text-[var(--ss-ink-3)]">{term}</dt>
                    <dd className="m-0 text-[15px] font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card id="fix" title="The fix we suggest">
              <div className="flex items-center gap-4">
                <IconTile name={plan.icon} big />
                <p className="m-0 font-v5 text-[20px] leading-snug font-medium tracking-[-0.01em]">{sentence(plan.fix)}</p>
              </div>
              <ol className="m-0 mt-5 grid list-none gap-2 p-0 sm:grid-cols-2">
                {plan.steps.map((step, i) => (
                  <li key={step} className="flex gap-3 rounded-[14px] border border-[var(--ss-line)] p-4 text-[14px] leading-relaxed">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ss-chip)] text-[12px] font-semibold">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Card>

            {plan.items.length > 0 && (
              <Card id="buy" title="What to buy">
                <ul className="m-0 list-none p-0">
                  {plan.items.map((c) => (
                    <li key={c.name} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--ss-line)] py-3 first:border-t-0 first:pt-0">
                      <span className="min-w-0 flex-1 text-[15px]">
                        {c.name}
                        <span className="block text-[13px] text-[var(--ss-ink-3)]">{money([c.low, c.high])}</span>
                      </span>
                      {c.shop && <ShopButtons query={c.shop} />}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {plan.alternatives.length > 0 && (
              <Card id="other" title="Other ways to fix it">
                <ul className="m-0 list-none p-0">
                  {plan.alternatives.map((alt, k) => (
                    <li
                      key={alt.fix}
                      id={`other-${k}`}
                      className="grid scroll-mt-28 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-2 border-t border-[var(--ss-line)] py-4 first:border-t-0 first:pt-0 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                    >
                      <IconTile name={alt.icon} />
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-[16px] leading-snug font-medium">{alt.fix}</span>
                        <span className="text-[14px] leading-relaxed text-[var(--ss-ink-2)]">{alt.when}</span>
                        <span className="text-[14px] font-medium sm:hidden">{price([alt.low, alt.high])}</span>
                      </div>
                      <div className="col-start-2 flex flex-col items-start gap-2 sm:col-start-3 sm:items-end">
                        <span className="text-[15px] font-medium whitespace-nowrap max-sm:hidden">{price([alt.low, alt.high])}</span>
                        {alt.shop && alt.high > 0 && <ShopButtons query={alt.shop} />}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {plan.other.length > 0 && (
              <Card id="know" title="Good to know">
                <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-[var(--ss-ink-2)]">
                  {plan.other.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </Card>
            )}

            <div className="flex flex-col gap-2 lg:hidden">
              <NextButton next={next} />
            </div>
          </div>

          {/* 3. Stays in view: the free step, where to jump, and what's next. */}
          <aside className="flex flex-col gap-4 max-lg:hidden lg:sticky lg:top-24">
            <Card>
              <div className="flex flex-col gap-5">
                {plan.free && <FreeStep text={plan.free} />}
                <div className="flex flex-col gap-2">
                  <h2 className="m-0 text-[13px] font-medium text-[var(--ss-ink-3)]">On this page</h2>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {sections.map(([id, label]) => (
                      <li key={id}>
                        <a href={`#${id}`} className="inline-block rounded-full border border-[var(--ss-line)] px-3 py-1.5 text-[13px] hover:bg-[var(--ss-soft)]">
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <NextButton next={next} />
                <Link href="/report" className="text-center text-[13px] text-[var(--ss-ink-2)] underline underline-offset-4 hover:text-[var(--ss-ink)]">
                  See the fix plan for every finding
                </Link>
              </div>
            </Card>
          </aside>
        </div>
      </Panel>
    </PageShell>
  );
}

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const price = (r: Range) => (r[1] === 0 ? "Free" : money(r));
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// The finding's photo, framed on it, filling the gallery's big tile.
function GalleryPhoto({ hazard, frame, href }: { hazard: MeasuredHazard; frame: Frame; href: string }) {
  const [ref, size] = useSize<HTMLDivElement>();
  return (
    <div ref={ref} className="relative aspect-[4/3] w-full overflow-hidden rounded-[16px] bg-[var(--ss-line)] lg:aspect-auto lg:h-full">
      {size.w > 0 && <Spotlight photo={spotPhoto(frame)} hazard={spotHazard(hazard)} w={size.w} h={size.h} color />}
      <Link
        href={href}
        className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1.5 text-[13px] font-medium text-[var(--ss-ink)] hover:bg-white"
      >
        View full photo
      </Link>
    </div>
  );
}

// One topic of the page, as a white card.
function Card({ id, title, children }: { id?: string; title?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgba(62,54,46,0.06),0_12px_32px_rgba(62,54,46,0.05)] sm:p-7">
      {title && <h2 className="m-0 mb-4 text-[15px] font-medium">{title}</h2>}
      {children}
    </section>
  );
}

function FreeStep({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[16px] bg-[var(--ss-soft)] p-4">
      <span className="flex items-center justify-between gap-2 text-[13px] font-medium">
        Start today, for free
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-normal text-[var(--ss-ink-2)]">No purchase needed</span>
      </span>
      <p className="m-0 text-[15px] leading-relaxed">{text}</p>
    </div>
  );
}

function NextButton({ next }: { next?: { jobId: string; hazard: { hazard_id: string } } }) {
  return (
    <Link href={next ? fixHref(next.jobId, next.hazard.hazard_id) : "/report"} className={`${BLACK_PILL} w-full`}>
      {next ? "Next finding →" : "See your fix plan →"}
    </Link>
  );
}

// A fix's drawing on a soft square.
function IconTile({ name, big = false }: { name: FixIconName; big?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-[14px] bg-[var(--ss-chip)] text-[var(--ss-ink)] ${big ? "size-16" : "size-14"}`}>
      <FixIcon name={name} size={big ? 44 : 38} />
    </span>
  );
}

// Cheapest-first searches at the two stores, as small buttons.
function ShopButtons({ query }: { query: string }) {
  return (
    <span className="flex gap-2">
      {shopLinks(query).map((s) => (
        <a
          key={s.store}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-[var(--ss-line)] px-3 py-1 text-[13px] whitespace-nowrap hover:bg-[var(--ss-soft)]"
        >
          {s.store}
        </a>
      ))}
    </span>
  );
}
