"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import PhotoCredits from "@/components/PhotoCredits";
import { BlurFade } from "@/components/ui/blur-fade";
import HazardCards, { type HazardCardData } from "@/components/v3/HazardCards";
import RoomCards, { type RoomCard } from "@/components/v3/RoomCards";
import { ROOMS, type HazardType } from "@/lib/contract";
import { duration, money, planTotals } from "@/lib/costs";
import { GUIDE_URL } from "@/lib/hazards";
import { biggest } from "@/lib/measure";
import siteImages from "@/lib/site-images.json";

const SITE = siteImages as unknown as Record<string, SitePhoto>;
const find = (key: string, type: HazardType) => biggest(SITE[key]?.hazards.filter((h) => h.type === type) ?? []);

const NAVY = "#1e1b33";
const GREEN = "#9bc47f";

const ROOM_CARDS: [string, string, HazardType][] = [
  ["bathroom", "bath-rug", "dark_rug"],
  ["hallway", "dark-rug", "dark_rug"],
  ["bedroom", "mirror", "mirror"],
];

const TILES: [HazardType, string][] = [
  ["dark_rug", "bath-rug"],
  ["bathroom_fitting_blends_in", "lookalike"],
  ["mirror", "mirror"],
  ["loose_rug", "loose-rug"],
  ["floor_clutter", "clutter"],
  ["furniture_blends_in", "furniture-blends"],
  ["toilet_lookalike", "lookalike"],
  ["shiny_floor", "shiny-floor"],
  ["patterned_floor", "patterned-floor"],
  ["stair_edge_hard_to_see", "stairs"],
];

// The example bathroom's plan, priced by lib/costs.
const PLAN = planTotals(["dark_rug", "bathroom_fitting_blends_in", "mirror"]);

