import { questionStatus, type ProgressState, type QStatus } from "./progress";
import { IT_CHAPTERS } from "../content/italy/chapters";
import type { ItChapter, ItQuestion } from "../content/italy/types";

/**
 * Study helpers of the Italian section. Pure functions over the approved question bank and the
 * learner's own progress; they never reach into the German content or its topic model.
 */

export type ItPracticeMode = "chapter" | "wrong" | "bookmarks" | "new" | "all";

export const isItPracticeMode = (v: unknown): v is ItPracticeMode =>
  v === "chapter" || v === "wrong" || v === "bookmarks" || v === "new" || v === "all";

export interface ItChapterStat {
  chapter: ItChapter;
  total: number;
  answered: number;
  mastered: number;
  /** Answered and last answered wrongly: exactly what the review mode practises. */
  wrong: number;
}

const statusOf = (progress: ProgressState, q: ItQuestion, threshold: number): QStatus =>
  questionStatus(progress.questions[q.id], threshold);

export function itChapterStats(progress: ProgressState, questions: readonly ItQuestion[], threshold: number): ItChapterStat[] {
  return IT_CHAPTERS.map((chapter) => {
    const mine = questions.filter((q) => q.chapter === chapter.id);
    let answered = 0, mastered = 0, wrong = 0;
    for (const q of mine) {
      const s = statusOf(progress, q, threshold);
      if (s !== "unanswered") answered += 1;
      if (s === "mastered") mastered += 1;
      if (s === "incorrect") wrong += 1;
    }
    return { chapter, total: mine.length, answered, mastered, wrong };
  });
}

export interface ItOverall { total: number; answered: number; mastered: number; wrong: number; bookmarked: number }

export function itOverall(progress: ProgressState, questions: readonly ItQuestion[], threshold: number): ItOverall {
  const stats = itChapterStats(progress, questions, threshold);
  const ids = new Set(questions.map((q) => q.id));
  return {
    total: questions.length,
    answered: stats.reduce((n, s) => n + s.answered, 0),
    mastered: stats.reduce((n, s) => n + s.mastered, 0),
    wrong: stats.reduce((n, s) => n + s.wrong, 0),
    // Only bookmarks on questions the learner may actually see are counted.
    bookmarked: progress.bookmarks.filter((id) => ids.has(id)).length,
  };
}

/** The questions a practice run should serve. Order is the bank's own order, so a run is reproducible. */
export function itPracticeSet(
  questions: readonly ItQuestion[],
  progress: ProgressState,
  mode: ItPracticeMode,
  chapter: number | null,
  threshold: number,
): ItQuestion[] {
  if (mode === "wrong") return questions.filter((q) => statusOf(progress, q, threshold) === "incorrect");
  if (mode === "new") return questions.filter((q) => (chapter === null || q.chapter === chapter) && statusOf(progress, q, threshold) === "unanswered");
  if (mode === "bookmarks") return questions.filter((q) => progress.bookmarks.includes(q.id));
  if (mode === "chapter" && chapter !== null) return questions.filter((q) => q.chapter === chapter);
  return [...questions];
}

/** The legal references behind a chapter's questions, de-duplicated, for the chapter's study page. */
export function itChapterSources(chapter: number, questions: readonly ItQuestion[], sourcesById: (id: string) => readonly string[]): string[] {
  const out = new Set<string>();
  for (const q of questions) if (q.chapter === chapter) for (const ref of sourcesById(q.id)) out.add(ref);
  return [...out].sort((a, b) => a.localeCompare(b, "it"));
}
