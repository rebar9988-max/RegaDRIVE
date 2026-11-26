import { PATENTE_B_RULES_IT, type ItExamRules } from "./shared/examIt";
import type { ItQuestion } from "../content/italy/types";

/**
 * One Italian mock exam: exactly as many questions as the real test, drawn from the approved bank.
 * Returns null when there are not enough approved questions — a shorter paper would not be the exam,
 * and inventing one would misrepresent the real test.
 */
export function pickItExam(pool: readonly ItQuestion[], rules: ItExamRules = PATENTE_B_RULES_IT, random: () => number = Math.random): ItQuestion[] | null {
  const rest = [...new Map(pool.map((question) => [question.id, question])).values()];
  if (rest.length < rules.questionCount) return null;
  const out: ItQuestion[] = [];
  while (out.length < rules.questionCount && rest.length > 0) {
    const i = Math.min(rest.length - 1, Math.floor(random() * rest.length));
    out.push(rest.splice(i, 1)[0]!);
  }
  return out;
}

/** Seconds left of the 20 minutes, never below zero. */
export const itTimeLeft = (startedAt: number, now: number, rules: ItExamRules = PATENTE_B_RULES_IT): number =>
  Math.max(0, rules.minutes * 60 - Math.floor((now - startedAt) / 1000));

export const formatClock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * The exam paper as the learner sees it in the overview: one cell per question, in the order the paper
 * was drawn. The real ministerial test is answered in any order, so the overview is what carries the
 * flow — never a hidden linear position.
 */
export interface ItExamCell {
  index: number;
  id: string;
  answered: boolean;
  flagged: boolean;
}

export function itExamCells(
  paper: readonly ItQuestion[],
  answers: Readonly<Record<string, boolean>>,
  flags: Readonly<Record<string, boolean>>,
): ItExamCell[] {
  return paper.map((q, index) => ({ index, id: q.id, answered: q.id in answers, flagged: flags[q.id] === true }));
}

/** How many statements still carry no answer. The learner may hand in anyway; the number is shown first. */
export const itExamUnanswered = (paper: readonly ItQuestion[], answers: Readonly<Record<string, boolean>>): number =>
  paper.reduce((n, q) => (q.id in answers ? n : n + 1), 0);

/**
 * The next statement worth going to after `from`: the first unanswered one, searched forward and then
 * from the start, so answering in any order still walks the whole paper. Null when nothing is left.
 */
export function itExamNextOpen(
  paper: readonly ItQuestion[],
  answers: Readonly<Record<string, boolean>>,
  from: number,
): number | null {
  for (let step = 1; step <= paper.length; step += 1) {
    const i = (from + step) % paper.length;
    const q = paper[i];
    if (q && !(q.id in answers)) return i;
  }
  return null;
}

/** One line of the result review: the statement, what the learner answered, and whether that was right. */
export interface ItExamReviewRow {
  question: ItQuestion;
  given: boolean | null;
  correct: boolean;
}

export function itExamReview(
  paper: readonly ItQuestion[],
  answers: Readonly<Record<string, boolean>>,
): ItExamReviewRow[] {
  return paper.map((question) => {
    const given = question.id in answers ? answers[question.id]! : null;
    return { question, given, correct: given === question.answer };
  });
}

/**
 * How urgent the clock looks: plain for most of the 20 minutes, then warning in the last quarter and
 * critical in the last minute. Derived from the seconds left, so it can never disagree with the clock.
 */
export type ItClockState = "calm" | "warning" | "critical";

export function itClockState(secondsLeft: number, rules: ItExamRules = PATENTE_B_RULES_IT): ItClockState {
  if (secondsLeft <= 60) return "critical";
  if (secondsLeft <= Math.round(rules.minutes * 60 * 0.25)) return "warning";
  return "calm";
}
