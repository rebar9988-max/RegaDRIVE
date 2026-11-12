import type { Question } from "../content/types";

export interface QuestionProgress {
  attempts: number;
  correctCount: number;
  streak: number;
  lastCorrect: boolean | null;
  lastAnsweredAt: number | null;
}

export interface ProgressState {
  version: 1;
  questions: Record<string, QuestionProgress>;
  /** sessionId:questionId keys already scored — prevents duplicate scoring. */
  scored: Record<string, true>;
  bookmarks: string[];
  completedLessons: string[];
  /** YYYY-MM-DD -> answers that day */
  days: Record<string, number>;
  examHistory: { at: number; passed: boolean; errorPoints: number; totalPoints: number; rulesVersion: string }[];
}

export const MASTERY_THRESHOLD_DEFAULT = 3;

export const emptyProgress = (): ProgressState => ({
  version: 1, questions: {}, scored: {}, bookmarks: [], completedLessons: [], days: {}, examHistory: [],
});

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const ids = (v: unknown, max: number) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 120))].slice(0, max) : []);

/**
 * Rebuilds a progress document from untrusted input (device storage after an update, an account backup from
 * another device). Everything well-formed is kept; anything malformed is dropped instead of crashing the app or
 * being merged into good data. Returns null only when the input is not a version-1 progress document at all.
 */
export function normalizeProgress(raw: unknown): ProgressState | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  const out = emptyProgress();
  if (isObj(raw.questions)) {
    for (const [id, v] of Object.entries(raw.questions).slice(0, 20_000)) {
      if (!isObj(v) || id.length === 0 || id.length > 120) continue;
      const attempts = count(v.attempts);
      out.questions[id] = {
        attempts, correctCount: Math.min(attempts, count(v.correctCount)), streak: Math.min(attempts, count(v.streak)),
        lastCorrect: typeof v.lastCorrect === "boolean" ? v.lastCorrect : null,
        lastAnsweredAt: typeof v.lastAnsweredAt === "number" && Number.isFinite(v.lastAnsweredAt) ? v.lastAnsweredAt : null,
      };
    }
  }
  if (isObj(raw.scored)) for (const k of Object.keys(raw.scored).slice(0, 50_000)) if (raw.scored[k] === true && k.length <= 260) out.scored[k] = true;
  out.bookmarks = ids(raw.bookmarks, 20_000);
  out.completedLessons = ids(raw.completedLessons, 5_000);
  if (isObj(raw.days)) for (const [d, n] of Object.entries(raw.days).slice(0, 5_000)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && count(n) > 0) out.days[d] = count(n);
  if (Array.isArray(raw.examHistory)) {
    out.examHistory = raw.examHistory.filter(isObj)
      .filter((e) => typeof e.at === "number" && Number.isFinite(e.at) && typeof e.passed === "boolean")
      .map((e) => ({ at: e.at as number, passed: e.passed as boolean, errorPoints: count(e.errorPoints), totalPoints: count(e.totalPoints), rulesVersion: typeof e.rulesVersion === "string" ? e.rulesVersion.slice(0, 80) : "" }))
      .slice(-50);
  }
  return out;
}

export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Pure: returns a new state. A question is scored at most once per session. */
export function recordAnswer(state: ProgressState, sessionId: string, questionId: string, correct: boolean, now: number): ProgressState {
  const key = `${sessionId}:${questionId}`;
  if (state.scored[key]) return state;
  const prev = state.questions[questionId] ?? { attempts: 0, correctCount: 0, streak: 0, lastCorrect: null, lastAnsweredAt: null };
  const next: QuestionProgress = {
    attempts: prev.attempts + 1,
    correctCount: prev.correctCount + (correct ? 1 : 0),
    streak: correct ? prev.streak + 1 : 0,
    lastCorrect: correct,
    lastAnsweredAt: now,
  };
  const dk = dayKey(now);
  return {
    ...state,
    questions: { ...state.questions, [questionId]: next },
    scored: { ...state.scored, [key]: true },
    days: { ...state.days, [dk]: (state.days[dk] ?? 0) + 1 },
  };
}

export type QStatus = "unanswered" | "incorrect" | "learning" | "mastered";
export function questionStatus(p: QuestionProgress | undefined, threshold = MASTERY_THRESHOLD_DEFAULT): QStatus {
  if (!p || p.attempts === 0) return "unanswered";
  if (p.streak >= threshold) return "mastered";
  if (p.lastCorrect === false) return "incorrect";
  return "learning";
}

export function toggleBookmark(state: ProgressState, id: string): ProgressState {
  const has = state.bookmarks.includes(id);
  return { ...state, bookmarks: has ? state.bookmarks.filter((b) => b !== id) : [...state.bookmarks, id] };
}

