import { describe, expect, it } from "vitest";
import { itClockState, itExamCells, itExamNextOpen, itExamReview, itExamUnanswered, pickItExam } from "../../src/lib/itExam";
import { PATENTE_B_RULES_IT, scoreItExam } from "../../src/lib/shared/examIt";
import type { ItQuestion } from "../../src/content/italy/types";

const text = (s: string) => ({ ckb: s, it: s, kmrArab: s });
const q = (n: number, answer: boolean): ItQuestion => ({
  id: `q${n}`,
  chapter: ((n - 1) % 16) + 1,
  prompt: text(`p${n}`),
  answer,
  explanation: text(`e${n}`),
  questionCode: null,
  licenseClasses: ["B"],
  sourceType: "original",
  contentVersion: "v",
  reviewStatus: "approved",
  publicationStatus: "published",
});
const paper = Array.from({ length: 5 }, (_, i) => q(i + 1, i % 2 === 0));

describe("the Italian exam paper is answered in any order", () => {
  it("reports each statement as answered or marked, in the order of the paper", () => {
    const cells = itExamCells(paper, { q2: true }, { q4: true, q5: false });
    expect(cells.map((c) => c.id)).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    expect(cells.filter((c) => c.answered).map((c) => c.id)).toEqual(["q2"]);
    expect(cells.filter((c) => c.flagged).map((c) => c.id)).toEqual(["q4"]);
    expect(cells[1]!.index).toBe(1);
  });

  it("counts what is still open, and treats a false answer as an answer", () => {
    expect(itExamUnanswered(paper, {})).toBe(5);
    expect(itExamUnanswered(paper, { q1: false, q3: true })).toBe(3);
    expect(itExamUnanswered(paper, Object.fromEntries(paper.map((p) => [p.id, false])))).toBe(0);
  });

  it("walks on to the next open statement, wrapping past the end", () => {
    expect(itExamNextOpen(paper, { q2: true }, 0)).toBe(2);
    expect(itExamNextOpen(paper, { q4: true, q5: true }, 2)).toBe(0);
    expect(itExamNextOpen(paper, Object.fromEntries(paper.map((p) => [p.id, true])), 0)).toBeNull();
  });
});

describe("the result review", () => {
  it("keeps one row per statement, with the answer given and whether it was right", () => {
    const rows = itExamReview(paper, { q1: true, q2: true });
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ given: true, correct: true });
    expect(rows[1]).toMatchObject({ given: true, correct: false });
    expect(rows[2]).toMatchObject({ given: null, correct: false });
  });

  it("counts an unanswered statement as wrong, as the real test does", () => {
    const rows = itExamReview(paper, {});
    expect(rows.every((r) => r.given === null && !r.correct)).toBe(true);
  });
});

describe("the exam clock", () => {
  it("stays calm, then warns in the last quarter and turns critical in the last minute", () => {
    expect(itClockState(20 * 60)).toBe("calm");
    expect(itClockState(5 * 60 + 1)).toBe("calm");
    expect(itClockState(5 * 60)).toBe("warning");
    expect(itClockState(61)).toBe("warning");
    expect(itClockState(60)).toBe("critical");
    expect(itClockState(0)).toBe("critical");
  });
});

describe("a handed-in paper is scored by the ministerial rules", () => {
  const full = Array.from({ length: PATENTE_B_RULES_IT.questionCount }, (_, i) => q(i + 1, i % 2 === 0));

  it("passes with at most three wrong answers and fails with four", () => {
    const answers = (wrong: number) =>
      full.map((item, i) => ({ questionId: item.id, correct: i >= wrong }));
    expect(scoreItExam(answers(3)).passed).toBe(true);
    expect(scoreItExam(answers(4)).passed).toBe(false);
  });

  it("draws exactly the paper the rules ask for, or nothing at all", () => {
    expect(pickItExam(full)).toHaveLength(PATENTE_B_RULES_IT.questionCount);
    expect(pickItExam(full.slice(0, 29))).toBeNull();
  });
});
