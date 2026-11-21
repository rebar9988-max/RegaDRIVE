import { PATENTE_B_RULES_IT, type ItExamRules } from "./shared/examIt";
import type { ItQuestion } from "../content/italy/types";

/**
 * One Italian mock exam: exactly as many questions as the real test, drawn from the approved bank.
 * Returns null when there are not enough approved questions — a shorter paper would not be the exam,
 * and inventing one would misrepresent the real test.
 */
export function pickItExam(pool: readonly ItQuestion[], rules: ItExamRules = PATENTE_B_RULES_IT, random: () => number = Math.random): ItQuestion[] | null {
  if (pool.length < rules.questionCount) return null;
  const rest = [...pool];
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
