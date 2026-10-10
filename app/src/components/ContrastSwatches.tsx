import type { PlainContrast } from "@/lib/measure";

// The object's color next to the color around it, and what that may mean:
// the contrast check, shown instead of numbers.
export default function ContrastSwatches({ c, size = "md", dark = false }: { c: PlainContrast; size?: "sm" | "md"; dark?: boolean }) {
  const chip = size === "sm" ? "size-7 rounded-[8px]" : "size-11 rounded-[12px]";
  const swatch = (color: string, label: string) => (
    <span className="flex items-center gap-2">
      <span className={`${chip} shrink-0 border ${dark ? "border-white/25" : "border-black/10"}`} style={{ background: color }} aria-hidden="true" />
      <span className={size === "sm" ? "text-[12px]" : "text-[13px]"}>{label}</span>
    </span>
  );
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {swatch(c.objectColor, c.object)}
        <span className={`text-[12px] ${dark ? "text-white/60" : "text-[var(--ss-ink-3)]"}`}>vs.</span>
        {swatch(c.backgroundColor, c.background)}
      </div>
      <p className={`m-0 leading-snug ${size === "sm" ? "text-[13px]" : "text-[14px]"}`}>{c.sentence}</p>
    </div>
  );
}
