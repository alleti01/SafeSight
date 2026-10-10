"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  MotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import LabeledPhoto from "@/components/LabeledPhoto";
import type { Hazard } from "@/lib/contract";

// The centerpiece: a photo stays pinned while scrolling plays the story.
// First the room as you see it, all grey; then, one at a time, each hazard
// comes into color with what it can mean to someone with dementia.

export interface StoryPhoto {
  src: string;
  width: number;
  height: number;
}

export interface StoryStep {
  photo: string;
  hazard?: Hazard;
  eyebrow: string;
  line: string;
}

export default function SeeItTheirWay({
  photos,
  steps,
}: {
  photos: Record<string, StoryPhoto>;
  steps: StoryStep[];
}) {
  // The server can't know the reader's motion setting, so both sides first
  // render the scrolling story and swap to the still one after mounting.
  // Each version is its own component so its hooks stay with it.
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && reduceMotion ? <StillStory photos={photos} steps={steps} /> : <ScrollStory photos={photos} steps={steps} />;
}

function StillStory({ photos, steps }: { photos: Record<string, StoryPhoto>; steps: StoryStep[] }) {
  return (
    <div className="flex flex-col gap-16">
      {steps.map((s, i) => {
        const p = photos[s.photo];
        return (
          <figure key={i} className="m-0 flex flex-col gap-4">
            <LabeledPhoto
              frame={{
                frame_id: s.photo,
                image_url: p.src,
                width: p.width,
                height: p.height,
              }}
              hazards={s.hazard ? [s.hazard] : []}
              src={p.src}
              still
              tags={false}
            />
            <Caption step={s} />
          </figure>
        );
      })}
    </div>
  );
}

