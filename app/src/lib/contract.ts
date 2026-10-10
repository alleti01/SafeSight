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
  | "toilet_lookalike";

export const ROOMS = ["bathroom", "bedroom", "hallway"] as const;

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
}

export interface AnalyzeResult {
  job_id: string;
  room: string;
  frames: Frame[];
  hazards: Hazard[];
}

export const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
