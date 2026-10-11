"use client";

import { motion, useReducedMotion } from "motion/react";
import { Eyebrow } from "@/components/v5/Chrome";
import PageShell, { Panel } from "@/components/v4/PageShell";
import { STEPS, type Progress, type Step } from "@/lib/brain";

const LABEL: Record<Step, string> = {
  upload: "Uploading",
  frames: "Picking clear photos",
  people: "Blurring people",
  objects: "Finding objects",
  contrast: "Checking contrast",
};

function detail(p: Progress): string {
  if (p.total === 0) return "";
  if (p.step === "upload") return `${Math.round((p.done / p.total) * 100)}%`;
  return `${Math.min(p.done + 1, p.total)} of ${p.total} photos`;
}

// The "working on it" screen: every step, the current one moving.
export default function AnalysisProgress({ room, progress }: { room: string; progress: Progress | null }) {
  const reduceMotion = useReducedMotion();
  const current = progress ? STEPS.indexOf(progress.step) : 0;

  return (
    <PageShell>
      <Panel>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
          <div className="flex flex-col items-start gap-5">
            <Eyebrow>Checking your room</Eyebrow>
            <h1 className="m-0 text-[clamp(36px,4.6vw,60px)] leading-[1.08] font-v5 font-medium tracking-[-0.03em]">
              Looking around the <span className="capitalize">{room}</span>
            </h1>
            <p className="m-0 max-w-[380px] text-[15px] leading-relaxed text-[var(--ss-ink-2)]">
              Keep this tab open while we work. Longer videos take longer. People are blurred before anything is saved.
            </p>
          </div>

          <ol className="m-0 flex list-none flex-col gap-3 p-0" aria-live="polite">
            {STEPS.map((step, i) => {
              const state = i < current ? "done" : i === current ? "now" : "next";
              return (
                <li
                  key={step}
                  data-step={step}
                  data-state={state}
                  className={`relative flex items-center justify-between gap-4 overflow-hidden rounded-[22px] px-4 py-4 sm:px-5 ${
                    state === "next" ? "bg-white/50" : "bg-[var(--ss-card)] shadow-[0_10px_30px_rgba(62,54,46,0.08)]"
                  }`}
                >
                  <span className="flex items-center gap-4">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-full text-[13px] tabular-nums ${
                        state === "next" ? "border border-[var(--ss-faint)] text-[var(--ss-faint)]" : "bg-[var(--ss-ink)] text-white"
                      }`}
                    >
                      {state === "done" ? "✓" : i + 1}
                    </span>
                    <span className={`text-[clamp(17px,1.6vw,20px)] ${state === "next" ? "text-[var(--ss-faint)]" : ""}`}>{LABEL[step]}</span>
                  </span>
                  <span className="text-[14px] text-[var(--ss-ink-3)] tabular-nums">
                    {state === "done" ? "Done" : state === "now" && progress ? detail(progress) : ""}
                  </span>
                  {state === "now" && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 h-[3px] w-1/4 rounded-full bg-[var(--ss-accent)]"
                      animate={reduceMotion ? undefined : { x: ["-100%", "400%"] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </Panel>
    </PageShell>
  );
}
