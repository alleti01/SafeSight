"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AnalysisProgress from "@/components/AnalysisProgress";
import { SeverityPill } from "@/components/HazardCard";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import PhotoCredits from "@/components/PhotoCredits";
import RoomTour from "@/components/room-tour/RoomTour";
import IsoHome from "@/components/v5/IsoHome";
import { CheckForm, Isolated } from "@/components/v4/Sections";
import Workflow, { type Flow } from "@/components/v5/Workflow";
import type { HazardType } from "@/lib/contract";
import { duration, FIX_PLANS, materials, money, planTotals } from "@/lib/costs";
import { GUIDE_URL, HAZARD_TEXT } from "@/lib/hazards";
import { biggest, type MeasuredHazard } from "@/lib/measure";
import siteImages from "@/lib/site-images.json";
import { useRoomCheck } from "@/lib/useRoomCheck";

// The home page built around what a caregiver does: look at a room the way
// someone with dementia might, see what they'd get (the fix list and where to
// buy it), learn what we look for and how, and check their own room here.

const SITE = siteImages as unknown as Record<string, SitePhoto>;
const find = (key: string, type: HazardType) => biggest(SITE[key]?.hazards.filter((h) => h.type === type) ?? []);

const FLOWS: [HazardType, string, string][] = [
  ["dark_rug", "bath-rug", "bathroom"],
  ["bathroom_fitting_blends_in", "lookalike", "bathroom"],
  ["floor_clutter", "room-wide", "living room"],
  ["furniture_blends_in", "room-wide", "living room"],
  ["mirror", "mirror", "bedroom"],
  ["loose_rug", "loose-rug", "hallway"],
];

const STEPS = [
  { title: "Film the room", body: "Walk slowly through the room with your phone, or take a few photos." },
  { title: "We hide anyone in it", body: "If a person appears, they're blurred straight away. If we can't blur them, we stop." },
  { title: "We look the way they might", body: "For the things the dementia guide warns about, and how much each one stands out." },
  { title: "You get a fix list", body: "What may be a problem, why, a free step for today, and the cheapest fix." },
];

// Everyday stores that sell what the fix lists call for. Names only: we
// don't use their logos.
const STORES = ["Walmart", "Target", "Amazon", "Home Depot", "Lowe's", "IKEA", "Wayfair", "Costco", "Ace Hardware", "Menards", "Kohl's", "Dollar General"];

const PRIVACY = [
  ["Blurred first", "Anyone in your video is blurred before anything is kept."],
  ["Stops if it can't", "If we can't blur someone, we don't check the video at all."],
  ["Gone within the hour", "Your video and photos are deleted an hour after the check."],
  ["No account", "Nothing to sign up for, and nothing tied to your name."],
];

// The nav stays out of the way while the room fills the screen, and slides in
// once you start scrolling.
function useScrolled(past = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > past);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [past]);
  return scrolled;
}

