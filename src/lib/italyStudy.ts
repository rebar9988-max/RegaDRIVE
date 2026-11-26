import { dayKey, questionStatus, streakDays, type ProgressState, type QStatus } from "./progress";
import { IT_CHAPTERS } from "../content/italy/chapters";
import { IT_INCROCI, itIncrocioLessonId, type ItIncrocio } from "../content/italy/incroci";
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

/** The id a finished Italian lesson is stored under, in Italy's own progress record. */
export const itLessonId = (chapter: number): string => `it-lesson-${chapter}`;

export const isItLessonDone = (progress: ProgressState, chapter: number): boolean =>
  progress.completedLessons.includes(itLessonId(chapter));

/** Mark a lesson finished, or undo it. Nothing else in the progress record changes. */
export function toggleItLessonDone(progress: ProgressState, chapter: number): ProgressState {
  const id = itLessonId(chapter);
  const done = progress.completedLessons.includes(id);
  return { ...progress, completedLessons: done ? progress.completedLessons.filter((x) => x !== id) : [...progress.completedLessons, id] };
}

/** How many of the 16 lessons are finished. */
export const itLessonsDone = (progress: ProgressState): number =>
  IT_CHAPTERS.filter((c) => isItLessonDone(progress, c.id)).length;

/** The chapter before and after this one, for the lesson's own navigation. */
export function itLessonNeighbours(chapter: number): { prev: number | null; next: number | null } {
  const ids = IT_CHAPTERS.map((c) => c.id);
  const i = ids.indexOf(chapter);
  if (i < 0) return { prev: null, next: null };
  return { prev: i > 0 ? ids[i - 1]! : null, next: i < ids.length - 1 ? ids[i + 1]! : null };
}

/* ── Intersections ("Incroci") ─────────────────────────────────────────── */

export const isItIncrocioSolved = (progress: ProgressState, id: string): boolean =>
  progress.completedLessons.includes(itIncrocioLessonId(id));

/** Record a solved scene. Solving it again changes nothing, and nothing else in the record moves. */
export function markItIncrocioSolved(progress: ProgressState, id: string): ProgressState {
  const key = itIncrocioLessonId(id);
  if (progress.completedLessons.includes(key)) return progress;
  return { ...progress, completedLessons: [...progress.completedLessons, key] };
}

export const itIncrociSolved = (progress: ProgressState): number =>
  IT_INCROCI.filter((s) => isItIncrocioSolved(progress, s.id)).length;

/** The first scene the learner has not solved yet, so the list can offer a single obvious start. */
export const itNextIncrocio = (progress: ProgressState): ItIncrocio | null =>
  IT_INCROCI.find((s) => !isItIncrocioSolved(progress, s.id)) ?? null;

/* ── Statistics ────────────────────────────────────────────────────────── */

export interface ItDay { key: string; count: number }

export interface ItStats {
  /** Answers given, counting every attempt — not the number of distinct questions. */
  attempts: number;
  correct: number;
  wrong: number;
  /** Share of correct answers, 0 – 100; null while nothing has been answered. */
  accuracy: number | null;
  answersToday: number;
  answersThisWeek: number;
  /** The last seven days, oldest first, each with the answers given that day. */
  week: ItDay[];
  streak: number;
  lessonsDone: number;
  incrociSolved: number;
  examsTaken: number;
  examsPassed: number;
}

/**
 * Everything the statistics screen shows, from the learner's own record only. A figure that has not
 * been earned stays zero and the screen says so; nothing here is estimated or filled in.
 */
