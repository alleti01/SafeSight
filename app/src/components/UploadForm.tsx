"use client";

import { motion, useReducedMotion } from "motion/react";
import { ROOMS } from "@/lib/contract";

export default function UploadForm({
  room,
  onRoom,
  files,
  onFiles,
  error,
  onSubmit,
}: {
  room: string;
  onRoom: (room: string) => void;
  files: File[];
  onFiles: (list: FileList | null) => void;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const reduceMotion = useReducedMotion();
  const videos = files.filter((f) => f.type.startsWith("video/"));
  const photos = files.filter((f) => f.type.startsWith("image/"));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <fieldset className="m-0 flex flex-wrap gap-x-6 gap-y-2 border-0 p-0 text-lg">
        <legend className="mb-3 p-0 text-[13px] uppercase tracking-[0.08em] text-muted">Room</legend>
        {ROOMS.map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2 capitalize">
            <input
              type="radio"
              name="room"
              id={`room-${r}`}
              value={r}
              checked={room === r}
              onChange={() => onRoom(r)}
              className="size-[18px] accent-accent"
            />
            {r}
          </label>
        ))}
      </fieldset>

      <label
        htmlFor="files"
        className="flex cursor-pointer items-center justify-between gap-4 border-y border-line py-5 text-xl hover:border-foreground"
      >
        <span>
          {files.length === 0
            ? "Add a video or photos"
            : videos.length === 1
              ? `1 video: ${videos[0].name}`
              : `${photos.length} photo${photos.length === 1 ? "" : "s"} ready`}
        </span>
        <span className="text-sm text-muted">Choose files</span>
        <input
          id="files"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => onFiles(e.target.files)}
          className="sr-only"
        />
      </label>

      {error && (
        <p role="alert" className="m-0 border-l-2 border-danger pl-3 text-base text-danger">
          {error}
        </p>
      )}

      <motion.button
        type="submit"
        whileHover={reduceMotion ? undefined : { x: 4 }}
        className="min-h-14 self-start rounded-[4px] bg-accent px-8 py-4 text-lg font-bold text-background hover:bg-accent-dark"
      >
        Check this room →
      </motion.button>

      <p className="m-0 text-sm text-muted">People in photos are blurred before anything is saved. Uploads are deleted after an hour.</p>
    </form>
  );
}
