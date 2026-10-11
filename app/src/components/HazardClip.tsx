"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { Hazard } from "@/lib/contract";

type Entry = NonNullable<Hazard["track"]>[number];

// The box at time t, between the two nearest track entries. Hidden (null)
// when the object is out of view at either end.
function boxAt(track: Entry[], t: number): [number, number, number, number] | null {
  if (track.length === 0) return null;
  let i = track.findIndex((e) => e[0] > t);
  if (i === -1) i = track.length;
  const a = track[Math.max(0, i - 1)];
  const b = track[Math.min(track.length - 1, i)];
  if (!a[5] && !b[5]) return null;
  if (!a[5] || !b[5]) {
    const seen = a[5] ? a : b;
    return [seen[1], seen[2], seen[3], seen[4]];
  }
  const f = b[0] === a[0] ? 0 : Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])));
  return [1, 2, 3, 4].map((k) => a[k] + (b[k] - a[k]) * f) as [number, number, number, number];
}

/**
 * A few seconds of the caregiver's video around a finding (people blurred),
 * playing on a loop, with the finding framed by red corner brackets that
 * follow it and the rest of the picture dimmed. When the object is out of
 * view the frame fades away rather than pointing at nothing.
 */
export default function HazardClip({ src, poster, track, label }: { src: string; poster?: string; track: Entry[]; label: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [near, setNear] = useState(false);
  const userPaused = useRef(false);

  // A results page can have many clips, and browsers only keep a few video
  // players drawing at once: the player exists only while the clip is near
  // the screen, and plays only while it's on screen (unless the viewer paused
  // it or prefers less motion).
  useEffect(() => {
    const w = wrap.current;
    if (!w) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "300px 0px" });
    io.observe(w);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = video.current;
    const w = wrap.current;
    if (!near || !v || !w || reduceMotion) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !userPaused.current) void v.play().catch(() => {});
        else if (!e.isIntersecting) v.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(w);
    return () => io.disconnect();
  }, [near, reduceMotion]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = video.current;
      const w = wrap.current;
      const f = frame.current;
      if (v && w && f && v.videoWidth) {
        // Where the video sits in its box (object-cover, centered), in pixels.
        const W = w.clientWidth;
        const H = w.clientHeight;
        const s = Math.max(W / v.videoWidth, H / v.videoHeight);
        const vw = v.videoWidth * s;
        const vh = v.videoHeight * s;
        const ox = (W - vw) / 2;
        const oy = (H - vh) / 2;
        const b = boxAt(track, v.currentTime);
        // Kept inside the picture when the object runs off its edge.
        if (b) {
          b[0] = Math.max(b[0], -ox / vw + 0.01);
          b[1] = Math.max(b[1], -oy / vh + 0.01);
          b[2] = Math.min(b[2], (W - ox) / vw - 0.01);
          b[3] = Math.min(b[3], (H - oy) / vh - 0.01);
        }
        if (b && b[2] > b[0] && b[3] > b[1]) {
          f.style.opacity = "1";
          f.style.left = `${ox + b[0] * vw}px`;
          f.style.top = `${oy + b[1] * vh}px`;
          f.style.width = `${(b[2] - b[0]) * vw}px`;
          f.style.height = `${(b[3] - b[1]) * vh}px`;
          // The name tag sits above the frame, or just inside it when the
          // frame is at the top of the picture (it would be cut off there).
          const tag = f.lastElementChild as HTMLElement | null;
          if (tag) tag.style.transform = oy + b[1] * vh < 34 ? "translate(8px, 8px)" : "translateY(calc(-100% - 6px))";
        } else {
          f.style.opacity = "0";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [track]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      void v.play().catch(() => {});
    } else {
      userPaused.current = true;
      v.pause();
    }
  };

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden bg-[#2b251f]">
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {near && (
        <video
          ref={video}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="absolute inset-0 h-full w-full object-cover"
          aria-label={`A few seconds of your video around the ${label.toLowerCase()}`}
        />
      )}
      <span
        ref={frame}
        aria-hidden="true"
        className="pointer-events-none absolute opacity-0 transition-opacity duration-300"
        style={{ boxShadow: "0 0 0 9999px rgba(43,37,31,0.42)", borderRadius: 8 }}
      >
        {["top-0 left-0 border-t-2 border-l-2 rounded-tl-[8px]", "top-0 right-0 border-t-2 border-r-2 rounded-tr-[8px]",
          "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-[8px]", "right-0 bottom-0 border-r-2 border-b-2 rounded-br-[8px]"].map((c) => (
          <span key={c} className={`absolute border-[var(--danger)] ${c}`} style={{ width: "min(22px, 33%)", height: "min(22px, 33%)" }} />
        ))}
        <span className="absolute top-0 left-0 rounded-[6px] bg-white px-2 py-0.5 text-[12px] font-medium whitespace-nowrap text-[var(--ss-ink)]">
          {label}
        </span>
      </span>
      <button
        type="button"
        onClick={toggle}
        className="absolute right-3 bottom-3 rounded-full bg-white/90 px-3 py-1 text-[12px] font-medium text-[var(--ss-ink)] hover:bg-white"
      >
        {playing ? "Pause" : "Play"}
      </button>
    </div>
  );
}
