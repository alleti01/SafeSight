"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HazardRow from "@/components/HazardRow";
import { BlurFade } from "@/components/ui/blur-fade";
import { Eyebrow } from "@/components/v5/Chrome";
import PageShell, { BLACK_PILL, Panel } from "@/components/v4/PageShell";
import { assetUrl } from "@/lib/brain";
import type { Severity } from "@/lib/contract";
import { SEVERITY_LABEL, roomName } from "@/lib/hazards";
import {
  detailHref,
  galleryItems,
  isSure,
  useScans,
  type GalleryItem,
} from "@/lib/results";

export default function ResultsPage() {
  const state = useScans();
  const removal = useRemoved();
  if (state === null) return null;

  const { scans, isExample } = state;
  const all = galleryItems(scans).filter(
    (i) => !removal.removed.includes(i.key),
  );
  // Findings the detector is sure of come first; the rest are listed apart, to check in person.
  const items = all.filter((i) => isSure(i.hazard));
  const unsure = all.filter((i) => !isSure(i.hazard));
  const rooms = [...new Set(scans.map((s) => s.room))];
  const photoCount = scans.reduce((n, s) => n + s.frames.length, 0);
  // Frames from a video carry their time in it; say so instead of "photos".
  const fromVideo = scans.some((s) => s.frames.some((f) => f.time_s !== undefined));
  const checkedLine = fromVideo
    ? `${photoCount} ${photoCount === 1 ? "moment" : "moments"} from your video checked`
    : `${photoCount} photo${photoCount === 1 ? "" : "s"} checked`;
  const heading =
    items.length === 0
      ? scans.length > 0
        ? "Nothing flagged"
        : "Nothing flagged yet"
      : `${items.length} ${items.length === 1 ? "thing" : "things"} may be a problem`;

  return (
    <PageShell>
      <Panel>
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
          <div className="flex flex-col items-start gap-5">
            <Eyebrow>{isExample ? "Example results" : "Your results"}</Eyebrow>
            <h1 className="m-0 text-[clamp(36px,4.6vw,64px)] leading-[1.08] font-v5 font-medium tracking-[-0.03em]">
              <span className="capitalize">
                {rooms.length > 0 ? rooms.map(roomName).join(", ") : "Results"}
              </span>
              <span className="flex items-center gap-4 text-[var(--ss-ink-2)]">
                <svg
                  viewBox="0 0 60 24"
                  className="h-[0.45em] w-[1em] shrink-0 text-[var(--ss-faint)]"
                  aria-hidden="true"
                >
                  <path
                    d="M2 12h54M44 2l12 10-12 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {heading}
              </span>
            </h1>
          </div>
          {scans.length > 0 && (
            <BlurFade delay={0.2} className="flex flex-col items-start gap-5">
              <p className="m-0 text-[15px] leading-relaxed text-[var(--ss-ink-2)]">
                {checkedLine}. Every
                home and person is different, so treat these as suggestions, not
                a safety inspection.
                {isExample && " Check a room to see your own."}
              </p>
              {items.length > 0 && (
                <Link
                  href={isExample ? "/report?example" : "/report"}
                  className={BLACK_PILL}
                >
                  Fix plan and costs (PDF) →
                </Link>
              )}
            </BlurFade>
          )}
        </header>
      </Panel>

      {items.length === 0 && unsure.length === 0 ? (
        <Panel>
          <p className="m-0 text-[20px]">
            {scans.length > 0 ? (
              "We didn't spot anything that may be a problem in these photos."
            ) : (
              <>
                <Link href="/#check" className="underline underline-offset-4">
                  Check a room
                </Link>{" "}
                to see what may need attention.
              </>
            )}
          </p>
        </Panel>
      ) : (
        <Gallery
          items={items}
          unsure={unsure}
          isExample={isExample}
          removal={removal}
        />
      )}

      {scans.map((scan) =>
        scan.frames.length === 0 ? null : (
          <Panel key={scan.job_id} className="!py-8">
            <details open={items.length === 0}>
              <summary className="cursor-pointer text-[18px] font-medium">
                {scan.frames.some((f) => f.time_s !== undefined) ? "Moments we checked" : "Photos we checked"}
                {" · "}
                <span className="capitalize">{roomName(scan.room)}</span> ({scan.frames.length})
              </summary>
              <ul className="m-0 mt-6 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-6">
                {scan.frames.map((f) => (
                  <li key={f.frame_id} className="flex flex-col gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetUrl(f.image_url)}
                      alt=""
                      className="w-full rounded-[16px] bg-[var(--ss-line)] object-cover grayscale"
                      style={{ aspectRatio: `${f.width} / ${f.height}` }}
                    />
                    {f.time_s !== undefined && (
                      <span className="text-[13px] text-[var(--ss-ink-3)]">
                        {Math.floor(f.time_s / 60)}:
                        {String(Math.floor(f.time_s % 60)).padStart(2, "0")}{" "}
                        into the video
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </Panel>
        ),
      )}
    </PageShell>
  );
}

const PRIORITIES: Severity[] = ["high", "medium", "low"];
const DOT: Record<Severity, string> = {
  high: "var(--danger)",
  medium: "var(--warn)",
  low: "var(--calm)",
};
const REMEMBER = "safesight:filters";

interface Filters {
  room: string | null;
  priority: Severity | null;
}

// The findings, with filters by priority (and by room, when the checks cover
// more than one). Each card keeps its number from the full list, so "2 of 3"
// matches the finding's own page and the fix plan; the cards keep their width
// however many are shown. The filters are remembered for the session, so
// coming back from a finding keeps them.
const REMOVED = "safesight:removed";

// Findings the caregiver marked "not right", for this session, with undo.
function useRemoved() {
  const [removed, setRemoved] = useState<string[]>([]);
  useEffect(() => {
    try {
      setRemoved(JSON.parse(sessionStorage.getItem(REMOVED) ?? "[]"));
    } catch {}
  }, []);
  const save = (next: string[]) => {
    setRemoved(next);
    try {
      sessionStorage.setItem(REMOVED, JSON.stringify(next));
    } catch {}
  };
  return {
    removed,
    remove: (key: string) => save([...removed, key]),
    undo: () => save(removed.slice(0, -1)),
  };
}

function Gallery({
  items,
  unsure,
  isExample,
  removal,
}: {
  items: GalleryItem[];
  unsure: GalleryItem[];
  isExample: boolean;
  removal: ReturnType<typeof useRemoved>;
}) {
  const [filters, setFilters] = useState<Filters>({
    room: null,
    priority: null,
  });
  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(REMEMBER) ?? "null",
      ) as Filters | null;
      if (saved) setFilters(saved);
    } catch {}
  }, []);
  const choose = (next: Filters) => {
    setFilters(next);
    try {
      sessionStorage.setItem(REMEMBER, JSON.stringify(next));
    } catch {}
  };

  const rooms = [...new Set(items.map((i) => i.room))];
  // A remembered filter that doesn't apply to these results is ignored.
  const room =
    filters.room && rooms.includes(filters.room) ? filters.room : null;
  const priority =
    filters.priority &&
    items.some((i) => i.hazard.severity === filters.priority)
      ? filters.priority
      : null;
  const inRoom = items.filter((i) => !room || i.room === room);
  const shown = inRoom.filter(
    (i) => !priority || i.hazard.severity === priority,
  );

  return (
    <section
      aria-label="Flagged hazards"
      className="flex w-full flex-col gap-5 px-5 pb-12 sm:px-10"
    >
      {items.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-[var(--ss-line)] py-3">
          {rooms.length > 1 && (
            <Chips label="Room">
              <Chip on={!room} onClick={() => choose({ room: null, priority })}>
                All rooms
              </Chip>
              {rooms.map((r) => (
                <Chip
                  key={r}
                  on={room === r}
                  onClick={() => choose({ room: r, priority })}
                  count={items.filter((i) => i.room === r).length}
                >
                  <span className="capitalize">{roomName(r)}</span>
                </Chip>
              ))}
            </Chips>
          )}
          <Chips label="Priority">
            <Chip
              on={!priority}
              onClick={() => choose({ room, priority: null })}
            >
              All
            </Chip>
            {PRIORITIES.map((p) => {
              const n = inRoom.filter((i) => i.hazard.severity === p).length;
              return n === 0 && priority !== p ? null : (
                <Chip
                  key={p}
                  on={priority === p}
                  onClick={() => choose({ room, priority: p })}
                  count={n}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ background: DOT[p] }}
                  />
                  {SEVERITY_LABEL[p]}
                </Chip>
              );
            })}
          </Chips>
          <span
            className="ml-auto flex items-center gap-3 text-[14px] text-[var(--ss-ink-3)]"
            aria-live="polite"
          >
            {removal.removed.length > 0 && (
              <button
                type="button"
                onClick={removal.undo}
                className="text-[var(--ss-ink-2)] underline underline-offset-2 hover:text-[var(--ss-ink)]"
              >
                Undo remove
              </button>
            )}
            Showing {shown.length} of {items.length}
            {(room || priority) && (
              <button
                type="button"
                onClick={() => choose({ room: null, priority: null })}
                className="text-[var(--ss-ink-2)] underline underline-offset-2 hover:text-[var(--ss-ink)]"
              >
                Clear
              </button>
            )}
          </span>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="m-0 py-10 text-[17px] text-[var(--ss-ink-2)]">
          Nothing here with these filters.{" "}
          <button
            type="button"
            onClick={() => choose({ room: null, priority: null })}
            className="underline underline-offset-2 hover:text-[var(--ss-ink)]"
          >
            Show everything
          </button>
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {shown.map((item, i) => (
            <BlurFade key={item.key} delay={0.1 + Math.min(i, 3) * 0.1}>
              <HazardRow
                hazard={item.hazard}
                frame={item.frame}
                room={item.room}
                number={items.indexOf(item) + 1}
                href={detailHref(item.jobId, item.hazard.hazard_id, isExample)}
                onDismiss={() => removal.remove(item.key)}
              />
            </BlurFade>
          ))}
        </div>
      )}

      {unsure.filter(
        (i) =>
          (!room || i.room === room) &&
          (!priority || i.hazard.severity === priority),
      ).length > 0 && (
        <details className="group mt-4 border-t border-[var(--ss-line)] pt-6">
          <summary className="flex cursor-pointer list-none items-baseline gap-3 text-[17px] font-medium [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="text-[var(--ss-ink-3)] transition-transform group-open:rotate-90"
            >
              ›
            </span>
            Less sure: check these in person
            <span className="text-[14px] font-normal text-[var(--ss-ink-3)]">
              {unsure.length} more. The detector wasn&apos;t confident enough to
              list them above.
            </span>
          </summary>
          <div className="mt-6 flex flex-col gap-6">
            {unsure
              .filter(
                (i) =>
                  (!room || i.room === room) &&
                  (!priority || i.hazard.severity === priority),
              )
              .map((item) => (
                <HazardRow
                  key={item.key}
                  hazard={item.hazard}
                  frame={item.frame}
                  room={item.room}
                  number={items.length + unsure.indexOf(item) + 1}
                  href={detailHref(
                    item.jobId,
                    item.hazard.hazard_id,
                    isExample,
                  )}
                  onDismiss={() => removal.remove(item.key)}
                />
              ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Chips({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      // Phones: one row that scrolls sideways, edge to edge.
      className="flex flex-wrap items-center gap-2 max-sm:-mx-5 max-sm:w-[calc(100%+40px)] max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-5 max-sm:[scrollbar-width:none]"
    >
      <span className="mr-1 shrink-0 text-[13px] font-medium text-[var(--ss-ink-3)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  on,
  onClick,
  count,
  children,
}: {
  on: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[14px] whitespace-nowrap transition-colors ${
        on
          ? "border-[var(--ss-ink)] bg-[var(--ss-ink)] text-white"
          : "border-[var(--ss-line)] bg-white text-[var(--ss-ink-2)] hover:border-[var(--ss-ink)]/40 hover:text-[var(--ss-ink)]"
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={` ${on ? "text-white/70" : "text-[var(--ss-ink-3)]"}`}>
          {count}
        </span>
      )}
    </button>
  );
}
