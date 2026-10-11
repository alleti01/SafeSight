import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Geist, IBM_Plex_Mono, Inter, Manrope, Newsreader } from "next/font/google";
import "./globals.css";

// Geist (headings, labels and numbers) and Inter (text) are the site's
// type. Manrope belongs to /v4; Atkinson Hyperlegible,
// Newsreader and Plex Mono to the first design at /v1.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], weight: ["400", "500", "600"] });
const inter = Inter({ variable: "--font-inter5", subsets: ["latin"], weight: ["400", "500"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const body = Atkinson_Hyperlegible({ variable: "--font-body", subsets: ["latin"], weight: ["400", "700"] });
const heading = Newsreader({ variable: "--font-heading", subsets: ["latin"], weight: ["300", "400", "500"] });
const code = IBM_Plex_Mono({ variable: "--font-code", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "SafeSight — dementia-friendly homes, checked room by room",
  description: "Find things at home that may be confusing or risky for someone with dementia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geist.variable} ${inter.variable} ${manrope.variable} ${body.variable} ${heading.variable} ${code.variable} bg-[var(--ss-sheet)] font-[family-name:var(--font-inter5)] text-[var(--ss-ink)] antialiased print:bg-white`}
      >
        {children}
      </body>
    </html>
  );
}
