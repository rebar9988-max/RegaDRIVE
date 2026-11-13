/**
 * /dr Content Review & Approval for the Verkehrszeichen release (signs + sign quiz).
 *
 * Publication stays decided by the existing fail-closed publicationGate: human review rows from D1 are merged
 * into the bundled content record, and an item becomes visible only when the gate passes. Nothing is ever
 * inserted by the system itself, and a row only counts while the content fingerprint it was recorded for is
 * still the fingerprint of the content that ships.
 */
import { CONTENT_REGISTRY } from "../../src/content/registry";
import { publicationGate, type ContentRecord, type ReviewRecord } from "../../src/content/pipeline";
import { SIGN_QUIZ } from "../../src/content/signQuiz";
import { REVIEW_ITEMS, REVIEW_ITEM_BY_ID, type ReviewItem } from "../../src/content/reviewItems";
import { KLASSE_B_RULES_2026 } from "../../src/lib/shared/exam";
import type { D1Like } from "./db";

export const REVIEW_STAGES = ["TRANSLATION_REVIEW", "EDUCATIONAL_REVIEW", "APPROVED"] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];
export const ROLE_FOR_STAGE: Record<ReviewStage, ReviewRecord["role"]> = {
  TRANSLATION_REVIEW: "sorani_translator",
  EDUCATIONAL_REVIEW: "driving_instructor",
  APPROVED: "content_owner",
};
/** Earliest plausible review date: the content did not exist before this. */
export const EARLIEST_REVIEW_DATE = "2026-11-06";

export interface ReviewRow {
  id: number; content_id: string; content_kind: "sign" | "signQuiz"; content_hash: string; content_version: string;
  stage: ReviewStage; outcome: "pass" | "fail"; reviewer_name: string; reviewer_role: ReviewRecord["role"];
  reviewed_on: string; evidence_ref: string; note: string; rules_version: string | null;
  recorded_by: string; recorded_at: number; revoked_at: number | null; revoked_by: string | null; revoke_reason: string | null;
}

/** Rows that count for an item: not revoked and recorded for the content that ships today. */
export function activeRows(item: ReviewItem, rows: ReviewRow[]): ReviewRow[] {
  return rows.filter((r) => r.content_id === item.id && r.revoked_at === null && r.content_hash === item.hash);
}

/** Latest active decision per stage. */
function latestByStage(rows: ReviewRow[]): Partial<Record<ReviewStage, ReviewRow>> {
  const out: Partial<Record<ReviewStage, ReviewRow>> = {};
  for (const r of [...rows].sort((a, b) => a.recorded_at - b.recorded_at || a.id - b.id)) out[r.stage] = r;
  return out;
}

export interface ItemState {
  id: string;
  kind: "sign" | "signQuiz";
  hash: string;
  status: "PUBLISHED" | "APPROVED_WAITING" | "EDUCATIONAL_REVIEW_DONE" | "TRANSLATION_REVIEW_DONE" | "AWAITING_REVIEW" | "REJECTED";
  publishable: boolean;
  reasons: string[];
  stages: Record<ReviewStage, { state: "pass" | "fail" | "pending"; reviewer?: string; role?: string; reviewedOn?: string; evidenceRef?: string; note?: string; rowId?: number }>;
}

