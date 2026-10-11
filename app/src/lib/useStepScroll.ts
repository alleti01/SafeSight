"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";

// Wide screens (1024px and up) pin a stepped section; narrow ones show a list
// you tap.
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return wide;
}

/**
 * A section that pins on wide screens and moves through `count` steps as you
 * scroll, one step per scroll gesture. Put `track` on a tall wrapper (its
 * height sets how much scrolling the steps take) with a sticky child.
 *
 * - `active` is the current step: from scroll position on wide screens, from
 *   `pick` on narrow ones.
 * - `pick(i)` scrolls to step i (wide) or shows it (narrow).
 *
 * While pinned, a wheel or trackpad flick moves one step and the rest of that
 * gesture's momentum is swallowed; a gesture that scrolls in from outside
 * stops on the first (or last) step. Past either end the page scrolls on.
 * The scrollbar and keyboard still work, by position.
 */
export function useStepScroll(count: number) {
  const reduce = useReducedMotion();
  const wide = useWide();
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const [scrolled, setScrolled] = useState(0);
  const [picked, setPicked] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => setScrolled(Math.min(count - 1, Math.max(0, Math.floor(v * count)))));

  // Scroll to the middle of step i's stretch of the pinned section.
  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const span = el.offsetHeight - window.innerHeight;
    const top = window.scrollY + el.getBoundingClientRect().top + ((i + 0.5) / count) * span;
    window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  };

  const at = useRef(0);
  at.current = scrolled;
  useEffect(() => {
    if (!wide) return;
    let lastWheel = 0;
    // Whether the gesture under way (wheel events less than 160ms apart) has
    // already moved a step; if so, the rest of it is swallowed.
    let used = false;
    const onWheel = (e: WheelEvent) => {
      const el = track.current;
      if (!el || e.deltaY === 0) return;
      const now = performance.now();
      const box = el.getBoundingClientRect();
      const pinned = box.top <= 1 && box.bottom >= window.innerHeight - 1;
      if (now - lastWheel > 160) used = !pinned;
      lastWheel = now;
      if (!pinned) return;
      if (used) return e.preventDefault();
      const next = at.current + (e.deltaY > 0 ? 1 : -1);
      if (next < 0 || next >= count) return;
      e.preventDefault();
      used = true;
      at.current = next;
      goTo(next);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
    // goTo only reads the ref, `count` and `reduce`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wide, reduce, count]);

  return { track, wide, active: wide ? scrolled : picked, pick: (i: number) => (wide ? goTo(i) : setPicked(i)) };
}
