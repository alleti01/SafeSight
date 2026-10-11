"use client";

import { roomName } from "@/lib/hazards";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Eyebrow } from "@/components/v5/Chrome";
import { Tag } from "@/components/v5/Finding";
import PageShell, { Panel } from "@/components/v4/PageShell";
import { assetUrl, STEPS, type Progress, type Step } from "@/lib/brain";

const LABEL: Record<Step, string> = {
  upload: "Uploading",
  frames: "Picking clear frames",
  people: "Blurring people",
  objects: "Finding objects",
  contrast: "Checking contrast",
};


function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function detail(p: Progress, isVideo: boolean): string {
  if (p.total === 0 || (p.step === "contrast" && p.total === 1)) return "";
  if (p.step === "upload") return `${Math.round((p.done / p.total) * 100)}%`;
  const unit = p.step === "contrast" && isVideo && p.total > 1 ? "clips" : isVideo ? "frames" : "photos";
  return `${Math.min(p.done + 1, p.total)} of ${p.total} ${unit}`;
}

// The same, in a few characters for narrow screens: "45%", "3/12".
function compact(p: Progress): string {
  if (p.total === 0 || (p.step === "contrast" && p.total === 1)) return "";
  if (p.step === "upload") return `${Math.round((p.done / p.total) * 100)}%`;
  return `${Math.min(p.done + 1, p.total)}/${p.total}`;
}

