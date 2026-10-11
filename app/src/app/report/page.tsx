"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { spotHazard, spotPhoto } from "@/components/HazardCard";
import { Spotlight } from "@/components/v5/Finding";
import PageShell, { BLACK_PILL, Panel, PILL } from "@/components/v4/PageShell";
import {
  duration,
  FIX_PLANS,
  labor,
  materials,
  money,
  planTotals,
  shopLinks,
} from "@/lib/costs";
import { GUIDE_URL, HAZARD_TEXT, SEVERITY_LABEL } from "@/lib/hazards";
import { galleryItems, useScans, type GalleryItem } from "@/lib/results";

// The fix plan, laid out like a plan rather than a stack of cards (after home
// inspection summaries, the CDC and AARP home checklists, and phased dental
// plans): the totals and a numbered index of every finding first; then what
// to do, by when (today for free, this weekend yourself, or a handyman), with
// a box to tick for each; then one shopping list for everything. Each finding
// keeps its number throughout, and its photo appears once, where it first
// comes up.

// Whether the plan covers more than one room (if not, rows don't repeat it).
const PlanContext = createContext({ manyRooms: false });

interface Numbered extends GalleryItem {
  n: number;
}

const same = (a: string, b: string) =>
  a.replace(/\.$/, "").toLowerCase() === b.replace(/\.$/, "").toLowerCase();
const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

