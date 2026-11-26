/**
 * /dr Content Review & Approval: the Verkehrszeichen release (signs + sign quiz) and the Italian
 * section (Italian signs + true/false questions).
 *
 * Publication stays decided by the existing fail-closed publicationGate: human review rows from D1 are merged
 * into the bundled content record, and an item becomes visible only when the gate passes. Nothing is ever
 * inserted by the system itself, and a row only counts while the content fingerprint it was recorded for is
 * still the fingerprint of the content that ships.
 */
import { CONTENT_REGISTRY } from "../../src/content/registry";
import { publicationGate, type ContentRecord, type ReviewRecord } from "../../src/content/pipeline";
import { SIGN_QUIZ } from "../../src/content/signQuiz";
import { REVIEW_ITEMS, type ReviewItem } from "../../src/content/reviewItems";
import { IT_REVIEW_ITEMS, type ItReviewItem } from "../../src/content/italy/reviewItems";
import { IT_CONTENT_REGISTRY, IT_RULES_VERSION } from "../../src/content/italy/registry";
import { IT_QUESTIONS } from "../../src/content/italy/questions";
import { KLASSE_B_RULES_2026 } from "../../src/lib/shared/exam";
import type { D1Like } from "./db";

/**
 * Every item a human reviews, from both content systems. The two banks stay separate — each item is
 * evaluated against its own registry and its own exam rules — but they share one review table, one
 * screen and one fail-closed gate.
 */
export type AnyReviewItem = ReviewItem | ItReviewItem;
export type ReviewContentKind = AnyReviewItem["kind"];
export const ALL_REVIEW_ITEMS: AnyReviewItem[] = [...REVIEW_ITEMS, ...IT_REVIEW_ITEMS];
export const REVIEW_ITEM_BY_ID: ReadonlyMap<string, AnyReviewItem> = new Map(ALL_REVIEW_ITEMS.map((i) => [i.id, i]));
const isItalian = (kind: ReviewContentKind): boolean => kind === "itSign" || kind === "itQuestion";
/** The exam-rule release an item of this kind is validated against. */
export const rulesVersionFor = (kind: ReviewContentKind): string => (isItalian(kind) ? IT_RULES_VERSION : KLASSE_B_RULES_2026.version);

export const REVIEW_STAGES = ["TRANSLATION_REVIEW", "EDUCATIONAL_REVIEW", "APPROVED"] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];
export const ROLE_FOR_STAGE: Record<ReviewStage, ReviewRecord["role"]> = {
  TRANSLATION_REVIEW: "sorani_translator",
  EDUCATIONAL_REVIEW: "driving_instructor",
  APPROVED: "content_owner",
};
/** Earliest plausible review date: the content did not exist before this. */
export const EARLIEST_REVIEW_DATE = "2026-11-06";

/** Which review table a row lives in: the German Verkehrszeichen table or the Italian one. */
export type ReviewSource = "de" | "it";
export const REVIEW_TABLE: Record<ReviewSource, string> = { de: "dr_content_reviews", it: "dr_it_content_reviews" };
export const sourceFor = (kind: ReviewContentKind): ReviewSource => (isItalian(kind) ? "it" : "de");

export interface ReviewRow {
  id: number; source: ReviewSource; content_id: string; content_kind: ReviewContentKind; content_hash: string; content_version: string;
  stage: ReviewStage; outcome: "pass" | "fail"; reviewer_name: string; reviewer_role: ReviewRecord["role"];
  reviewed_on: string; evidence_ref: string; note: string; rules_version: string | null;
  recorded_by: string; recorded_at: number; revoked_at: number | null; revoked_by: string | null; revoke_reason: string | null;
}

/** Rows that count for an item: not revoked and recorded for the content that ships today. */
export function activeRows(item: AnyReviewItem, rows: ReviewRow[]): ReviewRow[] {
  const src = sourceFor(item.kind);
  return rows.filter((r) => r.source === src && r.content_id === item.id && r.revoked_at === null && r.content_hash === item.hash);
}

