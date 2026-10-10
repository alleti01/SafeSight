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

  return { room, setRoom, files, pick, error, working, progress, submit };
}
