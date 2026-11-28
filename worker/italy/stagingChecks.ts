/**
 * Automatic checks of the staged Italian catalogue's draft translations (Sorani `ckb`, Duhok Badini
 * `kmrArab`), and the reasons a staged question cannot be published yet.
 *
 * The checks are computed on read from the stored text, so they always describe the current wording and
 * need no schema change. They are machine checks only: a clean result is never a review. Approval stays a
 * decision by a named human (worker/italy/stagingReview.ts, worker/dr/reviews.ts checkReviewMetadata).
 *
 * Severity: an `error` is a defect that must be fixed before a reviewer should spend time on the row
 * (missing text, wrong script, numbers that differ from the Italian, Sorani letters in Badini). A `warning`
 * is a heuristic hint a reviewer should look at (it can be a false alarm, e.g. a negation written inside
 * one word such as «ڕوونادات»).
 */

export type CheckLanguage = "ckb" | "kmrArab";
export type CheckSeverity = "error" | "warning";
export interface CheckIssue { code: CheckCode; severity: CheckSeverity }

export const CHECK_CODES = [
  "MISSING",
  "NOT_ARABIC_SCRIPT",
  "NUMBERS_DIFFER",
  "SORANI_LETTER_IN_BADINI",
  "LATIN_KURMANJI_IN_BADINI",
  "SORANI_FORM_IN_BADINI",
  "BADINI_FORM_IN_SORANI",
  "UNKNOWN_LATIN_WORD",
  "NEGATION_NOT_FOUND",
] as const;
export type CheckCode = (typeof CHECK_CODES)[number];

const SEVERITY: Record<CheckCode, CheckSeverity> = {
  MISSING: "error",
  NOT_ARABIC_SCRIPT: "error",
  NUMBERS_DIFFER: "error",
  SORANI_LETTER_IN_BADINI: "error",
  LATIN_KURMANJI_IN_BADINI: "error",
  SORANI_FORM_IN_BADINI: "warning",
  BADINI_FORM_IN_SORANI: "warning",
  UNKNOWN_LATIN_WORD: "warning",
  NEGATION_NOT_FOUND: "warning",
};

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿]/;
const EASTERN_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Kurdish/Persian digits become Western digits; the Kurdish decimal separator «٫» becomes «,». */
export function toWesternDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(EASTERN_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/٫/g, ",");
}

/**
 * The numbers of a text, sorted, for comparing the translation with the Italian. A digit glued to a Latin
 * word of four or more letters (the source typo "riprodott0") is not a quantity and is ignored; short unit
 * tokens such as "cm3" keep their digit, because the translation writes it too.
 */
export function numbersOf(s: string): string[] {
  return (toWesternDigits(s).replace(/[A-Za-zÀ-ÿ]{4,}\d+/g, "").match(/\d+/g) ?? []).sort();
}

