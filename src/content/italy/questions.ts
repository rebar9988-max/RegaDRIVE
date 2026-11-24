import type { ItQuestion } from "./types.ts";

/**
 * The obsolete, unreviewed RegaDRIVE Italian practice-question bank was removed
 * at the owner's explicit request. Do not serve draft questions as exam material.
 * The ministry Patenti A/B catalogue is being staged separately (PR #96),
 * pending rights verification, B eligibility mapping and translation review.
 * No Italian learner questions are available until a verified replacement is imported.
 */
export const IT_CONTENT_VERSION = "2026.11-it-awaiting-verified-source";
export const IT_QUESTIONS: ItQuestion[] = [];
export const itQuestionsByChapter = (chapter: number): ItQuestion[] =>
  IT_QUESTIONS.filter((question) => question.chapter === chapter);
