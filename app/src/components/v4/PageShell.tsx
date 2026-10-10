import PhotoCredits from "@/components/PhotoCredits";
import SiteHeader from "@/components/SiteHeader";

// Every page outside the home page: the tan page, the header sheet,
// the page's own sheets, and the footer. On paper only the content prints.
export default function PageShell({ children, credits = false }: { children: React.ReactNode; credits?: boolean }) {
  return (
    <div className="flex min-h-svh flex-col gap-3 p-3 sm:gap-6 sm:p-6 lg:p-10 print:block print:min-h-0 print:p-0">
      <SiteHeader />
      <main className="flex flex-col gap-3 sm:gap-6 print:block">{children}</main>
      <footer className="mx-auto mt-auto flex w-full max-w-[1440px] flex-wrap justify-between gap-3 px-2 text-[12px] text-[var(--ss-ink-2)] print:hidden">
        <span>Built at BananaHacks 2026. We say &ldquo;may be a problem&rdquo;, never &ldquo;is dangerous&rdquo;.</span>
        {credits && <PhotoCredits className="max-w-[720px]" />}
      </footer>
    </div>
  );
}

// One white rounded sheet of content.
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`mx-auto w-full max-w-[1440px] rounded-[28px] bg-[var(--ss-sheet)] px-5 py-10 sm:rounded-[36px] sm:px-10 sm:py-14 lg:px-16 print:max-w-none print:rounded-none print:bg-white print:p-0 ${className}`}
    >
      {children}
    </section>
  );
}

export const PILL = "inline-flex items-center gap-2 rounded-full bg-[var(--ss-card)] px-4 py-2 text-[14px] shadow-[0_6px_16px_rgba(62,54,46,0.06)] hover:bg-[var(--ss-soft)]";
export const BLACK_PILL =
  "inline-flex items-center justify-center rounded-full bg-[var(--ss-ink)] px-6 py-3.5 text-[15px] font-medium text-white shadow-[0_18px_36px_rgba(62,54,46,0.25)] hover:bg-[var(--ss-ink-hover)]";