export default function V5Page() {
  const scrolled = useScrolled();
  const check = useRoomCheck();
  const room = SITE["room-wide"];
  // The room's findings, left to right, as on the tour above.
  const found = [...((room?.hazards ?? []) as MeasuredHazard[])].sort((a, b) => a.box[0] + a.box[2] - (b.box[0] + b.box[2]));
  const totals = planTotals(found.map((h) => h.type));
  const flows: Flow[] = FLOWS.flatMap(([type, key, where]) => {
    const hazard = find(key, type);
    return hazard ? [{ type, room: where, photo: SITE[key], hazard }] : [];
  });

  if (check.working) return <AnalysisProgress room={check.room} progress={check.progress} />;

  return (
    <div>
      {/* 1. The room, full screen, popping each thing that may be a problem. */}
      {room && (
        <section id="look" className="relative h-[100svh] min-h-[560px] w-full">
          {/* Nothing over the room, so the motion is never hidden; the heading is for screen readers. */}
          <h1 className="sr-only">SafeSight: see this room the way someone living with dementia might</h1>
          <RoomTour photo={room} />
        </section>
      )}

      {/* Header: hidden over the room, slides in once you scroll. */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-[var(--ss-line)] bg-[var(--ss-sheet)]/95 backdrop-blur transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          scrolled ? "translate-y-0" : "-translate-y-full"
        }`}
        aria-hidden={!scrolled}
        inert={!scrolled}
      >
        <nav className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-4 sm:px-10">
          <Link href="/v5" className="flex items-center gap-2.5 font-v5 text-[22px] font-medium tracking-[-0.02em]">
            <Mark />
            <span className="max-[340px]:sr-only">SafeSight</span>
          </Link>
          <ul className="m-0 hidden list-none items-center gap-7 p-0 text-[15px] md:flex">
            <li><a href="#home" className="hover:opacity-70">The home</a></li>
            <li><a href="#fixes" className="hover:opacity-70">What you get</a></li>
            <li><a href="#stores" className="hover:opacity-70">Where to buy</a></li>
            <li><a href="#rooms" className="hover:opacity-70">What we look for</a></li>
            <li><a href="#how" className="hover:opacity-70">How it works</a></li>
            <li><a href="#privacy" className="hover:opacity-70">Privacy</a></li>
          </ul>
          <a href="#check" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ss-ink)] px-4 py-2.5 text-[14px] font-medium whitespace-nowrap text-white hover:bg-[var(--ss-ink-hover)] sm:px-5">
            Check a room <span aria-hidden="true">→</span>
          </a>
        </nav>
      </header>

      {/* 2. The whole home, drawn: every kind of thing we look for, room by room. */}
      <section id="home" className="relative overflow-hidden bg-[var(--ss-sheet)]">
        <div className="mx-auto max-w-[1200px] px-5 pt-20 sm:px-10 sm:pt-28">
          <h2 className="m-0 max-w-[720px] font-v5 text-[clamp(38px,5.2vw,68px)] leading-[1.04] font-medium tracking-[-0.03em]">
            Dementia-friendly homes, checked room by room
          </h2>
          <p className="m-0 mt-6 max-w-[460px] text-[17px] leading-relaxed text-[var(--ss-ink-2)]">
            Film a room on your phone. SafeSight finds what may confuse or trip someone living with dementia, and the cheapest way to fix it.
          </p>
          <a
            href="#check"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--ss-accent)] px-6 py-3.5 text-[15px] font-medium text-white hover:brightness-110"
          >
            Check a room <span aria-hidden="true">→</span>
          </a>
        </div>
        {/* On phones the drawing stays large enough to read, cropped at the sides. */}
        <div className="mx-auto -mt-4 flex max-w-[1300px] justify-center overflow-hidden px-2 sm:-mt-24 lg:-mt-40 lg:block lg:pl-[22%]">
          <div className="w-[720px] shrink-0 sm:w-full">
            <IsoHome />
          </div>
        </div>
      </section>

      {/* 3. What you get: the fix list for the room above. */}
      {room && (
        <section id="fixes" className="scroll-mt-20 bg-[var(--ss-sheet)]">
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-10 sm:py-28">
            <Eyebrow>What you get</Eyebrow>
            <H2>{found.length} things to fix in this room, cheapest first</H2>
            <p className="m-0 mt-5 max-w-[620px] text-[17px] leading-relaxed text-[var(--ss-ink-2)]">
              Every check ends with a list like this: what may be a problem and why, something you can do today for free, and the cheapest
              proper fix.
            </p>

            <dl className="m-0 mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Free steps today", `${totals.freeSteps} of ${found.length}`],
                ["Do it yourself", money(totals.diy)],
                ["Your time", duration(totals.minutes)],
                ["With a handyman", money(totals.hired)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[18px] bg-white p-5">
                  <dt className="text-[13px] text-[var(--ss-ink-3)]">{label}</dt>
                  <dd className="m-0 mt-1 font-v5 text-[clamp(22px,2.4vw,30px)] font-medium whitespace-nowrap tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <ol className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
              {found.map((h, i) => {
                const plan = FIX_PLANS[h.type];
                return (
                  <li key={h.hazard_id} className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-5 gap-y-3 rounded-[18px] bg-white p-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center">
                    <div className="relative size-[72px] overflow-hidden rounded-[14px] sm:size-24">
                      <Isolated photo={room} hazards={[h]} focus={h.box} zoom={2.4} alt="" />
                    </div>
                    <div className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] text-[var(--ss-ink-3)] tabular-nums">{i + 1}</span>
                        <span className="font-v5 text-[19px] font-medium tracking-[-0.01em]">{HAZARD_TEXT[h.type].name}</span>
                        <SeverityPill severity={h.severity} />
                      </span>
                      <p className="m-0 mt-1 text-[14px] leading-relaxed text-[var(--ss-ink-2)]">{HAZARD_TEXT[h.type].why}</p>
                      <p className="m-0 mt-2 text-[14px] leading-relaxed">
                        {plan.free && (
                          <>
                            <span className="font-medium">Free today:</span> {plan.free}{" "}
                          </>
                        )}
                        <span className="font-medium">Fix:</span> {plan.fix}.
                      </p>
                    </div>
                    <span className="col-start-2 font-v5 text-[22px] font-medium tabular-nums sm:col-start-auto">{money(materials(plan))}</span>
                  </li>
                );
              })}
            </ol>
            <Link
              href="/report?example"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--ss-accent)] px-6 py-3.5 text-[15px] font-medium text-white hover:brightness-110"
            >
              See a full example fix plan (PDF) <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      )}

      {/* 4. Where to buy it: everyday stores, drifting past. */}
      <section id="stores" className="scroll-mt-20 bg-[var(--ss-sheet)]">
        <div className="mx-auto max-w-[1200px] px-5 pb-20 sm:px-10 sm:pb-28">
          <Eyebrow>Where to buy</Eyebrow>
          <H2>From stores you already use</H2>
          <p className="m-0 mt-5 max-w-[620px] text-[17px] leading-relaxed text-[var(--ss-ink-2)]">
            Every fix uses everyday things, like a lighter rug, rug grippers, a colored toilet seat or a cord cover, that you can pick up at
            stores like these. No special equipment, no contractor needed.
          </p>
          <div
            className="relative mt-10 flex flex-col gap-4 overflow-hidden rounded-[24px] py-10"
            style={{ background: "linear-gradient(120deg, var(--ss-accent), var(--ss-page))" }}
          >
            <StoreRow stores={STORES.slice(0, 6)} />
            <StoreRow stores={STORES.slice(6)} reverse />
          </div>
        </div>
      </section>

      {/* 5. What we look for, one thing at a time. */}
      <section id="rooms" className="scroll-mt-20 bg-[var(--ss-soft)]">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-10 sm:py-28">
          <Eyebrow>What we look for</Eyebrow>
          <H2>The things the dementia guide warns about</H2>
          <p className="m-0 mt-5 max-w-[620px] text-[17px] leading-relaxed text-[var(--ss-ink-2)]">
            Each one, from a real home: what we saw, how much it stands out from what&apos;s around it, and what to do about it.
          </p>
          <div className="mt-12">
            <Workflow flows={flows} />
          </div>
        </div>
      </section>

      {/* 6. How it works, in four plain steps. */}
      <section id="how" className="scroll-mt-20 bg-[var(--ss-sheet)]">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-10 sm:py-28">
          <Eyebrow>How it works</Eyebrow>
          <H2>About a minute of your time</H2>
          <ol className="m-0 mt-12 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((st, i) => (
              <li key={st.title} className="flex flex-col gap-3 rounded-[18px] bg-white p-5">
                <span className="grid size-10 place-items-center rounded-full bg-[var(--ss-ink)] font-v5 text-[16px] text-white">{i + 1}</span>
                <span className="font-v5 text-[19px] leading-tight font-medium tracking-[-0.01em]">{st.title}</span>
                <span className="text-[14px] leading-relaxed text-[var(--ss-ink-2)]">{st.body}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 7. Privacy, in four short points. */}
      <section id="privacy" className="scroll-mt-20 bg-[var(--ss-ink)] text-white">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-10 sm:py-24">
          <Eyebrow dark>Your privacy</Eyebrow>
          <H2>It&apos;s their home. We treat it that way.</H2>
          <ul className="m-0 mt-12 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {PRIVACY.map(([title, body]) => (
              <li key={title} className="border-t border-white/20 pt-4">
                <span className="block font-v5 text-[19px] font-medium">{title}</span>
                <span className="mt-1 block text-[14px] leading-relaxed text-[#e3d8ca]">{body}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 8. Check a room, right here. */}
      <section id="check" className="scroll-mt-20 bg-[var(--ss-soft)]">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-20 sm:px-10 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <Eyebrow>Check a room</Eyebrow>
            <H2>Start with the room they use most</H2>
            <p className="m-0 mt-5 max-w-[440px] text-[17px] leading-relaxed text-[var(--ss-ink-2)]">
              We say &ldquo;may be a problem&rdquo;, never &ldquo;is dangerous&rdquo;: every home and person is different. This isn&apos;t a
              medical assessment; it&apos;s a second pair of eyes.
            </p>
          </div>
          <div className="rounded-[24px] bg-white p-5 sm:p-8">
            <CheckForm room={check.room} onRoom={check.setRoom} files={check.files} onFiles={check.pick} error={check.error} onSubmit={check.submit} />
          </div>
        </div>
      </section>

      {/* Footer. */}
      <footer className="bg-[var(--ss-sheet)]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-6 px-5 py-10 text-[13px] text-[var(--ss-ink-2)] sm:px-10">
          <span className="max-w-[460px]">
            Built at BananaHacks 2026 by Anish and Abhi. Based on the{" "}
            <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              Alzheimer&apos;s Society guide
            </a>
            . Not a medical assessment.
          </span>
          <PhotoCredits className="max-w-[600px]" />
        </div>
      </footer>
    </div>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" />
      <path d="M3 21 L21 3 M12 3 V12 H21" />
    </svg>
  );
}

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 border-t pt-4 ${dark ? "border-white/25" : "border-[var(--ss-ink)]"}`}>
      <span className={`size-2.5 ${dark ? "bg-white" : "bg-[var(--ss-ink)]"}`} />
      <span className="font-v5-serif text-[19px] italic">{children}</span>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 mt-5 max-w-[760px] font-v5 text-[clamp(32px,3.8vw,48px)] leading-[1.08] font-medium tracking-[-0.025em]">{children}</h2>;
}

