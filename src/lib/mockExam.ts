import type { Question } from "../content/types";
import { KLASSE_B_RULES_2026, type ExamRules } from "./shared/exam";

/** Deterministic PRNG so an exam can be reproduced from its seed. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Builds an educational simulation: 20 Grundstoff + 10 Zusatzstoff, no duplicates. */
export function buildMockExam(bank: Question[], seed: number, rules: ExamRules = KLASSE_B_RULES_2026): Question[] {
  const rnd = mulberry32(seed);
  const g = shuffle(bank.filter((q) => q.categoryType === "Grundstoff"), rnd).slice(0, rules.grundstoffCount);
  const z = shuffle(bank.filter((q) => q.categoryType === "Zusatzstoff"), rnd).slice(0, rules.zusatzstoffCount);
  return [...g, ...z];
}
