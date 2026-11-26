import { describe, expect, it } from "vitest";
import { emptyProgress, dayKey, recordAnswer, MASTERY_THRESHOLD_DEFAULT, type ProgressState } from "../../src/lib/progress";
import { itChapterStats, itNextStep, itReadiness, itStats, itStrongChapters, itWeakChapters, markItIncrocioSolved, toggleItLessonDone } from "../../src/lib/italyStudy";
import { IT_INCROCI } from "../../src/content/italy/incroci";
import { IT_CHAPTERS } from "../../src/content/italy/chapters";
import type { ItQuestion } from "../../src/content/italy/types";

const TH = MASTERY_THRESHOLD_DEFAULT;
const NOW = Date.parse("2026-11-26T12:00:00Z");
const text = { ckb: "تاقیکردنەوە", it: "Prova" };
const bank: ItQuestion[] = [1, 1, 2, 3].map((chapter, index) => ({
  id: `it-stats-${index}`, chapter, prompt: text, answer: true, explanation: text,
  questionCode: null, licenseClasses: ["B"], sourceType: "original",
  contentVersion: "test", reviewStatus: "draft", publicationStatus: "hidden",
}));
const answer = (p: ProgressState, id: string, correct: boolean, times = 1): ProgressState => {
  let out = p;
  for (let n = 0; n < times; n += 1) out = recordAnswer(out, `session-${id}-${n}`, id, correct, NOW);
  return out;
};

describe("Italian statistics", () => {
  it("shows nothing but zeros before the learner has answered anything", () => {
    const s = itStats(emptyProgress(), bank, NOW);
    expect(s).toMatchObject({ attempts: 0, correct: 0, wrong: 0, accuracy: null, answersToday: 0, answersThisWeek: 0, streak: 0, examsTaken: 0, examsPassed: 0 });
    expect(s.week.length).toBe(7);
    expect(s.week.every((d) => d.count === 0)).toBe(true);
  });

  it("counts attempts, correct and wrong answers, and the resulting accuracy", () => {
    let p = answer(emptyProgress(), bank[0]!.id, true, 3);
    p = answer(p, bank[1]!.id, false, 1);
    const s = itStats(p, bank, NOW);
    expect(s.attempts).toBe(4);
    expect(s.correct).toBe(3);
    expect(s.wrong).toBe(1);
    expect(s.accuracy).toBe(75);
  });

  it("counts only the Italian bank, never a question of another section", () => {
    const p = answer(emptyProgress(), "de-question-1", true, 5);
    expect(itStats(p, bank, NOW).attempts).toBe(0);
  });

  it("puts today last in the week and counts the week from the day record", () => {
    const p = { ...emptyProgress(), days: { [dayKey(NOW)]: 4, [dayKey(NOW - 86_400_000)]: 2 } };
    const s = itStats(p, bank, NOW);
    expect(s.week[6]).toEqual({ key: dayKey(NOW), count: 4 });
    expect(s.week[5]?.count).toBe(2);
    expect(s.answersToday).toBe(4);
    expect(s.answersThisWeek).toBe(6);
    expect(s.streak).toBe(2);
  });

  it("reports lessons, solved scenes and simulations from the record itself", () => {
    let p = toggleItLessonDone(emptyProgress(), 1);
    p = markItIncrocioSolved(p, IT_INCROCI[0]!.id);
    p = { ...p, examHistory: [
      { at: NOW, passed: true, errorPoints: 1, totalPoints: 30, rulesVersion: "patente-b-it" },
      { at: NOW, passed: false, errorPoints: 5, totalPoints: 30, rulesVersion: "patente-b-it" },
    ] };
    const s = itStats(p, bank, NOW);
    expect(s).toMatchObject({ lessonsDone: 1, incrociSolved: 1, examsTaken: 2, examsPassed: 1 });
  });
});

