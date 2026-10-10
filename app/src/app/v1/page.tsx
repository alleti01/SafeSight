"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import AnalysisProgress from "@/components/AnalysisProgress";
import { SEVERITY_TEXT_CLASS } from "@/components/HazardCard";
import LabeledPhoto from "@/components/LabeledPhoto";
import CompareSlider from "@/components/landing/CompareSlider";
import HazardGrid from "@/components/landing/HazardGrid";
import ModelStrip, { type SitePhoto } from "@/components/landing/ModelStrip";
import PrivacyBlur, { type PrivacyPhoto } from "@/components/landing/PrivacyBlur";
import Readout from "@/components/landing/Readout";
import SeeItTheirWay, { type StoryStep } from "@/components/landing/SeeItTheirWay";
import V1Header from "@/components/landing/V1Header";
import PhotoCredits from "@/components/PhotoCredits";
import UploadForm from "@/components/UploadForm";
import { BlurFade } from "@/components/ui/blur-fade";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import type { HazardType } from "@/lib/contract";
import { duration, FIX_PLANS, materials, money, planTotals } from "@/lib/costs";
import { GUIDE_URL, HAZARD_TEXT } from "@/lib/hazards";
import { biggest, measureText } from "@/lib/measure";
import siteImages from "@/lib/site-images.json";
import { useRoomCheck } from "@/lib/useRoomCheck";

// The first home page design ("Colour isolation"), kept for comparison.
// Stock photos from Unsplash, with what the real pipeline found and
// measured in each (backend/tools/annotate_site_images.py and
// measure_site_images.py).
const SITE = siteImages as unknown as Record<string, SitePhoto> & { privacy?: PrivacyPhoto };

const find = (photo: string, type: HazardType) => biggest(SITE[photo]?.hazards.filter((h) => h.type === type) ?? []);
const only = (photo: string, type: HazardType): SitePhoto | undefined => {
  const hazard = find(photo, type);
  return hazard && { ...SITE[photo], hazards: [hazard] };
};

const STORY_PHOTOS = Object.fromEntries(["bath-rug", "bath-white"].filter((k) => SITE[k]).map((k) => [k, SITE[k]]));
const STORY: StoryStep[] = [
  { photo: "bath-rug", eyebrow: "as you see it", line: "An ordinary bathroom." },
  { photo: "bath-rug", hazard: find("bath-rug", "dark_rug"), eyebrow: "as they might", line: "A dark rug can look like a hole." },
  { photo: "bath-white", hazard: find("bath-white", "bathroom_fitting_blends_in"), eyebrow: "as they might", line: "A white toilet can disappear." },
  { photo: "bath-white", hazard: find("bath-white", "mirror"), eyebrow: "as they might", line: "A mirror can hold a stranger." },
].filter((s) => STORY_PHOTOS[s.photo]);

const TILES: [HazardType, string][] = [
  ["dark_rug", "dark-rug"],
  ["loose_rug", "loose-rug"],
  ["shiny_floor", "shiny-floor"],
  ["patterned_floor", "patterned-floor"],
  ["bathroom_fitting_blends_in", "bath-white"],
  ["furniture_blends_in", "furniture-blends"],
  ["mirror", "mirror"],
  ["stair_edge_hard_to_see", "stairs"],
  ["floor_clutter", "clutter"],
  ["toilet_lookalike", "lookalike"],
];

// The fix plan for the bathroom in the story, priced by lib/costs.
const PLAN: [string, HazardType][] = [
  ["bath-rug", "dark_rug"],
  ["bath-white", "bathroom_fitting_blends_in"],
  ["mirror", "mirror"],
];
const PLAN_TOTALS = planTotals(PLAN.map(([, type]) => type));

// Recolors the dark rug light for the "after" side. A simulation, labeled so.
const LIGHT_RUG = "grayscale(1) invert(0.82) sepia(0.25) brightness(1.08)";

