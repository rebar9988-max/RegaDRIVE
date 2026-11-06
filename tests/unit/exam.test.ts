import { describe, expect, it } from "vitest";
import { isAnswerCorrect, scoreExam, KLASSE_B_RULES_2026 } from "../../src/lib/shared/exam";

const a = (id: string, points: number, correct: boolean) => ({ questionId: id, points, correct });

describe("answer mapping", () => {
  it("requires the exact set of correct options (multiple correct answers)", () => {
    expect(isAnswerCorrect(["a", "b"], ["a", "b"])).toBe(true);
    expect(isAnswerCorrect(["b", "a"], ["a", "b"])).toBe(true);
    expect(isAnswerCorrect(["a"], ["a", "b"])).toBe(false);
    expect(isAnswerCorrect(["a", "b", "c"], ["a", "b"])).toBe(false);
    expect(isAnswerCorrect(["a", "a"], ["a", "b"])).toBe(false);
    expect(isAnswerCorrect([], ["a"])).toBe(false);
  });
});

describe("Klasse B exam scoring", () => {
  it("passes with exactly 10 error points without two 5-point mistakes", () => {
    const r = scoreExam([a("1", 5, false), a("2", 3, false), a("3", 2, false), a("4", 4, true)]);
    expect(r).toMatchObject({ errorPoints: 10, passed: true, failReason: "none" });
  });
  it("fails above 10 error points", () => {
    const r = scoreExam([a("1", 4, false), a("2", 4, false), a("3", 3, false)]);
    expect(r).toMatchObject({ errorPoints: 11, passed: false, failReason: "too_many_error_points" });
  });
  it("fails on two wrong 5-point questions even at 10 error points", () => {
    const r = scoreExam([a("1", 5, false), a("2", 5, false), a("3", 2, true)]);
    expect(r).toMatchObject({ errorPoints: 10, fivePointMistakes: 2, passed: false, failReason: "five_point_rule" });
  });
  it("never scores a question twice", () => {
    const r = scoreExam([a("1", 4, false), a("1", 4, false), a("1", 4, false)]);
    expect(r.errorPoints).toBe(4);
    expect(r.totalPoints).toBe(4);
  });
  it("rules are versioned and sourced", () => {
    expect(KLASSE_B_RULES_2026.version).toMatch(/^klasse-b-/);
    expect(KLASSE_B_RULES_2026.sources.length).toBeGreaterThan(0);
    expect(KLASSE_B_RULES_2026.grundstoffCount + KLASSE_B_RULES_2026.zusatzstoffCount).toBe(30);
  });
});
