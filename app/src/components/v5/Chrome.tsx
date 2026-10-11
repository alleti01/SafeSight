"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// The pieces every page shares: the logo mark, the small label that opens
// a section, the section heading, and the header bar.

export function Mark({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" />
      <path d="M3 21 L21 3 M12 3 V12 H21" />
    </svg>
  );
}

export function Eyebrow({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={`flex items-center border-t pt-4 ${dark ? "border-white/25" : "border-[var(--ss-ink)]"}`}
    >
      <span className="font-v5 text-[15px] font-medium">{children}</span>
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="m-0 mt-5 max-w-[760px] font-v5 text-[clamp(32px,3.8vw,48px)] leading-[1.08] font-medium tracking-[-0.025em]">
      {children}
    </h2>
  );
}

// Links into the home page's sections, in the order they come down the page.
export const NAV = [
  { href: "/#home", label: "What we look for" },
  { href: "/#how", label: "How it works" },
  { href: "/#fixes", label: "What you get" },
];

// The header bar. On the home page it hides over the film and slides in once
// you scroll (the page passes `shown`); everywhere else it's always there.
// Below 1024px the section links move into a menu that opens under the bar.
// Section links are plain anchors: the browser's own jump to a section is
// reliable, where Next's Link stopped short when already on the home page.
export function Header({
  shown = true,
  fixed = false,
}: {
  shown?: boolean;
  fixed?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  // The menu closes with Escape, when the bar hides, or when the screen widens.
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => wide.matches && setMenu(false);
    window.addEventListener("keydown", key);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", key);
      wide.removeEventListener("change", onWide);
    };
  }, [menu]);
  const open = menu && shown;
  return (
    <header
      className={`${fixed ? "fixed" : "sticky"} inset-x-0 top-0 z-50 border-b border-[var(--ss-line)] bg-[var(--ss-sheet)]/95 backdrop-blur transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none print:hidden ${
        shown ? "translate-y-0" : "-translate-y-full"
      }`}
      aria-hidden={!shown}
      inert={!shown}
    >
      <nav className="flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-10">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-v5 text-[22px] font-medium tracking-[-0.02em] max-[400px]:gap-2 max-[400px]:text-[19px]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt=""
            width={28}
            height={28}
            className="size-7"
          />
          <span className="max-[340px]:sr-only">SafeSight</span>
        </Link>
        <ul className="m-0 hidden list-none items-center gap-6 p-0 text-[15px] whitespace-nowrap lg:flex xl:gap-7">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="hover:opacity-70">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex shrink-0 items-center gap-2">
          {/* A plain anchor on purpose, like the section links above. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/#check"
            onClick={() => setMenu(false)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ss-ink)] px-4 py-2.5 text-[14px] font-medium whitespace-nowrap text-white hover:bg-[var(--ss-ink-hover)] max-[400px]:px-3.5 max-[400px]:text-[13px] sm:px-5"
          >
            Check a room <span aria-hidden="true">→</span>
          </a>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close the menu" : "Open the menu"}
            onClick={() => setMenu((v) => !v)}
            className="grid size-11 place-items-center rounded-full border border-[var(--ss-line)] bg-white text-[var(--ss-ink)] lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path
                d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </nav>
      {open && (
        <div
          id="site-menu"
          className="border-t border-[var(--ss-line)] px-5 pt-2 pb-6 sm:px-10 lg:hidden"
        >
          <ul className="m-0 list-none p-0">
            {NAV.map((n) => (
              <li key={n.href} className="border-b border-[var(--ss-line)]">
                <a
                  href={n.href}
                  onClick={() => setMenu(false)}
                  className="flex items-center justify-between py-4 font-v5 text-[22px] font-medium tracking-[-0.01em]"
                >
                  {n.label}
                  <span aria-hidden="true" className="text-[var(--ss-ink-3)]">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
