"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import type { HazardType, Severity } from "@/lib/contract";
import { HAZARD_TEXT } from "@/lib/hazards";
import { SETTLES_AT, TRACKS } from "./hero-track";

// The first thing on the home page: a short film of someone taking out their
// phone and looking at their living room. The film itself tints each thing
// that may be a problem. Along the bottom is the list of what we look for;
// as each thing comes into view its entry lights up and opens out into the
// sentence that explains it. Nothing is drawn over the picture, so there is
// nothing to jitter. When the camera stops, the nav slides in. Scroll, and
// the film shrinks into a rounded card while it keeps playing.

const DOT: Record<Severity, string> = { high: "var(--danger)", medium: "var(--warn)", low: "var(--calm)" };

// A second line for the chair, since its problem is the wall behind it.
const EXTRA: Partial<Record<HazardType, string>> = {
  furniture_blends_in: "Here the chair and the wall behind it are nearly the same colour.",
};

interface Props {
  onNav: (shown: boolean) => void;
}

export default function VideoHero({ onNav }: Props) {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [active, setActive] = useState<HazardType[]>([]);
  const [found, setFound] = useState<HazardType[]>([]);
  const [ended, setEnded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  // The nav shows once the camera has settled, or while the film is scrolled
  // away from full screen; scroll back up before that and it hides again.
  const [settled, setSettled] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => onNav(settled || scrolled), [settled, scrolled, onNav]);
  const settle = useCallback(() => setSettled(true), []);

  // The film shrinks into a card over the first stretch of scrolling.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.84]);
  const radius = useTransform(scrollYProgress, [0, 1], [0, 32]);
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 28]);

  useEffect(() => scrollYProgress.on("change", (p) => setScrolled(p > 0.02)), [scrollYProgress]);

  // Once per video frame: open and close entries as their time comes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let handle = 0;
    let shown = "";
    const update = (t: number) => {
      const on = TRACKS.filter((k) => t >= k.from && t < k.to).map((k) => k.type);
      const key = on.join(",");
      if (key !== shown) {
        shown = key;
        setActive(on);
        setFound((f) => {
          const next = [...f];
          for (const k of on) if (!next.includes(k)) next.push(k);
          return next.length === f.length ? f : next;
        });
      }
      if (t >= SETTLES_AT) settle();
    };
    // Chrome and Safari can call us exactly once per video frame.
    const vfc = "requestVideoFrameCallback" in video;
    const loop = (_now?: number, meta?: { mediaTime: number }) => {
      update(meta ? meta.mediaTime : video.currentTime);
      handle = vfc ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
    };
    loop();
    return () => {
      if (vfc) video.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
    };
  }, [settle]);

  // Browsers can refuse to autoplay; then we show a play button instead.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      setBlocked(true);
      settle();
    });
  }, [settle]);

  const replay = () => {
    const video = videoRef.current;
    if (!video) return;
    setFound([]);
    setEnded(false);
    setBlocked(false);
    setSettled(false);
    video.currentTime = 0;
    video.play().catch(() => setBlocked(true));
  };

  return (
    <section ref={sectionRef} className="relative h-[170svh]" aria-label="A living room, seen the way someone living with dementia might">
      <h1 className="sr-only">SafeSight: see the home through their eyes</h1>
      <div className="sticky top-0 h-svh overflow-hidden bg-[var(--ss-sheet)]">
        <motion.div style={{ scale, borderRadius: radius, y }} className="relative h-full w-full overflow-hidden bg-[#1a1613] will-change-transform">
          <video
            ref={videoRef}
            src="/hero.mp4"
            poster="/hero-poster.jpg"
            muted
            playsInline
            preload="auto"
            onEnded={() => {
              setEnded(true);
              settle();
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Found so far */}
          <div
            className={`pointer-events-none absolute top-4 right-4 rounded-[4px] bg-white/90 px-3 py-1.5 text-[12px] font-medium tracking-[0.01em] text-[var(--ss-ink)] uppercase backdrop-blur transition-opacity duration-500 sm:top-5 sm:right-5 ${
              found.length ? "opacity-100" : "opacity-0"
            }`}
            aria-live="polite"
          >
            Found {found.length} of {TRACKS.length}
          </div>

          {/* What we look for. An entry lights up when its object is found,
              and opens out into its explanation while the object is in view. */}
          <ul className="pointer-events-none absolute inset-x-3 bottom-3 m-0 flex list-none flex-wrap items-end justify-center gap-1.5 p-0 sm:inset-x-5 sm:bottom-5">
            {TRACKS.map((track) => {
              const text = HAZARD_TEXT[track.type];
              const isFound = found.includes(track.type);
              const isOpen = active.includes(track.type);
              return (
                <li
                  key={track.type}
                  className={`rounded-[3px] px-3.5 py-2 backdrop-blur-md transition-colors duration-500 ${
                    isFound ? "bg-white/92 text-[var(--ss-ink)] shadow-[0_6px_20px_rgba(20,16,12,0.16)]" : "bg-black/30 text-white/75"
                  } ${isOpen ? "max-w-[300px]" : "max-w-[260px]"}`}
                  aria-current={isOpen ? "true" : undefined}
                >
                  <span className="flex items-center gap-2 font-v5 text-[13px] leading-tight font-medium tracking-[-0.01em] whitespace-nowrap">
                    <span className="size-1.5 shrink-0" style={{ background: isFound ? DOT[track.severity] : "rgba(255,255,255,0.45)" }} />
                    {text.name}
                  </span>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.p
                        key="why"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                        className="m-0 overflow-hidden text-[12px] leading-snug text-[var(--ss-ink-2)]"
                      >
                        <span className="block pt-1.5">
                          {text.why}
                          {EXTRA[track.type] && <> {EXTRA[track.type]}</>}
                        </span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>

          {(ended || blocked) && (
            <button
              type="button"
              onClick={replay}
              className="absolute top-4 left-4 flex items-center gap-2 rounded-[4px] bg-white/90 px-3.5 py-2 text-[12px] font-medium text-[var(--ss-ink)] shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur hover:bg-white sm:top-5 sm:left-5"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {blocked ? <path d="M8 5v14l11-7z" /> : <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />}
              </svg>
              {blocked ? "Play" : "Replay"}
            </button>
          )}
        </motion.div>
      </div>
    </section>
  );
}
