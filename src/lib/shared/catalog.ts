/**
 * Question-bank coverage report. Counts only what really exists and passes validation, so the bank can
 * never be reported as complete while records are missing, unreviewed, unlicensed or broken.
 * Pure and runtime-agnostic (owner workbench, tests, scripts).
 */
import type { Question } from "../../content/types";

/** Owner target for the Klasse B bank. A planning number, not a statement about the official catalogue. */
export const CATALOG_TARGET = 1600;

export type CatalogIssueKind =
  | "duplicate_id" | "duplicate_code" | "duplicate_content"
  | "invalid_answer_key" | "missing_points" | "missing_german" | "missing_sorani" | "missing_explanation"
  | "missing_media_alt" | "media_not_found" | "video_without_poster" | "media_not_approved"
  | "official_without_licence" | "official_without_code" | "official_without_catalogue_version" | "original_with_official_code";

export interface CatalogIssue { questionId: string; kind: CatalogIssueKind; detail?: string }

/** Issues that make a record unusable. The rest are warnings that still block approval. */
const BLOCKING: ReadonlySet<CatalogIssueKind> = new Set<CatalogIssueKind>([
  "duplicate_id", "duplicate_code", "duplicate_content", "invalid_answer_key", "missing_points", "missing_german",
  "media_not_found", "official_without_licence", "official_without_code", "official_without_catalogue_version", "original_with_official_code",
]);

export interface CatalogReport {
  target: number;
  total: number;
  /** Records without any blocking issue. */
  valid: number;
  /** Valid, human-approved and published: the only records a learner may see in production. */
  ready: number;
  /** Records still needed to reach the target (counted against `valid`, never against `total`). */
  missing: number;
  /** True only when at least `target` records are ready. */
  complete: boolean;
  bySource: { original: number; licensed_official: number };
  byReview: { draft: number; pending: number; approved: number };
  byCategory: { Grundstoff: number; Zusatzstoff: number };
  byCorrectCount: Record<number, number>;
  withImage: number;
  withVideo: number;
  issues: CatalogIssue[];
  issueCounts: Partial<Record<CatalogIssueKind, number>>;
}

