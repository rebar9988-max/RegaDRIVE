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
    // Law: 30 questions, 110 points, 10 permitted error points; failed when exceeded or two weight-5 questions are wrong.
    "https://www.gesetze-im-internet.de/fev_2010/anlage_7.html (FeV Anlage 7 Nr. 1.2.2, 1.3)",
    // 20 Grundstoff + 10 Zusatzstoff for Klasse B; "in der Regel rund 30 bis 45 Minuten".
    "https://www.tuev-nord.de/de/dienstleistungen/fuehrerschein-und-fahrzeug/theoriepruefung/",
    // "Es gibt keine zeitliche Begrenzung."
    "https://www.adac.de/verkehr/rund-um-den-fuehrerschein/erwerb/theoretische-fuehrerscheinpruefung/",
  ],
  verifiedOn: "2026-11-11",
};

/**
 * Optional time limit a learner may switch on for a simulation. It is NOT an official rule: FeV Anlage 7
 * states no duration and ADAC reports no time limit (checked 2026-11-11); TÜV NORD says candidates usually
 * need about 30 to 45 minutes. A simulation therefore runs without a limit unless the learner asks for one.
 */
export const EXAM_PRACTICE_LIMIT_MINUTES = 45;

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

/** Number questions: exact match after normalising German decimal commas and whitespace. */
export function isNumericAnswerCorrect(input: string, expected: number): boolean {
  const t = input.trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return false;
  return Math.abs(Number(t) - expected) < 1e-9;
}
