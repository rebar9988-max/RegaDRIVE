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
  const date = new Date(now);
  // A local calendar day may contain 23 or 25 hours when daylight saving changes.
  if (!state.days[dayKey(date.getTime())]) date.setDate(date.getDate() - 1);
  while (state.days[dayKey(date.getTime())]) { n++; date.setDate(date.getDate() - 1); }
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
