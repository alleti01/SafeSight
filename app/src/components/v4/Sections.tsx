"use client";

import type { SitePhoto } from "@/components/landing/ModelStrip";
import type { Hazard, HazardType } from "@/lib/contract";
import { ROOMS } from "@/lib/contract";
import { HAZARD_TEXT } from "@/lib/hazards";
import { plainContrast, type MeasuredHazard } from "@/lib/measure";

export const SEVERITY_DOT: Record<Hazard["severity"], string> = { high: "var(--danger)", medium: "var(--warn)", low: "var(--calm)" };

// One white rounded sheet on the grey-blue page, like the hero.
export function Sheet({ id, children, className = "" }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <section
      id={id}
      className={`relative mx-auto max-w-[1440px] scroll-mt-4 overflow-hidden rounded-[28px] bg-[var(--ss-sheet)] px-5 py-14 sm:rounded-[36px] sm:px-10 sm:py-20 lg:px-16 ${className}`}
    >
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--ss-card)] px-4 py-2 text-[13px] font-medium shadow-[0_6px_16px_rgba(62,54,46,0.06)]">
      <span className="size-1.5 rounded-full bg-[var(--ss-accent)]" />
      {children}
    </span>
  );
}

export function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className={`mb-12 grid gap-6 ${children ? "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end" : ""}`}>
      <div className="flex flex-col items-start gap-5">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="m-0 font-v4 text-[clamp(32px,3.8vw,54px)] leading-[1.1] font-normal tracking-[-0.02em]">{title}</h2>
      </div>
      {children && <p className="m-0 max-w-[440px] text-[15px] leading-relaxed text-[var(--ss-ink-2)] lg:justify-self-end">{children}</p>}
    </div>
  );
}

const center = (p: SitePhoto, box: Hazard["box"]) => {
  const [x0, y0, x1, y1] = box;
  return `${(((x0 + x1) / 2) / p.width) * 100}% ${(((y0 + y1) / 2) / p.height) * 100}%`;
};

// A photo in grey with the given findings in color, filling its container.
// Photo and masks are cropped (and zoomed) the same way, so the color stays
// on its object.
export function Isolated({
  photo,
  hazards,
  focus,
  zoom = 1,
  alt = "",
}: {
  photo: SitePhoto;
  hazards: Hazard[];
  focus?: Hazard["box"];
  /** Enlarge around the focus, for small thumbnails. */
  zoom?: number;
  alt?: string;
}) {
  const pos = focus ? center(photo, focus) : "50% 50%";
  const zoomed = zoom === 1 ? undefined : { transform: `scale(${zoom})`, transformOrigin: pos };
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt={alt} className="absolute inset-0 h-full w-full object-cover grayscale" style={{ objectPosition: pos, ...zoomed }} />
      {hazards.map((h) => {
        const outline = `url("${h.outline_url}")`;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={h.hazard_id}
            src={photo.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              ...zoomed,
              objectPosition: pos,
              maskImage: outline,
              WebkitMaskImage: outline,
              maskSize: "cover",
              WebkitMaskSize: "cover",
              maskPosition: pos,
              WebkitMaskPosition: pos,
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
            }}
          />
        );
      })}
    </>
  );
}

