import type { AnalyzeResult } from "./contract";

// Results from this browser session, one per room. A new scan of a room
// replaces the old one.
const KEY = "safesight:scans";

export function loadScans(): AnalyzeResult[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveScan(result: AnalyzeResult) {
  try {
    const others = loadScans().filter((s) => s.room !== result.room);
    sessionStorage.setItem(KEY, JSON.stringify([...others, result]));
  } catch {
    // Storage blocked; the results page shows its empty state.
  }
}
