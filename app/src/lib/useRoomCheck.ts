"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { analyze, type Progress } from "./brain";
import { ROOMS } from "./contract";
import { saveScan } from "./scans";

// Picking a room and files, sending them to the brain, and moving on to the
// results: shared by every version of the home page.
export function useRoomCheck() {
  const router = useRouter();
  const [room, setRoom] = useState<string>("bathroom");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [videoSeconds, setVideoSeconds] = useState<number | null>(null);

  // Other pages can link here with a room already picked: ?room=hallway#check
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("room");
    if (asked && (ROOMS as readonly string[]).includes(asked)) setRoom(asked);
  }, []);

  function pick(list: FileList | null) {
    setError("");
    const chosen = Array.from(list ?? []);
    const vids = chosen.filter((f) => f.type.startsWith("video/"));
    if (vids.length > 1 || (vids.length === 1 && chosen.length > 1)) {
      setError("Choose either photos or one video, not both.");
      setFiles([]);
      return;
    }
    setFiles(chosen);
    setVideoSeconds(null);
    if (vids.length === 1) {
      // The video's length, for the time estimate while it's checked.
      const url = URL.createObjectURL(vids[0]);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        if (Number.isFinite(v.duration)) setVideoSeconds(v.duration);
        URL.revokeObjectURL(url);
      };
      v.onerror = () => URL.revokeObjectURL(url);
      v.src = url;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      setError("Add photos or a video of the room first.");
      return;
    }
    setWorking(true);
    setError("");
    window.scrollTo({ top: 0 });
    try {
      setProgress(null);
      saveScan(await analyze(room, files, setProgress));
      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again in a moment.");
      setWorking(false);
    }
  }

  const estimate = estimateSeconds(files, videoSeconds);
  return { room, setRoom, files, pick, error, working, progress, estimate, submit };
}

/**
 * About how long a check takes, measured on our analysis service (Oct 11): about
 * 2.2 s a photo; a video about 1.75 s for each second (one frame a second, at
 * most 40 frames), plus about 2.8 s for each short clip of a finding (one per
 * few seconds of video, up to 12).
 */
export function estimateSeconds(files: File[], videoSeconds: number | null): number | null {
  if (files.length === 0) return null;
  if (files.some((f) => f.type.startsWith("video/"))) {
    if (videoSeconds === null) return null;
    return Math.round(6 + Math.min(videoSeconds, 40) * 1.75 + Math.min(12, Math.ceil(videoSeconds / 3)) * 2.8);
  }
  return Math.round(2 + files.length * 2.2);
}
