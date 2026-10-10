"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import PhotoCredits from "@/components/PhotoCredits";
import Cutout from "@/components/v2/Cutout";
import HazardSteps, { type HazardStep } from "@/components/v2/HazardSteps";
import type { HazardType } from "@/lib/contract";
import { FIX_PLANS, materials, money } from "@/lib/costs";
import { GUIDE_URL, HAZARD_TEXT } from "@/lib/hazards";
import { biggest, measureText } from "@/lib/measure";
import siteImages from "@/lib/site-images.json";

const SITE = siteImages as unknown as Record<string, SitePhoto>;
const find = (key: string, type: HazardType) => biggest(SITE[key]?.hazards.filter((h) => h.type === type) ?? []);

const RED = "#e0261f";

// Real hazards from the site photos, lifted out by their outlines and
// arranged on the stage. `at` is the center, `width` the size, both in %.
type Floating = { key: string; type: HazardType; label: string; at: [number, number]; width: number; phone: { at: [number, number]; width: number } };
const FLOATING: Floating[] = [
  { key: "loose-rug", type: "loose_rug", label: "Runner", at: [22, 34], width: 15, phone: { at: [30, 27], width: 38 } },
  { key: "lookalike", type: "bathroom_fitting_blends_in", label: "Blends in", at: [38, 31], width: 8, phone: { at: [72, 24], width: 22 } },
  { key: "mirror", type: "mirror", label: "Mirror", at: [52, 38], width: 7, phone: { at: [72, 49], width: 17 } },
  { key: "dark-rug", type: "loose_rug", label: "Doormat", at: [67, 30], width: 10, phone: { at: [28, 47], width: 28 } },
  { key: "dark-rug", type: "dark_rug", label: "Dark rug", at: [41, 62], width: 18, phone: { at: [40, 64], width: 46 } },
  { key: "patterned-floor", type: "loose_rug", label: "Hide rug", at: [21, 74], width: 19, phone: { at: [56, 79], width: 54 } },
];

const STEPS: [string, HazardType][] = [
  ["bath-rug", "dark_rug"],
  ["lookalike", "bathroom_fitting_blends_in"],
  ["mirror", "mirror"],
  ["loose-rug", "loose_rug"],
];

const LIST = [
  "dark rugs",
  "loose rugs",
  "shiny floors",
  "busy patterns",
  "toilets that blend in",
  "furniture that blends in",
  "mirrors",
  "stair edges",
  "clutter",
  "look-alikes",
];

const SECTIONS = [
  { id: "top", label: "Home" },
  { id: "about", label: "What it does" },
  { id: "finds", label: "What it finds" },
  { id: "start", label: "Check a room" },
  { id: "contact", label: "About" },
];

