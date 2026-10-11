"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AnalysisProgress from "@/components/AnalysisProgress";
import VideoHero from "@/components/hero/VideoHero";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import PhotoCredits from "@/components/PhotoCredits";
import { Eyebrow, H2, Header } from "@/components/v5/Chrome";
import { FindingsRow, type Finding } from "@/components/v5/FixList";
import HowItWorks from "@/components/v5/HowItWorks";
import RoomCapture from "@/components/v5/RoomCapture";
import IsoHome from "@/components/v5/IsoHome";
import type { HazardType } from "@/lib/contract";
import { GUIDE_URL } from "@/lib/hazards";
import { biggest, type MeasuredHazard } from "@/lib/measure";
import siteImages from "@/lib/site-images.json";
import { useRoomCheck } from "@/lib/useRoomCheck";

// The home page built around what a caregiver does: a short film of someone
// looking at their living room the way someone with dementia might, then see
// what they'd get (the fix list and where to buy it), learn what we look for
// and how, and check their own room here.

const SITE = siteImages as unknown as Record<string, SitePhoto>;
const find = (key: string, type: HazardType) =>
  biggest(SITE[key]?.hazards.filter((h) => h.type === type) ?? []);

// Kinds of hazard the room at the top doesn't have, shown from other homes
// after the room's own findings.
const ELSEWHERE: [HazardType, string, string][] = [
  ["bathroom_fitting_blends_in", "bath-white", "bathroom"],
];

// Everyday stores that sell what the fix lists call for, shown by their logos
// in one ink color (from Wikimedia Commons; credited in the README).
// `square` logos get more height so they read at the same size as wordmarks.
const STORES: { name: string; logo: string; square?: boolean }[] = [
  { name: "Walmart", logo: "walmart" },
  { name: "Target", logo: "target", square: true },
  { name: "Amazon", logo: "amazon" },
  { name: "The Home Depot", logo: "home-depot", square: true },
  { name: "Lowe's", logo: "lowes" },
  { name: "IKEA", logo: "ikea" },
  { name: "Wayfair", logo: "wayfair" },
  { name: "Costco", logo: "costco" },
  { name: "Ace Hardware", logo: "ace-hardware" },
  { name: "Menards", logo: "menards" },
  { name: "Kohl's", logo: "kohls" },
  { name: "Dollar General", logo: "dollar-general" },
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

export default function HomePage() {
  const scrolled = useScrolled();
  // The film shows the nav once its camera settles, or when it's scrolled.
  const [filmNav, setFilmNav] = useState(false);
  const check = useRoomCheck();
  const room = SITE["room-wide"];
  // The room's findings, left to right.
  const found = [...((room?.hazards ?? []) as MeasuredHazard[])].sort(
    (a, b) => a.box[0] + a.box[2] - (b.box[0] + b.box[2]),
  );
  const findings: Finding[] = [
    ...(room
      ? found.map((hazard) => ({
          type: hazard.type,
          room: "living room",
          photo: room,
          hazard,
        }))
      : []),
    ...ELSEWHERE.flatMap(([type, key, where]) => {
      const hazard = find(key, type);
      return hazard && !found.some((h) => h.type === type)
        ? [{ type, room: where, photo: SITE[key], hazard }]
        : [];
    }),
  ];

  if (check.working)
    return <AnalysisProgress room={check.room} progress={check.progress} files={check.files} estimate={check.estimate} />;

  return (
    <div>
      {/* The film: a room, seen the way someone living with dementia might. */}
      <VideoHero onNav={setFilmNav} />

      {/* Header: hidden over the film, slides in once it settles or you scroll. */}
      <Header fixed shown={filmNav || scrolled} />

      {/* 2. The whole home, drawn: every kind of thing we look for, room by room. */}
      <section
        id="home"
        className="relative scroll-mt-20 overflow-hidden bg-[var(--ss-sheet)]"
      >
        <div className="w-full px-5 pt-20 sm:px-10 sm:pt-28">
          <h2 className="m-0 max-w-[720px] font-v5 text-[clamp(38px,5.2vw,68px)] leading-[1.04] font-medium tracking-[-0.03em]">
            Dementia-friendly homes, checked room by room
          </h2>
          <p className="m-0 mt-6 max-w-[460px] text-[17px] leading-relaxed text-[var(--ss-ink-2)]">
            Film a room on your phone. SafeSight finds what may confuse or trip
            someone living with dementia, and the cheapest way to fix it.
          </p>
          <a
            href="#check"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--ss-accent)] px-6 py-3.5 text-[15px] font-medium text-white hover:brightness-110"
          >
            Check a room <span aria-hidden="true">→</span>
          </a>
        </div>
        {/* The whole drawing fits the width; on phones its labels are drawn larger (--label-scale). */}
        <div className="mx-auto -mt-4 max-w-[1300px] px-2 pb-6 [--label-scale:1.6] sm:-mt-24 sm:pb-0 lg:-mt-40 lg:pl-[22%]">
          <IsoHome />
        </div>
      </section>

      {/* 3. How it works: each step with a drawing of it; it pins and steps through as you scroll. */}
      <section id="how" className="scroll-mt-20 bg-[var(--ss-soft)]">
        <HowItWorks room={room} />
      </section>

      {/* 4. What you get: the heading and the room's findings filling one screen, then the full fix plan. */}
      {room && (
        <section
          id="fixes"
          className="scroll-mt-[74px] overflow-x-clip bg-[var(--ss-sheet)]"
        >
          <div className="flex flex-col lg:h-[calc(100svh-74px)] lg:min-h-[640px]">
            {/* The whole width, on the same 40px gutters as the sections around it. */}
            <div className="w-full px-5 pt-20 sm:px-10 sm:pt-28 lg:pt-10">
              <Eyebrow>What you get</Eyebrow>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
                <H2>A fix list for every room you check</H2>
                <p className="m-0 max-w-[460px] shrink-0 text-[16px] leading-relaxed text-[var(--ss-ink-2)]">
                  Every check ends with a list like this one for the room above.{" "}
                  <span className="lg:hidden">Tap a finding</span>
                  <span className="max-lg:hidden">Point at a finding</span> to
                  see what it is, how sure we are, whether its color is the
                  problem, and the cheapest fix.
                </p>
              </div>
            </div>
            {/* The row runs the full width of the screen and takes the rest of its height. */}
            <div className="mt-8 min-h-0 flex-1 lg:mt-10">
              <FindingsRow findings={findings} />
            </div>
          </div>

          <div className="w-full px-5 pt-10 pb-20 sm:px-10 sm:pb-28">
            <Link
              href="/report?example"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--ss-accent)] px-6 py-3.5 text-[15px] font-medium text-white hover:brightness-110"
            >
              See a full example fix plan (PDF){" "}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      )}

      {/* 5. Where to buy: one band, a short label on the left and the stores sliding past on the right. */}
      <section id="stores" className="scroll-mt-20 bg-[var(--ss-sheet)]">
        <div className="flex w-full flex-col gap-5 border-y border-[var(--ss-ink)]/15 px-5 py-6 sm:px-10 lg:flex-row lg:items-center lg:gap-12">
          <div className="shrink-0 lg:w-[360px]">
            <p className="m-0 font-v5 text-[20px] leading-snug font-medium tracking-[-0.01em]">
              Most fixes are one trip to the store
            </p>
          </div>
          <StoreRow stores={STORES} />
        </div>
      </section>

      {/* 6. Check a room, right here. */}
      <section id="check" className="scroll-mt-20 bg-[var(--ss-soft)]">
        {/* The heading across the top, as in "What you get", and the card the full width under it. */}
        <div className="flex w-full flex-col gap-10 px-5 py-20 sm:px-10 sm:py-28">
          <div>
            <Eyebrow>Check a room</Eyebrow>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
              <H2>Start with the room they use most</H2>
              <p className="m-0 max-w-[460px] shrink-0 text-[16px] leading-relaxed text-[var(--ss-ink-2)]">
                Film it on your phone and you&apos;ll see what may be a problem,
                and the easiest way to fix it.
              </p>
            </div>
          </div>
          <RoomCapture
            room={check.room}
            onRoom={check.setRoom}
            files={check.files}
            onFiles={check.pick}
            error={check.error}
            onSubmit={check.submit}
          />
        </div>
      </section>

      {/* Footer. */}
      <footer className="bg-[var(--ss-sheet)]">
        <div className="flex w-full flex-wrap justify-between gap-6 px-5 py-10 text-[13px] text-[var(--ss-ink-2)] sm:px-10">
          <span className="max-w-[460px]">
            Built at BananaHacks 2026 by Anish and Abhi. Based on the{" "}
            <a
              href={GUIDE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Alzheimer&apos;s Society guide
            </a>
            .
          </span>
          <PhotoCredits className="max-w-[600px]" />
        </div>
      </footer>
    </div>
  );
}

