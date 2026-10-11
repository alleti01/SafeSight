import PhotoCredits from "@/components/PhotoCredits";
import { Header } from "@/components/v5/Chrome";
import { GUIDE_URL } from "@/lib/hazards";

// Every page outside the home page: the header, the page's sections on the
// cream page, and the footer, in the same style as the home page. On paper
// only the content prints.
export default function PageShell({ children, credits = false }: { children: React.ReactNode; credits?: boolean }) {
  return (
    <div className="flex min-h-svh flex-col print:block print:min-h-0">
      <Header />
      <main className="flex flex-1 flex-col print:block">{children}</main>
      <footer className="border-t border-[var(--ss-line)] print:hidden">
        <div className="flex w-full flex-wrap justify-between gap-6 px-5 py-10 text-[13px] text-[var(--ss-ink-2)] sm:px-10">
          <span className="max-w-[460px]">
            Built at BananaHacks 2026. Based on the{" "}
            <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              Alzheimer&apos;s Society guide
            </a>
            . We say &ldquo;may be a problem&rdquo;, never &ldquo;is dangerous&rdquo;.
          </span>
          {credits && <PhotoCredits className="max-w-[600px]" />}
        </div>
      </footer>
    </div>
  );
}

// One section of a page.
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`w-full px-5 py-12 sm:px-10 sm:py-16 print:max-w-none print:p-0 ${className}`}>
      {children}
    </section>
  );
}

export const PILL = "inline-flex items-center gap-2 rounded-full border border-[var(--ss-line)] bg-white px-4 py-2 text-[14px] hover:bg-[var(--ss-soft)]";
export const BLACK_PILL =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ss-accent)] px-6 py-3.5 text-[15px] font-medium text-white hover:brightness-110";