export default function HomePageV1() {
  const reduceMotion = useReducedMotion();
  const { room, setRoom, files, pick, error, working, progress, submit } = useRoomCheck();

  if (working) return <AnalysisProgress room={room} progress={progress} />;

  const hero = only("bath-rug", "dark_rug");
  const heroRug = hero?.hazards[0];
  const runner = find("dark-rug", "dark_rug");
  const tiles = TILES.flatMap(([type, key]) => {
    // One finding per tile: the biggest of its kind.
    const main = find(key, type);
    return SITE[key] ? [{ type, photo: { ...SITE[key], hazards: main ? [main] : [] } }] : [];
  });
  const rugPhoto = SITE["bath-rug"];

  return (
    <div className="v1 min-h-svh bg-background font-sans text-foreground">
      <V1Header />
      <main className="mx-auto max-w-[1240px] px-4 pb-24 sm:px-8">
        {/* Hero: one room in grey, the problem in color, and what we measured. */}
        <section className="flex flex-col gap-10 pt-6 sm:pt-8">
          {hero && heroRug && (
            <BlurFade>
              <div className="relative">
                <LabeledPhoto
                  frame={{ frame_id: "hero", image_url: hero.src, width: hero.width, height: hero.height }}
                  hazards={hero.hazards}
                  src={hero.src}
                  tags={false}
                />
                <motion.span
                  className="absolute hidden border-l-[3px] border-danger bg-background px-2.5 py-1.5 font-mono text-[13px] whitespace-nowrap sm:block"
                  style={{
                    left: `${(heroRug.box[0] / hero.width) * 100}%`,
                    top: `${(heroRug.box[1] / hero.height) * 100}%`,
                    transform: "translateY(calc(-100% - 14px))",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={reduceMotion ? { duration: 0 } : { delay: 1.6, duration: 0.5 }}
                >
                  rug {measureText(heroRug).replace(" vs ", " · floor ")} · {HAZARD_TEXT[heroRug.type].name.toLowerCase()}, {heroRug.severity}
                </motion.span>
              </div>
            </BlurFade>
          )}
          <div className="grid items-end gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-12">
            <h1 className="m-0 text-[clamp(44px,5.6vw,76px)] leading-[1.02] font-light tracking-[-0.02em]">
              <VerticalCutReveal splitBy="words" staggerDuration={0.06} transition={{ type: "spring", stiffness: 190, damping: 24, delay: 0.2 }}>
                Only what may be a problem keeps its color.
              </VerticalCutReveal>
            </h1>
            <BlurFade delay={0.5} className="flex flex-col gap-5">
              <p className="m-0 text-[19px] leading-[1.55] text-muted">
                Film a room. SafeSight greys out everything except what may confuse or trip someone living with dementia, and tells you the cheapest
                fix.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link href="#check" className="rounded-[4px] bg-accent px-6 py-3.5 font-bold text-background hover:bg-accent-dark">
                  Check a room
                </Link>
                <Link href="/results?example" className="underline underline-offset-4 hover:text-accent">
                  See an example
                </Link>
              </div>
            </BlurFade>
          </div>
        </section>

        {/* The story, told by scrolling */}
        {STORY.length > 0 && (
          <Section id="example" eyebrow="Example" title="One bathroom, the way they might see it.">
            <SeeItTheirWay photos={STORY_PHOTOS} steps={STORY} />
          </Section>
        )}

        {/* What we look for */}
        <Section id="how" eyebrow="How it works" title="Ten things a camera can see.">
          <HazardGrid tiles={tiles} />
          <ol className="m-0 mt-6 grid list-none gap-6 border-t border-line p-0 pt-8 md:grid-cols-3">
            <Step n={1} label="Film a room" note="A slow minute of video, or a few photos.">
              {SITE.filming && <Photo src={SITE.filming.src} w={SITE.filming.width} h={SITE.filming.height} />}
            </Step>
            <Step n={2} label="We check it" note="People blurred, objects found, each one measured.">
              {rugPhoto && (
                <LabeledPhoto
                  frame={{ frame_id: "step2", image_url: rugPhoto.src, width: rugPhoto.width, height: rugPhoto.height }}
                  hazards={rugPhoto.hazards}
                  src={rugPhoto.src}
                  tags={false}
                />
              )}
            </Step>
            <Step n={3} label="Get a fix plan" note="The cheapest fix for each, priced, as a PDF.">
              <Link href="/report?example" className="block overflow-hidden rounded-[4px] bg-surface" style={{ aspectRatio: "16 / 9" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/site/fix-plan-page.jpg" alt="The first page of an example fix plan PDF" className="h-full w-full object-cover object-top" />
              </Link>
            </Step>
          </ol>
        </Section>

        {/* The model */}
        <Section id="model" eyebrow="The model" title="We measure each object, then say what it means.">
          {SITE["dark-rug"] && runner && <Readout photo={SITE["dark-rug"]} hazard={runner} title="Rug" />}
          <h3 className="m-0 mt-6 text-xl font-bold">Find it. Outline it. Check it.</h3>
          {SITE["bath-white"] && <ModelStrip photo={SITE["bath-white"]} />}
          <p className="m-0 text-sm text-muted">
            Real output from our pipeline on stock photos. The starting model also makes mistakes (it boxes windows as mirrors), so
            the findings shown here are ones we checked. Starting-model vs. fine-tuned accuracy: coming Sunday.
          </p>
        </Section>

        {/* Fix plan */}
        <Section id="plan" eyebrow="Fix plan" title="See the fix, and what it costs.">
          {rugPhoto && heroRug && (
            <CompareSlider
              before={rugPhoto.src}
              after={
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={rugPhoto.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={rugPhoto.src}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      filter: LIGHT_RUG,
                      maskImage: `url("${heroRug.outline_url}")`,
                      WebkitMaskImage: `url("${heroRug.outline_url}")`,
                      maskSize: "100% 100%",
                      WebkitMaskSize: "100% 100%",
                    }}
                  />
                </>
              }
              beforeLabel={`Before · rug ${measureText(heroRug).split(" vs ")[0]}`}
              afterLabel="After · a light rug (simulated)"
              width={rugPhoto.width}
              height={rugPhoto.height}
              alt="The bathroom with its dark rug, and the same bathroom with a light rug"
              start={56}
            />
          )}
          <dl className="m-0 grid grid-cols-2 gap-6 rounded-[4px] bg-linen p-6 md:grid-cols-4">
            <Figure label="Do it yourself" value={money(PLAN_TOTALS.diy)} />
            <Figure label="With a handyman" value={money(PLAN_TOTALS.hired)} />
            <Figure label="Your time" value={duration(PLAN_TOTALS.minutes)} />
            <Figure label="Free steps today" value={String(PLAN_TOTALS.freeSteps)} />
          </dl>
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12">
            <div className="flex flex-col gap-4">
              <p className="m-0 text-muted">
                Cheapest fix first, with a free step you can do today. Prices are low to high from US retailers; labor uses $60–$90 an hour.
              </p>
              <Link href="/report?example" className="self-start rounded-[4px] bg-accent px-5 py-3 font-bold text-background hover:bg-accent-dark">
                Open the fix plan PDF
              </Link>
            </div>
            <ul className="m-0 list-none border-b border-line p-0">
              {PLAN.map(([key, type]) => {
                const photo = SITE[key];
                const hz = find(key, type);
                if (!photo || !hz) return null;
                const plan = FIX_PLANS[type];
                return (
                  <li key={key} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-start gap-4 border-t border-line py-5 sm:gap-5">
                    <Thumb photo={photo} box={hz.box} />
                    <div>
                      <p className="m-0 font-bold">
                        {HAZARD_TEXT[type].name}{" "}
                        <span className={`ml-1 text-sm capitalize ${SEVERITY_TEXT_CLASS[hz.severity]}`}>{hz.severity}</span>
                      </p>
                      <p className="m-0 mt-1 text-[15px] leading-normal text-muted">
                        {plan.free && <>Free today: {plan.free.charAt(0).toLowerCase() + plan.free.slice(1)} </>}
                        Fix: {plan.fix.charAt(0).toLowerCase() + plan.fix.slice(1)}.
                      </p>
                    </div>
                    <span className="font-display text-2xl tabular-nums">{money(materials(plan))}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Section>

        {/* Privacy */}
        <Section id="privacy" eyebrow="Privacy" title="People are blurred before anything is saved.">
          {SITE.privacy && <PrivacyBlur photo={SITE.privacy} />}
          <p className="m-0 text-muted">No account. Uploads are deleted within the hour.</p>
        </Section>

        {/* Check a room */}
        <Section id="check" eyebrow="Check a room" title="Start with the room they use most.">
          <div className="max-w-[720px]">
            <UploadForm room={room} onRoom={setRoom} files={files} onFiles={pick} error={error} onSubmit={submit} />
          </div>
        </Section>

        <footer className="mt-24 flex flex-wrap justify-between gap-4 border-t border-line pt-6 text-sm text-muted">
          <div className="flex max-w-[760px] flex-col gap-1">
            <span>Built at BananaHacks 2026.</span>
            <PhotoCredits />
          </div>
          <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
            Based on the Alzheimer&apos;s Society guide
          </a>
        </footer>
      </main>
    </div>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-28 flex scroll-mt-28 flex-col gap-8">
      <BlurFade className="flex flex-col gap-3 border-t border-line pt-6">
        <span className="font-mono text-xs tracking-[0.1em] text-muted uppercase">{eyebrow}</span>
        <h2 className="m-0 max-w-[860px] text-[clamp(36px,4.4vw,60px)] leading-[1.04] font-light tracking-[-0.02em]">{title}</h2>
      </BlurFade>
      {children}
    </section>
  );
}

function Step({ n, label, note, children }: { n: number; label: string; note: string; children: React.ReactNode }) {
  return (
    <BlurFade as="li" delay={n * 0.1} className="flex flex-col gap-3">
      {children}
      <span className="flex items-baseline gap-3">
        <span className="font-display text-3xl leading-none text-accent tabular-nums">{n}</span>
        <span>
          <b className="block">{label}</b>
          <span className="text-[15px] text-muted">{note}</span>
        </span>
      </span>
    </BlurFade>
  );
}

function Photo({ src, w, h }: { src: string; w: number; h: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="w-full rounded-[4px] object-cover" style={{ aspectRatio: `${w} / ${h}` }} />
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm">{label}</dt>
      <dd className="m-0 font-display text-[clamp(24px,3vw,36px)] leading-tight whitespace-nowrap tabular-nums">{value}</dd>
    </div>
  );
}

// A small square zoomed in on one hazard, so the thumbnail shows the thing
// itself rather than the middle of the room.
function Thumb({ photo, box, size = 56 }: { photo: SitePhoto; box: [number, number, number, number]; size?: number }) {
  const [x0, y0, x1, y1] = box;
  // Fit the hazard in the square, but never shrink the photo below it.
  const scale = Math.max((size * 0.9) / Math.max(x1 - x0, y1 - y0), size / photo.height);
  const w = photo.width * scale;
  const h = photo.height * scale;
  const left = Math.min(0, Math.max(size - w, size / 2 - ((x0 + x1) / 2) * scale));
  const top = Math.min(0, Math.max(size - h, size / 2 - ((y0 + y1) / 2) * scale));
  return (
    <span className="relative block overflow-hidden rounded-[4px] bg-line" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt="" className="absolute max-w-none" style={{ width: w, height: h, left, top }} />
    </span>
  );
}
