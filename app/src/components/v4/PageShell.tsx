import { Header, SiteFooter } from "@/components/v5/Chrome";

// Every page outside the home page: the header, the page's sections on the
// cream page, and the footer, in the same style as the home page. On paper
// only the content prints.
export default function PageShell({ children }: { children: React.ReactNode; credits?: boolean }) {
  return (
    <div className="flex min-h-svh flex-col print:block print:min-h-0">
      <Header />
      <main className="flex flex-1 flex-col print:block">{children}</main>
      <SiteFooter />
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
