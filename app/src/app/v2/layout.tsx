import type { Metadata } from "next";
import { Antonio, Inter } from "next/font/google";

// A second take on the home page, after Zajno's C8VN landing page on Dribbble:
// a framed stage, floating objects in thin red detection boxes, and a giant
// condensed wordmark.
const display = Antonio({ variable: "--font-antonio", subsets: ["latin"], weight: ["100", "200", "400", "600", "700"] });
const body = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "SafeSight — see the home the way they might",
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable} min-h-svh bg-[#0b0c0e] font-v2-body`}>{children}</div>;
}
