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

// Same cutoffs as the analysis service (model/service.py SURE_AT), for results saved before it sent `sure`.
const SURE_AT: Record<string, number> = {
  rug: 0.3, toilet: 0.3, toilet_roll_holder: 0.4, towel: 0.5, mirror: 0.5, stairs: 0.3, cable: 0.5,
  floor_clutter: 0.7, bin: 0.85, bed: 0.3, sofa: 0.4, chair: 0.3, table: 0.3, door: 0.4, window: 0.3, glass_door: 0.6,
};

/** Whether the detector was sure enough of this finding to list it with the rest. */
export function isSure(h: AnalyzeResult["hazards"][number]): boolean {
  if (h.sure !== undefined) return h.sure;
  return h.object ? h.confidence >= (SURE_AT[h.object] ?? 0) : true;
}

/** Findings the caregiver marked "not right" this session (see the results page). */
export function removedKeys(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem("safesight:removed") ?? "[]");
  } catch {
    return [];
  }
}

/** The findings as the results page lists them: sure ones first, then less sure, without removed ones. */
export function listedItems(scans: AnalyzeResult[], { sureOnly = false } = {}): GalleryItem[] {
  const removed = removedKeys();
  const items = galleryItems(scans).filter((i) => !removed.includes(i.key));
  const sure = items.filter((i) => isSure(i.hazard));
  return sureOnly ? sure : [...sure, ...items.filter((i) => !isSure(i.hazard))];
}

export function detailHref(jobId: string, hazardId: string, example = false) {
  return `/results/${encodeURIComponent(jobId)}/${encodeURIComponent(hazardId)}${example ? "?example" : ""}`;
}
