"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";

const SECTIONS = [
  { id: "example", label: "Example" },
  { id: "how", label: "How it works" },
  { id: "model", label: "The model" },
  { id: "plan", label: "Fix plan" },
  { id: "privacy", label: "Privacy" },
] as const;

// The header of the first home page design (/v1): its links jump to
// sections and an underline follows the section you're reading.
export default function V1Header() {
  const active = useActiveSection(true);

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-50 border-b border-line bg-background/90 px-4 backdrop-blur-md sm:px-8 print:hidden">
      <nav className="mx-auto flex max-w-[1176px] items-center justify-between gap-4 py-3.5 text-[15px]">
        <Link href="/v1" className="shrink-0 font-display text-2xl">
          SafeSight
        </Link>

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <ul className="m-0 hidden list-none items-center gap-1 p-0 md:flex">
            {SECTIONS.map((s) => (
              <li key={s.id} className="relative">
                <Link
                  href={`#${s.id}`}
                  className={`block px-3 py-2 transition-colors hover:text-foreground ${
                    active === s.id ? "text-foreground" : "text-muted"
                  }`}
                >
                  {s.label}
                </Link>
                {active === s.id && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-3 -bottom-[15px] h-[2px] bg-foreground"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </li>
            ))}
          </ul>
          <Link href="/results" className="hidden px-3 py-2 text-muted hover:text-foreground sm:block md:hidden lg:block">
            Results
          </Link>
          <Link href="#check" className="shrink-0 rounded-[4px] bg-accent px-4 py-2.5 text-background hover:bg-accent-dark">
            Check a room
          </Link>
        </div>
      </nav>

      {/* Phones: the same section links as a row you can swipe. */}
      <ul className="-mx-4 m-0 flex list-none gap-1 overflow-x-auto px-3 pb-2 text-[15px] [scrollbar-width:none] md:hidden">
        {SECTIONS.map((s) => (
          <li key={s.id} className="shrink-0">
            <Link
              href={`#${s.id}`}
              className={`block rounded-[4px] px-3 py-1.5 ${
                active === s.id ? "bg-foreground text-background" : "text-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </header>
  );
}

function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setActive(null);
      return;
    }
    const seen = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        // The section taking up the most of the reading band wins.
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of seen) {
          if (ratio > bestRatio) [best, bestRatio] = [id, ratio];
        }
        setActive(best);
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [enabled]);

  return active;
}
