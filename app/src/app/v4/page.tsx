"use client";

// The fourth home page design (VR-hero style), kept for comparison. The home
// page is now the fifth design.

import { useState } from "react";
import Link from "next/link";
import AnalysisProgress from "@/components/AnalysisProgress";
import CompareSlider from "@/components/landing/CompareSlider";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import PrivacyBlur, { type PrivacyPhoto } from "@/components/landing/PrivacyBlur";
import PhotoCredits from "@/components/PhotoCredits";
import { Dots } from "@/components/SiteHeader";
import { CheckForm, HazardArches, Heading, Isolated, ModelStages, Readout, SEVERITY_DOT, Sheet } from "@/components/v4/Sections";
import RoomTour from "@/components/room-tour/RoomTour";
import { Lens, ProfileCard, RoomPicker, SeverityBadge, type Room } from "@/components/v4/Widgets";
import type { HazardType } from "@/lib/contract";
import { duration, FIX_PLANS, materials, money, planTotals } from "@/lib/costs";
import { GUIDE_URL, HAZARD_TEXT } from "@/lib/hazards";
import { biggest } from "@/lib/measure";
import siteImages from "@/lib/site-images.json";
import { useRoomCheck } from "@/lib/useRoomCheck";

const SITE = siteImages as unknown as Record<string, SitePhoto> & { privacy?: PrivacyPhoto };
const find = (key: string, type: HazardType) => biggest(SITE[key]?.hazards.filter((h) => h.type === type) ?? []);

const ROOMS: [string, string, HazardType][] = [
  ["bathroom", "bath-rug", "dark_rug"],
  ["hallway", "dark-rug", "dark_rug"],
  ["bedroom", "mirror", "mirror"],
];

const TILES: [HazardType, string][] = [
  ["dark_rug", "bath-rug"],
  ["loose_rug", "loose-rug"],
  ["shiny_floor", "shiny-floor"],
  ["patterned_floor", "patterned-floor"],
  ["bathroom_fitting_blends_in", "lookalike"],
  ["furniture_blends_in", "furniture-blends"],
  ["mirror", "mirror"],
  ["stair_edge_hard_to_see", "stairs"],
  ["floor_clutter", "clutter"],
  ["toilet_lookalike", "lookalike"],
];

// The fix plan for the example bathroom, priced by lib/costs.
const PLAN: [string, HazardType][] = [
  ["bath-rug", "dark_rug"],
  ["bath-white", "bathroom_fitting_blends_in"],
  ["mirror", "mirror"],
];
const PLAN_TOTALS = planTotals(PLAN.map(([, type]) => type));

// Recolors the dark mat light for the "after" side. A simulation, labeled so.
const LIGHT_RUG = "grayscale(1) invert(0.82) sepia(0.25) brightness(1.08)";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#model", label: "What it sees" },
  { href: "#plan", label: "Fix plan" },
  { href: "#privacy", label: "Privacy" },
];

