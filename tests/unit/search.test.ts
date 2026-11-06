import { describe, expect, it } from "vitest";
import { defaultFilter, filterQuestions, normalize } from "../../src/lib/search";
import { QUESTIONS } from "../../src/content/questions";
import { emptyProgress, recordAnswer } from "../../src/lib/progress";
import { buildMockExam } from "../../src/lib/mockExam";

const f = (patch = {}) => ({ ...defaultFilter(), ...patch });

describe("search and filters", () => {
  it("finds questions by German, Kurdish, topic and vocabulary", () => {
    expect(filterQuestions(QUESTIONS, f({ text: "Rettungsgasse" }), emptyProgress(), 3).map((q) => q.id)).toContain("rd-g-020");
    expect(filterQuestions(QUESTIONS, f({ text: "ڕێڕەوی فریاکەوتن" }), emptyProgress(), 3).map((q) => q.id)).toContain("rd-g-020");
    expect(filterQuestions(QUESTIONS, f({ text: "ئۆتۆبان" }), emptyProgress(), 3).length).toBeGreaterThan(2);
    expect(filterQuestions(QUESTIONS, f({ text: "Profiltiefe" }), emptyProgress(), 3).map((q) => q.id)).toContain("rd-z-001");
  });
  it("normalizes Arabic-script variants and digits", () => {
    expect(normalize("كوردي ١٢")).toBe(normalize("کوردی 12"));
  });
  it("filters by points, category and status", () => {
    expect(filterQuestions(QUESTIONS, f({ points: [5] }), emptyProgress(), 3).every((q) => q.points === 5)).toBe(true);
    expect(filterQuestions(QUESTIONS, f({ category: "Zusatzstoff" }), emptyProgress(), 3).every((q) => q.categoryType === "Zusatzstoff")).toBe(true);
    const p = recordAnswer(emptyProgress(), "s", "rd-g-001", false, Date.now());
    expect(filterQuestions(QUESTIONS, f({ status: "incorrect" }), p, 3).map((q) => q.id)).toEqual(["rd-g-001"]);
    expect(filterQuestions(QUESTIONS, f({ status: "unanswered" }), p, 3).length).toBe(QUESTIONS.length - 1);
  });
});

describe("mock exam", () => {
  it("draws 20 Grundstoff + 10 Zusatzstoff without duplicates, reproducibly", () => {
    const e = buildMockExam(QUESTIONS, 42);
    expect(e.length).toBe(30);
    expect(new Set(e.map((q) => q.id)).size).toBe(30);
    expect(e.filter((q) => q.categoryType === "Grundstoff").length).toBe(20);
    expect(buildMockExam(QUESTIONS, 42).map((q) => q.id)).toEqual(e.map((q) => q.id));
  });
});
