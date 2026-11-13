import { describe, expect, it } from "vitest";
import { CONTENT_REGISTRY } from "../../src/content/registry";
import { publicationGate, STAGES, type ContentRecord, type ReviewRecord } from "../../src/content/pipeline";
import { contentFor } from "../../src/content/access";
import { QUESTIONS } from "../../src/content/questions";
import { SIGN_QUIZ } from "../../src/content/signQuiz";
import { LESSONS } from "../../src/content/lessons";
import { SIGNS } from "../../src/content/signs";
import { VOCABULARY } from "../../src/content/vocabulary";
import { KLASSE_B_RULES_2026 } from "../../src/lib/shared/exam";

const ALL_IDS = [...QUESTIONS, ...SIGN_QUIZ, ...LESSONS, ...SIGNS, ...VOCABULARY].map((x) => x.id);

describe("automated SOURCE_CHECK and LICENSE_CHECK (evidence for the registry records)", () => {
  it("every content item has exactly one record with a stable, unique id", () => {
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
    for (const id of ALL_IDS) expect(CONTENT_REGISTRY.get(id)?.id).toBe(id);
    expect(CONTENT_REGISTRY.size).toBe(ALL_IDS.length);
  });
  it.each([...CONTENT_REGISTRY.values()].map((r) => [r.id, r] as const))("%s has provenance, sources, licence class and version", (_id, r) => {
    expect(r.provenance.author).toBeTruthy();
    expect(r.provenance.createdOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.provenance.aiAssisted).toBe(true); // disclosed honestly
    expect(r.provenance.sourceRefs.length).toBeGreaterThan(0);
    expect(r.contentVersion).toBeTruthy();
    if (r.kind === "question") {
      const q = [...QUESTIONS, ...SIGN_QUIZ].find((x) => x.id === r.id)!;
      expect(r.licenseClass).toBe(q.sourceType === "original" ? "original_regadrive" : "licensed_official");
      if (q.sourceType === "original") expect(q.questionCode).toBeNull();
    }
  });
});

describe("truthful review state", () => {
  it("no item claims human approval yet, so production publishes nothing", () => {
    for (const r of CONTENT_REGISTRY.values()) {
      expect(STAGES.indexOf(r.stage)).toBeLessThan(STAGES.indexOf("APPROVED"));
      expect(r.reviews.every((x) => x.role === "automated")).toBe(true);
    }
    const prod = contentFor("production");
    expect([prod.questions.length, prod.signQuiz.length, prod.lessons.length, prod.signs.length, prod.vocabulary.length]).toEqual([0, 0, 0, 0, 0]);
    expect(contentFor("preview").questions.length).toBe(QUESTIONS.length);
    expect(contentFor("preview").signQuiz.length).toBe(SIGN_QUIZ.length);
  });
});

describe("publication gate (fail closed)", () => {
  const q = QUESTIONS[0]!;
  const human = (stage: ReviewRecord["stage"], role: ReviewRecord["role"]): ReviewRecord => ({ stage, reviewer: "Named Reviewer", role, date: "2026-11-10", evidenceRef: "review/2026-11-10.pdf", outcome: "pass" });
  const approved = (): ContentRecord => {
    const base = CONTENT_REGISTRY.get(q.id)!;
    return { ...base, stage: "PUBLISHED", validatedAgainstRules: KLASSE_B_RULES_2026.version,
      reviews: [...base.reviews, human("TRANSLATION_REVIEW", "sorani_translator"), human("EDUCATIONAL_REVIEW", "driving_instructor"), human("APPROVED", "content_owner")] };
  };
  it("passes a fully reviewed, sourced, rules-validated item", () => {
    expect(publicationGate(approved(), q)).toEqual({ publishable: true, reasons: [] });
  });
  it("blocks the current (unreviewed) state", () => {
    const g = publicationGate(CONTENT_REGISTRY.get(q.id), q);
    expect(g.publishable).toBe(false);
    expect(g.reasons).toContain("missing passed TRANSLATION_REVIEW");
    expect(g.reasons).toContain("missing passed EDUCATIONAL_REVIEW");
  });
  it("rejects automated sign-off for human stages", () => {
    const r = approved();
    r.reviews = r.reviews.map((x) => (x.stage === "EDUCATIONAL_REVIEW" ? { ...x, role: "automated" } : x));
    expect(publicationGate(r, q).reasons).toContain("EDUCATIONAL_REVIEW needs a named human reviewer");
  });
  it("requires revalidation when exam rules change", () => {
    expect(publicationGate(approved(), q, "klasse-b-ersterwerb-2027-01").reasons).toContain("not revalidated against exam rules klasse-b-ersterwerb-2027-01");
  });
  it("blocks an unresolved failed review, missing sources, and invented official codes", () => {
    const failed = approved();
    failed.reviews.push({ ...human("TRANSLATION_REVIEW", "sorani_translator"), date: "2026-11-11", outcome: "fail" });
    expect(publicationGate(failed, q).reasons).toContain("an unresolved failed review exists");
    const noSrc = approved();
    noSrc.provenance = { ...noSrc.provenance, sourceRefs: [] };
    expect(publicationGate(noSrc, q).reasons).toContain("no source references");
    expect(publicationGate(approved(), { ...q, questionCode: "1.1.01-001" }).reasons).toContain("original question carries an official code");
  });
  it("licensed official questions need a licence record and a real code", () => {
    const r = { ...approved(), licenseClass: "licensed_official" as const };
    const g = publicationGate(r, { ...q, sourceType: "licensed_official", questionCode: "1.1.01-001" });
    expect(g.reasons).toContain("licensed content without licence record");
  });
  it("blocks content with no record at all", () => {
    expect(publicationGate(undefined).publishable).toBe(false);
  });
});
