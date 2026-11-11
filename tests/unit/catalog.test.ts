import { describe, expect, it } from "vitest";
import { CATALOG_TARGET, catalogReport, contentFingerprint } from "../../src/lib/shared/catalog";
import { QUESTIONS } from "../../src/content/questions";
import type { Question } from "../../src/content/types";

let n = 0;
const make = (over: Partial<Question> = {}): Question => {
  n++;
  return {
    id: `t-${n}`, topicId: "priority", categoryType: "Grundstoff", points: 3, questionCode: null, licenseClasses: ["B"],
    sourceType: "original", contentVersion: "test", reviewStatus: "approved", publicationStatus: "published",
    prompt: { de: `Testfrage ${n}`, ckb: `پرسیاری ${n}` },
    options: [{ id: "a", text: { de: "Ja", ckb: "بەڵێ" } }, { id: "b", text: { de: "Nein", ckb: "نەخێر" } }],
    correct: ["a"], explanation: { de: "Erklärung", ckb: "ڕوونکردنەوە" }, vocabularyIds: [],
    ...over,
  };
};
const kinds = (qs: Question[], opts = {}) => catalogReport(qs, opts).issues.map((i) => i.kind);

describe("catalogue coverage", () => {
  it("the target is 1,600 and the bundled bank is honestly reported as incomplete", () => {
    expect(CATALOG_TARGET).toBe(1600);
    const r = catalogReport(QUESTIONS);
    expect(r.total).toBe(QUESTIONS.length);
    expect(r.issues.filter((i) => i.kind !== "missing_sorani")).toEqual([]);
    expect(r.valid).toBe(QUESTIONS.length);
    expect(r.missing).toBe(1600 - QUESTIONS.length);
    // Nothing is human-approved yet, so nothing counts as ready.
    expect(r.ready).toBe(0);
    expect(r.complete).toBe(false);
  });
  it("is complete only when the target number of records is valid, approved and published", () => {
    const qs = [make(), make(), make()];
    expect(catalogReport(qs, { target: 3 })).toMatchObject({ valid: 3, ready: 3, missing: 0, complete: true });
    expect(catalogReport([...qs.slice(0, 2), make({ reviewStatus: "pending" })], { target: 3 })).toMatchObject({ valid: 3, ready: 2, complete: false });
    expect(catalogReport([...qs.slice(0, 2), make({ publicationStatus: "hidden" })], { target: 3 })).toMatchObject({ ready: 2, complete: false });
    expect(catalogReport(qs.slice(0, 2), { target: 3 })).toMatchObject({ missing: 1, complete: false });
  });
  it("detects duplicate ids, official numbers and content", () => {
    const a = make();
    expect(kinds([a, { ...a }])).toContain("duplicate_id");
    const lic = { sourceType: "licensed_official" as const, licenseId: "L1", catalogueVersion: "2026-01-01" };
    expect(kinds([make({ ...lic, questionCode: "1.1.01-001" }), make({ ...lic, questionCode: "1.1.01-001" })])).toContain("duplicate_code");
    const same = { prompt: { de: "  Gleiche   FRAGE ", ckb: "هەمان" } };
    expect(kinds([make(same), make({ prompt: { de: "gleiche frage", ckb: "هەمان" } })])).toContain("duplicate_content");
    expect(contentFingerprint(make(same))).toBe(contentFingerprint(make({ prompt: { de: "gleiche frage", ckb: "x" } })));
  });
  it("a duplicate does not count towards the bank", () => {
    const a = make();
    expect(catalogReport([a, { ...a }, make()], { target: 3 })).toMatchObject({ total: 3, valid: 1, missing: 2 });
  });
  it("supports one, two or three correct answers and rejects a broken answer key", () => {
    const three = [{ id: "a", text: { de: "A", ckb: "ا" } }, { id: "b", text: { de: "B", ckb: "ب" } }, { id: "c", text: { de: "C", ckb: "ج" } }];
    const r = catalogReport([make({ correct: ["a"] }), make({ options: three, correct: ["a", "b"] }), make({ options: three, correct: ["a", "b", "c"] })]);
    expect(r.issues).toEqual([]);
    expect(r.byCorrectCount).toEqual({ 1: 1, 2: 1, 3: 1 });
    expect(kinds([make({ correct: [] })])).toEqual(["invalid_answer_key"]);
    expect(kinds([make({ correct: ["z"] })])).toEqual(["invalid_answer_key"]);
    expect(kinds([make({ correct: ["a", "a"] })])).toEqual(["invalid_answer_key"]);
    expect(kinds([make({ answerType: "number", options: [], correct: [] })])).toEqual(["invalid_answer_key"]);
    expect(kinds([make({ answerType: "number", options: [], correct: [], numericAnswer: 40 })])).toEqual([]);
  });
  it("reports incomplete records: points, translations, explanation", () => {
    expect(kinds([make({ points: null })])).toEqual(["missing_points"]);
    expect(kinds([make({ prompt: { de: "", ckb: "پرسیار" } })])).toEqual(["missing_german"]);
    expect(kinds([make({ prompt: { de: "Nur Deutsch", ckb: "" } })])).toEqual(["missing_sorani"]);
    expect(kinds([make({ explanation: { de: "", ckb: "" } })])).toEqual(["missing_explanation"]);
    // A missing translation is not blocking, but the record is not ready for learners.
    expect(catalogReport([make({ prompt: { de: "Nur Deutsch", ckb: "" } })], { target: 1 })).toMatchObject({ valid: 1, ready: 0, complete: false });
  });
  it("validates media: alt text, existing file, video poster", () => {
    const img = { kind: "image" as const, key: "media/aa.webp", alt: { de: "Kreuzung", ckb: "چوارڕێیان" } };
    expect(kinds([make({ media: [img] })], { mediaKeys: new Set(["media/aa.webp"]) })).toEqual([]);
    expect(kinds([make({ media: [img] })], { mediaKeys: new Set() })).toEqual(["media_not_found"]);
    expect(kinds([make({ media: [{ ...img, alt: { de: "", ckb: "" } }] })])).toEqual(["missing_media_alt"]);
    expect(kinds([make({ media: [{ ...img, kind: "video" }] })])).toEqual(["video_without_poster"]);
    expect(catalogReport([make({ media: [img] }), make({ media: [{ ...img, key: "media/bb.mp4", kind: "video", posterKey: "media/aa.webp" }] })])).toMatchObject({ withImage: 1, withVideo: 1 });
  });
  it("never accepts official content without licence, number and catalogue version", () => {
    expect(kinds([make({ sourceType: "licensed_official" })]).sort()).toEqual(["official_without_catalogue_version", "official_without_code", "official_without_licence"]);
    expect(kinds([make({ questionCode: "1.1.01-001" })])).toEqual(["original_with_official_code"]);
    expect(catalogReport([make({ sourceType: "licensed_official" })], { target: 1 }).valid).toBe(0);
  });
});