export default function V2Page() {
  const reduceMotion = useReducedMotion();
  const floating = FLOATING.flatMap((f) => {
    const hazard = find(f.key, f.type);
    return hazard ? [{ ...f, hazard, photo: SITE[f.key] }] : [];
  });
  const steps: HazardStep[] = STEPS.flatMap(([key, type]) => {
    const hazard = find(key, type);
    if (!hazard) return [];
    const cost = money(materials(FIX_PLANS[type]));
    const measured = measureText(hazard);
    return [
      {
        photo: SITE[key],
        hazard,
        title: HAZARD_TEXT[type].name,
        body: `${HAZARD_TEXT[type].why} ${HAZARD_TEXT[type].fix}`,
        note: [measured, cost === "$0" ? "fix: free" : `fix from ${cost}`].filter(Boolean).join(" · "),
      },
    ];
  });
  const thumb = find("bath-rug", "dark_rug");

  return (
    <div className="flex flex-col gap-2.5 p-2.5 text-[#101113]">
      <SideNav />

      {/* Stage: real hazards floating in their detection boxes. */}
      <section id="top" className="relative h-[calc(100svh-20px)] min-h-[560px] overflow-hidden rounded-[18px] bg-[radial-gradient(ellipse_at_40%_40%,#f4f4f5_0%,#dcdde0_60%,#c9cacd_100%)]">
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-6 px-5 pt-5 font-v2-body text-[10px] leading-tight font-medium tracking-[0.04em] uppercase sm:px-[8%]">
          <span>
            Dementia-friendly <br className="hidden sm:block" />
            home check
          </span>
          <span className="hidden text-right sm:block">
            Based on the Alzheimer&apos;s Society
            <br />
            guide to a safer home
          </span>
        </div>
        <div className="absolute inset-x-5 top-[54px] z-10 border-t border-dotted border-[#101113]/40 sm:left-[8%] sm:right-[8%]" aria-hidden="true">
          <span className="absolute -top-[3px] left-0 size-[5px] rounded-full bg-[#101113]" />
        </div>
        <Link href="/" className="absolute top-[70px] left-5 z-10 rounded-full bg-[#101113] px-3 py-1 text-[10px] font-medium tracking-wide text-white uppercase sm:left-4">
          Home
        </Link>

        <Links points={floating.map((f) => f.at)} className="hidden md:block" />
        <Links points={floating.map((f) => f.phone.at)} className="md:hidden" />

        {floating.map((f, i) => (
          <Cutout
            key={`${f.key}-${f.type}`}
            photo={f.photo}
            hazard={f.hazard}
            label={f.label}
            tag={`${f.hazard.type} ${f.hazard.confidence.toFixed(2)}`}
            at={f.at}
            width={f.width}
            phone={f.phone}
            bob={i}
          />
        ))}

        <motion.h1
          className="absolute right-[2%] bottom-[-0.12em] m-0 font-v2-display text-[clamp(84px,17vw,300px)] leading-none font-thin tracking-[-0.02em] text-[#101113] uppercase"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        >
          SafeSight
        </motion.h1>
        <span className="absolute bottom-4 left-5 z-10 flex items-center gap-2 rounded-full bg-[#101113] px-3 py-1 text-[10px] font-medium tracking-wide text-white uppercase">
          See it their way <span className="size-1.5 rounded-full" style={{ background: RED }} />
        </span>
        <Notch />
      </section>

      {/* What it does */}
      <section id="about" className="relative flex min-h-[calc(100svh-20px)] flex-col items-center justify-center gap-10 overflow-hidden rounded-[18px] bg-[#0f1013] px-6 py-24 text-white">
        <Bracketed>
          <h2 className="m-0 text-center font-v2-display text-[clamp(40px,6.4vw,96px)] leading-[0.95] font-normal uppercase">
            See the home
            <span className="my-2 block font-v2-body text-[clamp(7px,0.7vw,10px)] leading-normal font-medium tracking-[0.08em] text-white/80">
              {LIST.join("  |  ")}
            </span>
            the way they might
          </h2>
        </Bracketed>
        {thumb && (
          <div className="relative h-[72px] w-[128px] overflow-hidden rounded-[3px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SITE["bath-rug"].src} alt="" className="absolute inset-0 h-full w-full object-cover grayscale" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SITE["bath-rug"].src}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ maskImage: `url("${thumb.outline_url}")`, WebkitMaskImage: `url("${thumb.outline_url}")`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
            />
            <span className="absolute inset-0 mix-blend-multiply" style={{ background: RED, opacity: 0.55 }} />
          </div>
        )}
        <p className="m-0 max-w-[560px] text-center font-v2-display text-[clamp(18px,1.6vw,22px)] leading-[1.25] font-normal text-white/90">
          Film a room on your phone. SafeSight blurs anyone in it, finds what may confuse or trip someone living with dementia, measures how much each
          thing stands out, and gives you the cheapest fix, free steps first.
        </p>
        <Notch dark />
      </section>

      {/* What it finds */}
      <section id="finds" aria-label="What it finds">
        {steps.length > 0 && <HazardSteps steps={steps} />}
      </section>

      {/* Call to action */}
      <section id="start" className="relative flex h-[calc(100svh-20px)] min-h-[520px] flex-col items-center justify-center gap-8 overflow-hidden rounded-[18px] px-6 text-white" style={{ background: RED }}>
        <div className="pointer-events-none absolute inset-0 opacity-30 blur-2xl" aria-hidden="true">
          <span className="absolute top-[18%] left-[30%] size-[30vmin] rounded-full bg-[#7a0d09]" />
          <span className="absolute top-[42%] left-[44%] size-[38vmin] rounded-full bg-[#9c120c]" />
          <span className="absolute top-[12%] left-[56%] size-[26vmin] rounded-full bg-[#7a0d09]" />
        </div>
        <span className="relative font-v2-body text-[10px] font-medium tracking-[0.12em] uppercase">Free · no account · deleted within the hour</span>
        <Bracketed light>
          <h2 className="m-0 text-center font-v2-display text-[clamp(40px,6.4vw,96px)] leading-[0.95] font-normal uppercase">
            Check the room
            <br />
            they use most
          </h2>
        </Bracketed>
        <div className="relative flex flex-wrap items-center justify-center gap-3">
          <Link href="/#check" className="rounded-full bg-white px-6 py-3 text-[13px] font-medium tracking-wide uppercase hover:bg-[#101113] hover:text-white" style={{ color: RED }}>
            Check a room →
          </Link>
          <Link href="/results?example" className="rounded-full border border-white/70 px-6 py-3 text-[13px] font-medium tracking-wide uppercase hover:bg-white/10">
            See an example
          </Link>
        </div>
        <Notch />
      </section>

      {/* Footer */}
      <footer id="contact" className="relative overflow-hidden rounded-[18px] bg-[#0f1013] px-5 pt-3 text-white sm:px-8">
        <div className="h-2 rounded-full" style={{ background: RED }} />
        <div className="grid grid-cols-2 gap-8 pt-16 font-v2-body text-[10px] leading-relaxed font-medium tracking-[0.06em] uppercase md:grid-cols-4">
          <FooterCol title="Project">
            <span>Built at BananaHacks 2026</span>
            <PhotoCredits className="normal-case" />
          </FooterCol>
          <FooterCol title="The guide">
            <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="hover:text-white">
              Making your home dementia friendly
            </a>
            <span>Alzheimer&apos;s Society</span>
          </FooterCol>
          <FooterCol title="Pages">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/results?example" className="hover:text-white">Example results</Link>
            <Link href="/report?example" className="hover:text-white">Fix plan PDF</Link>
            <Link href="/#privacy" className="hover:text-white">Privacy</Link>
          </FooterCol>
          <FooterCol title="Wording">
            <span>We say &ldquo;may be a problem&rdquo;, never &ldquo;is dangerous&rdquo;.</span>
            <span>Not a medical assessment.</span>
          </FooterCol>
        </div>
        <p className="m-0 mt-10 text-right font-v2-display text-[clamp(72px,17vw,300px)] leading-[0.8] font-thin tracking-[-0.02em] uppercase select-none" aria-hidden="true">
          SafeSight
        </p>
      </footer>
    </div>
  );
}

