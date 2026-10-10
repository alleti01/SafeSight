"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#model", label: "The model" },
  { href: "/results", label: "Results" },
  { href: "/report", label: "Fix plan" },
];

export function Dots({ className = "h-6 w-7" }: { className?: string }) {
  const dots: [number, number, number][] = [
    [6, 4, 2.2], [13, 4, 2.6], [3, 10, 2.2], [10, 10, 3.2], [18, 10, 2.6], [6, 16, 2.6], [13, 16, 2.2],
  ];
  return (
    <svg viewBox="0 0 22 20" className={className} aria-hidden="true">
      {dots.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={i % 3 === 1 ? "var(--ss-accent)" : "var(--ss-light)"} />
      ))}
    </svg>
  );
}

// The bar at the top of every page but the home page (whose hero has its own):
// a white rounded sheet with the logo, pill links and the main action.
export default function SiteHeader() {
  const path = usePathname();
  const here = (href: string) => href !== "/" && !href.includes("#") && path.startsWith(href.split("?")[0]);
  return (
    <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 rounded-[24px] bg-[var(--ss-sheet)] px-4 py-3 sm:rounded-[28px] sm:px-6 print:hidden">
      <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[20px] font-medium tracking-tight">
        <Dots />
        SafeSight
      </Link>
      <ul className="m-0 hidden list-none items-center gap-1 p-0 text-[15px] md:flex">
        {NAV.map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={here(n.href) ? "page" : undefined}
              className={`block rounded-full px-4 py-2 ${
                here(n.href) ? "bg-[var(--ss-card)] font-medium shadow-[0_6px_16px_rgba(62,54,46,0.06)]" : "text-[var(--ss-ink-2)] hover:text-[var(--ss-ink)]"
              }`}
            >
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/#check"
        className="shrink-0 rounded-full bg-[var(--ss-ink)] px-5 py-2.5 text-[14px] font-medium whitespace-nowrap text-white shadow-[0_10px_24px_rgba(62,54,46,0.25)] hover:bg-[var(--ss-ink-hover)]"
      >
        Check a room
      </Link>
    </header>
  );
}
