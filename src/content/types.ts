export type QuestionCategory = "Grundstoff" | "Zusatzstoff";
export type QuestionPoints = 2 | 3 | 4 | 5;
export type SourceType = "original" | "licensed_official";
export type ReviewStatus = "draft" | "pending" | "approved";

/** Every learner-facing text exists in Kurdish Sorani (ckb, RTL) and German (de, LTR). */
export interface Bilingual { ckb: string; de: string }

export interface QuestionMetadata {
  questionCode: string | null;
  points: QuestionPoints | null;
  categoryType: QuestionCategory;
  licenseClasses: string[];
  sourceType: SourceType;
  contentVersion: string;
  reviewStatus: ReviewStatus;
}

export interface AnswerOption { id: string; text: Bilingual }

export interface Question extends QuestionMetadata {
  id: string;
  topicId: string;
  prompt: Bilingual;
  options: AnswerOption[];
  /** Option ids that are correct. More than one may be correct. */
  correct: string[];
  explanation: Bilingual;
  vocabularyIds: string[];
  signId?: string;
  publicationStatus: "published" | "hidden";
}

export interface Topic { id: string; title: Bilingual; category: QuestionCategory }

export interface LessonSection { heading: Bilingual; body: Bilingual }
export interface Lesson { id: string; topicId: string; title: Bilingual; summary: Bilingual; sections: LessonSection[]; minutes: number }

export type SignShape = "triangle" | "triangle-down" | "octagon" | "diamond" | "circle-red" | "circle-blue" | "circle-plain" | "rect-blue" | "rect-yellow";
export interface TrafficSign {
  id: string;
  /** Official StVO sign number (public regulatory reference, not exam content). */
  stvoNumber: string;
  shape: SignShape;
  glyph: string;
  name: Bilingual;
  meaning: Bilingual;
  group: "danger" | "priority" | "prohibition" | "mandatory" | "information";
}

export interface VocabularyEntry { id: string; de: string; article?: "der" | "die" | "das"; ckb: string; note?: Bilingual }
