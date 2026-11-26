import { IT_QUESTIONS } from "./questions.ts";
import { IT_SIGNS, itSignById } from "./signs.ts";
import { IT_CONTENT_REGISTRY } from "./registry.ts";
import { itQuestionHash, itSignHash } from "./hash.ts";
import type { ItQuestion, ItSign, ItText } from "./types.ts";

/**
 * Review targets of the Italian section: the sign illustrations and the true/false questions.
 * Shared by the worker (server-side checks) and the /dr review screen. Nothing here approves anything:
 * it describes what a human reviewer has to look at and runs the automatic validation first.
 */
export type ItReviewKind = "itSign" | "itQuestion";
export interface ItCheck { ok: boolean; label: string }
export interface ItReviewItem {
  id: string;
  kind: ItReviewKind;
  /** Changes whenever any reviewed text, answer or reference changes, so an old approval stops counting. */
  hash: string;
  contentVersion: string;
  sourceRefs: string[];
  checks: ItCheck[];
  valid: boolean;
}

const ARABIC = /[؀-ۿ]/;
const SORANI_ONLY = /[ڕڵۆێ]/;

/**
 * The three languages the Italian section serves — Sorani, Badini and Italian — are required of every
 * text. Latin-script Kurmanji, German and Arabic are not part of the Italian interface; when an item
 * carries them anyway they are checked for the right script, but their absence is not a defect.
 */
function textChecks(label: string, t: ItText): ItCheck[] {
  const optional = (value: string | undefined, ok: (v: string) => boolean) => value === undefined || value.trim().length === 0 || ok(value);
  return [
    { ok: t.it.trim().length > 0 && !ARABIC.test(t.it), label: `${label}: Italian source text present (Latin script)` },
    { ok: t.ckb.trim().length > 0 && ARABIC.test(t.ckb), label: `${label}: Sorani text present (Arabic script)` },
    { ok: !!t.kmrArab && t.kmrArab.trim().length > 0 && ARABIC.test(t.kmrArab), label: `${label}: Badini text present (Arabic script)` },
    { ok: optional(t.kmr, (v) => !ARABIC.test(v)), label: `${label}: Kurmanji, if present, in Latin script` },
    { ok: optional(t.de, (v) => !ARABIC.test(v)), label: `${label}: German, if present, in Latin script` },
    { ok: optional(t.ar, (v) => ARABIC.test(v) && !SORANI_ONLY.test(v)), label: `${label}: Arabic, if present, without Sorani-only letters` },
  ];
}

function questionChecks(q: ItQuestion): ItCheck[] {
  const sign = q.signId ? itSignById(q.signId) : undefined;
  return [
    ...textChecks("question", q.prompt),
    ...textChecks("explanation", q.explanation),
    { ok: typeof q.answer === "boolean", label: "answer is VERO or FALSO" },
    // The explanation has to state the same verdict as the answer key, in Italian.
    { ok: new RegExp(q.answer ? "^VERO\\b" : "^FALSO\\b").test(q.explanation.it.trim()), label: "Italian explanation starts with the same verdict as the answer" },
    { ok: Number.isInteger(q.chapter) && q.chapter >= 1 && q.chapter <= 16, label: "belongs to one of the 16 syllabus chapters" },
    { ok: q.sourceType === "original" && q.questionCode === null, label: "original question without an official code" },
    { ok: q.reviewStatus !== "approved", label: "not pre-approved in the code" },
    { ok: !q.signId || !!sign, label: "sign illustration resolves" },
  ];
}

function signChecks(s: ItSign): ItCheck[] {
  return [
    ...textChecks("name", s.name),
    { ok: /^[a-z0-9-]+\.svg$/.test(s.file), label: "illustration file name valid (public/signs/it)" },
    { ok: ["danger", "priority", "prohibition", "mandatory", "information"].includes(s.group), label: "sign group known" },
  ];
}

/** Where an item's legal references come from: the content registry for bundled items, the item itself for imported ones. */
const src = (id: string, own?: readonly string[]) => {
  const registered = IT_CONTENT_REGISTRY.get(id)?.provenance.sourceRefs ?? [];
  return registered.length > 0 ? registered : [...(own ?? [])];
};
const ver = (id: string) => IT_CONTENT_REGISTRY.get(id)?.contentVersion ?? "";

export function itQuestionReviewItem(q: ItQuestion): ItReviewItem {
  const sourceRefs = src(q.id, q.sourceRefs);
  const checks = [...questionChecks(q), { ok: sourceRefs.length > 0, label: "legal source reference recorded (Codice della Strada)" }];
  return { id: q.id, kind: "itQuestion", hash: itQuestionHash(q), contentVersion: ver(q.id) || q.contentVersion, sourceRefs, checks, valid: checks.every((c) => c.ok) };
}

export const IT_REVIEW_ITEMS: ItReviewItem[] = [
  ...IT_SIGNS.map((s): ItReviewItem => {
    const checks = [...signChecks(s), { ok: src(s.id).length > 0, label: "source reference recorded" }];
    return { id: s.id, kind: "itSign", hash: itSignHash(s), contentVersion: ver(s.id), sourceRefs: src(s.id), checks, valid: checks.every((c) => c.ok) };
  }),
  ...IT_QUESTIONS.map(itQuestionReviewItem),
];

export const IT_REVIEW_ITEM_BY_ID: ReadonlyMap<string, ItReviewItem> = new Map(IT_REVIEW_ITEMS.map((i) => [i.id, i]));

/**
 * Review items for a catalogue that did not come from this build — an owner import stored in the
 * content database. The same checks and the same fingerprinting are applied, so imported content is
 * held to the standard the bundled content is held to, and nothing can be published without review.
 */
export function itReviewItemsFor(questions: readonly ItQuestion[], signs: readonly ItSign[]): ItReviewItem[] {
  return [
    ...signs.map((s): ItReviewItem => {
      const refs = src(s.id, s.sourceRefs);
      const checks = [...signChecks(s), { ok: refs.length > 0, label: "source reference recorded" }];
      return { id: s.id, kind: "itSign", hash: itSignHash(s), contentVersion: ver(s.id) || "imported", sourceRefs: refs, checks, valid: checks.every((c) => c.ok) };
    }),
    ...questions.map((q) => itQuestionReviewItem(q)),
  ];
}
