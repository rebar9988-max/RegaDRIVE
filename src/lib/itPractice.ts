import type { ItQuestion } from "../content/italy/types";
import { isItPracticeMode, type ItPracticeMode } from "./italyStudy";

/**
 * A practice run in progress. Answers are already scored into progress the moment they are given, so
 * what a reload would otherwise lose is the run itself: which statements it drew, in which order, and
 * how far the learner got. That is what is kept here.
 */
export const IT_PRACTICE_SESSION_KEY = "it-practice-session";

export interface ItPracticeSession {
  version: 1;
  mode: ItPracticeMode;
  /** The chapter the run was started for, or null for a run across chapters. */
  chapter: number | null;
  /** The statements of the run, in the order they were drawn. */
  questionIds: string[];
  /** The answers given in this run: questionId -> what the learner chose. */
  answers: Record<string, boolean>;
  pos: number;
  updatedAt: number;
}

/** A run is kept for a day; after that the learner is better served by a fresh set. */
export const IT_PRACTICE_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function newItPracticeSession(
  mode: ItPracticeMode,
  chapter: number | null,
  list: readonly ItQuestion[],
  now: number,
): ItPracticeSession {
  return { version: 1, mode, chapter, questionIds: list.map((q) => q.id), answers: {}, pos: 0, updatedAt: now };
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * The stored run, rebuilt from the statements that are published now — or null, in which case the run
 * is simply started fresh. It is dropped when it is for another mode or chapter than the one the
 * learner opened, when it is older than a day, when it is empty, or when any statement is gone: a run
 * that cannot be rebuilt exactly would silently renumber itself under the learner.
 */
export function restoreItPracticeSession(
  raw: unknown,
  want: { mode: ItPracticeMode; chapter: number | null },
  approved: readonly ItQuestion[],
  now: number,
  maxAgeMs: number = IT_PRACTICE_SESSION_MAX_AGE_MS,
): { session: ItPracticeSession; list: ItQuestion[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<ItPracticeSession>;
  if (s.version !== 1 || !isItPracticeMode(s.mode) || s.mode !== want.mode) return null;
  const chapter = s.chapter === null || (typeof s.chapter === "number" && Number.isInteger(s.chapter)) ? s.chapter ?? null : undefined;
  if (chapter === undefined || chapter !== want.chapter) return null;
  if (typeof s.updatedAt !== "number" || !Number.isFinite(s.updatedAt) || now - s.updatedAt > maxAgeMs) return null;
  if (!isStringArray(s.questionIds) || s.questionIds.length === 0) return null;
  if (!s.answers || typeof s.answers !== "object") return null;
  const byId = new Map(approved.map((q) => [q.id, q]));
  const list: ItQuestion[] = [];
  for (const id of s.questionIds) {
    const q = byId.get(id);
    if (!q) return null;
    list.push(q);
  }
  const known = new Set(list.map((q) => q.id));
  const answers: Record<string, boolean> = {};
  for (const [id, a] of Object.entries(s.answers)) if (known.has(id) && typeof a === "boolean") answers[id] = a;
  const at = s.pos;
  const pos = typeof at === "number" && Number.isInteger(at) ? Math.min(Math.max(0, at), list.length) : 0;
  return { session: { version: 1, mode: s.mode, chapter, questionIds: [...s.questionIds], answers, pos, updatedAt: s.updatedAt }, list };
}

/**
 * One cell of the practice overview. Practice reveals the answer key at once, so a cell says whether
 * the statement was got right or wrong — not merely that it was answered.
 */
export interface ItPracticeCell {
  index: number;
  id: string;
  state: "unanswered" | "correct" | "wrong";
}

export function itPracticeCells(
  list: readonly ItQuestion[],
  answers: Readonly<Record<string, boolean>>,
): ItPracticeCell[] {
  return list.map((q, index) => {
    const given = answers[q.id];
    return { index, id: q.id, state: given === undefined ? "unanswered" : given === q.answer ? "correct" : "wrong" };
  });
}

/** How many statements of the run are still to be got right: the honest "left to do" of a run. */
export const itPracticeLeft = (list: readonly ItQuestion[], answers: Readonly<Record<string, boolean>>): number =>
  itPracticeCells(list, answers).filter((c) => c.state !== "correct").length;