/** Latest active decision per stage. */
function latestByStage(rows: ReviewRow[]): Partial<Record<ReviewStage, ReviewRow>> {
  const out: Partial<Record<ReviewStage, ReviewRow>> = {};
  for (const r of [...rows].sort((a, b) => a.recorded_at - b.recorded_at || a.id - b.id)) out[r.stage] = r;
  return out;
}

export interface ItemState {
  id: string;
  kind: ReviewContentKind;
  hash: string;
  status: "PUBLISHED" | "APPROVED_WAITING" | "EDUCATIONAL_REVIEW_DONE" | "TRANSLATION_REVIEW_DONE" | "AWAITING_REVIEW" | "REJECTED";
  publishable: boolean;
  reasons: string[];
  stages: Record<ReviewStage, { state: "pass" | "fail" | "pending"; reviewer?: string; role?: string; reviewedOn?: string; evidenceRef?: string; note?: string; rowId?: number; rowSource?: ReviewSource }>;
}

/** Evaluate one item with the real publication gate. Only the latest active decision per stage is used. */
export function evaluate(item: AnyReviewItem, rows: ReviewRow[]): ItemState {
  const italian = isItalian(item.kind);
  const base = italian ? IT_CONTENT_REGISTRY.get(item.id) : CONTENT_REGISTRY.get(item.id);
  const mine = latestByStage(activeRows(item, rows));
  const stages = {} as ItemState["stages"];
  for (const s of REVIEW_STAGES) {
    const r = mine[s];
    stages[s] = r ? { state: r.outcome, reviewer: r.reviewer_name, role: r.reviewer_role, reviewedOn: r.reviewed_on, evidenceRef: r.evidence_ref, note: r.note, rowId: r.id, rowSource: r.source } : { state: "pending" };
  }
  if (!base) return { id: item.id, kind: item.kind, hash: item.hash, status: "AWAITING_REVIEW", publishable: false, reasons: ["no content record"], stages };

  const human: ReviewRecord[] = Object.values(mine).map((r) => ({
    stage: r!.stage, reviewer: r!.reviewer_name, role: r!.reviewer_role, date: r!.reviewed_on, evidenceRef: r!.evidence_ref, outcome: r!.outcome,
  }));
  const eduRules = mine.EDUCATIONAL_REVIEW?.outcome === "pass" ? mine.EDUCATIONAL_REVIEW.rules_version : null;
  const merged: ContentRecord = {
    ...base,
    stage: mine.APPROVED?.outcome === "pass" ? "APPROVED" : mine.EDUCATIONAL_REVIEW?.outcome === "pass" ? "EDUCATIONAL_REVIEW" : "TRANSLATION_REVIEW",
    reviews: [...base.reviews, ...human],
    validatedAgainstRules: base.kind === "question" ? eduRules : base.validatedAgainstRules,
  };
  // The German gate inspects option-id answers; Italian questions are true/false and are checked below instead.
  const question = item.kind === "signQuiz" ? SIGN_QUIZ.find((q) => q.id === item.id) : undefined;
  const gate = publicationGate(merged, question, rulesVersionFor(item.kind));
  // Order is part of the process: an approval only counts on top of both earlier passes, and the item must validate.
  const reasons = [...gate.reasons];
  if (!item.valid) reasons.push("automatic validation failed");
  if (item.kind === "itQuestion") {
    const q = IT_QUESTIONS.find((x) => x.id === item.id);
    if (!q) reasons.push("Italian question not found");
    else {
      if (q.sourceType !== "original") reasons.push("Italian content must be original");
      if (q.questionCode !== null) reasons.push("original question carries an official code");
      if (q.publicationStatus !== "published") reasons.push("question is hidden");
      if (typeof q.answer !== "boolean") reasons.push("answer mapping invalid");
    }
  }
  if (mine.APPROVED?.outcome === "pass" && (mine.TRANSLATION_REVIEW?.outcome !== "pass" || mine.EDUCATIONAL_REVIEW?.outcome !== "pass")) reasons.push("approval without both reviews");
  const publishable = reasons.length === 0;
  const failed = Object.values(mine).some((r) => r!.outcome === "fail");
  const status: ItemState["status"] = publishable ? "PUBLISHED"
    : failed ? "REJECTED"
    : mine.APPROVED?.outcome === "pass" ? "APPROVED_WAITING"
    : mine.EDUCATIONAL_REVIEW?.outcome === "pass" ? "EDUCATIONAL_REVIEW_DONE"
    : mine.TRANSLATION_REVIEW?.outcome === "pass" ? "TRANSLATION_REVIEW_DONE" : "AWAITING_REVIEW";
  return { id: item.id, kind: item.kind, hash: item.hash, status, publishable, reasons, stages };
}

