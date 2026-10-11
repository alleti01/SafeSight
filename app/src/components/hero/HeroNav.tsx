"use client";

import Link from "next/link";

export const NAV = [
  { href: "#home", label: "The home" },
  { href: "#fixes", label: "What you get" },
  { href: "#stores", label: "Where to buy" },
  { href: "#rooms", label: "What we look for" },
  { href: "#how", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
];

// The bar at the top of the home page, in the /v5 style. It stays out of the
// way while the film fills the screen, and slides in once the camera settles
// or you scroll.
export default function HeroNav({ shown }: { shown: boolean }) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b border-[var(--ss-line)] bg-[var(--ss-sheet)]/95 backdrop-blur transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        shown ? "translate-y-0" : "-translate-y-full"
      }`}
      aria-hidden={!shown}
      inert={!shown}
    >
      <nav className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-4 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 font-v5 text-[22px] font-medium tracking-[-0.02em]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={28} height={28} className="size-7" />
          <span className="max-[340px]:sr-only">SafeSight</span>
        </Link>
        <ul className="m-0 hidden list-none items-center gap-7 p-0 text-[15px] md:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="hover:opacity-70">
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href="#check"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ss-ink)] px-4 py-2.5 text-[14px] font-medium whitespace-nowrap text-white hover:bg-[var(--ss-ink-hover)] sm:px-5"
        >
          Check a room <span aria-hidden="true">→</span>
        </a>
      </nav>
    </header>
  );
}

