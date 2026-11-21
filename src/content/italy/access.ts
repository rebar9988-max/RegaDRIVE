import type { ContentMode } from "../access.ts";
import { IT_CHAPTERS } from "./chapters.ts";
import { IT_QUESTIONS } from "./questions.ts";
import { IT_SIGNS } from "./signs.ts";
import { itPublicationGate } from "./registry.ts";
import type { ItChapter, ItQuestion, ItSign } from "./types.ts";

export interface ItContent {
  mode: ContentMode;
  chapters: ItChapter[];
  questions: ItQuestion[];
  signs: ItSign[];
  /** Items that exist but are still in review, so the UI can say so instead of showing an empty page. */
  inReview: number;
}

/**
 * What the Italian section may show.
 * "production": only items the fail-closed gate lets through — today none, because the two human
 * reviews are outstanding. "preview": everything, for development and CI (never deployed to the
 * production domain; scripts/preflight.mjs rejects preview builds).
 */
export function itContentFor(mode: ContentMode): ItContent {
  const publishable = IT_QUESTIONS.filter((q) => itPublicationGate(q.id, q).publishable);
  const questions = mode === "preview" ? IT_QUESTIONS.filter((q) => q.publicationStatus === "published") : publishable;
  const signs = mode === "preview" ? IT_SIGNS : IT_SIGNS.filter((s) => itPublicationGate(s.id).publishable);
  return { mode, chapters: IT_CHAPTERS, questions, signs, inReview: IT_QUESTIONS.length - publishable.length };
}

export const itQuestionsOf = (content: ItContent, chapter: number): ItQuestion[] => content.questions.filter((q) => q.chapter === chapter);