/** Evaluate one item with the real publication gate. Only the latest active decision per stage is used. */
export function evaluate(item: ReviewItem, rows: ReviewRow[]): ItemState {
  const base = CONTENT_REGISTRY.get(item.id);
  const mine = latestByStage(activeRows(item, rows));
  const stages = {} as ItemState["stages"];
  for (const s of REVIEW_STAGES) {
    const r = mine[s];
    stages[s] = r ? { state: r.outcome, reviewer: r.reviewer_name, role: r.reviewer_role, reviewedOn: r.reviewed_on, evidenceRef: r.evidence_ref, note: r.note, rowId: r.id } : { state: "pending" };
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
  const question = item.kind === "signQuiz" ? SIGN_QUIZ.find((q) => q.id === item.id) : undefined;
  const gate = publicationGate(merged, question);
  // Order is part of the process: an approval only counts on top of both earlier passes, and the item must validate.
  const reasons = [...gate.reasons];
  if (!item.valid) reasons.push("automatic validation failed");
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

export async function loadRows(db: D1Like): Promise<ReviewRow[]> {
  return (await db.prepare("SELECT * FROM dr_content_reviews ORDER BY recorded_at, id").all<ReviewRow>()).results;
}

export function evaluateAll(rows: ReviewRow[]): ItemState[] {
  return REVIEW_ITEMS.map((i) => evaluate(i, rows));
}

/** Public: ids (with fingerprint) of everything the gate lets through. Fail closed: any error means nothing. */
export async function approvedContent(db: D1Like | undefined): Promise<{ ok: boolean; signs: Record<string, string>; signQuiz: Record<string, string> }> {
  const out = { ok: false, signs: {} as Record<string, string>, signQuiz: {} as Record<string, string> };
  if (!db) return out;
  try {
    const rows = await loadRows(db);
    for (const st of evaluateAll(rows)) if (st.publishable) (st.kind === "sign" ? out.signs : out.signQuiz)[st.id] = st.hash;
    out.ok = true;
  } catch { out.signs = {}; out.signQuiz = {}; }
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
export function checkSubmission(s: Submission, item: ReviewItem | undefined, rows: ReviewRow[], today: string): string | null {
  if (!item) return "UNKNOWN_ITEM";
  if (s.reviewerName.length < 3 || s.reviewerName.length > 80 || NOT_A_HUMAN.test(s.reviewerName)) return "REVIEWER_NAME_INVALID";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.reviewedOn) || s.reviewedOn > today || s.reviewedOn < EARLIEST_REVIEW_DATE) return "REVIEW_DATE_INVALID";
  if (s.evidenceRef.length < 8 || s.evidenceRef.length > 300) return "EVIDENCE_REQUIRED";
  if (s.note.length > 500) return "NOTE_TOO_LONG";
  if (s.outcome === "fail") return s.note.length < 5 ? "NOTE_REQUIRED_FOR_FAIL" : null;
  if (!s.confirm) return "CONFIRMATION_REQUIRED";
  if (!item.valid) return "VALIDATION_FAILED";
  const mine = latestByStage(activeRows(item, rows));
  if (s.stage === "EDUCATIONAL_REVIEW" && mine.TRANSLATION_REVIEW?.outcome !== "pass") return "TRANSLATION_REVIEW_FIRST";
  if (s.stage === "EDUCATIONAL_REVIEW" && mine.TRANSLATION_REVIEW?.reviewer_name.toLowerCase() === s.reviewerName.toLowerCase()) return "REVIEWERS_MUST_DIFFER";
  if (s.stage === "APPROVED" && (mine.TRANSLATION_REVIEW?.outcome !== "pass" || mine.EDUCATIONAL_REVIEW?.outcome !== "pass")) return "BOTH_REVIEWS_FIRST";
  return null;
}

export async function recordReview(db: D1Like, s: Submission, item: ReviewItem, actor: string, now: number): Promise<void> {
  await db.prepare(`INSERT INTO dr_content_reviews (content_id, content_kind, content_hash, content_version, stage, outcome, reviewer_name, reviewer_role, reviewed_on, evidence_ref, note, rules_version, recorded_by, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(item.id, item.kind, item.hash, item.contentVersion, s.stage, s.outcome, s.reviewerName, ROLE_FOR_STAGE[s.stage], s.reviewedOn, s.evidenceRef, s.note,
      s.stage === "EDUCATIONAL_REVIEW" && s.outcome === "pass" ? KLASSE_B_RULES_2026.version : null, actor, now).run();
}

export { REVIEW_ITEMS, REVIEW_ITEM_BY_ID };
