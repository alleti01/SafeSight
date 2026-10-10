import siteImages from "@/lib/site-images.json";

type Credit = { by: string; url: string; site: string };

// Every stock photo on the site, credited to its photographer on Unsplash.
const CREDITS: Credit[] = Object.values(siteImages as unknown as Record<string, { credit?: Credit }>)
  .flatMap((p) => (p.credit?.site === "Unsplash" ? [p.credit] : []))
  .filter((c, i, all) => all.findIndex((d) => d.by === c.by) === i);

export default function PhotoCredits({ className = "" }: { className?: string }) {
  return (
    <p className={`m-0 ${className}`}>
      Photos on{" "}
      <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
        Unsplash
      </a>{" "}
      by{" "}
      {CREDITS.map((c, i) => (
        <span key={c.by}>
          <a href={c.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {c.by}
          </a>
          {i < CREDITS.length - 2 ? ", " : i === CREDITS.length - 2 ? " and " : "."}
        </span>
      ))}
    </p>
  );
}
