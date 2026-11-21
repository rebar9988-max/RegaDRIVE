/** Italian (Patente B) section content. Separate from the German StVO content by design. */
export type { ItChapter, ItQuestion, ItSign, ItText, ItReviewStatus } from "./types.ts";
export { IT_CHAPTERS, IT_PLANNED_TOTAL, itChapterById } from "./chapters.ts";
export { IT_QUESTIONS, IT_CONTENT_VERSION, itQuestionsByChapter } from "./questions.ts";
export { IT_SIGNS, itSignById, itSignSrc } from "./signs.ts";
