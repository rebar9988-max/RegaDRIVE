import type { ItQuestion, ItSign, ItText } from "./types.ts";

/**
 * Runtime validation of Italian content that arrives from outside the repository — an owner import.
 *
 * The same rules the bundled catalogue is held to (src/content/italy/reviewItems.ts) are applied here
 * before anything is stored, so a malformed or mistranslated row never reaches the review queue, and
 * never reaches a learner. Nothing here approves anything: storing is not publishing.
 */

const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-zÀ-ÿ]/;
/** Letters that exist in Sorani but not in Badini, used to catch Sorani pasted into the Badini field. */
export const SORANI_ONLY = /[ڕڵۆێ]/;

export interface Issue { field: string; problem: string }

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The three languages the Italian section must always carry, and the optional ones. */
export function textIssues(field: string, value: unknown): Issue[] {
  const out: Issue[] = [];
  if (typeof value !== "object" || value === null) return [{ field, problem: "missing" }];
  const t = value as Record<string, unknown>;
  const it = str(t.it), ckb = str(t.ckb), badini = str(t.kmrArab);
  if (!it) out.push({ field: `${field}.it`, problem: "Italian text missing" });
  else if (ARABIC.test(it)) out.push({ field: `${field}.it`, problem: "Italian text must be Latin script" });
  if (!ckb) out.push({ field: `${field}.ckb`, problem: "Sorani text missing" });
  else if (!ARABIC.test(ckb)) out.push({ field: `${field}.ckb`, problem: "Sorani text must be Arabic script" });
  if (!badini) out.push({ field: `${field}.kmrArab`, problem: "Badini text missing" });
  else if (!ARABIC.test(badini)) out.push({ field: `${field}.kmrArab`, problem: "Badini text must be Arabic script" });
  for (const key of ["kmr", "de", "ar"] as const) {
    const extra = str(t[key]);
    if (!extra) continue;
    if (key === "kmr" && ARABIC.test(extra)) out.push({ field: `${field}.kmr`, problem: "Latin-script Kurmanji expected" });
    if (key === "de" && !LATIN.test(extra)) out.push({ field: `${field}.de`, problem: "German text must be Latin script" });
    if (key === "ar" && !ARABIC.test(extra)) out.push({ field: `${field}.ar`, problem: "Arabic text must be Arabic script" });
    if (key === "ar" && SORANI_ONLY.test(extra)) out.push({ field: `${field}.ar`, problem: "Arabic text contains Sorani-only letters" });
  }
  return out;
}

const text = (value: unknown): ItText => {
  const t = value as Record<string, unknown>;
  const out: ItText = { ckb: str(t.ckb), it: str(t.it) };
  for (const key of ["kmrArab", "kmr", "de", "ar"] as const) {
    const extra = str(t[key]);
    if (extra) out[key] = extra;
  }
  return out;
};

export interface ParsedQuestion { kind: "question"; value: ItQuestion }
export interface ParsedSign { kind: "sign"; value: ItSign }
export type Parsed = ParsedQuestion | ParsedSign;

/**
 * Validate one imported question. Every rule here is a rule a learner depends on: the answer key is a
 * boolean, the Italian explanation states the same verdict as the key, the chapter is one of the 16,
 * and the item never claims an official question code.
 */