/** Consecutive days (ending today or yesterday) with at least one answer. */
export function streakDays(state: ProgressState, now: number): number {
  let n = 0;
  let t = now;
  if (!state.days[dayKey(t)]) t -= 86_400_000;
  while (state.days[dayKey(t)]) { n++; t -= 86_400_000; }
  return n;
}

export function topicStats(state: ProgressState, questions: Question[], threshold = MASTERY_THRESHOLD_DEFAULT) {
  const by = new Map<string, { total: number; mastered: number; answered: number; wrong: number }>();
  for (const q of questions) {
    const s = by.get(q.topicId) ?? { total: 0, mastered: 0, answered: 0, wrong: 0 };
    const p = state.questions[q.id];
    const st = questionStatus(p, threshold);
    s.total++;
    if (st === "mastered") s.mastered++;
    if (st !== "unanswered") s.answered++;
    if (p) s.wrong += p.attempts - p.correctCount;
    by.set(q.topicId, s);
  }
  return by;
}

/** Topics with the worst accuracy among those answered. */
export function weakTopics(state: ProgressState, questions: Question[], limit = 3): string[] {
  const acc = new Map<string, { a: number; c: number }>();
  for (const q of questions) {
    const p = state.questions[q.id];
    if (!p) continue;
    const s = acc.get(q.topicId) ?? { a: 0, c: 0 };
    s.a += p.attempts;
    s.c += p.correctCount;
    acc.set(q.topicId, s);
  }
  return [...acc.entries()]
    .filter(([, s]) => s.c / s.a < 0.8)
    .sort((x, y) => x[1].c / x[1].a - y[1].c / y[1].a)
    .slice(0, limit)
    .map(([id]) => id);
}

export type ReadinessLevel = "not_started" | "learning" | "almost" | "ready";
export interface Readiness { level: ReadinessLevel; answeredPct: number; masteredPct: number; recentExams: number; recentPassed: number }

/**
 * Exam readiness from real results only: how much of the bank is mastered and how the latest simulations
 * went. "ready" needs 90 % mastered and the last three simulations passed; it is a learning aid, not a promise.
 */
export function readiness(state: ProgressState, questions: Question[], threshold = MASTERY_THRESHOLD_DEFAULT): Readiness {
  const total = questions.length;
  const answered = questions.filter((q) => questionStatus(state.questions[q.id], threshold) !== "unanswered").length;
  const mastered = questions.filter((q) => questionStatus(state.questions[q.id], threshold) === "mastered").length;
  const recent = (state.examHistory ?? []).slice(-3);
  const recentPassed = recent.filter((e) => e.passed).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const masteredPct = pct(mastered);
  let level: ReadinessLevel = "learning";
  if (answered === 0 && recent.length === 0) level = "not_started";
  else if (masteredPct >= 90 && recent.length === 3 && recentPassed === 3) level = "ready";
  else if (masteredPct >= 70 && recent.length > 0 && recent[recent.length - 1]!.passed) level = "almost";
  return { level, answeredPct: pct(answered), masteredPct, recentExams: recent.length, recentPassed };
}

/**
 * Pure, loss-free merge of two progress copies (device + account backup). Nothing is ever dropped:
 * per question the more recent answer wins, lists and scored keys are united, day counts keep the maximum
 * and exam results are united by time. Used when backing up to or restoring from a student account.
 */
export function mergeProgress(a: ProgressState, b: ProgressState): ProgressState {
  const questions: Record<string, QuestionProgress> = { ...a.questions };
  for (const [id, q] of Object.entries(b.questions ?? {})) {
    const mine = questions[id];
    if (!mine || (q.lastAnsweredAt ?? 0) > (mine.lastAnsweredAt ?? 0) || ((q.lastAnsweredAt ?? 0) === (mine.lastAnsweredAt ?? 0) && q.attempts > mine.attempts)) questions[id] = q;
  }
  const days: Record<string, number> = { ...a.days };
  for (const [d, n] of Object.entries(b.days ?? {})) days[d] = Math.max(days[d] ?? 0, n);
  const exams = new Map<number, ProgressState["examHistory"][number]>();
  for (const e of [...(a.examHistory ?? []), ...(b.examHistory ?? [])]) exams.set(e.at, e);
  return {
    version: 1,
    questions,
    scored: { ...a.scored, ...b.scored },
    bookmarks: [...new Set([...(a.bookmarks ?? []), ...(b.bookmarks ?? [])])],
    completedLessons: [...new Set([...(a.completedLessons ?? []), ...(b.completedLessons ?? [])])],
    days,
    examHistory: [...exams.values()].sort((x, y) => x.at - y.at),
  };
}
