import { describe, expect, it } from "vitest";
import { QUESTIONS } from "../../src/content/questions";
import { SIGNS } from "../../src/content/signs";
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