const IT_NEGATION = /(^|[^\p{L}])(non|né|nessun[oa]?|mai|vietat[oaie]|divieto|proibit[oaie])(?![\p{L}])/iu;
const KU_NEGATION = /(^|[\s،(])(نا|نە|نی|مە|نین|ناب|نەب|نەد|ناد|نەک)|قەدەغە|نینە|نییە|بێ/;
/** Sorani grammar that Duhok Badini never uses (present tense دە‑, Sorani prepositions and pronouns). */
const SORANI_IN_BADINI = /(^|\s)(دە[کبچڕگزهن]\S*ات|دەبێت|دەکرێت|دەتوانێت|دەچێت|لەگەڵ|ئەگەرچی|ئێستا|زۆر|لەسەر|لەبەر|تۆ|ئێمە|ئێوە|چۆن|بۆچی)(?=\s|$|[.،؟])/;
/** Badini grammar that standard Sorani does not use. */
const BADINI_IN_SORANI = /(^|\s)(دکەت|دبیت|دڤێت|دشێت|دگەل|ژ|ئەڤ|ئەڤە|هەمی|گەلەک|بو|نینە)(?=\s|$|[.،؟])/;
/** Latin-script Kurmanji (Hawar) letters: Badini is Arabic script only. */
const HAWAR = /[şŞçÇêÊîÎûÛ]/;
const LATIN_WORD = /[A-Za-zÀ-ÿ]+/g;

/** The automatic checks of one translation against its Italian source. */
export function checkTranslation(language: CheckLanguage, text: string | null, italian: string): CheckIssue[] {
  const codes: CheckCode[] = [];
  const value = (text ?? "").trim();
  if (!value) return [{ code: "MISSING", severity: SEVERITY.MISSING }];
  if (!ARABIC.test(value)) codes.push("NOT_ARABIC_SCRIPT");
  if (numbersOf(italian).join(",") !== numbersOf(value).join(",")) codes.push("NUMBERS_DIFFER");
  if (language === "kmrArab") {
    if (/ڵ/.test(value)) codes.push("SORANI_LETTER_IN_BADINI");
    if (HAWAR.test(value)) codes.push("LATIN_KURMANJI_IN_BADINI");
    if (SORANI_IN_BADINI.test(value)) codes.push("SORANI_FORM_IN_BADINI");
  } else if (BADINI_IN_SORANI.test(value)) {
    codes.push("BADINI_FORM_IN_SORANI");
  }
  // Proper names and codes the Italian also carries (STOP, GPL, A.B.S., Suv) are not foreign words.
  const latin = (value.match(LATIN_WORD) ?? []).filter((w) => !italian.includes(w));
  if (latin.length) codes.push("UNKNOWN_LATIN_WORD");
  if (IT_NEGATION.test(italian) && !KU_NEGATION.test(value)) codes.push("NEGATION_NOT_FOUND");
  return codes.map((code) => ({ code, severity: SEVERITY[code] }));
}

export interface RowChecks { ckb: CheckIssue[]; kmrArab: CheckIssue[]; errors: number; warnings: number }

export function checkRow(row: { question_it: string; ckb: string | null; kmr_arab: string | null }): RowChecks {
  const ckb = checkTranslation("ckb", row.ckb, row.question_it);
  const kmrArab = checkTranslation("kmrArab", row.kmr_arab, row.question_it);
  const all = [...ckb, ...kmrArab];
  return { ckb, kmrArab, errors: all.filter((i) => i.severity === "error").length, warnings: all.filter((i) => i.severity === "warning").length };
}

/**
 * Why a staged question cannot reach a learner yet. Per-row blockers depend on the row; catalogue-wide
 * blockers are true of every staged row because the staging table has no place for that information
 * (rights, explanation, legal reference) or because the row is not in the reviewable content yet. None
 * of these can be cleared by software: each needs a document or a decision by a named person.
 */
export const ROW_BLOCKERS = [
  "CKB_NOT_APPROVED",
  "KMR_ARAB_NOT_APPROVED",
  "NEEDS_REVISION",
  "AUTOMATIC_CHECK_ERROR",
  "AUTOMATIC_CHECK_WARNING",
  "CHAPTER_UNCONFIRMED",
  "IMAGE_RIGHTS_UNVERIFIED",
] as const;
export type RowBlocker = (typeof ROW_BLOCKERS)[number];

export const CATALOGUE_BLOCKERS = [
  "TEXT_RIGHTS_UNVERIFIED",
  "NO_EXPLANATION",
  "NO_LEGAL_REFERENCE",
  "NOT_IN_REVIEW_PIPELINE",
  "IMAGES_NOT_HOSTED",
] as const;
export type CatalogueBlocker = (typeof CATALOGUE_BLOCKERS)[number];

export interface BlockerInput {
  question_it: string; ckb: string | null; kmr_arab: string | null; image: string | null;
  ckb_status: string; kmr_arab_status: string; chapter_confidence: string | null; chapter_draft?: number | null;
}

/** In the final-approval queue: no check error, no revision request, at least one language still pending. */
export function isReadyForApproval(row: BlockerInput, checks: RowChecks = checkRow(row)): boolean {
  const pending = row.ckb_status === "pending" || row.kmr_arab_status === "pending";
  const revision = row.ckb_status === "needs_revision" || row.kmr_arab_status === "needs_revision";
  return checks.errors === 0 && pending && !revision;
}

export function rowBlockers(row: BlockerInput, checks: RowChecks = checkRow(row)): RowBlocker[] {
  const out: RowBlocker[] = [];
  if (row.ckb_status !== "approved") out.push("CKB_NOT_APPROVED");
  if (row.kmr_arab_status !== "approved") out.push("KMR_ARAB_NOT_APPROVED");
  if (row.ckb_status === "needs_revision" || row.kmr_arab_status === "needs_revision") out.push("NEEDS_REVISION");
  if (checks.errors > 0) out.push("AUTOMATIC_CHECK_ERROR");
  if (checks.warnings > 0) out.push("AUTOMATIC_CHECK_WARNING");
  if (row.chapter_confidence === "needs_review") out.push("CHAPTER_UNCONFIRMED");
  if (row.image) out.push("IMAGE_RIGHTS_UNVERIFIED");
  return out;
}

export interface CatalogueSummary {
  total: number;
  checks: { rowsWithErrors: number; rowsWithWarnings: number; rowsClean: number; byCode: Record<string, { ckb: number; kmrArab: number }> };
  rowBlockers: Record<RowBlocker, number>;
  catalogueBlockers: readonly CatalogueBlocker[];
  /** Rows a reviewer can approve without first fixing anything the machine found. */
  readyForHumanReview: number;
  /** The final-approval queue (isReadyForApproval), in total and per draft chapter ("0" = no chapter). */
  readyForFinalApproval: { total: number; withWarnings: number; byChapter: Record<string, number> };
  publishable: 0;
}

/** Summarise every staged row. `publishable` is always 0: the catalogue-wide blockers apply to all rows. */
export function summarise(rows: BlockerInput[]): CatalogueSummary {
  const byCode: Record<string, { ckb: number; kmrArab: number }> = Object.fromEntries(CHECK_CODES.map((c) => [c, { ckb: 0, kmrArab: 0 }]));
  const blockerCounts = Object.fromEntries(ROW_BLOCKERS.map((b) => [b, 0])) as Record<RowBlocker, number>;
  let rowsWithErrors = 0, rowsWithWarnings = 0, rowsClean = 0, ready = 0;
  const queue = { total: 0, withWarnings: 0, byChapter: {} as Record<string, number> };
  for (const row of rows) {
    const checks = checkRow(row);
    for (const i of checks.ckb) byCode[i.code]!.ckb++;
    for (const i of checks.kmrArab) byCode[i.code]!.kmrArab++;
    if (checks.errors) rowsWithErrors++;
    if (checks.warnings) rowsWithWarnings++;
    if (!checks.errors && !checks.warnings) rowsClean++;
    if (!checks.errors) ready++;
    for (const b of rowBlockers(row, checks)) blockerCounts[b]++;
    if (isReadyForApproval(row, checks)) {
      queue.total++;
      if (checks.warnings) queue.withWarnings++;
      const ch = String(row.chapter_draft ?? 0);
      queue.byChapter[ch] = (queue.byChapter[ch] ?? 0) + 1;
    }
  }
  return {
    total: rows.length,
    checks: { rowsWithErrors, rowsWithWarnings, rowsClean, byCode },
    rowBlockers: blockerCounts,
    catalogueBlockers: CATALOGUE_BLOCKERS,
    readyForHumanReview: ready,
    readyForFinalApproval: queue,
    publishable: 0,
  };
}
