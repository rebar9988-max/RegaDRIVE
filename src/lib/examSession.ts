/**
 * In-progress exam simulation. Kept in IndexedDB so a reload, a closed tab or a lost connection never
 * loses the learner's answers. Pure helpers only; the page owns reading and writing.
 */
export const EXAM_SESSION_KEY = "exam-session";

export interface ExamSession {
  version: 1;
  /** Reproduces the same 30 questions (see buildMockExam). */
  seed: number;
  rulesVersion: string;
  startedAt: number;
  durationMs: number;
  pos: number;
  /** questionId -> chosen option ids (or [typedValue] for number questions). */
  answers: Record<string, string[]>;
  /** Questions the learner marked to look at again before handing in. */
  flagged: string[];
}

export function newExamSession(seed: number, rulesVersion: string, durationMinutes: number, now: number): ExamSession {
  return { version: 1, seed, rulesVersion, startedAt: now, durationMs: durationMinutes * 60_000, pos: 0, answers: {}, flagged: [] };
}

export const remainingMs = (s: ExamSession, now: number) => Math.max(0, s.startedAt + s.durationMs - now);

/** mm:ss, always Latin digits (the timer is rendered left-to-right in every language). */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * Validates a stored session before it is resumed. Anything malformed, written for other exam rules or
 * referring to questions that are no longer in the exam is discarded (null) instead of being trusted.
 */
export function restoreExamSession(raw: unknown, rulesVersion: string, questionIds: (seed: number) => string[]): ExamSession | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<ExamSession>;
  if (s.version !== 1 || s.rulesVersion !== rulesVersion) return null;
  if (!Number.isInteger(s.seed) || !Number.isFinite(s.startedAt) || !Number.isFinite(s.durationMs) || s.durationMs! <= 0) return null;
  if (!s.answers || typeof s.answers !== "object" || !isStringArray(s.flagged)) return null;
  const ids = questionIds(s.seed!);
  if (ids.length === 0) return null;
  const known = new Set(ids);
  const answers: Record<string, string[]> = {};
  for (const [id, a] of Object.entries(s.answers)) if (known.has(id) && isStringArray(a)) answers[id] = [...a];
  const pos = Number.isInteger(s.pos) ? Math.min(Math.max(0, s.pos!), ids.length - 1) : 0;
  return { version: 1, seed: s.seed!, rulesVersion, startedAt: s.startedAt!, durationMs: s.durationMs!, pos, answers, flagged: s.flagged.filter((id) => known.has(id)) };
}

export const isAnswered = (answers: Record<string, string[]>, id: string) => (answers[id]?.length ?? 0) > 0;
