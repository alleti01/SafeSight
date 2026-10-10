"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { SitePhoto } from "@/components/landing/ModelStrip";
import { Isolated } from "@/components/v4/Sections";
import type { HazardType } from "@/lib/contract";
import { FIX_PLANS, materials, money } from "@/lib/costs";
import { HAZARD_TEXT } from "@/lib/hazards";
import ContrastSwatches from "@/components/ContrastSwatches";
import { plainContrast, type MeasuredHazard } from "@/lib/measure";

export interface Flow {
  type: HazardType;
  room: string;
  photo: SitePhoto;
  hazard: MeasuredHazard;
}

const ACCENT = "var(--ss-accent)";
const STEP_MS = 7000;

// gradient-labs.ai's "We handle what others hand off" card, for our pipeline:
// a list of hazards on the left (the active one advances on its own, with a
// progress line), and on the right the check for that hazard drawn as a little
// flow: the frame we looked at, the measurement, and the fix plan.
export default function Workflow({ flows }: { flows: Flow[] }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || reduce) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % flows.length), STEP_MS);
    return () => window.clearTimeout(t);
  }, [active, auto, reduce, flows.length]);

  const f = flows[active];
  return (
    <div className="grid gap-6 rounded-[24px] bg-white p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)]">
      <ul className="m-0 flex list-none flex-col p-0" role="tablist" aria-label="Things we check for">
        {flows.map((fl, i) => {
          const on = i === active;
          return (
            <li key={fl.type} className="border-b border-[var(--ss-line)]">
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setActive(i);
                  setAuto(false);
                }}
                className="relative flex w-full flex-col gap-2 py-3.5 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className={`grid size-9 place-items-center rounded-[10px] text-[15px] ${on ? "text-white" : "bg-[var(--ss-chip)] text-[var(--ss-ink-2)]"}`} style={on ? { background: ACCENT } : undefined}>
                    {i + 1}
                  </span>
                  <span className={`text-[16px] ${on ? "font-medium" : "text-[var(--ss-ink)]"}`}>{HAZARD_TEXT[fl.type].name}</span>
                </span>
                {on && <span className="pr-2 text-[14px] leading-relaxed text-[var(--ss-ink-2)]">{HAZARD_TEXT[fl.type].why}</span>}
                {on && auto && !reduce && (
                  <motion.span
                    key={`bar-${active}`}
                    className="absolute bottom-[-1px] left-0 h-[2px]"
                    style={{ background: ACCENT }}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="relative min-h-[420px] overflow-hidden rounded-[18px] bg-[var(--ss-soft)] p-5 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div key={f.type} className="relative grid h-full gap-4 sm:grid-cols-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <Card delay={0} reduce={!!reduce} className="self-start">
              <Head icon="▣" title={`${f.room[0].toUpperCase()}${f.room.slice(1)}`} note="What your video showed" />
              <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-[10px] bg-[var(--ss-line)]">
                <Isolated photo={f.photo} hazards={[f.hazard]} focus={f.hazard.box} alt={HAZARD_TEXT[f.type].name} />
              </div>
              <Row k="Found" v={HAZARD_TEXT[f.type].name} />
              <Row k="How sure we are" v={f.hazard.confidence >= 0.6 ? "Very sure" : f.hazard.confidence >= 0.4 ? "Fairly sure" : "Worth a look"} />
            </Card>

            <div className="flex flex-col gap-3">
              <Chip delay={0.4} reduce={!!reduce} busy="Checking…" done="Checked" />
              <Card delay={0.8} reduce={!!reduce}>
                <Head icon="◐" title="Does it stand out?" note="Compared with what's around it" />
                <Measurement hazard={f.hazard} />
              </Card>
              <Chip delay={1.4} reduce={!!reduce} busy="Pricing…" done="Priced" />
              <Card delay={1.8} reduce={!!reduce}>
                <Head icon="✓" title="Fix plan" note={`Severity: ${f.hazard.severity}`} />
                {FIX_PLANS[f.type].free && <Row k="Free today" v={FIX_PLANS[f.type].free!} />}
                <Row k="Cheapest fix" v={materials(FIX_PLANS[f.type])[1] > 0 ? money(materials(FIX_PLANS[f.type])) : "$0"} />
              </Card>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Card({ children, delay, reduce, className = "" }: { children: React.ReactNode; delay: number; reduce: boolean; className?: string }) {
  return (
    <motion.div
      className={`rounded-[14px] border border-[var(--ss-line)] bg-white p-4 shadow-[0_6px_18px_rgba(30,24,18,0.05)] ${className}`}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: reduce ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Head({ icon, title, note }: { icon: string; title: string; note: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-[var(--ss-chip)] text-[14px]">{icon}</span>
      <span>
        <span className="block text-[15px] leading-tight font-semibold">{title}</span>
        <span className="text-[12px] text-[var(--ss-ink-3)]">{note}</span>
      </span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="mt-3 flex justify-between gap-3 border-t border-[var(--ss-line)] pt-2 text-[13px]">
      <span className="text-[var(--ss-ink-2)]">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function Measurement({ hazard }: { hazard: MeasuredHazard }) {
  const contrast = plainContrast(hazard);
  if (!contrast) {
    return <p className="m-0 mt-3 text-[13px] leading-relaxed text-[var(--ss-ink-2)]">This one may be a problem because of what it is, whatever its color.</p>;
  }
  return (
    <div className="mt-3">
      <ContrastSwatches c={contrast} size="sm" />
    </div>
  );
}

// A status chip between steps: busy for a moment, then done.
function Chip({ delay, reduce, busy, done }: { delay: number; reduce: boolean; busy: string; done: string }) {
  const [finished, setFinished] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setFinished(true), (delay + 0.9) * 1000);
    return () => window.clearTimeout(t);
  }, [delay, reduce]);
  return (
    <motion.span
      className="inline-flex items-center gap-2 self-start rounded-[8px] border border-[var(--ss-line)] bg-[var(--ss-soft)] px-3 py-1.5 text-[12px]"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: reduce ? 0 : delay }}
    >
      <span className="text-[11px]">{finished ? "☑" : "⧗"}</span>
      {finished ? done : busy}
    </motion.span>
  );
}
