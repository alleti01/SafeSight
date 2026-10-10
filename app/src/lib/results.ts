"use client";

import { useEffect, useState } from "react";
import { EXAMPLE_RESULT, USING_FAKE } from "./brain";
import { SEVERITY_ORDER, type AnalyzeResult, type Frame, type Hazard } from "./contract";
import { loadScans } from "./scans";

export interface GalleryItem {
  hazard: Hazard;
  frame: Frame;
  room: string;
  jobId: string;
  key: string;
}

/** This session's scans; or the bundled example when the address ends in
 * ?example, or when using fake results and nothing is saved. */
export function useScans() {
  const [state, setState] = useState<{ scans: AnalyzeResult[]; isExample: boolean } | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("example")) {
      setState({ scans: [EXAMPLE_RESULT], isExample: true });
      return;
    }
    const saved = loadScans();
    setState(
      saved.length === 0 && USING_FAKE
        ? { scans: [EXAMPLE_RESULT], isExample: true }
        : { scans: saved, isExample: false },
    );
  }, []);

  return state;
}

/** Every hazard across scans, most serious first. */
export function galleryItems(scans: AnalyzeResult[]): GalleryItem[] {
  return scans
    .flatMap((scan) =>
      scan.hazards.flatMap((hazard) => {
        const frame = scan.frames.find((f) => f.frame_id === hazard.frame_id);
        return frame
          ? [{ hazard, frame, room: scan.room, jobId: scan.job_id, key: `${scan.job_id}-${hazard.hazard_id}` }]
          : [];
      }),
    )
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.hazard.severity] - SEVERITY_ORDER[b.hazard.severity] ||
        b.hazard.confidence - a.hazard.confidence,
    );
}

export function detailHref(jobId: string, hazardId: string, example = false) {
  return `/results/${encodeURIComponent(jobId)}/${encodeURIComponent(hazardId)}${example ? "?example" : ""}`;
}
