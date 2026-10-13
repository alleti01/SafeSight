import type { AnalyzeResult, HazardType, Severity } from "./contract";

// The one setting that points the app at the brain (the analysis service).
// Without it the site can't check rooms, and says so.
export const BRAIN_URL = (process.env.NEXT_PUBLIC_BRAIN_URL ?? "").replace(/\/$/, "");
export const USING_FAKE = BRAIN_URL === "";

export function assetUrl(path: string): string {
  if (/^https?:\/\//.test(path) || USING_FAKE) return path;
  return BRAIN_URL + path;
}

export const STEPS = ["upload", "frames", "people", "objects", "contrast"] as const;
export type Step = (typeof STEPS)[number];

export interface Progress {
  step: Step;
  done: number;
  total: number;
  /** The frame being checked right now (people already blurred). */
  preview?: string;
  /** How many things were found so far. */
  found?: number;
  /** Waiting for another check to finish (the service checks one at a time). */
  queued?: boolean;
}

const POLL_MS = 700;

interface JobStatus {
  job_id: string;
  status: "queued" | "working" | "done" | "failed";
  step: Step;
  done: number;
  total: number;
  result?: AnalyzeResult;
  detail?: string;
  preview?: string;
  found?: number;
}

export async function analyze(
  room: string,
  files: File[],
  onProgress: (p: Progress) => void = () => {},
): Promise<AnalyzeResult> {
  if (USING_FAKE) throw new Error("This site isn't connected to the analysis service right now, so it can't check rooms. Try again later.");

  const form = new FormData();
  form.append("room", room);
  for (const file of files) {
    form.append(file.type.startsWith("video/") ? "video" : "photos", file);
  }

  let job = await upload(form, onProgress);
  while (job.status === "queued" || job.status === "working") {
    onProgress({ step: job.step, done: job.done, total: job.total, preview: job.preview, found: job.found, queued: job.status === "queued" });
    await sleep(POLL_MS);
    const res = await fetch(`${BRAIN_URL}/analyze/${job.job_id}`);
    if (!res.ok) throw new Error(await errorText(res));
    job = await res.json();
  }
  if (job.status === "failed") throw new Error(job.detail ?? "The check didn't finish. Try again in a moment.");
  return job.result!;
}

// XMLHttpRequest rather than fetch, so the upload itself can report progress.
function upload(form: FormData, onProgress: (p: Progress) => void): Promise<JobStatus> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BRAIN_URL}/analyze`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress({ step: "upload", done: e.loaded, total: e.total });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
      else reject(new Error(xhr.response?.detail ?? `The analysis service answered ${xhr.status}. Try again in a moment.`));
    };
    xhr.onerror = () => reject(new Error("We couldn't reach the analysis service. Check your connection and try again."));
    xhr.send(form);
  });
}

/** Something the live camera found in one frame. `box` is fractions of the frame: left, top, right, bottom. */
export interface LiveHazard {
  type: HazardType;
  severity: Severity;
  confidence: number;
  box: [number, number, number, number];
}

/**
 * One frame from the live camera: what may be a problem in it right now, to
 * mark on the video while filming. Nothing comes back without a brain,
 * and a failed frame just counts as nothing found.
 */
export async function liveScan(room: string, frame: Blob, signal?: AbortSignal): Promise<LiveHazard[]> {
  if (USING_FAKE) return [];
  const form = new FormData();
  form.append("room", room);
  form.append("frame", frame, "frame.jpg");
  const res = await fetch(`${BRAIN_URL}/live`, { method: "POST", body: form, signal });
  if (!res.ok) return [];
  const body = await res.json();
  return Array.isArray(body.hazards) ? body.hazards : [];
}

async function errorText(res: Response) {
  const body = await res.json().catch(() => null);
  return body?.detail ?? `The analysis service answered ${res.status}. Try again in a moment.`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