export function itStats(progress: ProgressState, questions: readonly ItQuestion[], now: number): ItStats {
  let attempts = 0, correct = 0;
  const ids = new Set(questions.map((q) => q.id));
  for (const [id, p] of Object.entries(progress.questions)) {
    if (!ids.has(id)) continue;
    attempts += p.attempts;
    correct += Math.min(p.attempts, p.correctCount);
  }
  const week: ItDay[] = [];
  for (let back = 6; back >= 0; back--) {
    const d = new Date(now);
    d.setDate(d.getDate() - back);
    const key = dayKey(d.getTime());
    week.push({ key, count: progress.days[key] ?? 0 });
  }
  const exams = progress.examHistory ?? [];
  return {
    attempts,
    correct,
    wrong: attempts - correct,
    accuracy: attempts === 0 ? null : Math.round((correct / attempts) * 100),
    answersToday: week[week.length - 1]?.count ?? 0,
    answersThisWeek: week.reduce((n, d) => n + d.count, 0),
    week,
    streak: streakDays(progress, now),
    lessonsDone: itLessonsDone(progress),
    incrociSolved: itIncrociSolved(progress),
    examsTaken: exams.length,
    examsPassed: exams.filter((e) => e.passed).length,
  };
}

export type ItReadinessLevel = "not_started" | "learning" | "almost" | "ready";

export interface ItReadiness {
  level: ItReadinessLevel;
  /** Share of the approved bank answered at least once, 0 – 100. */
  answeredPct: number;
  /** Share of the approved bank mastered, 0 – 100. */
  masteredPct: number;
  recentExams: number;
  recentPassed: number;
}

/**
 * Exam readiness of the Italian section, from real answers and real simulations only. "ready" asks
 * for 90 % of the approved bank mastered and the last three simulations passed. It is a study aid and
 * never a prediction of the official examination.
 */
export function itReadiness(progress: ProgressState, questions: readonly ItQuestion[], threshold: number): ItReadiness {
  const total = questions.length;
  let answered = 0, mastered = 0;
  for (const q of questions) {
    const s = statusOf(progress, q, threshold);
    if (s !== "unanswered") answered += 1;
    if (s === "mastered") mastered += 1;
  }
  const recent = (progress.examHistory ?? []).slice(-3);
  const recentPassed = recent.filter((e) => e.passed).length;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  const masteredPct = pct(mastered);
  let level: ItReadinessLevel = "learning";
  if (answered === 0 && recent.length === 0) level = "not_started";
  else if (masteredPct >= 90 && recent.length === 3 && recentPassed === 3) level = "ready";
  else if (masteredPct >= 70 && recent.length > 0 && recent[recent.length - 1]!.passed) level = "almost";
  return { level, answeredPct: pct(answered), masteredPct, recentExams: recent.length, recentPassed };
}

/** Chapters sorted by how well they are going; only chapters the learner has actually started. */
export function itStrongChapters(stats: readonly ItChapterStat[], limit = 3): ItChapterStat[] {
  return stats.filter((s) => s.answered > 0 && s.mastered > 0 && s.wrong === 0)
    .sort((a, b) => b.mastered - a.mastered)
    .slice(0, limit);
}

export function itWeakChapters(stats: readonly ItChapterStat[], limit = 3): ItChapterStat[] {
  return stats.filter((s) => s.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, limit);
}

/** What the study guide offers next. One honest step, chosen from the learner's own record. */
export type ItNextStep = "waitForContent" | "fixMistakes" | "trainIncroci" | "takeExam" | "continueLesson" | "startLesson";

export function itNextStep(input: {
  progress: ProgressState;
  questions: readonly ItQuestion[];
  threshold: number;
  examQuestionCount: number;
}): ItNextStep {
  const { progress, questions, threshold, examQuestionCount } = input;
  const wrong = questions.filter((q) => statusOf(progress, q, threshold) === "incorrect").length;
  if (wrong > 0) return "fixMistakes";
  const lessons = itLessonsDone(progress);
  if (questions.length === 0) return lessons === 0 ? "startLesson" : "waitForContent";
  if (lessons === 0) return "startLesson";
  if (itIncrociSolved(progress) < IT_INCROCI.length) return "trainIncroci";
  if (questions.length >= examQuestionCount && itReadiness(progress, questions, threshold).masteredPct >= 70) return "takeExam";
  if (lessons < IT_CHAPTERS.length) return "continueLesson";
  return "takeExam";
}
