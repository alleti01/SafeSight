"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { liveScan, USING_FAKE, type LiveHazard } from "@/lib/brain";
import { ROOMS } from "@/lib/contract";
import { HAZARD_TEXT } from "@/lib/hazards";

const ICON = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const LIVE_CORNERS = [
  "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-[6px]",
  "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-[6px]",
  "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-[6px]",
  "right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-[6px]",
];

const CORNERS = [
  "top-4 left-4 border-t-2 border-l-2 rounded-tl-[10px]",
  "top-4 right-4 border-t-2 border-r-2 rounded-tr-[10px]",
  "bottom-4 left-4 border-b-2 border-l-2 rounded-bl-[10px]",
  "right-4 bottom-4 border-r-2 border-b-2 rounded-br-[10px]",
];

// Longest recording from the in-page camera; the walk-through needs about a
// minute (the analysis takes up to three).
const MAX_RECORD_S = 90;

// Keep the live marks readable: the clearest few (at most four), most
// confident first, and only one of each kind labeled.
const MAX_MARKS = 4;
function calm(found: LiveHazard[]) {
  return found
    .filter((h) => h.confidence >= 0.45)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_MARKS);
}

// What the browser can record, best first (Safari records MP4, others WebM;
// the analysis reads both).
function recordingType() {
  const types = [
    "video/mp4;codecs=avc1",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

// The "Check a room" card. Pick a room, then one of two ways in:
// - Scan live (after RASSAR): the camera opens in the card and films while a
//   few frames a second go to the brain; what may be a problem is framed on
//   the video as you move. "Finish scan" keeps the video. If the camera can't
//   be used, the phone's own camera app opens instead.
// - Upload media (after Google Lens): choose or drop a video or photos; they
//   show as thumbnails you can remove.
// Either way ends with "Check this room".
export default function RoomCapture({
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
  const record = useRef<HTMLInputElement>(null);
  const choose = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [mode, setMode] = useState<"live" | "upload">("live");

  // The in-page camera.
  const live = useRef<HTMLVideoElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState("");
  const [marks, setMarks] = useState<LiveHazard[]>([]);
  const [view, setView] = useState({ cw: 0, ch: 0, vw: 0, vh: 0 });
  const stage = useRef<HTMLDivElement>(null);

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setRecording(false);
    setSeconds(0);
  };

  const openCamera = async () => {
    setNote("");
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    )
      return record.current?.click();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setStream(s);
      startRecording(s);
    } catch {
      setNote(
        "We couldn't open the camera here, so your phone's camera app will open instead.",
      );
      record.current?.click();
    }
  };

  const startRecording = (from: MediaStream) => {
    const type = recordingType();
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(
      from,
      type ? { mimeType: type, videoBitsPerSecond: 2_500_000 } : undefined,
    );
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blobType = rec.mimeType || type || "video/webm";
      const file = new File(
        chunks,
        `${room}-walk-through.${blobType.includes("mp4") ? "mp4" : "webm"}`,
        { type: blobType.split(";")[0] },
      );
      const dt = new DataTransfer();
      dt.items.add(file);
      onFiles(dt.files);
      from.getTracks().forEach((t) => t.stop());
      setStream(null);
      setRecording(false);
      setSeconds(0);
    };
    recorder.current = rec;
    rec.start(1000);
    setSeconds(0);
    setRecording(true);
  };

  const stopRecording = () =>
    recorder.current?.state === "recording" && recorder.current.stop();

  // Close the camera without keeping anything recorded so far.
  const cancel = () => {
    if (recorder.current?.state === "recording") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    stopCamera();
  };

  // Show the camera in the viewfinder; let go of it when it closes or the form goes away.
  useEffect(() => {
    if (live.current && stream) {
      live.current.srcObject = stream;
      live.current.play().catch(() => {});
    }
  }, [stream]);
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  // Scan while the camera is on: a small frame to the brain about four times
  // a second (one at a time), and what comes back is marked on the video.
  // Weak guesses are left off so the marks don't flicker.
  useEffect(() => {
    if (!stream || USING_FAKE) return;
    let alive = true;
    const ctrl = new AbortController();
    const canvas = document.createElement("canvas");
    (async () => {
      while (alive) {
        const v = live.current;
        if (v && v.videoWidth) {
          const scale = Math.min(
            1,
            640 / Math.max(v.videoWidth, v.videoHeight),
          );
          canvas.width = Math.round(v.videoWidth * scale);
          canvas.height = Math.round(v.videoHeight * scale);
          canvas
            .getContext("2d")
            ?.drawImage(v, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob | null>((done) =>
            canvas.toBlob(done, "image/jpeg", 0.7),
          );
          if (blob) {
            try {
              const found = await liveScan(room, blob, ctrl.signal);
              if (alive) setMarks(calm(found));
            } catch {
              // A dropped frame is just a frame with nothing marked.
            }
          }
        }
        await new Promise((r) => window.setTimeout(r, 250));
      }
    })();
    return () => {
      alive = false;
      ctrl.abort();
      setMarks([]);
    };
  }, [stream, room]);

  // Where the video sits in the viewfinder (it covers it), to place the marks.
  useEffect(() => {
    const el = stage.current;
    const v = live.current;
    if (!el || !v) return;
    const measure = () =>
      setView({
        cw: el.clientWidth,
        ch: el.clientHeight,
        vw: v.videoWidth,
        vh: v.videoHeight,
      });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    v.addEventListener("loadedmetadata", measure);
    measure();
    return () => {
      ro.disconnect();
      v.removeEventListener("loadedmetadata", measure);
    };
  }, [stream]);
  // Where a mark goes over the video (which covers the viewfinder, so its
  // edges may be cropped off). Kept just inside the picture, so a thing at the
  // edge still shows its frame and name; marks that are mostly off it are left out.
  const place = ([l, t, r, b]: LiveHazard["box"]) => {
    const { cw, ch, vw, vh } = view;
    if (!cw || !vw) return null;
    const s = Math.max(cw / vw, ch / vh);
    const dx = (cw - vw * s) / 2;
    const dy = (ch - vh * s) / 2;
    const edge = 8;
    const x0 = Math.max(edge, dx + l * vw * s);
    const y0 = Math.max(edge, dy + t * vh * s);
    const x1 = Math.min(cw - edge, dx + r * vw * s);
    const y1 = Math.min(ch - edge, dy + b * vh * s);
    if (x1 - x0 < 40 || y1 - y0 < 40) return null;
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  };

  // The timer, stopping on its own at the limit.
  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);
  useEffect(() => {
    if (recording && seconds >= MAX_RECORD_S) stopRecording();
  }, [recording, seconds]);

  // A preview for each file, released when the files change.
  const previews = useMemo(
    () =>
      files.map((f) => ({
        file: f,
        url: URL.createObjectURL(f),
        video: f.type.startsWith("video/"),
      })),
    [files],
  );
  useEffect(
    () => () => previews.forEach((p) => URL.revokeObjectURL(p.url)),
    [previews],
  );

  const remove = (i: number) => {
    const dt = new DataTransfer();
    files.forEach((f, k) => k !== i && dt.items.add(f));
    onFiles(dt.files);
  };

  const videos = files.filter((f) => f.type.startsWith("video/")).length;
  const summary = videos
    ? "1 video ready"
    : `${files.length} photo${files.length === 1 ? "" : "s"} ready`;

  const pickMode = (m: "live" | "upload") => {
    if (stream) cancel();
    setMode(m);
  };
  const scanning = mode === "live" && !!stream;
  // What's marked on screen (things cropped off the picture aren't counted).
  const seen = marks.filter((m) => place(m.box)).length;

  // On phones the camera fills the screen while scanning; the page behind it
  // stays put.
  useEffect(() => {
    if (!scanning || !window.matchMedia("(max-width: 767px)").matches) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, [scanning]);

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-6 rounded-[24px] border border-[var(--ss-line)] bg-white p-6 shadow-[0_24px_60px_rgba(62,54,46,0.08)] sm:p-8"
    >
      {/* Wide screens: the title on the left, the room and the two ways in on the right; below that, the room and the two ways in share a row under the title. */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between xl:gap-10">
        <div>
          <p className="m-0 font-v5 text-[30px] leading-tight font-medium tracking-[-0.02em]">
            Check a room
          </p>
          <p className="m-0 mt-2 text-[16px] text-[var(--ss-ink-2)]">
            Spot what may be a problem and see simple ways to fix it.
          </p>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-4 xl:w-[min(720px,60%)]">
          <label className="flex items-center justify-between gap-4 md:shrink-0">
            <span className="text-[15px] text-[var(--ss-ink-2)]">
              Which room?
            </span>
            <span className="relative">
              <select
                value={room}
                onChange={(e) => onRoom(e.target.value)}
                className="appearance-none rounded-[12px] border border-[var(--ss-line)] bg-[var(--ss-sheet)] py-2.5 pr-10 pl-4 text-[15px] capitalize focus-visible:outline-2 focus-visible:outline-[var(--ss-ink)]"
              >
                {ROOMS.map((r) => (
                  <option key={r} value={r} className="capitalize">
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" {...ICON} />
              </svg>
            </span>
          </label>

          {/* Two ways in. */}
          <div
            role="tablist"
            aria-label="How to check the room"
            className="grid grid-cols-2 gap-1 rounded-[14px] bg-[var(--ss-soft)] p-1 md:flex-1"
          >
            {(
              [
                [
                  "live",
                  "Scan live",
                  "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10",
                ],
                [
                  "upload",
                  "Upload media",
                  "M4 5h16v14H4z M4 15l4-4 4 4 3-3 5 5 M15 9h.01",
                ],
              ] as const
            ).map(([m, label, d]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => pickMode(m)}
                className={`flex items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-[15px] whitespace-nowrap transition-colors ${
                  mode === m
                    ? "bg-white font-medium text-[var(--ss-ink)] shadow-[0_4px_14px_rgba(62,54,46,0.1)]"
                    : "text-[var(--ss-ink-2)] hover:text-[var(--ss-ink)]"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-[18px]"
                  aria-hidden="true"
                >
                  <path d={d} {...ICON} />
                </svg>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* The panel: the live camera, what you've added, or how each way works. */}
      <div
        className={`relative overflow-hidden rounded-[18px] border border-[var(--ss-line)] transition-shadow ${scanning ? "bg-[#2b2520] max-md:fixed max-md:inset-0 max-md:z-[70] max-md:rounded-none max-md:border-0" : "bg-[var(--ss-sheet)]"} ${over ? "ring-4 ring-[var(--ss-accent)]" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFiles(e.dataTransfer.files);
        }}
      >
        {scanning ? (
          <div
            ref={stage}
            className="relative aspect-[4/3] w-full sm:aspect-video lg:aspect-[21/9] max-md:h-full max-md:aspect-auto!"
          >
            <video
              ref={live}
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            {CORNERS.map((c) => (
              <span
                key={c}
                aria-hidden="true"
                className={`pointer-events-none absolute z-10 size-7 border-[#f3e6d3]/70 ${c}`}
              />
            ))}
            {/* What may be a problem, framed where it is on the video. */}
            {marks.map((h, i) => {
              const at = place(h.box);
              if (!at) return null;
              const nth = marks
                .slice(0, i)
                .filter((m) => m.type === h.type).length;
              return (
                <span
                  key={`${h.type}-${nth}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute z-10 transition-[left,top,width,height] duration-300 ease-out motion-reduce:transition-none"
                  style={at}
                >
                  {LIVE_CORNERS.map((c) => (
                    <span
                      key={c}
                      className={`absolute size-4 border-[#e8796c] ${c}`}
                    />
                  ))}
                  {nth === 0 && (
                    <span className="absolute top-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded-[6px] bg-[#e8796c] px-2 py-0.5 text-[12px] font-medium whitespace-nowrap text-white">
                      {HAZARD_TEXT[h.type].name}
                    </span>
                  )}
                </span>
              );
            })}
            {/* While nothing's found yet, a slow line sweeps the picture. */}
            {!USING_FAKE && seen === 0 && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px animate-[scan_2.6s_ease-in-out_infinite] bg-[#f3e6d3]/70 shadow-[0_0_14px_2px_rgba(243,230,211,0.45)] motion-reduce:hidden"
              />
            )}
            <span
              role="status"
              className="absolute top-8 left-10 z-20 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[13px] text-white backdrop-blur-md max-md:top-[calc(env(safe-area-inset-top)+28px)] max-md:left-8"
            >
              {USING_FAKE ? (
                "Live marking needs the SafeSight service"
              ) : seen ? (
                <>
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-[#e8796c]"
                  />
                  {seen} thing{seen === 1 ? "" : "s"} may be a
                  problem
                </>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className="size-2 animate-pulse rounded-full bg-[#f3e6d3]"
                  />
                  Scanning…
                </>
              )}
            </span>
            <button
              type="button"
              onClick={cancel}
              aria-label="Close the camera"
              className="absolute top-8 right-10 z-20 grid size-9 place-items-center rounded-full bg-black/50 text-[18px] text-white hover:bg-black/70 max-md:top-[calc(env(safe-area-inset-top)+24px)] max-md:right-8 max-md:size-11"
            >
              ×
            </button>
            {recording && (
              <span className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-[13px] text-white max-md:bottom-[calc(env(safe-area-inset-bottom)+104px)]">
                <span
                  aria-hidden="true"
                  className="size-2 animate-pulse rounded-full bg-[#e8796c]"
                />
                Recording {Math.floor(seconds / 60)}:
                {String(seconds % 60).padStart(2, "0")}
              </span>
            )}
            {/* Phones: the camera fills the screen, so finishing is here, in reach of a thumb. */}
            <button
              type="button"
              onClick={stopRecording}
              className="absolute inset-x-6 bottom-[calc(env(safe-area-inset-bottom)+28px)] z-20 flex items-center justify-center gap-2 rounded-[14px] bg-white py-4 text-[16px] font-medium text-[var(--ss-ink)] shadow-[0_8px_24px_rgba(0,0,0,0.3)] md:hidden"
            >
              Finish scan <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : files.length > 0 ? (
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-white px-3 py-1 text-[13px] font-medium shadow-[0_2px_8px_rgba(62,54,46,0.06)]">
                {summary}
              </span>
              <button
                type="button"
                onClick={() =>
                  mode === "live" ? openCamera() : choose.current?.click()
                }
                className="text-[13px] text-[var(--ss-ink-2)] underline underline-offset-2 hover:text-[var(--ss-ink)]"
              >
                {mode === "live" ? "Scan again" : "Change"}
              </button>
            </div>
            <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-6">
              {previews.map((p, i) => (
                <li
                  key={p.url}
                  className="relative aspect-[4/3] overflow-hidden rounded-[12px] bg-[var(--ss-line)]"
                >
                  {p.video ? (
                    <video
                      src={p.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label={`Remove ${p.file.name}`}
                    className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-[14px] text-white hover:bg-black/80"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-6 sm:p-7 lg:flex lg:flex-col lg:items-center lg:py-14 lg:text-center">
            <span
              aria-hidden="true"
              className="grid size-12 place-items-center rounded-[14px] border border-[var(--ss-line)] bg-white text-[var(--ss-ink)]"
            >
              <svg viewBox="0 0 24 24" className="size-5">
                {mode === "live" ? (
                  <path
                    d="M4 8h3l2-3h6l2 3h3v11H4z M12 10.5a3 3 0 1 1 0 6a3 3 0 0 1 0-6z"
                    {...ICON}
                  />
                ) : (
                  <path
                    d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
                    {...ICON}
                  />
                )}
              </svg>
            </span>
            <p className="m-0 mt-5 font-v5 text-[22px] leading-tight font-medium tracking-[-0.01em]">
              {mode === "live"
                ? "Look around with SafeSight"
                : "Add a video or photos"}
            </p>
            <p className="m-0 mt-2 max-w-[460px] text-[15px] leading-relaxed text-[var(--ss-ink-2)]">
              {mode === "live"
                ? `Use your camera to look around your ${room}. You'll see what may be a problem marked as you scan.`
                : `A video of the whole ${room}, or a few photos of it, from your phone.`}
            </p>
            {mode === "upload" && (
              <div className="mt-4 flex flex-wrap items-center gap-3 lg:justify-center">
                <button
                  type="button"
                  onClick={() => choose.current?.click()}
                  className="rounded-full border border-[var(--ss-ink)]/25 bg-white px-5 py-2.5 text-[14px] font-medium hover:bg-[var(--ss-soft)]"
                >
                  Choose files
                </button>
                <span className="text-[13px] text-[var(--ss-ink-3)] max-sm:hidden">
                  or drop them here
                </span>
              </div>
            )}
            <p className="m-0 mt-5 flex items-center gap-2.5 border-t border-[var(--ss-line)] pt-4 text-[14px] text-[var(--ss-ink-2)] lg:mt-7 lg:justify-center lg:px-10">
              <svg
                viewBox="0 0 24 24"
                className="size-[18px] shrink-0 text-[var(--ss-ink-3)]"
                aria-hidden="true"
              >
                <path
                  d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8z"
                  {...ICON}
                />
              </svg>
              Turn slowly all the way around, keep the lights on, and include
              the floor and walkways.
            </p>
          </div>
        )}

        <input
          ref={record}
          type="file"
          accept="video/*"
          capture="environment"
          onChange={(e) => onFiles(e.target.files)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <input
          ref={choose}
          id="room-files"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => onFiles(e.target.files)}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {note && <p className="m-0 text-[13px] text-[var(--ss-ink-3)]">{note}</p>}

      {error && (
        <p
          role="alert"
          className="m-0 rounded-[14px] bg-[#fdecea] px-4 py-3 text-[14px] text-[#9b2c24]"
        >
          {error}{" "}
          <Link href="/results?example" className="underline underline-offset-2">
            See example results
          </Link>
        </p>
      )}

      <div className="flex flex-col items-center gap-3 lg:flex-row-reverse lg:justify-between lg:gap-6">
        {mode === "live" && files.length === 0 ? (
          <button
            type="button"
            onClick={scanning ? stopRecording : openCamera}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--ss-ink)] py-4 text-[16px] font-medium text-white hover:bg-[var(--ss-ink-hover)] lg:w-[360px]"
          >
            {scanning ? "Finish scan" : "Start live scan"}{" "}
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--ss-ink)] py-4 text-[16px] font-medium text-white hover:bg-[var(--ss-ink-hover)] lg:w-[360px]"
          >
            Check this room <span aria-hidden="true">→</span>
          </button>
        )}
        <p className="m-0 text-[13px] text-[var(--ss-ink-3)]">
          {mode === "live" && files.length === 0
            ? "You can finish or close your scan at any time."
            : "About a minute to check. Anyone in it is blurred first."}
        </p>
      </div>
    </form>
  );
}
