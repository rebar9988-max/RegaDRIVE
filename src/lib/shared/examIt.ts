/**
 * Italian theory exam (Patente B) — the real rules of the ministerial test.
 *
 * 30 true/false statements, 20 minutes, passed with at most 3 wrong answers. Unlike the German exam
 * there are no error points and no question weights: every statement counts the same.
 */
export interface ItExamRules {
  version: string;
  licenseClass: "B";
  questionCount: number;
  minutes: number;
  maxErrors: number;
  sources: string[];
  verifiedOn: string;
}

export const PATENTE_B_RULES_IT: ItExamRules = {
  version: "patente-b-it-2026-11",
  licenseClass: "B",
  questionCount: 30,
  minutes: 20,
  maxErrors: 3,
  sources: [
    // Law: DM Ministero delle infrastrutture e della mobilità sostenibili 27 ottobre 2021 (GU 9 December
    // 2021), which changed the test for A1, A2, A, B1, B and BE; applicable from 20 December 2021 by
    // dirigenziale decree prot. RD n. 439 of 13 December 2021.
    "https://mit.gov.it/nfsmitgov/files/media/normativa/2021-12/DECRETO_protocollo_0000439_del%20_13-12-2021.pdf (decreto dirigenziale 439/2021: data di applicabilità del DM 27 ottobre 2021)",
    "https://mit.gov.it/nfsmitgov/files/media/normativa/2022-01/circolare_protocollo_01215_del_17_01_2022.pdf (circolare MIT 1215/2022 sul DM 27 ottobre 2021)",
    // Secondary descriptions of the same rules, used as a cross-check: 30 questions, 20 minutes, max 3 errors.
    "https://www.mondopatente.it/patente-b/esame-teoria (30 domande V/F, 20 minuti, max 3 errori)",
  ],
  // Cross-checked against the sources above on this date. The educational reviewer confirms it before any
  // Italian question is published.
  verifiedOn: "2026-11-21",
};

export interface ItScoredAnswer { questionId: string; correct: boolean }
export interface ItExamResult { rulesVersion: string; answered: number; errors: number; passed: boolean; failReason: "none" | "too_many_errors" | "invalid_question_count" }

/** Score an Italian mock exam. Each question counts once; more than maxErrors wrong answers fails. */
export function scoreItExam(answers: ItScoredAnswer[], rules: ItExamRules = PATENTE_B_RULES_IT): ItExamResult {
  const seen = new Set<string>();
  let errors = 0;
  for (const a of answers) {
    if (seen.has(a.questionId)) continue;
    seen.add(a.questionId);
    if (!a.correct) errors += 1;
  }
  if (seen.size !== rules.questionCount) {
    return { rulesVersion: rules.version, answered: seen.size, errors, passed: false, failReason: "invalid_question_count" };
  }
  const failed = errors > rules.maxErrors;
  return { rulesVersion: rules.version, answered: seen.size, errors, passed: !failed, failReason: failed ? "too_many_errors" : "none" };
}
