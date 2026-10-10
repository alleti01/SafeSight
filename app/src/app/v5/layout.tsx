import type { Metadata } from "next";
import { Geist, Instrument_Serif, Inter } from "next/font/google";

// A fifth take on the home page, after gradient-labs.ai: a cream page, black
// type, orange actions, an isometric line drawing in the hero, and bands of
// color between sections, each opened by a small italic serif label.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], weight: ["400", "500", "600"] });
const inter = Inter({ variable: "--font-inter5", subsets: ["latin"], weight: ["400", "500"] });
const serif = Instrument_Serif({ variable: "--font-iserif", subsets: ["latin"], weight: "400", style: "italic" });

export const metadata: Metadata = {
  title: "SafeSight — dementia-friendly homes, checked room by room",
};

export default function V5Layout({ children }: { children: React.ReactNode }) {
  return <div className={`${geist.variable} ${inter.variable} ${serif.variable} v5 min-h-svh bg-[var(--ss-sheet)] font-[family-name:var(--font-inter5)] text-[var(--ss-ink)]`}>{children}</div>;
}