export default function ReportPage() {
  const state = useScans();
  if (state === null) return null;

  const items: Numbered[] = galleryItems(state.scans).map((item, i) => ({
    ...item,
    n: i + 1,
  }));
  const rooms = [...new Set(state.scans.map((s) => s.room))];
  const totals = planTotals(items.map((i) => i.hazard.type));
  // Frames from a video carry their time in it; photos don't.
  const frames = state.scans.flatMap((sc) => sc.frames);
  const video = frames.some((f) => f.time_s !== undefined);
  const source = state.isExample
    ? "these photos"
    : video
      ? "your video"
      : frames.length === 1
        ? "your photo"
        : "your photos";
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
            <h1 className="m-0 font-v5 text-[clamp(32px,4vw,52px)] leading-tight font-medium tracking-[-0.03em]">
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

  const plan = (i: Numbered) => FIX_PLANS[i.hazard.type];
  const free = items.filter((i) => plan(i).free);
  const weekend = items.filter(
    (i) => !plan(i).free || !same(plan(i).free!, plan(i).fix),
  );
  const hired = items.filter((i) => plan(i).handymanHours);
  // Each finding's photo shows where it first comes up.
  const firstSeen = new Set<number>();
  const showPhoto = (i: Numbered) =>
    !firstSeen.has(i.n) && !!firstSeen.add(i.n);

  // Everything to buy, once each, with the findings it's for.
  const shopping = new Map<
    string,
    { name: string; low: number; high: number; shop?: string; for: number[] }
  >();
  for (const i of weekend) {
    for (const c of plan(i).items) {
      const row = shopping.get(c.name) ?? { ...c, for: [] };
      row.for.push(i.n);
      shopping.set(c.name, row);
    }
  }

  return (
    <PlanContext.Provider value={{ manyRooms: rooms.length > 1 }}>
      <PageShell>
        <Panel className="print:bg-none">
          <article className="mx-auto flex max-w-[860px] flex-col gap-10 print:max-w-none print:gap-5 print:text-[9.5pt]">
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <Link
                href={state.isExample ? "/#fixes" : "/results"}
                className={PILL}
              >
                {/* The example plan goes back to "What you get" on the home page; a real one to its results. */}
                ← Back
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className={BLACK_PILL}
              >
                Save as PDF
              </button>
            </div>

            {/* 1. What this is, and the totals. */}
            <header className="flex flex-col gap-3 print:gap-1.5">
              <span className="font-v5 text-[14px] text-[var(--ss-ink-3)] print:text-[10pt]">
                SafeSight fix plan ·{" "}
                <span className="capitalize">{rooms.join(", ")}</span> · {today}{" "}
                ·{" "}
                <a
                  href={GUIDE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-[var(--ss-ink)]"
                >
                  Alzheimer&apos;s Society guide
                </a>
              </span>
              <h1 className="m-0 font-v5 text-[clamp(36px,4.6vw,56px)] leading-[1.05] font-medium tracking-[-0.03em] print:text-[26pt]">
                Fix plan for the {rooms.join(", ")}
              </h1>
              <p className="m-0 text-[17px] text-[var(--ss-ink-2)] print:text-[10.5pt]">
                {items.length} {items.length === 1 ? "thing" : "things"} in{" "}
                {source} may be a problem.
              </p>
            </header>

            <section
              aria-label="Totals"
              className="grid grid-cols-2 border-y border-[var(--ss-ink)] sm:grid-cols-4 print:grid-cols-4"
            >
              <Total
                value={`${items.length}`}
                label={
                  items.length === 1 ? "thing to look at" : "things to look at"
                }
              />
              <Total value={`${totals.freeSteps}`} label="free to do today" />
              <Total value={money(totals.diy)} label="if you do it yourself" />
              <Total value={money(totals.hired)} label="with a handyman" />
            </section>

            {/* 2. Every finding, one line each; the numbers carry through the plan. */}
            <section aria-label="What we found">
              <div className="flex justify-end gap-3 pb-1 text-[12px] text-[var(--ss-ink-3)] print:text-[7.5pt]">
                <span className="max-sm:hidden print:inline">Priority</span>
                <span className="w-[104px] whitespace-nowrap text-right print:w-[68px]">
                  To fix yourself
                </span>
              </div>
              <ol className="m-0 list-none border-t border-[var(--ss-line)] p-0">
                {items.map((i) => (
                  <li
                    key={i.key}
                    className="flex items-baseline gap-3 border-b border-[var(--ss-line)] py-2.5 print:py-1"
                  >
                    <Num n={i.n} />
                    <span className="font-medium">
                      {HAZARD_TEXT[i.hazard.type]?.name ?? i.hazard.type}
                    </span>
                    {rooms.length > 1 && (
                      <span className="text-[var(--ss-ink-3)] capitalize">
                        {i.room}
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-[var(--ss-faint)]"
                    />
                    <span className="text-[14px] whitespace-nowrap text-[var(--ss-ink-2)] max-sm:hidden print:inline print:text-[9pt]">
                      {SEVERITY_LABEL[i.hazard.severity]}
                    </span>
                    <span className="w-[104px] whitespace-nowrap text-right tabular-nums print:w-[68px]">
                      {money(materials(plan(i)))}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {/* 3. What to do, by when. */}
            {free.length > 0 && (
              <Band title="Today" note="Free, with things you already have">
                {free.map((i) => (
                  <Row key={i.key} item={i} photo={showPhoto(i)}>
                    <Task>{plan(i).free}</Task>
                  </Row>
                ))}
              </Band>
            )}

            {weekend.length > 0 && (
              <Band title="This weekend" note="Do it yourself">
                {weekend.map((i) => {
                  const p = plan(i);
                  return (
                    <Row
                      key={i.key}
                      item={i}
                      photo={showPhoto(i)}
                      cost={money(materials(p))}
                    >
                      <Task>{sentence(p.fix)}</Task>
                      <span className="block pl-6 text-[14px] text-[var(--ss-ink-3)] print:text-[8.5pt]">
                        {duration(p.diyMinutes)}
                        {p.items.length > 0
                          ? ` · buy ${p.items.map((c) => c.name.toLowerCase()).join(" and ")}`
                          : " · nothing to buy"}
                      </span>
                    </Row>
                  );
                })}
              </Band>
            )}

            {hired.length > 0 && (
              <Band
                title="Or call a handyman"
                note="If you'd rather not do it yourself"
              >
                {hired.map((i) => {
                  const p = plan(i);
                  const m = materials(p);
                  const l = labor(p);
                  return (
                    <Row
                      key={i.key}
                      item={i}
                      photo={false}
                      cost={money([m[0] + l[0], m[1] + l[1]])}
                    >
                      <Task>{sentence(p.fix)}</Task>
                      <span className="block pl-6 text-[14px] text-[var(--ss-ink-3)] print:text-[8.5pt]">
                        About {p.handymanHours![0]}–{p.handymanHours![1]} hr,
                        including what to buy
                      </span>
                    </Row>
                  );
                })}
              </Band>
            )}

            {/* 4. One shopping list for everything, to cut out and take along. */}
            {shopping.size > 0 && (
              <section
                aria-label="Shopping list"
                className="break-inside-avoid rounded-[6px] border-2 border-dashed border-[var(--ss-faint)] p-5 print:p-3"
              >
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="m-0 font-v5 text-[20px] font-medium tracking-[-0.01em] print:text-[12pt]">
                    <span
                      aria-hidden="true"
                      className="mr-2 text-[var(--ss-ink-3)]"
                    >
                      ✂
                    </span>
                    Shopping list
                  </h2>
                  <span className="font-v5 text-[13px] text-[var(--ss-ink-3)] print:text-[9.5pt]">
                    Cheapest first at Walmart or Amazon
                  </span>
                </div>
                <ul className="m-0 list-none p-0">
                  {[...shopping.values()].map((c) => (
                    <li
                      key={c.name}
                      className="flex items-baseline gap-3 border-t border-[var(--ss-line)] py-2 print:py-1"
                    >
                      <Box />
                      <span className="flex-1">
                        {c.name}
                        <span className="text-[var(--ss-ink-3)]">
                          {" "}
                          · for {c.for.map((n) => `#${n}`).join(", ")}
                        </span>
                      </span>
                      {c.shop && (
                        <span className="text-[14px] text-[var(--ss-ink-3)] print:hidden">
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
                      <span className="w-[104px] whitespace-nowrap text-right tabular-nums print:w-[68px]">
                        {money([c.low, c.high])}
                      </span>
                    </li>
                  ))}
                  <li className="flex items-baseline justify-between gap-3 border-t border-[var(--ss-ink)] pt-2 font-medium print:pt-1">
                    <span>Everything on the list</span>
                    <span className="tabular-nums">{money(totals.diy)}</span>
                  </li>
                </ul>
              </section>
            )}
          </article>
        </Panel>
      </PageShell>
    </PlanContext.Provider>
  );
}

function Total({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-[var(--ss-line)] px-1 py-4 sm:border-l sm:px-5 sm:first:border-l-0 sm:first:pl-0 print:border-l print:px-3 print:py-2 print:first:border-l-0 print:first:pl-0">
      <span className="font-v5 text-[30px] leading-tight font-medium tracking-[-0.02em] tabular-nums print:text-[17pt]">
        {value}
      </span>
      <span className="text-[13px] text-[var(--ss-ink-3)] print:text-[8.5pt]">
        {label}
      </span>
    </div>
  );
}

// A heading for a "when" band, with a hairline under it.
function Band({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--ss-ink)] pb-2 print:pb-1">
        <h2 className="m-0 font-v5 text-[24px] font-medium tracking-[-0.02em] print:text-[13pt]">
          {title}
        </h2>
        <span className="font-v5 text-[13px] text-[var(--ss-ink-3)] print:text-[9.5pt]">
          {note}
        </span>
      </div>
      <ul className="m-0 list-none p-0">{children}</ul>
    </section>
  );
}

// One finding in a band: its number (and photo with why, the first time it
// comes up), the thing to do, and what it costs.
function Row({
  item,
  photo,
  cost,
  children,
}: {
  item: Numbered;
  photo: boolean;
  cost?: string;
  children: React.ReactNode;
}) {
  const { manyRooms } = useContext(PlanContext);
  const text = HAZARD_TEXT[item.hazard.type];
  return (
    <li className="flex gap-4 border-b border-[var(--ss-line)] py-3 break-inside-avoid print:gap-3 print:py-1.5">
      {photo ? (
        <div className="relative aspect-[4/3] w-[132px] shrink-0 self-start max-sm:w-[104px] overflow-hidden rounded-[6px] bg-[var(--ss-line)] print:w-[30mm] print:rounded-[3px]">
          <Spotlight
            photo={spotPhoto(item.frame)}
            hazard={spotHazard(item.hazard)}
            w={4}
            h={3}
          />
          <span className="absolute top-1.5 left-1.5">
            <Num n={item.n} />
          </span>
        </div>
      ) : (
        <span className="pt-0.5">
          <Num n={item.n} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1 print:gap-0.5">
        <span className="text-[14px] text-[var(--ss-ink-3)] print:text-[8.5pt]">
          {text?.name ?? item.hazard.type}
          {manyRooms && <span className="capitalize"> · {item.room}</span>}
        </span>
        {photo && text && (
          <span className="text-[14px] leading-snug text-[var(--ss-ink-2)] print:text-[8.5pt]">
            {text.why}
          </span>
        )}
        <div className={photo ? "mt-1" : ""}>{children}</div>
      </div>
      {cost && (
        <span className="w-[104px] whitespace-nowrap shrink-0 pt-0.5 text-right tabular-nums print:w-[68px]">
          {cost}
        </span>
      )}
    </li>
  );
}

function Task({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-baseline gap-2 font-medium">
      <Box />
      {children}
    </span>
  );
}

function Box() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-[13px] shrink-0 translate-y-[2px] rounded-[2px] border-[1.5px] border-[var(--ss-ink)] print:size-[9pt]"
    />
  );
}

function Num({ n }: { n: number }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--ss-ink)] text-[12px] font-medium text-white tabular-nums print:size-[13pt] print:text-[8pt]">
      {n}
    </span>
  );
}