// The stores' logos in one row drifting sideways forever, faded at both ends;
// the list is drawn twice so the loop has no seam. It pauses under the
// pointer, and stands still (wrapping instead) when reduced motion is on.
function StoreRow({ stores }: { stores: typeof STORES }) {
  const logo = (st: (typeof STORES)[number], copy: boolean) => (
    <li
      key={copy ? `${st.name}-copy` : st.name}
      aria-hidden={copy || undefined}
      className={`flex shrink-0 items-center ${copy ? "motion-reduce:hidden" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/site/stores/${st.logo}.svg`}
        alt={copy ? "" : st.name}
        className={`w-auto object-contain ${st.square ? "h-[34px]" : "h-[24px]"}`}
        style={{
          filter: "grayscale(1) contrast(1.2) brightness(0.55)",
          opacity: 0.8,
        }}
      />
    </li>
  );
  return (
    // Faded at both ends while it moves; with reduced motion it wraps, unfaded.
    <div className="group min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] motion-reduce:[mask-image:none]">
      <ul
        className="m-0 flex w-max list-none items-center gap-14 p-0 pr-14 group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:gap-x-10 motion-reduce:gap-y-4 motion-reduce:pr-0 motion-reduce:[animation:none] animate-[marquee_45s_linear_infinite]"
        aria-label="Stores"
      >
        {stores.map((st) => logo(st, false))}
        {stores.map((st) => logo(st, true))}
      </ul>
    </div>
  );
}