/**
 * Every review decision from both tables, oldest first. Row ids are per table, so each row carries the
 * table it came from and revoking one needs both. A table that cannot be read — the owner has not
 * applied its migration yet — yields no rows for that bank and never blocks the other one: fail closed
 * for the bank that is not ready, unchanged for the bank that is.
 */
export async function loadRows(db: D1Like): Promise<ReviewRow[]> {
  const { rows } = await loadRowsWithState(db);
  return rows;
}

export interface RowsState { rows: ReviewRow[]; ready: Record<ReviewSource, boolean> }

export async function loadRowsWithState(db: D1Like): Promise<RowsState> {
  const read = async (source: ReviewSource): Promise<ReviewRow[] | null> => {
    try {
      const r = await db.prepare(`SELECT * FROM ${REVIEW_TABLE[source]} ORDER BY recorded_at, id`).all<ReviewRow>();
      return r.results.map((x) => ({ ...x, source }));
    } catch { return null; }
  };
  const [de, it] = await Promise.all([read("de"), read("it")]);
  return {
    rows: [...(de ?? []), ...(it ?? [])].sort((a, b) => a.recorded_at - b.recorded_at || a.id - b.id),
    ready: { de: de !== null, it: it !== null },
  };
}

export function evaluateAll(rows: ReviewRow[]): ItemState[] {
  return ALL_REVIEW_ITEMS.map((i) => evaluate(i, rows));
}

export interface ApprovedContent {
  /** True when the review records could be read. False means nothing is published (fail closed). */
  ok: boolean;
  signs: Record<string, string>;
  signQuiz: Record<string, string>;
  itSigns: Record<string, string>;
  itQuestions: Record<string, string>;
  /** Per bank: whether its review table could be read at all. A bank that is not ready publishes nothing. */
  ready: Record<ReviewSource, boolean>;
}

/** Public: ids (with fingerprint) of everything the gate lets through. Fail closed: any error means nothing. */
export async function approvedContent(db: D1Like | undefined): Promise<ApprovedContent> {
  const empty = () => ({ signs: {} as Record<string, string>, signQuiz: {} as Record<string, string>, itSigns: {} as Record<string, string>, itQuestions: {} as Record<string, string> });
  const out: ApprovedContent = { ok: false, ...empty(), ready: { de: false, it: false } };
  if (!db) return out;
  try {
    const { rows, ready } = await loadRowsWithState(db);
    out.ready = ready;
    // A bank whose table could not be read publishes nothing, whatever the other bank does.
    for (const st of evaluateAll(rows)) {
      if (!st.publishable || !ready[sourceFor(st.kind)]) continue;
      out[st.kind === "sign" ? "signs" : st.kind === "signQuiz" ? "signQuiz" : st.kind === "itSign" ? "itSigns" : "itQuestions"][st.id] = st.hash;
    }
    out.ok = ready.de || ready.it;
  } catch { Object.assign(out, empty()); out.ready = { de: false, it: false }; out.ok = false; }
  return out;
}

// ── submissions ─────────────────────────────────────────────────────────────
const NOT_A_HUMAN = /claude|anthropic|\bai\b|gpt|chatgpt|gemini|bot\b|assistant|automat|pipeline|todo|tbd|n\/a|unknown/i;

