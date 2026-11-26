import type { ItText } from "../types.ts";

/**
 * A lesson of the Italian section. Original RegaDRIVE teaching material: the rule in the learner's own
 * words, with the article of the Codice della Strada it rests on, a practical example, the signs it
 * concerns, and two self-checks. These are NOT ministerial examination questions and carry no official
 * question code; the exam bank stays separate and separately reviewed (src/content/italy/questions.ts).
 */
export interface ItLessonPoint {
  text: ItText;
  /** The article the point rests on, e.g. "CdS art. 142". Shown next to the point. */
  ref?: string;
}

/** A self-check inside a lesson: a statement the learner judges true or false, with the reason. */
export interface ItLessonCheck {
  id: string;
  statement: ItText;
  answer: boolean;
  why: ItText;
}

export interface ItLesson {
  /** 1 – 16, the chapter in IT_CHAPTERS. */
  chapter: number;
  intro: ItText;
  points: ItLessonPoint[];
  example: ItText;
  /** Sign ids from IT_SIGNS that belong to this lesson. */
  signIds: string[];
  checks: ItLessonCheck[];
  /** Legal references for the whole lesson. */
  sources: string[];
}