// The "working on it" screen. Left: what's happening, about how long is left
// and how much was found so far. Right: the frame being checked (people
// already blurred) above every step, the current one moving.
export default function AnalysisProgress({
  room,
  progress,
  files = [],
  estimate = null,
}: {
  room: string;
  progress: Progress | null;
  files?: File[];
  estimate?: number | null;
}) {
  const reduceMotion = useReducedMotion();
  const current = progress ? STEPS.indexOf(progress.step) : 0;
  const isVideo = files.some((f) => f.type.startsWith("video/"));

  // The estimate counts from when the check actually starts: while another
  // check is running ours waits in line, and a countdown would run out early.
  const queued = progress?.queued ?? false;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (queued) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 1000);
    return () => clearInterval(id);
  }, [queued]);

  // Until the first checked frame comes back, show the caregiver's own upload (it never leaves their browser here).
  const [local, setLocal] = useState<{ url: string; video: boolean } | null>(null);
  useEffect(() => {
    if (!files[0]) return;
    const url = URL.createObjectURL(files[0]);
    setLocal({ url, video: isVideo });
    return () => URL.revokeObjectURL(url);
  }, [files, isVideo]);

  const left = estimate === null ? null : estimate - elapsed;
  const found = progress?.found;
  const preview = progress?.preview ? assetUrl(progress.preview) : null;
  const frameNote =
    progress && (progress.step === "objects" || progress.step === "people") && progress.total > 0
      ? `${isVideo ? "Frame" : "Photo"} ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`
      : null;

  return (
    <PageShell>
      <Panel>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="flex flex-col items-start gap-5">
            <Eyebrow>Checking your room</Eyebrow>
            <h1 className="m-0 text-[clamp(36px,4.6vw,60px)] leading-[1.08] font-v5 font-medium tracking-[-0.03em]">
              Looking around the <span className="capitalize">{roomName(room)}</span>
            </h1>
            <p className="m-0 max-w-[400px] text-[15px] leading-relaxed text-[var(--ss-ink-2)]">
              Keep this tab open while we work. People are blurred before anything is saved, and your video is deleted
              when the check is done.
            </p>

            <dl className="m-0 mt-4 grid w-full max-w-[460px] grid-cols-3 border-t border-[var(--ss-line)] pt-5">
              <Stat label={queued ? "Waiting for another check" : left === null ? "Working" : left > 3 ? "Time left" : "Almost done"}>
                {queued ? "In line" : left === null ? "…" : left > 3 ? `~${clock(left)}` : "Soon"}
              </Stat>
              <Stat label="Found so far" divider>
                {found === undefined ? "–" : found}
              </Stat>
              <Stat label={isVideo ? "Frames done" : "Photos done"} divider>
                {progress && (progress.step === "objects" || progress.step === "contrast") && progress.total > 0
                  ? progress.step === "contrast"
                    ? "All"
                    : progress.done
                  : "–"}
              </Stat>
            </dl>
          </div>

          <div className="rounded-[20px] bg-white p-3 shadow-[0_20px_50px_rgba(62,54,46,0.1)]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-[var(--ss-line)]">
              <AnimatePresence initial={false}>
                <motion.div
                  key={preview ?? local?.url ?? "empty"}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="h-full w-full object-cover grayscale" />
                  ) : local?.video ? (
                    <video src={local.url} muted loop playsInline autoPlay={!reduceMotion} className="h-full w-full object-cover blur-[6px] grayscale" />
                  ) : local ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={local.url} alt="" className="h-full w-full object-cover blur-[6px] grayscale" />
                  ) : null}
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 bg-[rgba(62,54,46,0.12)]" />
              {!reduceMotion && (
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-x-0 h-20 bg-gradient-to-b from-transparent to-white/15"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.35)" }}
                  animate={{ top: ["-12%", "100%"] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
                />
              )}
              <div className="absolute top-3 left-3 flex gap-1.5">
                {frameNote && <span className="rounded-[6px] bg-white/90 px-2 py-0.5 text-[12px] font-medium">{frameNote}</span>}
                {!preview && local && <span className="rounded-[6px] bg-white/90 px-2 py-0.5 text-[12px] font-medium">Your upload</span>}
              </div>
            </div>

            <div className="px-3 pt-4 pb-2">
              <p className="m-0 mb-2 text-[11px] font-medium tracking-[0.08em] text-[var(--ss-ink-3)] uppercase">
                {STEPS.length} steps
              </p>
              <ol className="m-0 flex list-none flex-col p-0" aria-live="polite">
                {STEPS.map((step, i) => {
                  const state = i < current ? "done" : i === current ? "now" : "next";
                  const frac = state === "now" && progress && progress.total > 0 ? Math.min(1, (progress.done + 0.5) / progress.total) : 0;
                  return (
                    <li
                      key={step}
                      data-step={step}
                      data-state={state}
                      className={`relative flex items-center gap-3 overflow-hidden rounded-[10px] px-2.5 py-2.5 ${state === "now" ? "bg-[var(--ss-soft)]" : ""}`}
                    >
                      <span className="w-[64px] shrink-0 sm:w-[68px]">
                        {state === "done" ? (
                          <Tag tone="good">Done</Tag>
                        ) : state === "now" ? (
                          <Tag tone="warn">Working</Tag>
                        ) : (
                          <Tag tone="plain">Waiting</Tag>
                        )}
                      </span>
                      <span className={`min-w-0 text-[15px] whitespace-nowrap ${state === "next" ? "text-[var(--ss-faint)]" : ""}`}>
                        {step === "contrast" && isVideo ? (
                          <>
                            <span className="sm:hidden">Contrast and clips</span>
                            <span className="hidden sm:inline">Checking contrast, making clips</span>
                          </>
                        ) : (
                          LABEL[step]
                        )}
                      </span>
                      <span className="ml-auto shrink-0 text-[13px] text-[var(--ss-ink-3)]">
                        {state === "now" && progress ? (
                          <>
                            <span className="sm:hidden">{compact(progress)}</span>
                            <span className="hidden sm:inline">{detail(progress, isVideo)}</span>
                          </>
                        ) : (
                          ""
                        )}
                      </span>
                      {state === "now" && (
                        <motion.span
                          aria-hidden="true"
                          className="absolute bottom-0 left-0 h-[2px] bg-[var(--ss-accent)]"
                          initial={false}
                          animate={{ width: frac > 0 ? `${frac * 100}%` : "18%", opacity: 1 }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}

function Stat({ label, divider = false, children }: { label: string; divider?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 ${divider ? "border-l border-[var(--ss-line)] pl-5" : "pr-5"}`}>
      <dd className="m-0 font-v5 text-[30px] leading-none font-medium tracking-[-0.02em]">{children}</dd>
      <dt className="text-[13px] text-[var(--ss-ink-3)]">{label}</dt>
    </div>
  );
}
