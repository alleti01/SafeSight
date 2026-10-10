import type { Metadata } from "next";
import { Atkinson_Hyperlegible, IBM_Plex_Mono, Manrope, Newsreader } from "next/font/google";
import "./globals.css";

// Manrope is the site's type. Atkinson Hyperlegible, Newsreader and Plex Mono
// belong to the first design, kept at /v1.
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const body = Atkinson_Hyperlegible({ variable: "--font-body", subsets: ["latin"], weight: ["400", "700"] });
const heading = Newsreader({ variable: "--font-heading", subsets: ["latin"], weight: ["300", "400", "500"] });
const code = IBM_Plex_Mono({ variable: "--font-code", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "SafeSight — see the home through their eyes",
  description: "Find things at home that may be confusing or risky for someone with dementia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${body.variable} ${heading.variable} ${code.variable} bg-[var(--ss-page)] font-v4 text-[var(--ss-ink)] antialiased print:bg-white`}>
        {children}
      </body>
    </html>
  );
}
