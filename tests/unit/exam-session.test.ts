import { describe, expect, it } from "vitest";
import { elapsedMs, formatClock, isAnswered, newExamSession, remainingMs, restoreExamSession } from "../../src/lib/examSession";
import { EXAM_PRACTICE_LIMIT_MINUTES, KLASSE_B_RULES_2026, scoreExam } from "../../src/lib/shared/exam";
import { buildMockExam } from "../../src/lib/mockExam";
import { isQuestionAnswerCorrect } from "../../src/lib/answers";
import { QUESTIONS } from "../../src/content/questions";
import type { Question } from "../../src/content/types";

const V = KLASSE_B_RULES_2026.version;
const ids = () => ["q1", "q2", "q3"];

describe("exam session", () => {
  it("has no time limit by default, as the official exam, and only counts the time used", () => {
    const s = newExamSession(7, V, null, 1_000);
    expect(s).toMatchObject({ seed: 7, pos: 0, answers: {}, flagged: [], plays: {}, durationMs: null });
    expect(remainingMs(s, 1_000 + 10 * 3_600_000)).toBeNull();
    expect(elapsedMs(s, 62_500)).toBe(61_500);
    expect(formatClock(elapsedMs(s, 62_500), "down")).toBe("01:01");
    expect(restoreExamSession(JSON.parse(JSON.stringify(s)), V, ids)).toEqual(s);
  });
  it("an optional practice limit counts down to zero", () => {
    const s = newExamSession(7, V, EXAM_PRACTICE_LIMIT_MINUTES, 1_000);
    expect(remainingMs(s, 1_000)).toBe(EXAM_PRACTICE_LIMIT_MINUTES * 60_000);
    expect(remainingMs(s, 1_000 + s.durationMs! + 5)).toBe(0);
  });
  it("the rules are sourced from the law and claim no official time limit", () => {
    expect(KLASSE_B_RULES_2026.sources.some((x) => x.includes("gesetze-im-internet.de/fev_2010/anlage_7"))).toBe(true);
    expect(KLASSE_B_RULES_2026).toMatchObject({ officialTotalPoints: 110, maxErrorPoints: 10, failOnFivePointMistakes: 2 });
    expect(Object.keys(KLASSE_B_RULES_2026).some((k) => /minute|duration|time/i.test(k))).toBe(false);
  });
  it("formats the clock as mm:ss and never shows a negative time", () => {
    expect(formatClock(45 * 60_000)).toBe("45:00");
    expect(formatClock(61_000)).toBe("01:01");
    expect(formatClock(400)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
  });
  it("restores a stored session, keeping answers, position and flags", () => {
    const s = { ...newExamSession(7, V, 45, 1_000), pos: 2, answers: { q1: ["a", "b"], q3: [] }, flagged: ["q2"] };
    expect(restoreExamSession(JSON.parse(JSON.stringify(s)), V, ids)).toEqual(s);
  });
  it("drops answers and flags for questions that are not part of the exam and clamps the position", () => {
    const s = { ...newExamSession(7, V, 45, 1_000), pos: 99, answers: { q1: ["a"], gone: ["a"], q2: "a" }, flagged: ["gone", "q3"] };
    const r = restoreExamSession(s, V, ids)!;
    expect(r.answers).toEqual({ q1: ["a"] });
    expect(r.flagged).toEqual(["q3"]);
    expect(r.pos).toBe(2);
  });
  it.each([
    ["nothing stored", undefined],
    ["not an object", "x"],
    ["other format version", { ...newExamSession(1, V, 45, 0), version: 2 }],
    ["other exam rules", { ...newExamSession(1, "old-rules", 45, 0) }],
    ["broken seed", { ...newExamSession(1, V, 45, 0), seed: "1" }],
    ["broken duration", { ...newExamSession(1, V, 45, 0), durationMs: 0 }],
    ["broken flags", { ...newExamSession(1, V, 45, 0), flagged: [1] }],
  ])("refuses to resume: %s", (_n, raw) => {
    expect(restoreExamSession(raw, V, ids)).toBeNull();
  });
  it("refuses a session whose exam can no longer be built", () => {
    expect(restoreExamSession(newExamSession(1, V, 45, 0), V, () => [])).toBeNull();
  });
  it("an empty selection is not an answer", () => {
    expect(isAnswered({ a: [] }, "a")).toBe(false);
    expect(isAnswered({ a: ["x"] }, "a")).toBe(true);
    expect(isAnswered({}, "a")).toBe(false);
  });
});

describe("exam simulation end to end (answer key decides, no partial credit)", () => {
  const exam = buildMockExam(QUESTIONS, 42);
  const score = (answer: (q: Question) => string[]) =>
    scoreExam(exam.map((q) => ({ questionId: q.id, points: q.points ?? 0, correct: isQuestionAnswerCorrect(q, answer(q)) })));

  it("builds 20 Grundstoff + 10 Zusatzstoff questions without duplicates, reproducibly", () => {
    expect(exam.filter((q) => q.categoryType === "Grundstoff")).toHaveLength(20);
    expect(exam.filter((q) => q.categoryType === "Zusatzstoff")).toHaveLength(10);
    expect(new Set(exam.map((q) => q.id)).size).toBe(30);
    expect(buildMockExam(QUESTIONS, 42).map((q) => q.id)).toEqual(exam.map((q) => q.id));
  });
  it("all answers exactly right: passed with 0 error points", () => {
    expect(score((q) => q.correct)).toMatchObject({ errorPoints: 0, passed: true });
  });
  it("an unanswered exam fails and loses every point", () => {
    const r = score(() => []);
    expect(r.passed).toBe(false);
    expect(r.errorPoints).toBe(r.totalPoints);
  });
  it("a multi-answer question with one correct option missing costs its full points", () => {
    const multi = exam.find((q) => q.correct.length > 1)!;
    expect(multi).toBeDefined();
    const r = score((q) => (q.id === multi.id ? q.correct.slice(0, 1) : q.correct));
    expect(r.errorPoints).toBe(multi.points);
  });
  it("a multi-answer question with one extra wrong option costs its full points", () => {
    const multi = exam.find((q) => q.correct.length > 1 && q.options.length > q.correct.length)!;
    expect(multi).toBeDefined();
    const r = score((q) => (q.id === multi.id ? q.options.map((o) => o.id) : q.correct));
    expect(r.errorPoints).toBe(multi.points);
  });
  it("two wrong 5-point questions fail the exam at exactly 10 error points", () => {
    const five = exam.filter((q) => q.points === 5).slice(0, 2).map((q) => q.id);
    expect(five).toHaveLength(2);
    expect(score((q) => (five.includes(q.id) ? [] : q.correct))).toMatchObject({ errorPoints: 10, passed: false, failReason: "five_point_rule" });
  });
});
