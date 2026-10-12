import type { AnalyzeResult, HazardType, Severity } from "./contract";
import fakeResults from "./fake-results.json";

// The one setting that points the app at the brain. Leave it unset to use the
// fake results in fake-results.json (a copy of shared/contract.json).
export const BRAIN_URL = (process.env.NEXT_PUBLIC_BRAIN_URL ?? "").replace(/\/$/, "");
export const USING_FAKE = BRAIN_URL === "";

export const EXAMPLE_RESULT = fakeResults as AnalyzeResult;

// The bundled example's photos and outlines ship with the app, so the example
// works even when the backend is down.
const BUNDLED = /^\/(frames|outlines)\//;

export function assetUrl(path: string): string {
  if (/^https?:\/\//.test(path) || USING_FAKE || BUNDLED.test(path)) return path;
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
  if (USING_FAKE) return fakeAnalyze(room, files, onProgress);

  const form = new FormData();
  form.append("room", room);
  for (const file of files) {
    form.append(file.type.startsWith("video/") ? "video" : "photos", file);
  }

  let job = await upload(form, onProgress);
  let missed = 0; // check-ins in a row that didn't get through
  while (job.status === "queued" || job.status === "working") {
    onProgress({ step: job.step, done: job.done, total: job.total, preview: job.preview, found: job.found, queued: job.status === "queued" });
    await sleep(POLL_MS);
    let res: Response;
    try {
      res = await fetch(`${BRAIN_URL}/analyze/${job.job_id}`);
    } catch {
      // A dropped connection or the service restarting: keep trying for about a minute.
      if (++missed * POLL_MS > 60_000) throw new Error("We lost touch with the checker. Check your connection and try again.");
      continue;
    }
    // The service restarted mid-check and doesn't know this job any more.
    if (res.status === 404) throw new Error("The checker restarted while it was working on your room. Please check it again.");
    if (!res.ok) {
      if (res.status >= 500 && ++missed * POLL_MS <= 60_000) continue;
      throw new Error(await errorText(res));
    }
    missed = 0;
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

async function fakeAnalyze(room: string, files: File[], onProgress: (p: Progress) => void) {
  const n = Math.max(files.length, 3);
  for (const step of STEPS) {
    for (let i = 0; i < n; i++) {
      onProgress({ step, done: i, total: n });
      await sleep(120);
    }
  }
  return { ...EXAMPLE_RESULT, job_id: Math.random().toString(36).slice(2, 10), room };
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
 * mark on the video while filming. Nothing comes back without a brain (the
 * example mode), and a failed frame just counts as nothing found.
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
