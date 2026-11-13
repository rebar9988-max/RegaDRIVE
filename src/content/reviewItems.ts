import { SIGNS, signSource } from "./signs.ts";
import { SIGN_QUIZ } from "./signQuiz.ts";
import { CONTENT_REGISTRY } from "./registry.ts";
import { signHash, questionHash } from "./hash.ts";
import type { Bilingual, Question, TrafficSign } from "./types.ts";

/**
 * Review targets of the Verkehrszeichen release: the 40 signs and the 89 sign-quiz questions.
 * Shared by the worker (server-side checks) and the /dr review screen. Nothing here approves anything:
 * it only describes what a human reviewer has to look at and runs the automatic validation.
 */
export type ReviewKind = "sign" | "signQuiz";
export interface Check { ok: boolean; label: string }
export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  /** Changes whenever any reviewed text, option, answer or reference changes, so an old approval stops counting. */
  hash: string;
  contentVersion: string;
  sourceRefs: string[];
  checks: Check[];
  valid: boolean;
}

const ARABIC = /[؀-ۿ]/;
const SORANI_ONLY = /[ڕڵۆێەڤگپچژ]/;
const GERMAN_LETTERS = /[äöüßÄÖÜ]/;

function bilingualChecks(label: string, t: Bilingual): Check[] {
  const out: Check[] = [];
  out.push({ ok: t.de.trim().length > 0, label: `${label}: German text present` });
  out.push({ ok: t.ckb.trim().length > 0 && ARABIC.test(t.ckb), label: `${label}: Sorani text present (Arabic script)` });
  out.push({ ok: !!t.kmr && t.kmr.trim().length > 0 && !ARABIC.test(t.kmr) && !GERMAN_LETTERS.test(t.kmr), label: `${label}: Kurmanji in Latin script` });
  out.push({ ok: !!t.ar && ARABIC.test(t.ar) && !SORANI_ONLY.test(t.ar), label: `${label}: Arabic text without Sorani-only letters` });
  return out;
}

const SHAPES: string[] = ["triangle", "triangle-down", "octagon", "diamond", "circle-red", "circle-blue", "circle-plain", "rect-blue", "rect-yellow", "square-red"];

function signChecks(s: TrafficSign): Check[] {
  return [
    ...bilingualChecks("name", s.name), ...bilingualChecks("meaning", s.meaning),
    { ok: /^\d{3}(\.\d+)?$/.test(s.stvoNumber), label: "official StVO sign number format" },
    { ok: [1, 2, 3].includes(s.anlage) && Number.isInteger(s.lfdNr) && s.lfdNr > 0, label: "official reference (Anlage + lfd. Nr.)" },
    { ok: SHAPES.includes(s.shape) && typeof s.glyph === "string", label: "SVG drawing defined (known shape)" },
  ];
}

function questionChecks(q: Question): Check[] {
  const ids = q.options.map((o) => o.id);
  return [
    ...bilingualChecks("question", q.prompt), ...bilingualChecks("explanation", q.explanation),
    ...q.options.flatMap((o) => bilingualChecks(`option ${o.id}`, o.text)),
    { ok: q.options.length >= 2 && new Set(ids).size === ids.length, label: "answer options unique (at least 2)" },
    { ok: q.correct.length === 1 && q.correct.every((c) => ids.includes(c)), label: "exactly one correct answer, mapped to an option" },
    { ok: q.sourceType === "original" && q.questionCode === null, label: "original question without an official code" },
    { ok: !!q.signId, label: "linked to a sign (or scenario) with an official reference" },
  ];
}

const src = (id: string) => CONTENT_REGISTRY.get(id)?.provenance.sourceRefs ?? [];
const ver = (id: string) => CONTENT_REGISTRY.get(id)?.contentVersion ?? "";

export const REVIEW_ITEMS: ReviewItem[] = [
  ...SIGNS.map((s): ReviewItem => {
    const checks = [...signChecks(s), { ok: src(s.id).length > 0 && signSource(s).length > 0, label: "source reference recorded" }];
    return { id: s.id, kind: "sign", hash: signHash(s), contentVersion: ver(s.id), sourceRefs: [signSource(s)], checks, valid: checks.every((c) => c.ok) };
  }),
  ...SIGN_QUIZ.map((q): ReviewItem => {
    const checks = [...questionChecks(q), { ok: src(q.id).length > 0, label: "source reference recorded" }];
    return { id: q.id, kind: "signQuiz", hash: questionHash(q), contentVersion: ver(q.id), sourceRefs: src(q.id), checks, valid: checks.every((c) => c.ok) };
  }),
];

export const REVIEW_ITEM_BY_ID: ReadonlyMap<string, ReviewItem> = new Map(REVIEW_ITEMS.map((i) => [i.id, i]));
