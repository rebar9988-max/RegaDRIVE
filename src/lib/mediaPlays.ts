/**
 * Video play limit, as in the real theory exam: a clip may be watched at most five times per question.
 * Pure helpers; the viewer stores the counts per exam session so a reload cannot reset them.
 */
export const MAX_VIDEO_PLAYS = 5;

export type PlayCounts = Record<string, number>;

export const playsLeft = (counts: PlayCounts, key: string, max = MAX_VIDEO_PLAYS) => Math.max(0, max - (counts[key] ?? 0));

/** Records one started play. Returns the same object when the limit is already reached (nothing changes). */
export function recordPlay(counts: PlayCounts, key: string, max = MAX_VIDEO_PLAYS): PlayCounts {
  if (playsLeft(counts, key, max) === 0) return counts;
  return { ...counts, [key]: (counts[key] ?? 0) + 1 };
}

/** Accepts only a plain object of non-negative integers; anything else counts as "no plays yet" for that key. */
export function readPlayCounts(raw: unknown): PlayCounts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: PlayCounts = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "number" && Number.isInteger(v) && v >= 0 && k.length <= 200) out[k] = Math.min(v, MAX_VIDEO_PLAYS);
  return out;
}

/** Zoom steps for images. */
export const ZOOM_STEPS = [1, 1.5, 2, 3] as const;
export const nextZoom = (z: number, dir: 1 | -1) => {
  const i = ZOOM_STEPS.findIndex((s) => s >= z);
  const at = i < 0 ? ZOOM_STEPS.length - 1 : i;
  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, at + dir))]!;
};