export default function V3Page() {
  const router = useRouter();
  const [room, setRoom] = useState<string>("bathroom");
  const [active, setActive] = useState(0);

  const rooms: RoomCard[] = ROOM_CARDS.flatMap(([name, key, type]) => {
    const hazard = find(key, type);
    return hazard ? [{ room: name, photo: SITE[key], hazard }] : [];
  });
  const cards: HazardCardData[] = TILES.flatMap(([type, key]) => (SITE[key] ? [{ type, photo: SITE[key], hazard: find(key, type) }] : []));

  function go(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/?room=${room}#check`);
  }

  return (
    <div className="min-h-svh bg-[linear-gradient(180deg,#e3e9ef_0%,#eceae6_45%,#e9d7c6_100%)] px-3 py-6 text-[#1e1b33] sm:px-8 sm:py-12 lg:px-[5%]">
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[32px] bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_55%,#f6f2ee_100%)] shadow-[0_30px_80px_rgba(30,27,51,0.08)] sm:rounded-[44px]">
        {/* Nav */}
        <nav className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-12 sm:py-10 lg:px-20">
          <Link href="/v3" className="text-[26px] font-semibold tracking-tight">
            SafeSight<span style={{ color: GREEN }}>.</span>
          </Link>
          <div className="order-3 flex w-full flex-wrap gap-x-8 gap-y-2 text-[15px] md:order-none md:w-auto">
            <a href="#hazards" className="hover:opacity-70">All hazards</a>
            <Link href="/report?example" className="hover:opacity-70">Fix plan</Link>
            <Link href="/#privacy" className="hover:opacity-70">Privacy</Link>
            <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="hover:opacity-70">The guide</a>
          </div>
          <div className="flex items-center gap-6 text-[15px]">
            <Link href="/results?example" className="hidden hover:opacity-70 sm:inline">Example</Link>
            <Link href="/#check" className="rounded-full px-7 py-2.5 font-medium text-white hover:opacity-90" style={{ background: NAVY }}>
              Check a room
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="grid gap-10 px-6 pb-16 sm:px-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)] lg:gap-8 lg:px-0 lg:pb-24 lg:pl-28">
          <div className="flex flex-col justify-between gap-10 lg:py-14">
            <BlurFade>
              <h1 className="m-0 font-v3 text-[clamp(56px,6.4vw,92px)] leading-[1.08] font-medium tracking-[-0.02em]">
                Film.
                <br />
                See.
                <br />
                Fix.
              </h1>
              <p className="m-0 mt-6 max-w-[360px] text-[17px] leading-relaxed text-[#1e1b33]/70">
                Find what may confuse or trip someone living with dementia, room by room, and the cheapest way to fix it.
              </p>
            </BlurFade>
            <form onSubmit={go} className="relative z-10 flex h-[88px] shadow-[0_24px_50px_rgba(30,27,51,0.12)] sm:h-[104px] lg:mr-[-110px]">
              <label className="flex flex-1 flex-col justify-center bg-white px-6 sm:px-10">
                <span className="text-xs text-[#1e1b33]/55">Which room?</span>
                <select
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="-ml-1 cursor-pointer appearance-none bg-transparent text-lg capitalize outline-none sm:text-xl"
                >
                  {ROOMS.map((r) => (
                    <option key={r} value={r}>
                      {r[0].toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="w-[88px] text-[26px] font-medium transition-[filter] hover:brightness-95 sm:w-[120px] sm:text-[32px]" style={{ background: GREEN }}>
                Go
              </button>
            </form>
          </div>

          <div className="h-[clamp(420px,46vw,640px)] lg:-mr-px">
            <RoomCards
              cards={rooms}
              active={active}
              onPick={(i) => {
                setActive(i);
                setRoom(rooms[i].room);
              }}
            />
          </div>
        </section>

        {/* Hazards */}
        <section id="hazards" className="scroll-mt-6 px-6 pb-20 sm:px-12 lg:px-20">
          <BlurFade>
            <h2 className="m-0 mb-8 text-center font-v3 text-[clamp(30px,3vw,44px)] leading-tight font-medium tracking-[-0.01em]">
              Ten Things That May Be A Problem.
            </h2>
          </BlurFade>
          <HazardCards cards={cards} />
        </section>

        {/* Fix plan in numbers */}
        <section className="mx-6 mb-6 grid gap-8 rounded-[28px] px-8 py-12 text-white sm:mx-12 sm:px-14 lg:mx-20 lg:mb-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] lg:items-center" style={{ background: NAVY }}>
          <div className="flex flex-col gap-5">
            <h2 className="m-0 font-v3 text-[clamp(28px,2.8vw,40px)] leading-tight font-medium">The cheapest fix, priced.</h2>
            <p className="m-0 text-white/70">For the example bathroom: a dark rug, a toilet that blends in and a mirror. Free steps first.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/report?example" className="rounded-full px-6 py-3 font-medium text-[#1e1b33]" style={{ background: GREEN }}>
                See the fix plan
              </Link>
              <Link href="/results?example" className="rounded-full border border-white/40 px-6 py-3 hover:bg-white/10">
                See the example
              </Link>
            </div>
          </div>
          <dl className="m-0 grid grid-cols-1 gap-px sm:grid-cols-2 overflow-hidden rounded-[18px] bg-white/15">
            <Stat label="Do it yourself" value={money(PLAN.diy)} />
            <Stat label="With a handyman" value={money(PLAN.hired)} />
            <Stat label="Your time" value={duration(PLAN.minutes)} />
            <Stat label="Free steps today" value={String(PLAN.freeSteps)} />
          </dl>
        </section>

        <footer className="flex flex-wrap justify-between gap-4 border-t border-[#1e1b33]/10 px-6 py-8 text-sm text-[#1e1b33]/60 sm:px-12 lg:px-20">
          <div className="flex max-w-[640px] flex-col gap-1">
            <span>Built at BananaHacks 2026.</span>
            <PhotoCredits />
          </div>
          <span>We say &ldquo;may be a problem&rdquo;, never &ldquo;is dangerous&rdquo;. Not a medical assessment.</span>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 p-6" style={{ background: NAVY }}>
      <dt className="text-sm text-white/60">{label}</dt>
      <dd className="m-0 text-[clamp(24px,2.4vw,34px)] font-light whitespace-nowrap">{value}</dd>
    </div>
  );
}
