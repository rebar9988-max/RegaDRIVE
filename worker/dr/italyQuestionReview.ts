import { IT_QUESTIONS } from "../../src/content/italy/questions";
import { itQuestionHash } from "../../src/content/italy/hash";
import { itQuestionReviewItem } from "../../src/content/italy/reviewItems";
import type { ItQuestion } from "../../src/content/italy/types";
import type { D1Like } from "./db";
import { evaluate, reviewInsert, type ReviewRow, type Submission } from "./reviews";

export const IT_QUESTION_BY_ID = new Map(IT_QUESTIONS.map((question) => [question.id, question]));
const EDIT_ACTION = "review.itQuestion.translation.edit";
const contentId = "json_extract(detail, '$.contentId')";
const baseHash = "json_extract(detail, '$.baseHash')";
const savedEdits = `FROM dr_audit_log WHERE action = '${EDIT_ACTION}' AND result = 'allowed'`;
// Check the current revision in the same statement as the write, including after step-up.
const currentRevision = `COALESCE((SELECT MAX(id) ${savedEdits} AND ${contentId} = ? AND ${baseHash} = ?), 0)`;

export interface ItalyTranslations {
  prompt: { ckb: string; kmrArab: string };
  explanation: { ckb: string; kmrArab: string };
}
interface EditDetail {
  contentId: string;
  baseHash: string;
  reviewerName: string;
  reviewedOn: string;
  evidenceRef: string;
  note: string;
  before: ItalyTranslations;
  after: ItalyTranslations;
}
interface EditRow { id: number; at: number; actor: string; detail: string }
type Edit = Omit<EditRow, "detail"> & EditDetail;

export function translationsOf(question: ItQuestion): ItalyTranslations {
  const { prompt, explanation } = question;
  return {
    prompt: { ckb: prompt.ckb, kmrArab: prompt.kmrArab ?? "" },
    explanation: { ckb: explanation.ckb, kmrArab: explanation.kmrArab ?? "" },
  };
}

export function parseTranslations(value: unknown): ItalyTranslations | null {
  if (!value || typeof value !== "object") return null;
  const { prompt, explanation } = value as Partial<ItalyTranslations>;
  const checkText = (text: unknown): text is string =>
    typeof text === "string" && text.trim().length <= 2000 && /\p{Script=Arabic}/u.test(text);
  if (!checkText(prompt?.ckb) || !checkText(prompt.kmrArab) || !checkText(explanation?.ckb) || !checkText(explanation.kmrArab)) return null;
  return {
    prompt: { ckb: prompt.ckb.trim(), kmrArab: prompt.kmrArab.trim() },
    explanation: { ckb: explanation.ckb.trim(), kmrArab: explanation.kmrArab.trim() },
  };
}

function applyEdit(question: ItQuestion, edit?: Edit) {
  const revision = edit?.id ?? 0;
  const hash = itQuestionHash(question);
  const updated = edit ? {
    ...question,
    prompt: { ...question.prompt, ...edit.after.prompt },
    explanation: { ...question.explanation, ...edit.after.explanation },
  } : question;
  const item = itQuestionReviewItem(updated);
  // Editorial decisions use a different fingerprint from the learner publication gate.
  return { question: updated, revision, baseHash: hash, item: { ...item, hash: `review:${hash}:${revision}` } };
}

function decode({ detail, ...row }: EditRow): Edit {
  return { ...row, ...JSON.parse(detail) as EditDetail };
}

export async function loadItalyQuestionDraft(db: D1Like, question: ItQuestion) {
  const row = await db.prepare(`SELECT id, at, actor, detail ${savedEdits} AND ${contentId} = ? AND ${baseHash} = ? ORDER BY id DESC LIMIT 1`)
    .bind(question.id, itQuestionHash(question)).first<EditRow>();
  return applyEdit(question, row ? decode(row) : undefined);
}

type Draft = Awaited<ReturnType<typeof loadItalyQuestionDraft>>;

// Preserve existing decisions for the bundled wording in the workbench until a human edits it.
export function italyQuestionRows(draft: Draft, rows: ReviewRow[]) {
  if (draft.revision !== 0) return rows;
  return rows.map((row) => row.source === "it" && row.content_id === draft.item.id && row.content_hash === draft.baseHash
    ? { ...row, content_hash: draft.item.hash } : row);
}

export async function italyQuestionsForReview(db: D1Like, rows: ReviewRow[]) {
  const { results } = await db.prepare(`SELECT id, at, actor, detail ${savedEdits} AND id IN (
    SELECT MAX(id) ${savedEdits} GROUP BY ${contentId}, ${baseHash}
  )`).all<EditRow>();
  const latest = new Map(results.map(decode).map((edit) => [`${edit.contentId}:${edit.baseHash}`, edit]));
  return IT_QUESTIONS.map((question) => {
    const draft = applyEdit(question, latest.get(`${question.id}:${itQuestionHash(question)}`));
    const state = evaluate(draft.item, italyQuestionRows(draft, rows));
    return {
      ...state,
      publishable: false,
      status: state.status === "PUBLISHED" ? "APPROVED" : state.status,
      valid: draft.item.valid,
      checks: draft.item.checks,
      sourceRefs: draft.item.sourceRefs,
      translations: translationsOf(draft.question),
    };
  });
}

export async function italyTranslationHistory(db: D1Like, id: string) {
  const { results } = await db.prepare(`SELECT id, at, actor, detail ${savedEdits} AND ${contentId} = ? ORDER BY id DESC`)
    .bind(id).all<EditRow>();
  return results.map(decode);
}

export async function saveItalyQuestionEdit(db: D1Like, draft: Draft, after: ItalyTranslations,
  metadata: Pick<EditDetail, "reviewerName" | "reviewedOn" | "evidenceRef" | "note">, actor: string, now: number, ip: string) {
  const { id } = draft.question;
  const detail: EditDetail = { ...metadata, contentId: id, baseHash: draft.baseHash, before: translationsOf(draft.question), after };
  if (JSON.stringify(detail.before) === JSON.stringify(after)) return "NO_TRANSLATION_CHANGES";
  const inserted = await db.prepare(`INSERT INTO dr_audit_log (at, actor, action, result, detail, ip)
    SELECT ?, ?, ?, 'allowed', ?, ? WHERE ${currentRevision} = ? RETURNING id`)
    .bind(now, actor, EDIT_ACTION, JSON.stringify(detail), ip, id, draft.baseHash, draft.revision).first();
  return inserted ? null : "STALE_TRANSLATION";
}

export async function recordItalyQuestionReview(db: D1Like, draft: Draft, sub: Submission, actor: string, now: number) {
  const { sql, values } = reviewInsert(sub, draft.item, actor, now);
  return db.prepare(`${sql}
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${currentRevision} = ? RETURNING id`)
    .bind(...values, draft.item.id, draft.baseHash, draft.revision).first();
}