// The ten hazards as arches: found ones in grey with the finding in color,
// the rest as the plain photo, saying the fine-tuned model is still to come.
export function HazardArches({ tiles }: { tiles: { type: HazardType; photo: SitePhoto; hazard?: MeasuredHazard }[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-8 p-0 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map(({ type, photo, hazard }) => (
        <li key={type} className="flex flex-col gap-3">
          <div className="relative aspect-[3/4] overflow-hidden rounded-t-full rounded-b-[24px] bg-[var(--ss-line)] shadow-[0_14px_34px_rgba(62,54,46,0.1)]">
            {hazard ? (
              <Isolated photo={photo} hazards={[hazard]} focus={hazard.box} alt={HAZARD_TEXT[type].name} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.src} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            )}
            <span className="absolute inset-x-2 bottom-2 rounded-full bg-white/85 px-3 py-1.5 text-center text-[11px] leading-tight backdrop-blur">
              {hazard ? (
                <>
                  <span className="mr-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: SEVERITY_DOT[hazard.severity] }} />
                  <span className="capitalize">{hazard.severity}</span>
                </>
              ) : (
                "Coming soon"
              )}
            </span>
          </div>
          <div>
            <span className="block text-[15px] leading-tight font-medium">{HAZARD_TEXT[type].name}</span>
            <span className="mt-1 block text-[13px] leading-snug text-[var(--ss-ink-3)]">{HAZARD_TEXT[type].why}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// One photo through each stage of the pipeline, from the backend's real output.
export function ModelStages({ photo }: { photo: SitePhoto }) {
  const { width: w, height: h } = photo;
  const pct = (n: number) => `${n}%`;
  const boxStyle = ([x0, y0, x1, y1]: number[]) => ({
    left: pct((x0 / w) * 100),
    top: pct((y0 / h) * 100),
    width: pct(((x1 - x0) / w) * 100),
    height: pct(((y1 - y0) / h) * 100),
  });
  const stages: { label: string; note: string; body: React.ReactNode }[] = [
    {
      label: "The photo",
      note: "From your video, with anyone in it blurred",
      // eslint-disable-next-line @next/next/no-img-element
      body: <img src={photo.src} alt="" className="absolute inset-0 h-full w-full object-cover" />,
    },
    {
      label: "Things it noticed",
      note: "Everything it spotted, mistakes and all",
      body: (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt="" className="absolute inset-0 h-full w-full object-cover grayscale" />
          {photo.objects.map((o, i) => (
            <span key={i} className="absolute rounded-[4px] border-2 border-white shadow-[0_0_0_1px_rgba(62,54,46,0.4)]" style={boxStyle(o.box)} />
          ))}
        </>
      ),
    },
    {
      label: "The exact shape",
      note: "So it knows exactly what to compare",
      body: (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt="" className="absolute inset-0 h-full w-full object-cover brightness-75 grayscale" />
          {photo.objects.map(
            (o, i) =>
              o.outline_url && (
                <span
                  key={i}
                  className="absolute inset-0 bg-[var(--ss-glow)]/90"
                  style={{ maskImage: `url("${o.outline_url}")`, WebkitMaskImage: `url("${o.outline_url}")`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
                />
              ),
          )}
        </>
      ),
    },
    {
      label: "What may be a problem",
      note: "Checked, then explained in plain words",
      body: <Isolated photo={photo} hazards={photo.hazards} />,
    },
  ];
  return (
    <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
      {stages.map((s, i) => (
        <li key={s.label} className="flex flex-col gap-3 rounded-[24px] bg-[var(--ss-card)] p-3 shadow-[0_14px_34px_rgba(62,54,46,0.08)]">
          <div className="relative overflow-hidden rounded-[18px] bg-[var(--ss-line)]" style={{ aspectRatio: `${w} / ${h}` }}>
            {s.body}
          </div>
          <div className="flex items-start gap-3 px-1 pb-1">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ss-ink)] text-[12px] text-white">{i + 1}</span>
            <span>
              <span className="block text-[15px] font-medium">{s.label}</span>
              <span className="text-[13px] text-[var(--ss-ink-3)]">{s.note}</span>
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

// The contrast check for one finding, as a person would see it: the object's
// color next to the color around it, and what that may mean.
export function Readout({ hazard, title }: { hazard: MeasuredHazard; title: string }) {
  const contrast = plainContrast(hazard);
  return (
    <div className="flex flex-col gap-6 rounded-[28px] bg-white/80 p-6 shadow-[0_20px_50px_rgba(62,54,46,0.1)] backdrop-blur-md sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-[13px] text-[var(--ss-ink-3)]">The contrast check · {title}</span>
          <span className="mt-1 block text-[26px] leading-tight font-medium">{HAZARD_TEXT[hazard.type].name}</span>
        </div>
        <span className="rounded-full px-3 py-1 text-[12px] font-medium text-white capitalize" style={{ background: SEVERITY_DOT[hazard.severity] }}>
          {hazard.severity}
        </span>
      </div>
      {contrast && (
        <div className="grid grid-cols-2 gap-3">
          {[
            [contrast.objectColor, contrast.object],
            [contrast.backgroundColor, contrast.background],
          ].map(([color, label]) => (
            <div key={label} className="flex flex-col gap-2">
              <span className="h-20 rounded-[16px] border border-black/10" style={{ background: color }} aria-hidden="true" />
              <span className="text-[14px]">{label}</span>
            </div>
          ))}
        </div>
      )}
      <p className="m-0 text-[17px] leading-snug">{contrast ? contrast.sentence : HAZARD_TEXT[hazard.type].why}</p>
      <p className="m-0 text-[13px] leading-relaxed text-[var(--ss-ink-3)]">
        We compare the object with a thin band of floor or wall just around it. Too different (a dark rug) or too alike (a white toilet on
        white tile) may be a problem.
      </p>
    </div>
  );
}

// The upload form, in pills and glass.
export function CheckForm({
  room,
  onRoom,
  files,
  onFiles,
  error,
  onSubmit,
}: {
  room: string;
  onRoom: (r: string) => void;
  files: File[];
  onFiles: (list: FileList | null) => void;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const videos = files.filter((f) => f.type.startsWith("video/"));
  const photos = files.filter((f) => f.type.startsWith("image/"));
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
        <legend className="mb-3 p-0 text-[13px] text-[var(--ss-ink-2)]">Which room?</legend>
        {ROOMS.map((r) => (
          <label
            key={r}
            className={`cursor-pointer rounded-full px-5 py-2.5 text-[15px] capitalize transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ss-ink)] ${
              room === r ? "bg-[var(--ss-ink)] text-white" : "bg-[var(--ss-card)] text-[var(--ss-ink-2)] shadow-[0_6px_16px_rgba(62,54,46,0.06)] hover:bg-[var(--ss-soft)]"
            }`}
          >
            <input type="radio" name="room" value={r} checked={room === r} onChange={() => onRoom(r)} className="sr-only" />
            {r}
          </label>
        ))}
      </fieldset>

      <label
        htmlFor="v4-files"
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-[var(--ss-light)] bg-white/70 px-6 py-10 text-center backdrop-blur transition-colors hover:bg-[var(--ss-card)]"
      >
        <svg viewBox="0 0 24 24" className="size-8 text-[var(--ss-accent)]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        <span className="text-[17px] font-medium">
          {files.length === 0
            ? "Add a video or photos"
            : videos.length === 1
              ? `1 video: ${videos[0].name}`
              : `${photos.length} photo${photos.length === 1 ? "" : "s"} ready`}
        </span>
        <span className="text-[13px] text-[var(--ss-ink-3)]">A slow minute of video, or a few photos, from your phone</span>
        <input id="v4-files" type="file" accept="image/*,video/*" multiple onChange={(e) => onFiles(e.target.files)} className="sr-only" />
      </label>

      {error && (
        <p role="alert" className="m-0 rounded-[14px] bg-[#fdecea] px-4 py-3 text-[14px] text-[#9b2c24]">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="self-start rounded-full bg-[var(--ss-ink)] px-8 py-4 text-[15px] font-medium text-white shadow-[0_18px_36px_rgba(62,54,46,0.25)] hover:bg-[var(--ss-ink-hover)]"
      >
        Check this room →
      </button>
    </form>
  );
}