// One row of store tiles drifting sideways forever; the list is drawn twice
// so the loop has no seam. It pauses under the pointer, and stands still
// (wrapping instead) when reduced motion is on.
function StoreRow({ stores, reverse = false }: { stores: string[]; reverse?: boolean }) {
  const tile = (name: string, copy: boolean) => (
    <li
      key={copy ? `${name}-copy` : name}
      aria-hidden={copy || undefined}
      className={`grid h-[72px] w-[200px] shrink-0 place-items-center rounded-[16px] bg-white px-4 sm:h-[84px] sm:w-[220px] ${copy ? "motion-reduce:hidden" : ""}`}
    >
      <span className="font-v5 text-[20px] font-semibold tracking-[-0.02em] whitespace-nowrap sm:text-[22px]">{name}</span>
    </li>
  );
  return (
    <div className="group flex overflow-hidden">
      <ul
        className={`m-0 flex w-max list-none gap-4 p-0 pr-4 group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0 motion-reduce:[animation:none] ${
          reverse ? "animate-[marquee_42s_linear_infinite_reverse]" : "animate-[marquee_38s_linear_infinite]"
        }`}
      >
        {stores.map((s) => tile(s, false))}
        {stores.map((s) => tile(s, true))}
      </ul>
    </div>
  );
}
