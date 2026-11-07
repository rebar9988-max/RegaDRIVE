export type QuestionCategory = "Grundstoff" | "Zusatzstoff";
export type QuestionPoints = 2 | 3 | 4 | 5;
export type SourceType = "original" | "licensed_official";
export type ReviewStatus = "draft" | "pending" | "approved";

/**
 * Every learner-facing text exists in Kurdish Sorani (ckb, RTL) and German (de, LTR).
 * Built-in content also carries Kurdish Kurmanji (kmr, Latin, LTR) and Arabic (ar, RTL);
 * imported items without them fall back to German (see src/app/i18n.ts).
 */
export interface Bilingual { ckb: string; de: string; kmr?: string; ar?: string }

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

/** "choice": tick one or more options. "number": type a numeric answer (official catalogue has these too). */
export type AnswerType = "choice" | "number";
export type MediaKind = "image" | "video";
export interface MediaRef {
  kind: MediaKind;
  /** Content-addressed storage key, e.g. "media/<sha256>.webp". Served from /media/<key> once storage is activated. */
  key: string;
  alt: Bilingual;
  /** Still image shown before a video plays. */
  posterKey?: string;
}

export interface Question extends QuestionMetadata {
  id: string;
  topicId: string;
  prompt: Bilingual;
  options: AnswerOption[];
  /** Option ids that are correct. More than one may be correct. Empty for number questions. */
  correct: string[];
  answerType?: AnswerType;
  numericAnswer?: number;
  media?: MediaRef[];
  /** Official catalogue release the licensed wording belongs to. */
  catalogueVersion?: string | null;
  licenseId?: string | null;
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

export interface VocabularyEntry { id: string; de: string; article?: "der" | "die" | "das"; ckb: string; kmr?: string; ar?: string; note?: Bilingual }