const norm = (s: string | undefined) => (s ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** Same German question text and the same set of German answers = the same question, whatever the id. */
export function contentFingerprint(q: Question): string {
  const options = q.options.map((o) => norm(o.text.de)).sort().join("|");
  const media = (q.media ?? []).map((m) => m.key).sort().join("|");
  return `${norm(q.prompt.de)}#${options}#${q.numericAnswer ?? ""}#${media}`;
}

export interface CatalogOptions {
  target?: number;
  /** Storage keys that really exist. When given, every referenced media key must be in it. */
  mediaKeys?: ReadonlySet<string>;
  /**
   * Storage keys whose provenance and scenario review passed (see mediaManifest.ts). When given, a question
   * using any other media file is not ready for learners.
   */
  approvedMediaKeys?: ReadonlySet<string>;
}

export function catalogReport(questions: readonly Question[], opts: CatalogOptions = {}): CatalogReport {
  const target = opts.target ?? CATALOG_TARGET;
  const issues: CatalogIssue[] = [];
  const add = (questionId: string, kind: CatalogIssueKind, detail?: string) => issues.push({ questionId, kind, detail });
  const ids = new Map<string, number>();
  const codes = new Map<string, string>();
  const prints = new Map<string, string>();

  for (const q of questions) {
    ids.set(q.id, (ids.get(q.id) ?? 0) + 1);
    if (ids.get(q.id)! > 1) add(q.id, "duplicate_id");
    if (q.questionCode) {
      const first = codes.get(q.questionCode);
      if (first !== undefined) add(q.id, "duplicate_code", `same official number as ${first}`); else codes.set(q.questionCode, q.id);
    }
    if (norm(q.prompt.de)) {
      const fp = contentFingerprint(q);
      const first = prints.get(fp);
      if (first !== undefined && first !== q.id) add(q.id, "duplicate_content", `same content as ${first}`); else prints.set(fp, q.id);
    }

    if (q.points === null) add(q.id, "missing_points");
    if (!norm(q.prompt.de) || q.options.some((o) => !norm(o.text.de))) add(q.id, "missing_german");
    if (!norm(q.prompt.ckb) || q.options.some((o) => !norm(o.text.ckb))) add(q.id, "missing_sorani");
    if (!norm(q.explanation.de) || !norm(q.explanation.ckb)) add(q.id, "missing_explanation");

    if (q.answerType === "number") {
      if (typeof q.numericAnswer !== "number" || !Number.isFinite(q.numericAnswer)) add(q.id, "invalid_answer_key", "number question without a numeric answer");
    } else {
      const optionIds = q.options.map((o) => o.id);
      const key = new Set(q.correct);
      if (q.options.length < 2 || new Set(optionIds).size !== optionIds.length) add(q.id, "invalid_answer_key", "needs at least two distinct options");
      else if (q.correct.length === 0 || key.size !== q.correct.length || !q.correct.every((c) => optionIds.includes(c))) add(q.id, "invalid_answer_key", "correct answers do not match the options");
    }

    for (const m of q.media ?? []) {
      if (!norm(m.alt.de)) add(q.id, "missing_media_alt", m.key);
      if (opts.mediaKeys && !opts.mediaKeys.has(m.key)) add(q.id, "media_not_found", m.key);
      if (opts.mediaKeys && m.posterKey && !opts.mediaKeys.has(m.posterKey)) add(q.id, "media_not_found", m.posterKey);
      if (m.kind === "video" && !m.posterKey) add(q.id, "video_without_poster", m.key);
      if (opts.approvedMediaKeys && !opts.approvedMediaKeys.has(m.key)) add(q.id, "media_not_approved", m.key);
      if (opts.approvedMediaKeys && m.posterKey && !opts.approvedMediaKeys.has(m.posterKey)) add(q.id, "media_not_approved", m.posterKey);
    }

    if (q.sourceType === "licensed_official") {
      if (!q.licenseId) add(q.id, "official_without_licence");
      if (!q.questionCode) add(q.id, "official_without_code");
      if (!q.catalogueVersion) add(q.id, "official_without_catalogue_version");
    } else if (q.questionCode !== null) add(q.id, "original_with_official_code");
  }

  const blocked = new Set(issues.filter((i) => BLOCKING.has(i.kind)).map((i) => i.questionId));
  const flagged = new Set(issues.map((i) => i.questionId));
  const validQs = questions.filter((q) => !blocked.has(q.id));
  // A duplicate id blocks every copy, so count distinct ids only.
  const valid = new Set(validQs.map((q) => q.id)).size;
  const ready = new Set(validQs.filter((q) => !flagged.has(q.id) && q.reviewStatus === "approved" && q.publicationStatus === "published").map((q) => q.id)).size;

  const issueCounts: CatalogReport["issueCounts"] = {};
  for (const i of issues) issueCounts[i.kind] = (issueCounts[i.kind] ?? 0) + 1;
  const count = <K extends string>(keys: readonly K[], of: (q: Question) => K) => {
    const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
    for (const q of questions) out[of(q)]++;
    return out;
  };
  const byCorrectCount: Record<number, number> = {};
  for (const q of questions) if (q.answerType !== "number") byCorrectCount[q.correct.length] = (byCorrectCount[q.correct.length] ?? 0) + 1;

  return {
    target, total: questions.length, valid, ready,
    missing: Math.max(0, target - valid),
    complete: ready >= target,
    bySource: count(["original", "licensed_official"] as const, (q) => q.sourceType),
    byReview: count(["draft", "pending", "approved"] as const, (q) => q.reviewStatus),
    byCategory: count(["Grundstoff", "Zusatzstoff"] as const, (q) => q.categoryType),
    byCorrectCount,
    withImage: questions.filter((q) => q.media?.some((m) => m.kind === "image")).length,
    withVideo: questions.filter((q) => q.media?.some((m) => m.kind === "video")).length,
    issues, issueCounts,
  };
}