export default function HomePageV4() {
  const check = useRoomCheck();
  const rooms: Room[] = ROOMS.flatMap(([name, key, type]) => {
    const hazard = find(key, type);
    return hazard ? [{ name, photo: SITE[key], hazard }] : [];
  });
  const [active, setActive] = useState(0);
  const room = rooms[active];
  const filming = SITE.filming;
  const tiles = TILES.flatMap(([type, key]) => (SITE[key] ? [{ type, photo: SITE[key], hazard: find(key, type) }] : []));
  const mat = find("bath-rug", "dark_rug");
  const entryRug = find("dark-rug", "dark_rug");

  if (check.working) return <AnalysisProgress room={check.room} progress={check.progress} />;

  return (
    <div className="flex min-h-svh flex-col gap-3 bg-[var(--ss-page)] p-3 font-v4 text-[var(--ss-ink)] sm:gap-6 sm:p-6 lg:p-10">
      {/* First thing you see: the room, which pops its hazards one by one. */}
      <section id="look" className="relative mx-auto flex h-[calc(100svh-24px)] min-h-[560px] w-full max-w-[1440px] flex-col overflow-hidden rounded-[28px] bg-[var(--ss-sheet)] sm:h-[calc(100svh-48px)] sm:rounded-[36px] lg:h-[calc(100svh-80px)]">
        {/* Nav */}
        <nav className="relative z-20 flex items-center justify-between gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
          <Link href="/v4" className="flex items-center gap-2.5 text-[22px] font-medium tracking-tight">
            <Dots />
            <span className="max-[360px]:sr-only">SafeSight</span>
          </Link>
          <ul className="m-0 hidden list-none items-center gap-2 p-0 text-[15px] md:flex">
            <li><span className="block rounded-full bg-[var(--ss-card)] px-4 py-2 font-medium shadow-[0_6px_16px_rgba(62,54,46,0.06)]">Home</span></li>
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="block px-4 py-2 text-[var(--ss-ink-2)] hover:text-[var(--ss-ink)]">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <a href="#check" className="shrink-0 rounded-full bg-[var(--ss-ink)] px-5 py-2.5 text-[14px] font-medium whitespace-nowrap text-white shadow-[0_10px_24px_rgba(62,54,46,0.25)] hover:bg-[var(--ss-ink-hover)]">
            Check a room
          </a>
        </nav>
        <div className="relative mx-3 mt-4 mb-3 flex-1 overflow-hidden rounded-[22px] sm:mx-6 sm:mt-5 sm:mb-6 sm:rounded-[28px]">
          {SITE["room-wide"] && (
            <RoomTour photo={SITE["room-wide"]}>
              <div className="pointer-events-none absolute top-4 right-4 left-4 rounded-[20px] bg-white/80 p-4 backdrop-blur-md sm:right-auto sm:max-w-[min(440px,calc(100%-160px))] sm:p-5">
                <h1 className="m-0 font-v4 text-[clamp(20px,2.4vw,32px)] leading-[1.1] font-normal tracking-[-0.02em]">Find what may be a problem.</h1>
                <p className="m-0 mt-2 hidden text-[14px] leading-snug text-[var(--ss-ink-2)] sm:block">
                  See this room the way someone living with dementia might. It&apos;s a made-up example; what&apos;s highlighted is what SafeSight really
                  found in it.
                </p>
              </div>
            </RoomTour>
          )}
        </div>
      </section>

      <section id="top" className="relative mx-auto w-full flex min-h-[calc(100svh-24px)] max-w-[1440px] flex-col overflow-hidden rounded-[28px] bg-[var(--ss-sheet)] sm:min-h-[calc(100svh-48px)] sm:rounded-[36px] lg:min-h-[760px]">
        {/* Soft light from the lower right, and faint guide lines. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_95%,var(--ss-glow)_0%,rgba(230,211,189,0)_55%)]" />
        <div className="pointer-events-none absolute top-[52%] left-[30%] hidden h-px w-[30%] bg-[var(--ss-line)] lg:block" />
        <div className="pointer-events-none absolute top-[40%] left-[40%] hidden h-[30%] w-px bg-[var(--ss-line)] lg:block" />


        <div className="relative grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Left: words */}
          <div className="relative z-10 flex flex-col gap-8 px-5 pt-10 pb-6 sm:px-10 lg:pt-24 lg:pb-10">
            <h2 className="m-0 font-v4 text-[clamp(40px,5vw,68px)] leading-[1.12] font-normal tracking-[-0.02em]">
              See the Home
              <span className="flex items-center gap-4">
                <svg viewBox="0 0 60 24" className="h-[0.5em] w-[1.1em] shrink-0 text-[var(--ss-faint)]" aria-hidden="true">
                  <path d="M2 12h54M44 2l12 10-12 10" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Through Their
              </span>
              Eyes
            </h2>

            <div className="flex flex-col gap-5 sm:ml-[20%] lg:ml-[34%]">
              <a href="#check" className="self-start rounded-full bg-[var(--ss-ink)] px-7 py-4 text-[15px] font-medium text-white shadow-[0_18px_36px_rgba(62,54,46,0.25)] hover:bg-[var(--ss-ink-hover)]">
                Check a room
              </a>
              <p className="m-0 max-w-[400px] text-[15px] leading-relaxed text-[var(--ss-ink-2)]">
                Film a room on your phone. SafeSight greys out everything except what may confuse or trip someone living with dementia, and
                gives you the cheapest fix.
              </p>
            </div>

            {/* Side pill of links */}
            <div className="absolute top-[52%] left-5 hidden flex-col gap-1 rounded-full bg-[var(--ss-card)] p-1.5 shadow-[0_10px_30px_rgba(62,54,46,0.08)] sm:left-10 lg:flex">
              <PillLink href={GUIDE_URL} label="The Alzheimer's Society guide" external>
                <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Zm0 16a2 2 0 0 1 2-2h12" />
              </PillLink>
              <PillLink href="/results?example" label="Example results">
                <path d="M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6" />
              </PillLink>
              <PillLink href="/report?example" label="Fix plan PDF">
                <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" />
              </PillLink>
              <PillLink href="#privacy" label="Privacy">
                <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
              </PillLink>
            </div>

            <div className="mt-auto pt-6">
              <span className="block text-[44px] leading-none font-normal tracking-tight">10</span>
              <span className="mt-2 block max-w-[220px] text-[14px] leading-snug text-[var(--ss-ink-3)]">
                hazards from the Alzheimer&apos;s Society guide
              </span>
            </div>
          </div>

          {/* Right: the lens and its widgets */}
          <div className="relative min-h-[560px] lg:min-h-0">
            <div className="absolute inset-x-[6%] top-[4%] bottom-[120px] sm:inset-x-[12%] lg:inset-x-[4%] lg:right-[18%] lg:top-[2%] lg:bottom-[118px]">
              {room && <Lens room={room} />}
            </div>

            {room && (
              <>
                <div className="absolute top-[6%] right-4 z-10 hidden sm:block lg:right-8">
                  <ProfileCard hazard={room.hazard} />
                </div>
                <div className="absolute top-[44%] left-0 z-10 hidden sm:block lg:-left-[10%]">
                  <SeverityBadge hazard={room.hazard} />
                </div>
                <div className="absolute bottom-[22%] left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/80 px-4 py-2 text-center text-[13px] shadow-[0_10px_30px_rgba(62,54,46,0.08)] backdrop-blur sm:hidden">
                  {HAZARD_TEXT[room.hazard.type].name} · <span className="capitalize">{room.hazard.severity}</span>
                </div>
              </>
            )}

            <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 lg:left-[38%]">
              <RoomPicker rooms={rooms} active={active} onPick={setActive} />
            </div>

            {filming && (
              <Link
                href="#check"
                className="group absolute right-4 bottom-6 z-10 hidden h-[300px] w-[190px] overflow-hidden rounded-full shadow-[0_20px_50px_rgba(62,54,46,0.18)] lg:right-8 lg:block"
                aria-label="Film a room: check a room now"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={filming.src} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-6 mx-auto grid size-[96px] place-items-center rounded-full bg-[var(--ss-card)] text-center text-[13px] font-medium shadow-[0_10px_24px_rgba(62,54,46,0.18)]">
                  <span>
                    <svg viewBox="0 0 24 24" className="mx-auto mb-1 size-5" aria-hidden="true">
                      <path d="M8 5v14l11-7z" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
                    </svg>
                    Film a room
                  </span>
                </span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <Sheet id="how">
        <Heading eyebrow="How it works" title="Ten things a camera can see.">
          Film one room on your phone. We blur anyone in it, spot the things the dementia guide warns about, and check how each one stands out from what&apos;s
          around it.
        </Heading>
        <ol className="m-0 mb-16 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
          {[
            { n: 1, title: "Film a room", note: "A slow minute of video, or a few photos.", photo: filming },
            { n: 2, title: "See it their way", note: "Everything grey except what may be a problem.", photo: mat ? SITE["bath-rug"] : undefined, hazard: mat },
            { n: 3, title: "Get a fix plan", note: "The cheapest fix for each, priced, as a PDF." },
          ].map((step) => (
            <li key={step.n} className="relative flex flex-col gap-4 rounded-[28px] bg-[var(--ss-card)] p-4 shadow-[0_14px_34px_rgba(62,54,46,0.08)]">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] bg-[var(--ss-line)]">
                {step.hazard && step.photo ? (
                  <Isolated photo={step.photo} hazards={[step.hazard]} focus={step.hazard.box} />
                ) : step.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={step.photo.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/site/fix-plan-page.jpg" alt="The first page of an example fix plan" className="absolute inset-0 h-full w-full object-cover object-top" />
                )}
              </div>
              <div className="flex items-start gap-3 px-1 pb-1">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ss-ink)] text-[14px] text-white">0{step.n}</span>
                <span>
                  <span className="block text-[17px] font-medium">{step.title}</span>
                  <span className="text-[14px] text-[var(--ss-ink-3)]">{step.note}</span>
                </span>
              </div>
            </li>
          ))}
        </ol>
        <HazardArches tiles={tiles} />
      </Sheet>

      {/* The model */}
      <Sheet id="model" className="bg-[radial-gradient(ellipse_at_10%_100%,var(--ss-glow)_0%,var(--ss-sheet)_55%)]">
        <Heading eyebrow="What it sees" title="Spot it. Check it. Explain it.">
          What SafeSight saw in real photos of homes. It isn&apos;t perfect yet (it once mistook a window for a mirror), so the findings shown
          here are ones we double-checked.
        </Heading>
        {SITE["bath-white"] && <ModelStages photo={SITE["bath-white"]} />}
        {entryRug && (
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="relative min-h-[320px] overflow-hidden rounded-[28px] bg-[var(--ss-line)] shadow-[0_14px_34px_rgba(62,54,46,0.08)]">
              <Isolated photo={SITE["dark-rug"]} hazards={[entryRug]} focus={entryRug.box} alt="An entryway in grey; only the rug is in color" />
              <span className="absolute top-4 left-4 rounded-full bg-white/85 px-3 py-1.5 text-[12px] backdrop-blur">
                Hallway · {HAZARD_TEXT[entryRug.type].name}
              </span>
            </div>
            <Readout hazard={entryRug} title="Rug" />
          </div>
        )}
      </Sheet>

      {/* Fix plan */}
      <Sheet id="plan">
        <Heading eyebrow="Fix plan" title="See the fix, and what it costs.">
          Cheapest fix first, with a free step you can do today. Prices are low to high from US retailers; labor uses $60–$90 an hour.
        </Heading>
        {mat && SITE["bath-rug"] && (
          <div className="overflow-hidden rounded-[28px] shadow-[0_20px_50px_rgba(62,54,46,0.12)]">
            <CompareSlider
              before={SITE["bath-rug"].src}
              after={
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={SITE["bath-rug"].src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={SITE["bath-rug"].src}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      filter: LIGHT_RUG,
                      maskImage: `url("${mat.outline_url}")`,
                      WebkitMaskImage: `url("${mat.outline_url}")`,
                      maskSize: "100% 100%",
                      WebkitMaskSize: "100% 100%",
                    }}
                  />
                </>
              }
              beforeLabel="Before"
              afterLabel="After (simulated)"
              width={SITE["bath-rug"].width}
              height={SITE["bath-rug"].height}
              alt="The bathroom with its dark mat, and the same bathroom with a light mat"
              start={48}
            />
          </div>
        )}
        <dl className="m-0 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Do it yourself", money(PLAN_TOTALS.diy)],
            ["With a handyman", money(PLAN_TOTALS.hired)],
            ["Your time", duration(PLAN_TOTALS.minutes)],
            ["Free steps today", String(PLAN_TOTALS.freeSteps)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[22px] bg-[var(--ss-card)] p-5 shadow-[0_10px_30px_rgba(62,54,46,0.07)]">
              <dt className="text-[13px] text-[var(--ss-ink-3)]">{label}</dt>
              <dd className="m-0 mt-1 text-[clamp(22px,2.4vw,32px)] font-normal whitespace-nowrap tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
          {PLAN.map(([key, type]) => {
            const hz = find(key, type);
            if (!SITE[key] || !hz) return null;
            const plan = FIX_PLANS[type];
            return (
              <li key={key} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 rounded-[22px] bg-[var(--ss-card)] p-3 pr-5 shadow-[0_10px_30px_rgba(62,54,46,0.07)] sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:pr-6">
                <div className="relative size-16 overflow-hidden rounded-full sm:row-span-1">
                  <Isolated photo={SITE[key]} hazards={[hz]} focus={hz.box} zoom={2.2} />
                </div>
                <div className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] font-medium">
                    {HAZARD_TEXT[type].name}
                    <span className="rounded-full px-2 py-0.5 text-[11px] text-white capitalize" style={{ background: SEVERITY_DOT[hz.severity] }}>
                      {hz.severity}
                    </span>
                  </span>
                  <span className="block text-[14px] text-[var(--ss-ink-3)]">
                    {plan.free && <>Free today: {plan.free.charAt(0).toLowerCase() + plan.free.slice(1)} </>}
                    Fix: {plan.fix.charAt(0).toLowerCase() + plan.fix.slice(1)}.
                  </span>
                </div>
                <span className="col-start-2 text-[20px] tabular-nums sm:col-start-auto sm:text-[22px]">{money(materials(plan))}</span>
              </li>
            );
          })}
        </ul>
        <Link href="/report?example" className="mt-8 inline-block rounded-full bg-[var(--ss-ink)] px-7 py-4 text-[15px] font-medium text-white shadow-[0_18px_36px_rgba(62,54,46,0.25)] hover:bg-[var(--ss-ink-hover)]">
          Open the fix plan PDF
        </Link>
      </Sheet>

      {/* Privacy */}
      <Sheet id="privacy">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
          <div>
            <Heading eyebrow="Privacy" title="People are blurred before anything is saved." />
            <ul className="m-0 -mt-4 flex list-none flex-wrap gap-2 p-0">
              {["No account", "People blurred first", "Deleted within the hour", "Stops if blurring fails"].map((f) => (
                <li key={f} className="rounded-full bg-[var(--ss-card)] px-4 py-2 text-[14px] shadow-[0_6px_16px_rgba(62,54,46,0.06)]">
                  {f}
                </li>
              ))}
            </ul>
          </div>
          {SITE.privacy && (
            <div className="overflow-hidden rounded-[28px] shadow-[0_20px_50px_rgba(62,54,46,0.12)]">
              <PrivacyBlur photo={SITE.privacy} />
            </div>
          )}
        </div>
      </Sheet>

      {/* Check a room */}
      <Sheet id="check" className="bg-[radial-gradient(ellipse_at_85%_100%,var(--ss-glow)_0%,var(--ss-sheet)_60%)]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col items-start gap-5">
            <Heading eyebrow="Check a room" title="Start with the room they use most." />
            <p className="m-0 -mt-6 max-w-[420px] text-[15px] leading-relaxed text-[var(--ss-ink-2)]">
              We say &ldquo;may be a problem&rdquo;, never &ldquo;is dangerous&rdquo;. This isn&apos;t a medical assessment; it&apos;s a second
              pair of eyes, based on the Alzheimer&apos;s Society guide.
            </p>
          </div>
          <CheckForm room={check.room} onRoom={check.setRoom} files={check.files} onFiles={check.pick} error={check.error} onSubmit={check.submit} />
        </div>
      </Sheet>

      <footer className="mx-auto flex w-full max-w-[1440px] flex-wrap justify-between gap-3 px-2 text-[12px] text-[var(--ss-ink-2)]">
        <span>Built at BananaHacks 2026.</span>
        <PhotoCredits className="max-w-[720px]" />
      </footer>
    </div>
  );
}

function PillLink({ href, label, external = false, children }: { href: string; label: string; external?: boolean; children: React.ReactNode }) {
  const icon = (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
  const cls = "grid size-10 place-items-center rounded-full text-[var(--ss-ink-2)] hover:bg-[var(--ss-soft)] hover:text-[var(--ss-accent)]";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className={cls}>
      {icon}
    </a>
  ) : (
    <Link href={href} aria-label={label} title={label} className={cls}>
      {icon}
    </Link>
  );
}
