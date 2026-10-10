import type { Metadata } from "next";
import { Lexend } from "next/font/google";

// A third take on the home page, after Halo Lab's "Skillex" landing page on
// Dribbble: a soft gradient, one white rounded sheet, a big three-word
// headline, a search bar overlapping photo cards, and pastel category cards.
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"], weight: ["300", "400", "500", "600"] });

export const metadata: Metadata = {
  title: "SafeSight — film, see, fix",
};

export default function V3Layout({ children }: { children: React.ReactNode }) {
  return <div className={`${lexend.variable} min-h-svh font-v3`}>{children}</div>;
}