export interface Submission { stage: ReviewStage; outcome: "pass" | "fail"; reviewerName: string; reviewedOn: string; evidenceRef: string; note: string; ids: string[]; confirm: boolean }

export function parseSubmission(body: unknown): Submission | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const stage = REVIEW_STAGES.find((s) => s === b.stage);
  if (!stage) return "BAD_STAGE";
  if (b.outcome !== "pass" && b.outcome !== "fail") return "BAD_OUTCOME";
  const ids = Array.isArray(b.ids) ? [...new Set(b.ids.filter((x): x is string => typeof x === "string"))] : [];
  if (ids.length === 0 || ids.length > 200) return "BAD_IDS";
  return { stage, outcome: b.outcome, reviewerName: str(b.reviewerName), reviewedOn: str(b.reviewedOn), evidenceRef: str(b.evidenceRef), note: str(b.note), ids, confirm: b.confirm === true };
}

/** Returns an error code, or null when the submission may be recorded for this item. */
export function checkSubmission(s: Submission, item: AnyReviewItem | undefined, rows: ReviewRow[], today: string): string | null {
  if (!item) return "UNKNOWN_ITEM";
  const metadataError = checkReviewMetadata(s, today);
  if (metadataError) return metadataError;
  if (s.outcome === "fail") return s.note.length < 5 ? "NOTE_REQUIRED_FOR_FAIL" : null;
  if (!s.confirm) return "CONFIRMATION_REQUIRED";
  if (!item.valid) return "VALIDATION_FAILED";
  const mine = latestByStage(activeRows(item, rows));
  if (s.stage === "EDUCATIONAL_REVIEW" && mine.TRANSLATION_REVIEW?.outcome !== "pass") return "TRANSLATION_REVIEW_FIRST";
  if (s.stage === "EDUCATIONAL_REVIEW" && mine.TRANSLATION_REVIEW?.reviewer_name.toLowerCase() === s.reviewerName.toLowerCase()) return "REVIEWERS_MUST_DIFFER";
  if (s.stage === "APPROVED" && (mine.TRANSLATION_REVIEW?.outcome !== "pass" || mine.EDUCATIONAL_REVIEW?.outcome !== "pass")) return "BOTH_REVIEWS_FIRST";
  return null;
}

export function checkReviewMetadata(s: Pick<Submission, "reviewerName" | "reviewedOn" | "evidenceRef" | "note">, today: string): string | null {
  if (s.reviewerName.length < 3 || s.reviewerName.length > 80 || NOT_A_HUMAN.test(s.reviewerName)) return "REVIEWER_NAME_INVALID";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.reviewedOn) || s.reviewedOn > today || s.reviewedOn < EARLIEST_REVIEW_DATE) return "REVIEW_DATE_INVALID";
  if (s.evidenceRef.length < 8 || s.evidenceRef.length > 300) return "EVIDENCE_REQUIRED";
  if (s.note.length > 500) return "NOTE_TOO_LONG";
  return null;
}

export function reviewInsert(s: Submission, item: AnyReviewItem, actor: string, now: number) {
  return {
    sql: `INSERT INTO ${REVIEW_TABLE[sourceFor(item.kind)]} (content_id, content_kind, content_hash, content_version, stage, outcome, reviewer_name, reviewer_role, reviewed_on, evidence_ref, note, rules_version, recorded_by, recorded_at)`,
    values: [item.id, item.kind, item.hash, item.contentVersion, s.stage, s.outcome, s.reviewerName, ROLE_FOR_STAGE[s.stage], s.reviewedOn, s.evidenceRef, s.note,
      s.stage === "EDUCATIONAL_REVIEW" && s.outcome === "pass" ? rulesVersionFor(item.kind) : null, actor, now],
  };
}

export async function recordReview(db: D1Like, s: Submission, item: AnyReviewItem, actor: string, now: number): Promise<void> {
  const { sql, values } = reviewInsert(s, item, actor, now);
  await db.prepare(`${sql} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(...values).run();
}

export { REVIEW_ITEMS, IT_REVIEW_ITEMS };
