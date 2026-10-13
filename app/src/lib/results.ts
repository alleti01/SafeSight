"use client";

import { useEffect, useState } from "react";
import { SEVERITY_ORDER, type AnalyzeResult, type Frame, type Hazard } from "./contract";
import { loadScans } from "./scans";

export interface GalleryItem {
  hazard: Hazard;
  frame: Frame;
  room: string;
  jobId: string;
  key: string;
}

/** This session's own checks (read in the browser, after the first render). */
export function useScans() {
  const [state, setState] = useState<{ scans: AnalyzeResult[] } | null>(null);

  useEffect(() => {
    setState({ scans: loadScans() });
  }, []);

  return state;
}

/** Every hazard across scans, most serious first. */
// Floor checks whose two samples differ by almost nothing measured the same
// surface twice (a carpet taken for both floor and wall), so they're not shown.
// Objects are different: a white door on a white wall really can measure ~0,
// and that's exactly what should be flagged, so they're kept.
const SAME_SURFACE = 1.5;
const CONTRAST_TYPES = new Set(["floor_wall_blend", "floor_transition"]);
function measuredNothing(h: AnalyzeResult["hazards"][number]): boolean {
  const d = (h as { evidence?: { lrv_difference?: unknown } }).evidence?.lrv_difference;
  return CONTRAST_TYPES.has(h.type) && typeof d === "number" && d < SAME_SURFACE;
}

export function galleryItems(scans: AnalyzeResult[]): GalleryItem[] {
  return scans
    .flatMap((scan) =>
      scan.hazards.filter((h) => !measuredNothing(h)).flatMap((hazard) => {
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

export function detailHref(jobId: string, hazardId: string) {
  return `/results/${encodeURIComponent(jobId)}/${encodeURIComponent(hazardId)}`;
}

/** The step-by-step fix for one finding. */
export const fixHref = (jobId: string, hazardId: string) => `${detailHref(jobId, hazardId)}/fix`;
