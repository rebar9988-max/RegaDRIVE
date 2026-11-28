import { describe, expect, it } from "vitest";
import { CATALOGUE_BLOCKERS, checkRow, isReadyForApproval, checkTranslation, numbersOf, rowBlockers, summarise, toWesternDigits } from "../../worker/italy/stagingChecks";

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);
const base = { image: null, ckb_status: "pending", kmr_arab_status: "pending", chapter_confidence: null };

describe("automatic translation checks of the staged Italian catalogue", () => {
  it("reads Kurdish digits and the Kurdish decimal separator", () => {
    expect(toWesternDigits("٣٫٥ تەن و ١٢٠ کم")).toBe("3,5 تەن و 120 کم");
    expect(numbersOf("massa superiore a 3,5 tonnellate")).toEqual(["3", "5"]);
    // A digit glued to a long word is a source typo, not a quantity; "cm3" keeps its digit.
    expect(numbersOf("pannello riprodott0 in figura")).toEqual([]);
    expect(numbersOf("fino a 125 cm3")).toEqual(["125", "3"]);
  });

  it("accepts a correct Sorani and Badini pair", () => {
    const italian = "La distanza minima di sicurezza se si viaggia a 50 km/h deve essere di circa 14 metri";
    expect(checkTranslation("ckb", "کەمترین دووریی سەلامەتی ئەگەر بە خێراییی ٥٠ کم/کاتژمێر بڕۆیت دەبێت نزیکەی ١٤ مەتر بێت.", italian)).toEqual([]);
    expect(checkTranslation("kmrArab", "کێمترین دویراتیا سلامەتیێ ئەگەر ب لەزا ٥٠ کم/دەمژمێر بچی دڤێت نێزیکی ١٤ مەتر بیت.", italian)).toEqual([]);
  });

  it("finds missing text, wrong script and numbers that differ from the Italian", () => {
    const italian = "La distanza di sicurezza deve essere di almeno 100 metri";
    expect(codes(checkTranslation("ckb", "", italian))).toEqual(["MISSING"]);
    expect(codes(checkTranslation("ckb", null, italian))).toEqual(["MISSING"]);
    expect(codes(checkTranslation("ckb", "distanza", italian))).toContain("NOT_ARABIC_SCRIPT");
    expect(codes(checkTranslation("ckb", "دووریی سەلامەتی دەبێت لانیکەم ٥٠ مەتر بێت.", italian))).toContain("NUMBERS_DIFFER");
  });

  it("keeps Badini free of Sorani letters, Sorani grammar and Latin-script Kurmanji", () => {
    const italian = "La strada è bagnata";
    expect(codes(checkTranslation("kmrArab", "ڕێک تەڕە و دڵ", italian))).toContain("SORANI_LETTER_IN_BADINI");
    expect(codes(checkTranslation("kmrArab", "ڕێک تەڕە دەبێت بوەستی", italian))).toContain("SORANI_FORM_IN_BADINI");
    expect(codes(checkTranslation("kmrArab", "ڕێک şil e", italian))).toContain("LATIN_KURMANJI_IN_BADINI");
    expect(codes(checkTranslation("ckb", "ڕێگاکە دڤێت تەڕ بێت", italian))).toContain("BADINI_FORM_IN_SORANI");
  });

  it("warns, but does not fail, on heuristic findings", () => {
    const italian = "Il sorpasso non è consentito";
    const issues = checkTranslation("ckb", "تێپەڕاندن ڕێگەپێدراوە", italian);
    expect(issues).toEqual([{ code: "NEGATION_NOT_FOUND", severity: "warning" }]);
    expect(checkTranslation("ckb", "تێپەڕاندن ڕێگەپێدراو نییە", italian)).toEqual([]);
    // A Latin code the Italian also carries is not a foreign word.
    expect(checkTranslation("ckb", "نیشانەی «STOP»", "Il segnale STOP")).toEqual([]);
    expect(codes(checkTranslation("ckb", "نیشانەی GPS", "Il segnale"))).toEqual(["UNKNOWN_LATIN_WORD"]);
  });
});

describe("publication blockers", () => {
  const row = { ...base, question_it: "La strada è bagnata", ckb: "ڕێگاکە تەڕە", kmr_arab: "ڕێک تەڕە" };

  it("lists what still stops a row, and never says a row is ready on machine checks alone", () => {
    expect(rowBlockers(row)).toEqual(["CKB_NOT_APPROVED", "KMR_ARAB_NOT_APPROVED"]);
    expect(rowBlockers({ ...row, image: "images/it_1.jpg", chapter_confidence: "needs_review", kmr_arab_status: "needs_revision" }))
      .toEqual(["CKB_NOT_APPROVED", "KMR_ARAB_NOT_APPROVED", "NEEDS_REVISION", "CHAPTER_UNCONFIRMED", "IMAGE_RIGHTS_UNVERIFIED"]);
    expect(rowBlockers({ ...row, kmr_arab: "ڕێک دڵ" })).toContain("AUTOMATIC_CHECK_ERROR");
    expect(rowBlockers({ ...row, ckb_status: "approved", kmr_arab_status: "approved" })).toEqual([]);
  });

  it("summarises the catalogue with publishable fixed at zero while catalogue-wide blockers remain", () => {
    const sum = summarise([row, { ...row, kmr_arab: "ڕێک دڵ" }, { ...row, ckb_status: "approved", kmr_arab_status: "approved" }]);
    expect(sum.total).toBe(3);
    expect(sum.checks).toMatchObject({ rowsWithErrors: 1, rowsClean: 2 });
    expect(sum.checks.byCode.SORANI_LETTER_IN_BADINI).toEqual({ ckb: 0, kmrArab: 1 });
    expect(sum.readyForHumanReview).toBe(2);
    expect(sum.rowBlockers.CKB_NOT_APPROVED).toBe(2);
    expect(sum.catalogueBlockers).toEqual(CATALOGUE_BLOCKERS);
    expect(sum.publishable).toBe(0);
    expect(checkRow(row)).toMatchObject({ errors: 0, warnings: 0 });
  });

  it("puts a row in the final-approval queue only while a language is pending and nothing blocks it", () => {
    expect(isReadyForApproval(row)).toBe(true);
    expect(isReadyForApproval({ ...row, kmr_arab: "ڕێک دڵ" })).toBe(false);
    expect(isReadyForApproval({ ...row, ckb_status: "needs_revision" })).toBe(false);
    expect(isReadyForApproval({ ...row, ckb_status: "approved", kmr_arab_status: "approved" })).toBe(false);
    expect(isReadyForApproval({ ...row, ckb_status: "approved" })).toBe(true);
    const sum = summarise([{ ...row, chapter_draft: 3 }, { ...row, chapter_draft: 3 }, { ...row, chapter_draft: null }]);
    expect(sum.readyForFinalApproval).toEqual({ total: 3, withWarnings: 0, byChapter: { "3": 2, "0": 1 } });
  });
});