// Thin white lines joining the floating pieces, like a detector's graph.
function Links({ points, className }: { points: [number, number][]; className: string }) {
  return (
    <svg className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {points.slice(1).map((p, i) => (
        <line key={i} x1={points[i][0]} y1={points[i][1]} x2={p[0]} y2={p[1]} stroke="#ffffff" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.85} />
      ))}
    </svg>
  );
}

function Bracketed({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  const side = `w-3 border-y-2 ${light ? "border-white" : "border-white/90"}`;
  return (
    <div className="relative flex w-full max-w-[1100px] items-stretch justify-between gap-4">
      <span className={`${side} border-l-2`} aria-hidden="true" />
      {children}
      <span className={`${side} border-r-2`} aria-hidden="true" />
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 text-white/60">
      <span className="mb-1 text-white">{title}</span>
      {children}
    </div>
  );
}

// The small tab at the bottom of each panel, as on the reference.
function Notch({ dark = false }: { dark?: boolean }) {
  return (
    <span className="absolute bottom-0 left-1/2 flex h-3 w-16 -translate-x-1/2 items-center justify-center rounded-t-[8px] bg-[#0b0c0e]" aria-hidden="true">
      <span className={`h-px w-8 ${dark ? "bg-white/70" : "bg-white"}`} />
    </span>
  );
}

// Dots down the left edge, one per section; the one you're reading is filled.
function SideNav() {
  const [active, setActive] = useState("top");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return (
    <nav aria-label="Sections" className="fixed top-1/2 left-[18px] z-50 hidden -translate-y-1/2 flex-col gap-2.5 mix-blend-difference sm:flex">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} aria-label={s.label} aria-current={active === s.id ? "true" : undefined} className="group grid size-3 place-items-center">
          <span className={`block rounded-full bg-white transition-all ${active === s.id ? "size-2" : "size-1 opacity-60 group-hover:opacity-100"}`} />
        </a>
      ))}
    </nav>
  );
}