function ScrollStory({ photos, steps }: { photos: Record<string, StoryPhoto>; steps: StoryStep[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const n = steps.length;
  const first = steps[0] && photos[steps[0].photo];
  return (
    <div ref={ref} className="relative" style={{ height: `${n * 85}svh` }}>
      <div className="sticky top-[116px] flex h-[calc(100svh-116px)] flex-col justify-center py-6 md:top-[72px] md:h-[calc(100svh-72px)]">
        <div
          className="mx-auto flex w-full flex-col gap-6"
          // Shrink by width, never by height, so the photo keeps its shape and
          // the outlines stay on their objects.
          style={{
            maxWidth: `calc((100svh - 300px) * ${first.width / first.height})`,
          }}
        >
          <div
            className="relative w-full overflow-hidden rounded-[4px] bg-line"
            style={{ aspectRatio: `${first.width} / ${first.height}` }}
          >
            {Object.keys(photos).map((key) => (
              <PhotoLayer
                key={key}
                id={key}
                photo={photos[key]}
                steps={steps}
                progress={scrollYProgress}
              />
            ))}
            {steps.map(
              (s, i) =>
                s.hazard && (
                  <HazardLayer
                    key={i}
                    photo={photos[s.photo]}
                    hazard={s.hazard}
                    index={i}
                    n={n}
                    progress={scrollYProgress}
                  />
                ),
            )}
          </div>
          <div className="relative min-h-[120px]">
            {steps.map((s, i) => (
              <StepCaption
                key={i}
                step={s}
                index={i}
                n={n}
                progress={scrollYProgress}
              />
            ))}
          </div>
          <div className="flex gap-2" aria-hidden="true">
            {steps.map((_, i) => (
              <Dot key={i} index={i} n={n} progress={scrollYProgress} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Each of n steps owns an equal slice of the scroll. A layer shown for steps
// first..last fades in around the start of its first slice and out around
// the end of its last; the very first and last layers stay at the ends.
// The browser needs keyframes inside 0..1, strictly increasing, and pinned at
// both 0 and 1: a missing end keyframe falls back to fully visible.
export function range(
  first: number,
  last: number,
  n: number,
): { input: number[]; output: number[] } {
  const fade = 0.25 / n;
  const input = [0];
  const output = [first === 0 ? 1 : 0];
  if (first > 0) {
    input.push(first / n - fade, first / n + fade);
    output.push(0, 1);
  }
  if (last < n - 1) {
    input.push((last + 1) / n - fade, (last + 1) / n + fade);
    output.push(1, 0);
  }
  input.push(1);
  output.push(last === n - 1 ? 1 : 0);
  return { input, output };
}

function useShown(
  progress: MotionValue<number>,
  n: number,
  first: number,
  last = first,
) {
  const { input, output } = range(first, last, n);
  return useTransform(progress, input, output);
}

function PhotoLayer({
  id,
  photo,
  steps,
  progress,
}: {
  id: string;
  photo: StoryPhoto;
  steps: StoryStep[];
  progress: MotionValue<number>;
}) {
  const indices = steps.flatMap((s, i) => (s.photo === id ? [i] : []));
  const opacity = useShown(
    progress,
    steps.length,
    indices[0] ?? 0,
    indices[indices.length - 1] ?? 0,
  );
  return (
    <motion.img
      src={photo.src}
      alt=""
      style={{ opacity }}
      className="absolute inset-0 h-full w-full object-cover grayscale"
    />
  );
}

function HazardLayer({
  photo,
  hazard,
  index,
  n,
  progress,
}: {
  photo: StoryPhoto;
  hazard: Hazard;
  index: number;
  n: number;
  progress: MotionValue<number>;
}) {
  const opacity = useShown(progress, n, index);
  const [x0, y0, x1, y1] = hazard.box;
  const pct = (v: number) => `${v}%`;
  const box = {
    left: pct((x0 / photo.width) * 100),
    top: pct((y0 / photo.height) * 100),
    width: pct(((x1 - x0) / photo.width) * 100),
    height: pct(((y1 - y0) / photo.height) * 100),
  };
  const color =
    hazard.severity === "high"
      ? "var(--danger)"
      : hazard.severity === "medium"
        ? "var(--warn)"
        : "var(--calm)";
  const mask = hazard.outline_url ? `url("${hazard.outline_url}")` : undefined;

  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none absolute inset-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={
          mask
            ? {
                maskImage: mask,
                WebkitMaskImage: mask,
                maskSize: "100% 100%",
                WebkitMaskSize: "100% 100%",
              }
            : {
                clipPath: `inset(${box.top} ${pct(100 - (x1 / photo.width) * 100)} ${pct(100 - (y1 / photo.height) * 100)} ${box.left})`,
              }
        }
      />
      <div
        className="absolute"
        style={{ ...box, outline: `2px solid ${color}`, outlineOffset: 4 }}
      />
    </motion.div>
  );
}

function StepCaption({
  step,
  index,
  n,
  progress,
}: {
  step: StoryStep;
  index: number;
  n: number;
  progress: MotionValue<number>;
}) {
  const shown = useShown(progress, n, index);
  // Only the second half of each fade shows text, so captions never overlap.
  const opacity = useTransform(shown, [0.5, 1], [0, 1]);
  const y = useTransform(shown, [0.5, 1], [12, 0]);
  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-0"
      aria-hidden={index > 0}
    >
      <Caption step={step} />
    </motion.div>
  );
}

function Caption({ step }: { step: StoryStep }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className={`font-mono text-xs uppercase tracking-[0.1em] ${step.hazard ? "text-danger" : "text-muted"}`}
      >
        {step.eyebrow}
      </span>
      <p className="m-0 font-display text-[clamp(26px,3.4vw,48px)] font-light leading-[1.1] tracking-[-0.02em]">
        {step.line}
      </p>
    </div>
  );
}

function Dot({
  index,
  n,
  progress,
}: {
  index: number;
  n: number;
  progress: MotionValue<number>;
}) {
  const shown = useShown(progress, n, index);
  const opacity = useTransform(shown, [0, 1], [0.25, 1]);
  return <motion.span style={{ opacity }} className="h-1 w-8 bg-foreground" />;
}
