import { describe, expect, it } from "vitest";
import { itClockState, itExamCells, itExamErrorsByChapter, itExamNextOpen, itExamReview, itExamUnanswered, newItExamSession, pickItExam, restoreItExamSession } from "../../src/lib/itExam";
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

describe("a paper left in the middle", () => {
  const full = Array.from({ length: PATENTE_B_RULES_IT.questionCount }, (_, i) => q(i + 1, i % 2 === 0));
  const started = 1_000_000;
  const soon = started + 60_000; // a minute in, well inside the 20
  const open = () => {
    const s = newItExamSession(full, PATENTE_B_RULES_IT.version, started);
    return { ...s, answers: { q1: true, q2: false }, flagged: ["q3"], pos: 4 };
  };
  const restore = (raw: unknown, now = soon, pool = full) =>
    restoreItExamSession(raw, PATENTE_B_RULES_IT.version, pool, now, PATENTE_B_RULES_IT);

  it("stores the paper by id, in the order it was drawn", () => {
    const s = newItExamSession(full, PATENTE_B_RULES_IT.version, started);
    expect(s.questionIds).toEqual(full.map((item) => item.id));
    expect(s).toMatchObject({ version: 1, startedAt: started, answers: {}, flagged: [], pos: 0 });
  });

  it("comes back with the same statements, answers, marks and position", () => {
    const back = restore(open());
    expect(back?.paper.map((item) => item.id)).toEqual(full.map((item) => item.id));
    expect(back?.session.answers).toEqual({ q1: true, q2: false });
    expect(back?.session.flagged).toEqual(["q3"]);
    expect(back?.session.pos).toBe(4);
  });

  it("is dropped when its 20 minutes are already over, so yesterday's paper is never a failed exam", () => {
    expect(restore(open(), started + PATENTE_B_RULES_IT.minutes * 60_000 + 1)).toBeNull();
  });

  it("is dropped when a statement is no longer published: a paper it cannot rebuild is not this paper", () => {
    expect(restore(open(), soon, full.slice(1))).toBeNull();
  });

  it("is dropped when the exam rules have changed", () => {
    expect(restoreItExamSession(open(), "other-rules", full, soon, PATENTE_B_RULES_IT)).toBeNull();
  });

  it("refuses anything malformed instead of resuming a half-read paper", () => {
    expect(restore(null)).toBeNull();
    expect(restore({})).toBeNull();
    expect(restore({ ...open(), version: 2 })).toBeNull();
    expect(restore({ ...open(), questionIds: full.slice(0, 5).map((item) => item.id) })).toBeNull();
    expect(restore({ ...open(), answers: "no" })).toBeNull();
    expect(restore({ ...open(), flagged: [1, 2] })).toBeNull();
    expect(restore({ ...open(), startedAt: "soon" })).toBeNull();
  });

  it("drops answers, marks and a position that no longer fit the paper", () => {
    const back = restore({ ...open(), answers: { q1: true, ghost: true, q2: "yes" }, flagged: ["q3", "ghost"], pos: 999 });
    expect(back?.session.answers).toEqual({ q1: true });
    expect(back?.session.flagged).toEqual(["q3"]);
    expect(back?.session.pos).toBe(PATENTE_B_RULES_IT.questionCount - 1);
  });
});

describe("the result tells the learner where the mistakes fell", () => {
  it("groups the errors by chapter, heaviest first", () => {
    const mixed = [q(1, true), q(2, true), q(17, true), q(18, true), q(33, true)];
    // q1 and q17 are chapter 1, q2 and q18 chapter 2, q33 chapter 1 again.
    const wrongEverywhere = itExamErrorsByChapter(mixed, { q1: false, q17: false, q33: false, q2: false, q18: true });
    expect(wrongEverywhere).toEqual([{ chapter: 1, errors: 3 }, { chapter: 2, errors: 1 }]);
  });

  it("counts an unanswered statement as a mistake and lists no chapter without one", () => {
    expect(itExamErrorsByChapter([q(1, true)], {})).toEqual([{ chapter: 1, errors: 1 }]);
    expect(itExamErrorsByChapter([q(1, true)], { q1: true })).toEqual([]);
  });
});
