// Types for shared/contract.json. Keep in step with shared/README.md.

export type HazardType =
  | "dark_rug"
  | "loose_rug"
  | "shiny_floor"
  | "patterned_floor"
  | "bathroom_fitting_blends_in"
  | "furniture_blends_in"
  | "mirror"
  | "stair_edge_hard_to_see"
  | "floor_clutter"
  | "toilet_lookalike"
  | "glass_door"
  | "door_blends_in"
  | "window_reflection"
  | "floor_transition"
  | "floor_wall_blend"
  | "patterned_wall";

export const ROOMS = ["bathroom", "bedroom", "hallway", "living_room", "kitchen", "stairs"] as const;

export type Severity = "high" | "medium" | "low";

export interface Frame {
  frame_id: string;
  image_url: string;
  width: number;
  height: number;
  time_s?: number;
}

export interface Hazard {
  hazard_id: string;
  type: HazardType;
  severity: Severity;
  confidence: number;
  frame_id: string;
  box: [number, number, number, number];
  outline_url: string;
  /** What the object is, e.g. "toilet", "rug" (the brain's object type). */
  object?: string;
  /** What was measured, e.g. { lrv_difference: 4.4 } or { darker_than_floor_by: 49.4 }. */
  evidence?: Record<string, number | boolean>;
  /** For videos: seconds into the video where this was seen. */
  time_s?: number;
}

export interface AnalyzeResult {
  job_id: string;
  room: string;
  frames: Frame[];
  hazards: Hazard[];
}

export const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