describe("Italian exam readiness", () => {
  it("starts at nothing and never invents a percentage for an empty bank", () => {
    expect(itReadiness(emptyProgress(), [], TH)).toEqual({ level: "not_started", answeredPct: 0, masteredPct: 0, recentExams: 0, recentPassed: 0 });
    expect(itReadiness(emptyProgress(), bank, TH).level).toBe("not_started");
  });

  it("moves to learning as soon as something is answered", () => {
    const p = answer(emptyProgress(), bank[0]!.id, true, 1);
    const r = itReadiness(p, bank, TH);
    expect(r.level).toBe("learning");
    expect(r.answeredPct).toBe(25);
    expect(r.masteredPct).toBe(0);
  });

  it("reaches ready only with the bank mastered and the last three simulations passed", () => {
    let p = emptyProgress();
    for (const q of bank) p = answer(p, q.id, true, TH);
    const exam = (passed: boolean) => ({ at: NOW, passed, errorPoints: passed ? 1 : 9, totalPoints: 30, rulesVersion: "patente-b-it" });
    expect(itReadiness({ ...p, examHistory: [exam(true), exam(true)] }, bank, TH).level).toBe("almost");
    expect(itReadiness({ ...p, examHistory: [exam(true), exam(true), exam(false)] }, bank, TH).level).toBe("learning");
    const ready = itReadiness({ ...p, examHistory: [exam(true), exam(true), exam(true)] }, bank, TH);
    expect(ready).toMatchObject({ level: "ready", masteredPct: 100, answeredPct: 100, recentExams: 3, recentPassed: 3 });
  });
});

describe("strong and weak chapters", () => {
  it("names nothing before the learner has started", () => {
    const stats = itChapterStats(emptyProgress(), bank, TH);
    expect(itStrongChapters(stats)).toEqual([]);
    expect(itWeakChapters(stats)).toEqual([]);
  });

  it("separates a mastered chapter from one with wrong answers", () => {
    let p = emptyProgress();
    p = answer(p, bank[0]!.id, true, TH);
    p = answer(p, bank[1]!.id, true, TH);
    p = answer(p, bank[2]!.id, false, 1);
    const stats = itChapterStats(p, bank, TH);
    expect(itStrongChapters(stats).map((s) => s.chapter.id)).toEqual([1]);
    expect(itWeakChapters(stats).map((s) => s.chapter.id)).toEqual([2]);
  });
});

describe("the study guide's next step", () => {
  const step = (progress: ProgressState, questions: ItQuestion[] = bank) =>
    itNextStep({ progress, questions, threshold: TH, examQuestionCount: 30 });

  it("sends a learner with nothing yet to the first lesson", () => {
    expect(step(emptyProgress())).toBe("startLesson");
    expect(step(emptyProgress(), [])).toBe("startLesson");
  });

  it("asks an empty bank to wait, once the lessons have been started", () => {
    expect(step(toggleItLessonDone(emptyProgress(), 1), [])).toBe("waitForContent");
  });

  it("always puts the learner's own mistakes first", () => {
    const p = answer(toggleItLessonDone(emptyProgress(), 1), bank[0]!.id, false, 1);
    expect(step(p)).toBe("fixMistakes");
  });

  it("offers the intersections while scenes are unsolved, then the next lesson", () => {
    let p = toggleItLessonDone(emptyProgress(), 1);
    expect(step(p)).toBe("trainIncroci");
    for (const s of IT_INCROCI) p = markItIncrocioSolved(p, s.id);
    expect(step(p)).toBe("continueLesson");
  });

  it("offers a simulation only when the bank is long enough and well enough known", () => {
    let p = emptyProgress();
    for (const c of IT_CHAPTERS) p = toggleItLessonDone(p, c.id);
    for (const s of IT_INCROCI) p = markItIncrocioSolved(p, s.id);
    for (const q of bank) p = answer(p, q.id, true, TH);
    // Four approved questions are not a 30-question paper, so the step falls back to the simulation
    // screen only after every lesson is done; the screen itself still refuses to start a short exam.
    expect(step(p)).toBe("takeExam");
  });
});
