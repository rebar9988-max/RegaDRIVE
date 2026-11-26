import { describe, expect, it } from "vitest";
import {
  IT_PRACTICE_SESSION_MAX_AGE_MS,
  itPracticeCells,
  itPracticeLeft,
  newItPracticeSession,
  restoreItPracticeSession,
} from "../../src/lib/itPractice";
import type { ItPracticeMode } from "../../src/lib/italyStudy";
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
const list = [q(1, true), q(2, false), q(3, true), q(4, false)];
const now = 2_000_000;

describe("the practice overview", () => {
  it("says whether each statement was got right, not merely answered", () => {
    const cells = itPracticeCells(list, { q1: true, q2: true });
    expect(cells.map((c) => c.state)).toEqual(["correct", "wrong", "unanswered", "unanswered"]);
    expect(cells[1]).toMatchObject({ index: 1, id: "q2" });
  });

  it("counts everything not yet right as still to do", () => {
    expect(itPracticeLeft(list, {})).toBe(4);
    expect(itPracticeLeft(list, { q1: true, q2: true })).toBe(3);
    expect(itPracticeLeft(list, { q1: true, q2: false, q3: true, q4: false })).toBe(0);
  });
});

describe("a practice run left in the middle", () => {
  const open = () => ({ ...newItPracticeSession("chapter", 3, list, now), answers: { q1: true }, pos: 2 });
  const want: { mode: ItPracticeMode; chapter: number | null } = { mode: "chapter", chapter: 3 };
  const restore = (raw: unknown, at = now + 1000, pool = list, w: { mode: ItPracticeMode; chapter: number | null } = want) =>
    restoreItPracticeSession(raw, w, pool, at);

  it("comes back with the same statements, answers and position", () => {
    const back = restore(open());
    expect(back?.list.map((item) => item.id)).toEqual(["q1", "q2", "q3", "q4"]);
    expect(back?.session.answers).toEqual({ q1: true });
    expect(back?.session.pos).toBe(2);
  });

  it("is only offered for the run the learner actually opened", () => {
    expect(restore(open(), now + 1000, list, { mode: "wrong", chapter: null })).toBeNull();
    expect(restore(open(), now + 1000, list, { mode: "chapter", chapter: 4 })).toBeNull();
    expect(restore({ ...open(), chapter: null }, now + 1000, list, { mode: "chapter", chapter: null })).not.toBeNull();
  });

  it("is dropped once it is more than a day old", () => {
    expect(restore(open(), now + IT_PRACTICE_SESSION_MAX_AGE_MS + 1)).toBeNull();
    expect(restore(open(), now + IT_PRACTICE_SESSION_MAX_AGE_MS)).not.toBeNull();
  });

  it("is dropped when a statement is no longer published", () => {
    expect(restore(open(), now + 1000, list.slice(1))).toBeNull();
  });

  it("refuses anything malformed instead of resuming a half-read run", () => {
    expect(restore(null)).toBeNull();
    expect(restore({})).toBeNull();
    expect(restore({ ...open(), version: 2 })).toBeNull();
    expect(restore({ ...open(), mode: "nonsense" })).toBeNull();
    expect(restore({ ...open(), questionIds: [] })).toBeNull();
    expect(restore({ ...open(), answers: "no" })).toBeNull();
    expect(restore({ ...open(), updatedAt: "today" })).toBeNull();
  });

  it("drops answers that no longer belong to the run and clamps the position", () => {
    const back = restore({ ...open(), answers: { q1: true, ghost: true, q2: "yes" }, pos: 99 });
    expect(back?.session.answers).toEqual({ q1: true });
    expect(back?.session.pos).toBe(list.length);
  });
});
