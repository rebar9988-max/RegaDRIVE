import { describe, expect, it } from "vitest";
import { isQuestionAnswerCorrect } from "../../src/lib/answers";
import { isNumericAnswerCorrect } from "../../src/lib/shared/exam";
import { contentFor } from "../../src/content/access";
import { QUESTIONS } from "../../src/content/questions";
import type { Question } from "../../src/content/types";

const base = QUESTIONS[0]!;
describe("answer types", () => {
  it("number questions accept German decimal commas and reject junk", () => {
    expect(isNumericAnswerCorrect(" 40 ", 40)).toBe(true);
    expect(isNumericAnswerCorrect("0,5", 0.5)).toBe(true);
    expect(isNumericAnswerCorrect("40m", 40)).toBe(false);
    expect(isNumericAnswerCorrect("", 0)).toBe(false);
    const q: Question = { ...base, answerType: "number", numericAnswer: 40, options: [], correct: [] };
    expect(isQuestionAnswerCorrect(q, ["40"])).toBe(true);
    expect(isQuestionAnswerCorrect(q, ["41"])).toBe(false);
    expect(isQuestionAnswerCorrect(q, [])).toBe(false);
  });
  it("choice questions keep exact-set semantics", () => {
    expect(isQuestionAnswerCorrect(base, base.correct)).toBe(true);
    expect(isQuestionAnswerCorrect(base, [])).toBe(false);
  });
});

describe("official content is never bundled", () => {
  it("excludes licensed_official items from the static app even in preview", () => {
    const fake: Question = { ...base, id: "off-x", sourceType: "licensed_official", questionCode: "0.0.00-001" };
    QUESTIONS.push(fake);
    try {
      expect(contentFor("preview").questions.some((q) => q.id === "off-x")).toBe(false);
      expect(contentFor("production").questions.some((q) => q.id === "off-x")).toBe(false);
    } finally { QUESTIONS.pop(); }
  });
});
