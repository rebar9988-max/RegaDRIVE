/** Versioned Klasse B theory-exam scoring rules (first licence, "Ersterwerb"). */
export interface ExamRules {
  version: string;
  licenseClass: "B";
  grundstoffCount: number;
  zusatzstoffCount: number;
  officialTotalPoints: number;
  maxErrorPoints: number;
  /** Failing this many 5-point questions fails the exam even within maxErrorPoints. */
  failOnFivePointMistakes: number;
  sources: string[];
  verifiedOn: string;
}

export const KLASSE_B_RULES_2026: ExamRules = {
  version: "klasse-b-ersterwerb-2026-11",
  licenseClass: "B",
  grundstoffCount: 20,
  zusatzstoffCount: 10,
  officialTotalPoints: 110,
  maxErrorPoints: 10,
  failOnFivePointMistakes: 2,
  sources: [
    "https://www.tuev-nord.de/de/privatkunden/verkehr/fuehrerschein/theoretische-pruefung",
    "https://www.bussgeldkatalog.de/theoriepruefung/",
  ],
  verifiedOn: "2026-11-06",
};

export interface ScoredAnswer {
  questionId: string;
  points: number;
  correct: boolean;
}

export interface ExamResult {
  rulesVersion: string;
  totalPoints: number;
  errorPoints: number;
  fivePointMistakes: number;
  passed: boolean;
  failReason: "none" | "too_many_error_points" | "five_point_rule";
}

export function scoreExam(answers: ScoredAnswer[], rules: ExamRules = KLASSE_B_RULES_2026): ExamResult {
  const seen = new Set<string>();
  let totalPoints = 0;
  let errorPoints = 0;
  let fivePointMistakes = 0;
  for (const a of answers) {
    if (seen.has(a.questionId)) continue; // a question is scored once only
    seen.add(a.questionId);
    totalPoints += a.points;
    if (!a.correct) {
      errorPoints += a.points;
      if (a.points === 5) fivePointMistakes += 1;
    }
  }
  let failReason: ExamResult["failReason"] = "none";
  if (errorPoints > rules.maxErrorPoints) failReason = "too_many_error_points";
  else if (fivePointMistakes >= rules.failOnFivePointMistakes) failReason = "five_point_rule";
  return { rulesVersion: rules.version, totalPoints, errorPoints, fivePointMistakes, passed: failReason === "none", failReason };
}

/** Exact-set comparison: every correct option and no incorrect option must be chosen. */
export function isAnswerCorrect(selected: readonly string[], correct: readonly string[]): boolean {
  if (selected.length !== correct.length) return false;
  const s = new Set(selected);
  if (s.size !== selected.length) return false;
  return correct.every((c) => s.has(c));
}
