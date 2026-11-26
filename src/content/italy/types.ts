/**
 * Italy (Patente B) content model.
 *
 * Kept apart from the German (StVO) model in ../types.ts on purpose: the Italian catalogue is
 * true/false, its signs are not StVO signs, and its source language is Italian, not German.
 * Nothing here changes the German content or the four learner languages.
 */

/**
 * One text in every language the Italian section needs.
 * - ckb: Kurdish Sorani (RTL) — the learner-first language.
 * - it: the Italian source wording (second line for Italy, as German is for Germany).
 * - kmrArab: Kurdish Kurmanji in Arabic script ("Badini"), kept separate from the Latin-script kmr.
 * - de, ar: the remaining learner languages; drafted with AI assistance and not yet human-reviewed.
 */
export interface ItText {
  ckb: string;
  it: string;
  kmrArab?: string;
  kmr?: string;
  de?: string;
  ar?: string;
}

/** The 16 chapters of the Italian theory syllabus. */
export interface ItChapter {
  /** 1 – 16, as numbered in the official syllabus. */
  id: number;
  title: ItText;
  /** How many questions the full syllabus plans for this chapter (not how many exist here yet). */
  plannedCount: number;
}

/** A sign illustration served from /signs/it/<file>. Original RegaDRIVE artwork, not an official reproduction. */
export interface ItSign {
  id: string;
  /**
   * Legal or provenance references for this item. The bundled catalogue records them in the content
   * registry; an imported item carries them here, because review needs them either way.
   */
  sourceRefs?: readonly string[];
  /** File name under public/signs/it, without the folder. */
  file: string;
  group: "danger" | "priority" | "prohibition" | "mandatory" | "information";
  name: ItText;
}

export type ItReviewStatus = "draft" | "pending" | "approved";

/** A true/false question of the Italian catalogue. */
export interface ItQuestion {
  id: string;
  /** 1 – 16, the chapter in IT_CHAPTERS. Italian content is grouped by chapter, not by the German topics. */
  chapter: number;
  prompt: ItText;
  /** true = VERO, false = FALSO. */
  answer: boolean;
  explanation: ItText;
  /** Id in IT_SIGNS; the illustration shown with the question. */
  signId?: string;
  /** Original content carries no official question code (repository rule). */
  questionCode: null;
  licenseClasses: readonly string[];
  sourceType: "original";
  contentVersion: string;
  /** Legal references (Codice della Strada articles) when the item was imported rather than bundled. */
  sourceRefs?: readonly string[];
  /** Never "approved" before a qualified human review (docs/CONTENT_REVIEW.md). */
  reviewStatus: ItReviewStatus;
  publicationStatus: "published" | "hidden";
}
