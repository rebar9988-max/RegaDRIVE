import { describe, expect, it } from "vitest";
import { QUESTIONS } from "../../src/content/questions";
import { SIGNS } from "../../src/content/signs";
import { SIGN_QUIZ } from "../../src/content/signQuiz";
import { VOCABULARY } from "../../src/content/vocabulary";
import { TOPICS } from "../../src/content/topics";
import { LESSONS } from "../../src/content/lessons";
import { KLASSE_B_RULES_2026 } from "../../src/lib/shared/exam";

const arabicScript = /[؀-ۿ]/;
const bilingualOk = (t: { ckb: string; de: string }) =>
  t.ckb.trim().length > 0 && t.de.trim().length > 0 && arabicScript.test(t.ckb) && !arabicScript.test(t.de);

describe("question bank integrity", () => {
  it("has unique ids", () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
  });
  it.each(QUESTIONS.map((q) => [q.id, q] as const))("%s is complete, bilingual and honestly labelled", (_id, q) => {
    expect(bilingualOk(q.prompt)).toBe(true);
    expect(bilingualOk(q.explanation)).toBe(true);
    expect(q.options.length).toBeGreaterThanOrEqual(2);
    for (const o of q.options) expect(bilingualOk(o.text) || /^[\d.,\s]+(km\/h|m|mm|Promille)?$/.test(o.text.de)).toBe(true);
    expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
    expect(q.correct.length).toBeGreaterThan(0);
    for (const c of q.correct) expect(q.options.some((o) => o.id === c)).toBe(true);
    expect([2, 3, 4, 5]).toContain(q.points);
    expect(TOPICS.some((t) => t.id === q.topicId)).toBe(true);
    for (const v of q.vocabularyIds) expect(VOCABULARY.some((x) => x.id === v)).toBe(true);
    if (q.signId) expect(SIGNS.some((s) => s.id === q.signId)).toBe(true);
    // Original questions must never carry an invented official code or claim official status.
    if (q.sourceType === "original") expect(q.questionCode).toBeNull();
    expect(q.reviewStatus).not.toBe("approved");
    expect(q.licenseClasses).toContain("B");
  });
  it("has enough questions for a 20 + 10 mock exam", () => {
    expect(QUESTIONS.filter((q) => q.categoryType === "Grundstoff").length).toBeGreaterThanOrEqual(KLASSE_B_RULES_2026.grundstoffCount);
    expect(QUESTIONS.filter((q) => q.categoryType === "Zusatzstoff").length).toBeGreaterThanOrEqual(KLASSE_B_RULES_2026.zusatzstoffCount);
  });
  it("covers every points value 2, 3, 4 and 5", () => {
    for (const p of [2, 3, 4, 5]) expect(QUESTIONS.some((q) => q.points === p)).toBe(true);
  });
});

describe("other content", () => {
  it("signs, lessons and vocabulary are bilingual", () => {
    for (const s of SIGNS) { expect(bilingualOk(s.name)).toBe(true); expect(bilingualOk(s.meaning)).toBe(true); }
    for (const l of LESSONS) { expect(bilingualOk(l.title)).toBe(true); for (const s of l.sections) expect(bilingualOk(s.body)).toBe(true); }
    for (const v of VOCABULARY) { expect(arabicScript.test(v.ckb)).toBe(true); expect(arabicScript.test(v.de)).toBe(false); }
  });
});

describe("Verkehrszeichen-Quiz", () => {
  const kmrOk = (t: { kmr?: string; ar?: string }) => Boolean(t.kmr?.trim()) && arabicScript.test(t.ar ?? "");
  it("has unique sign ids and numbers, each with an official StVO source", () => {
    expect(new Set(SIGNS.map((s) => s.id)).size).toBe(SIGNS.length);
    expect(new Set(SIGNS.map((s) => s.stvoNumber)).size).toBe(SIGNS.length);
    for (const s of SIGNS) {
      expect([1, 2, 3]).toContain(s.anlage);
      expect(s.lfdNr).toBeGreaterThan(0);
      expect(kmrOk(s.name) && kmrOk(s.meaning)).toBe(true);
    }
  });
  it("covers danger, priority, prohibition, mandatory and information signs", () => {
    for (const g of ["danger", "priority", "prohibition", "mandatory", "information"] as const) expect(SIGNS.some((s) => s.group === g)).toBe(true);
    expect(SIGNS.length).toBeGreaterThanOrEqual(40);
  });
  it("every sign has a meaning and a sign-type question", () => {
    for (const s of SIGNS) {
      expect(SIGN_QUIZ.some((q) => q.id === `rd-sq-${s.id}-m` && q.signId === s.id)).toBe(true);
      expect(SIGN_QUIZ.some((q) => q.id === `rd-sq-${s.id}-k` && q.signId === s.id)).toBe(true);
    }
  });
  it("has unique ids and is kept out of the exam bank", () => {
    expect(new Set(SIGN_QUIZ.map((q) => q.id)).size).toBe(SIGN_QUIZ.length);
    const examIds = new Set(QUESTIONS.map((q) => q.id));
    for (const q of SIGN_QUIZ) expect(examIds.has(q.id)).toBe(false);
  });
  it.each(SIGN_QUIZ.map((q) => [q.id, q] as const))("%s is bilingual, single-answer and honestly labelled", (_id, q) => {
    expect(bilingualOk(q.prompt)).toBe(true);
    expect(bilingualOk(q.explanation)).toBe(true);
    expect(q.options.length).toBe(3);
    for (const o of q.options) { expect(bilingualOk(o.text)).toBe(true); expect(kmrOk(o.text)).toBe(true); }
    expect(new Set(q.options.map((o) => o.text.de)).size).toBe(q.options.length);
    expect(q.correct).toHaveLength(1);
    expect(q.options.some((o) => o.id === q.correct[0])).toBe(true);
    expect(q.signId && SIGNS.some((s) => s.id === q.signId)).toBeTruthy();
    expect(q.sourceType).toBe("original");
    expect(q.questionCode).toBeNull();
    expect(q.reviewStatus).not.toBe("approved");
    expect(q.topicId).toBe("signs");
    expect(TOPICS.some((t) => t.id === q.topicId)).toBe(true);
  });
  it("meaning questions point at the right sign name", () => {
    for (const s of SIGNS) {
      const q = SIGN_QUIZ.find((x) => x.id === `rd-sq-${s.id}-m`)!;
      expect(q.options.find((o) => o.id === q.correct[0])!.text.de).toBe(s.name.de);
    }
  });
});