export function parseItQuestion(raw: unknown, knownSignIds: ReadonlySet<string>): { value?: ItQuestion; issues: Issue[] } {
  const issues: Issue[] = [];
  if (typeof raw !== "object" || raw === null) return { issues: [{ field: "item", problem: "not an object" }] };
  const q = raw as Record<string, unknown>;
  const id = str(q.id);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(id)) issues.push({ field: "id", problem: "id must be 3-64 chars of a-z, 0-9 and -" });
  const chapter = typeof q.chapter === "number" ? q.chapter : Number.NaN;
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 16) issues.push({ field: "chapter", problem: "chapter must be an integer 1-16" });
  if (typeof q.answer !== "boolean") issues.push({ field: "answer", problem: "answer must be true (VERO) or false (FALSO)" });
  issues.push(...textIssues("prompt", q.prompt));
  issues.push(...textIssues("explanation", q.explanation));
  const signId = str(q.signId);
  if (signId && !knownSignIds.has(signId)) issues.push({ field: "signId", problem: `unknown sign ${signId}` });
  if (q.questionCode !== null && q.questionCode !== undefined) issues.push({ field: "questionCode", problem: "imported content must not carry an official question code" });
  // Review cannot pass an item with no legal basis, so an import has to bring one.
  const refs = Array.isArray(q.sourceRefs) ? q.sourceRefs.filter((r) => typeof r === "string" && r.trim().length > 2) as string[] : [];
  if (refs.length === 0) issues.push({ field: "sourceRefs", problem: "at least one legal reference is required, e.g. \"CdS art. 142\"" });
  if (q.sourceType !== undefined && q.sourceType !== "original") issues.push({ field: "sourceType", problem: "only original content can be imported" });
  if (q.reviewStatus === "approved") issues.push({ field: "reviewStatus", problem: "an import can never arrive pre-approved; approval happens in /dr" });
  // The explanation has to agree with the answer key, in Italian, so a learner is never taught the opposite.
  const explanation = typeof q.explanation === "object" && q.explanation !== null ? str((q.explanation as Record<string, unknown>).it) : "";
  if (typeof q.answer === "boolean" && explanation) {
    const expected = q.answer ? "VERO" : "FALSO";
    if (!new RegExp(`^${expected}\\b`, "i").test(explanation)) {
      issues.push({ field: "explanation.it", problem: `must begin with ${expected}, matching the answer key` });
    }
  }
  if (issues.length > 0) return { issues };
  const value: ItQuestion = {
    id, chapter, answer: q.answer as boolean,
    prompt: text(q.prompt), explanation: text(q.explanation),
    ...(signId ? { signId } : {}),
    questionCode: null,
    licenseClasses: Array.isArray(q.licenseClasses) && q.licenseClasses.every((c) => typeof c === "string") && q.licenseClasses.length > 0
      ? (q.licenseClasses as string[]) : ["B"],
    sourceType: "original",
    sourceRefs: refs.map((r) => r.trim()),
    contentVersion: str(q.contentVersion) || "imported",
    reviewStatus: q.reviewStatus === "draft" ? "draft" : "pending",
    publicationStatus: q.publicationStatus === "hidden" ? "hidden" : "published",
  };
  return { value, issues };
}

const SIGN_GROUPS = new Set(["danger", "priority", "prohibition", "mandatory", "information"]);

/** Validate one imported sign. The file must be a plain name under public/signs/it, never a path or a URL. */
export function parseItSign(raw: unknown): { value?: ItSign; issues: Issue[] } {
  const issues: Issue[] = [];
  if (typeof raw !== "object" || raw === null) return { issues: [{ field: "item", problem: "not an object" }] };
  const s = raw as Record<string, unknown>;
  const id = str(s.id);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(id)) issues.push({ field: "id", problem: "id must be 3-64 chars of a-z, 0-9 and -" });
  const file = str(s.file);
  if (!/^[a-z0-9][a-z0-9-]{0,63}\.svg$/.test(file)) issues.push({ field: "file", problem: "file must be a plain <name>.svg under public/signs/it" });
  const group = str(s.group);
  if (!SIGN_GROUPS.has(group)) issues.push({ field: "group", problem: `group must be one of ${[...SIGN_GROUPS].join(", ")}` });
  issues.push(...textIssues("name", s.name));
  const refs = Array.isArray(s.sourceRefs) ? s.sourceRefs.filter((r) => typeof r === "string" && r.trim().length > 2) as string[] : [];
  if (refs.length === 0) issues.push({ field: "sourceRefs", problem: "at least one source reference is required for the illustration" });
  if (issues.length > 0) return { issues };
  return { value: { id, file, group: group as ItSign["group"], name: text(s.name), sourceRefs: refs.map((r) => r.trim()) }, issues };
}
