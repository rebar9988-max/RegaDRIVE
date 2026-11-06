/**
 * Owner-controlled question import: parse (JSON / CSV) → validate → preview. Pure and runtime-agnostic
 * (browser preview + Worker server-side validation). It never publishes: every normalised question is
 * DRAFT / hidden / reviewStatus "draft" regardless of the input.
 */
import type { AnswerType, Bilingual, MediaKind, Question, QuestionCategory, QuestionPoints } from "../../content/types";

export const MAX_ROWS = 5000;
export const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
export const OPTION_IDS = ["a", "b", "c", "d", "e"] as const;
export const LICENSE_CLASSES = ["B", "BE", "B96", "AM", "A1", "A2", "A", "C", "CE", "C1", "C1E", "D", "DE", "D1", "D1E", "L", "T", "Mofa"] as const;
/** Permissive official-code shape (digits, dots, one dash suffix). Exact format is checked by the owner. */
export const DEFAULT_CODE_PATTERN = /^[0-9]+(\.[0-9]+){1,4}(-[0-9]{1,4})?$/;

export interface ImportMedia { kind: MediaKind; file: string; altDe: string; altCkb?: string; posterFile?: string }
export interface ImportQuestion {
  questionCode: string | null;
  catalogueVersion: string | null;
  sourceType: "licensed_official" | "original";
  licenseId: string | null;
  categoryType: QuestionCategory;
  points: number;
  licenseClasses: string[];
  topicId: string;
  answerType: AnswerType;
  prompt: { de: string; ckb?: string };
  options?: { id: string; de: string; ckb?: string }[];
  correct?: string[];
  numericAnswer?: number;
  explanation?: { de?: string; ckb?: string };
  media?: ImportMedia[];
  vocabularyIds?: string[];
}

export interface MediaManifestEntry { file: string; kind: MediaKind; key: string; bytes: number; mime: string }
export interface ImportContext {
  knownTopics: ReadonlySet<string>;
  knownLicenses: ReadonlySet<string>;
  /** Already stored official questions by code → content hash (for update/duplicate detection). */
  existing: ReadonlyMap<string, string>;
  /** Files the owner attached (validated by media.ts). Missing references are errors. */
  media: ReadonlyMap<string, MediaManifestEntry>;
  codePattern?: RegExp;
}

export type RowStatus = "new" | "update" | "duplicate" | "invalid";
export interface RowIssue { field: string; message: string }
export interface PreviewRow {
  index: number;
  status: RowStatus;
  code: string | null;
  hash: string | null;
  errors: RowIssue[];
  warnings: RowIssue[];
  question: Question | null;
}
export interface ImportPreview {
  rows: PreviewRow[];
  summary: Record<RowStatus, number> & { total: number; warnings: number };
  fatal: string | null;
}

// ── parsing ─────────────────────────────────────────────────────────────

/** RFC 4180 CSV: quoted fields, escaped quotes, CRLF/LF, optional UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (quoted) throw new Error("CSV: unterminated quoted field");
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

export const CSV_COLUMNS = [
  "question_code", "catalogue_version", "source_type", "license_id", "category", "points", "license_classes", "topic_id",
  "answer_type", "prompt_de", "prompt_ckb",
  ...OPTION_IDS.flatMap((o) => [`option_${o}_de`, `option_${o}_ckb`]),
  "correct", "numeric_answer", "explanation_de", "explanation_ckb",
  "media_kind", "media_file", "media_alt_de", "media_alt_ckb", "media_poster_file", "vocabulary_ids",
] as const;

const blank = (v: string | undefined) => (v === undefined || v.trim() === "" ? undefined : v.trim());
const list = (v: string | undefined) => (blank(v) ? v!.split(/[;|]/).map((x) => x.trim()).filter(Boolean) : []);

/** Maps CSV rows (header required) to ImportQuestion objects. Unknown columns are rejected. */
export function csvToImport(text: string): ImportQuestion[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error("CSV: empty file");
  const cols = header.map((h) => h.trim().toLowerCase());
  const unknown = cols.filter((c) => !(CSV_COLUMNS as readonly string[]).includes(c));
  if (unknown.length) throw new Error(`CSV: unknown column(s): ${unknown.join(", ")}`);
  for (const req of ["source_type", "category", "points", "topic_id", "prompt_de"]) if (!cols.includes(req)) throw new Error(`CSV: missing column ${req}`);
  return rows.map((r) => {
    const g = (c: string) => { const i = cols.indexOf(c); return i < 0 ? undefined : r[i]; };
    const answerType = (blank(g("answer_type")) ?? "choice") as AnswerType;
    const options = OPTION_IDS.flatMap((o) => (blank(g(`option_${o}_de`)) !== undefined ? [{ id: o, de: g(`option_${o}_de`)!.trim(), ckb: blank(g(`option_${o}_ckb`)) }] : []));
    const mediaFile = blank(g("media_file"));
    return {
      questionCode: blank(g("question_code")) ?? null,
      catalogueVersion: blank(g("catalogue_version")) ?? null,
      sourceType: (blank(g("source_type")) ?? "") as ImportQuestion["sourceType"],
      licenseId: blank(g("license_id")) ?? null,
      categoryType: (blank(g("category")) ?? "") as QuestionCategory,
      points: Number(blank(g("points")) ?? NaN),
      licenseClasses: list(g("license_classes")),
      topicId: blank(g("topic_id")) ?? "",
      answerType,
      prompt: { de: g("prompt_de") ?? "", ckb: blank(g("prompt_ckb")) },
      options: answerType === "choice" ? options : options.length ? options : undefined,
      correct: list(g("correct")),
      numericAnswer: blank(g("numeric_answer")) !== undefined ? Number(g("numeric_answer")!.replace(",", ".")) : undefined,
      explanation: { de: blank(g("explanation_de")), ckb: blank(g("explanation_ckb")) },
      media: mediaFile ? [{ kind: (blank(g("media_kind")) ?? "image") as MediaKind, file: mediaFile, altDe: g("media_alt_de") ?? "", altCkb: blank(g("media_alt_ckb")), posterFile: blank(g("media_poster_file")) }] : [],
      vocabularyIds: list(g("vocabulary_ids")),
    };
  });
}

export function jsonToImport(text: string): ImportQuestion[] {
  const data = JSON.parse(text) as unknown;
  const arr = Array.isArray(data) ? data : (data as { questions?: unknown }).questions;
  if (!Array.isArray(arr)) throw new Error("JSON: expected an array or { \"questions\": [...] }");
  return arr as ImportQuestion[];
}

// ── validation ──────────────────────────────────────────────────────────

const ARABIC = /[؀-ۿ]/;
const HTML = /<\/?[a-z!][^>]*>/i;
// eslint-disable-next-line no-control-regex -- intentional: rejects control characters in imported text
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MAX = { prompt: 1000, option: 500, explanation: 4000, alt: 300 };

function checkText(errors: RowIssue[], field: string, v: unknown, max: number, lang: "de" | "ckb", required: boolean) {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
    if (required) errors.push({ field, message: "required" });
    return;
  }
  if (typeof v !== "string") return errors.push({ field, message: "must be text" });
  if (v.length > max) errors.push({ field, message: `longer than ${max} characters` });
  if (HTML.test(v)) errors.push({ field, message: "HTML/markup is not allowed" });
  if (CONTROL.test(v)) errors.push({ field, message: "contains control characters" });
  if (v.includes("[[") || v.includes("]]")) errors.push({ field, message: "template placeholder [[…]] was not replaced" });
  if (lang === "ckb" && !ARABIC.test(v)) errors.push({ field, message: "Sorani text must use Arabic script" });
  if (lang === "de" && ARABIC.test(v)) errors.push({ field, message: "German text contains Arabic script" });
}

/** Stable JSON for hashing (sorted keys). */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

/** Hash of the authoritative German content + answer key + media; translations do not change it. */
export async function contentHash(q: ImportQuestion): Promise<string> {
  const canonical = stable({
    de: q.prompt?.de?.trim(), points: q.points, type: q.answerType,
    options: (q.options ?? []).map((o) => [o.id, o.de?.trim()]), correct: [...(q.correct ?? [])].sort(),
    num: q.numericAnswer ?? null, media: (q.media ?? []).map((m) => [m.kind, m.file]),
  });
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validateRow(q: ImportQuestion, ctx: ImportContext): { errors: RowIssue[]; warnings: RowIssue[] } {
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const e = (field: string, message: string) => errors.push({ field, message });
  const w = (field: string, message: string) => warnings.push({ field, message });
  if (!q || typeof q !== "object") { e("row", "not an object"); return { errors, warnings }; }

  if (q.sourceType !== "licensed_official" && q.sourceType !== "original") e("sourceType", "must be licensed_official or original");
  if (q.sourceType === "licensed_official") {
    if (!q.questionCode) e("questionCode", "required for licensed official questions");
    else if (!(ctx.codePattern ?? DEFAULT_CODE_PATTERN).test(q.questionCode)) e("questionCode", "does not match the official code format");
    if (!q.licenseId) e("licenseId", "licensed content needs a documented licence id");
    else if (!ctx.knownLicenses.has(q.licenseId)) e("licenseId", `unknown licence '${q.licenseId}' — register the licence first`);
    if (!q.catalogueVersion) e("catalogueVersion", "required for licensed official questions");
  }
  if (q.sourceType === "original" && q.questionCode) e("questionCode", "original questions must not carry an official code");
  if (q.catalogueVersion && !/^\d{4}-\d{2}-\d{2}$/.test(q.catalogueVersion)) e("catalogueVersion", "use YYYY-MM-DD");

  if (q.categoryType !== "Grundstoff" && q.categoryType !== "Zusatzstoff") e("categoryType", "must be Grundstoff or Zusatzstoff");
  if (![2, 3, 4, 5].includes(q.points)) e("points", "must be 2, 3, 4 or 5");
  if (!Array.isArray(q.licenseClasses) || q.licenseClasses.length === 0) e("licenseClasses", "at least one licence class");
  else for (const c of q.licenseClasses) if (!(LICENSE_CLASSES as readonly string[]).includes(c)) e("licenseClasses", `unknown class '${c}'`);
  if (!ctx.knownTopics.has(q.topicId)) e("topicId", `unknown topic '${q.topicId}'`);

  checkText(errors, "prompt.de", q.prompt?.de, MAX.prompt, "de", true);
  checkText(errors, "prompt.ckb", q.prompt?.ckb, MAX.prompt, "ckb", false);
  if (!q.prompt?.ckb) w("prompt.ckb", "Sorani translation missing — required before approval");
  checkText(errors, "explanation.de", q.explanation?.de, MAX.explanation, "de", false);
  checkText(errors, "explanation.ckb", q.explanation?.ckb, MAX.explanation, "ckb", false);
  if (!q.explanation?.de && !q.explanation?.ckb) w("explanation", "no explanation — required before approval");

  if (q.answerType === "choice") {
    const opts = q.options ?? [];
    if (opts.length < 2 || opts.length > OPTION_IDS.length) e("options", `2–${OPTION_IDS.length} options required`);
    const ids = opts.map((o) => o.id);
    if (new Set(ids).size !== ids.length) e("options", "duplicate option ids");
    for (const o of opts) {
      if (!(OPTION_IDS as readonly string[]).includes(o.id)) e(`options.${o.id}`, "option id must be a–e");
      checkText(errors, `options.${o.id}.de`, o.de, MAX.option, "de", true);
      checkText(errors, `options.${o.id}.ckb`, o.ckb, MAX.option, "ckb", false);
      if (!o.ckb) w(`options.${o.id}.ckb`, "Sorani translation missing");
    }
    const correct = q.correct ?? [];
    if (correct.length === 0) e("correct", "at least one correct option");
    if (new Set(correct).size !== correct.length) e("correct", "duplicate entries");
    for (const c of correct) if (!ids.includes(c)) e("correct", `'${c}' is not an option`);
    if (q.numericAnswer !== undefined) e("numericAnswer", "only for number questions");
  } else if (q.answerType === "number") {
    if (typeof q.numericAnswer !== "number" || !Number.isFinite(q.numericAnswer)) e("numericAnswer", "a finite number is required");
    if ((q.options ?? []).length) e("options", "number questions have no options");
    if ((q.correct ?? []).length) e("correct", "number questions use numericAnswer");
  } else e("answerType", "must be choice or number");

  for (const [i, m] of (q.media ?? []).entries()) {
    const f = `media[${i}]`;
    if (m.kind !== "image" && m.kind !== "video") e(`${f}.kind`, "must be image or video");
    const entry = ctx.media.get(m.file);
    if (!entry) e(`${f}.file`, `file '${m.file}' was not uploaded`);
    else if (entry.kind !== m.kind) e(`${f}.file`, `file is a ${entry.kind}, row says ${m.kind}`);
    checkText(errors, `${f}.altDe`, m.altDe, MAX.alt, "de", true);
    checkText(errors, `${f}.altCkb`, m.altCkb, MAX.alt, "ckb", false);
    if (m.kind === "video") {
      if (!m.posterFile) w(`${f}.posterFile`, "video without poster image");
      else if (ctx.media.get(m.posterFile)?.kind !== "image") e(`${f}.posterFile`, "poster must be an uploaded image");
    }
  }
  return { errors, warnings };
}

function normalise(q: ImportQuestion, ctx: ImportContext, index: number): Question {
  const bi = (de: string | undefined, ckb: string | undefined): Bilingual => ({ de: (de ?? "").trim(), ckb: (ckb ?? "").trim() });
  const id = q.questionCode ? `off-${q.questionCode}` : `imp-${index}`;
  return {
    id,
    topicId: q.topicId,
    categoryType: q.categoryType,
    points: q.points as QuestionPoints,
    questionCode: q.sourceType === "licensed_official" ? q.questionCode : null,
    licenseClasses: [...q.licenseClasses],
    sourceType: q.sourceType,
    contentVersion: q.catalogueVersion ?? "import",
    catalogueVersion: q.catalogueVersion,
    licenseId: q.licenseId,
    // Never published by an import.
    reviewStatus: "draft",
    publicationStatus: "hidden",
    answerType: q.answerType,
    prompt: bi(q.prompt.de, q.prompt.ckb),
    options: (q.options ?? []).map((o) => ({ id: o.id, text: bi(o.de, o.ckb) })),
    correct: q.answerType === "choice" ? [...(q.correct ?? [])] : [],
    numericAnswer: q.answerType === "number" ? q.numericAnswer : undefined,
    explanation: bi(q.explanation?.de, q.explanation?.ckb),
    vocabularyIds: q.vocabularyIds ?? [],
    media: (q.media ?? []).map((m) => ({ kind: m.kind, key: ctx.media.get(m.file)!.key, alt: bi(m.altDe, m.altCkb), posterKey: m.posterFile ? ctx.media.get(m.posterFile)?.key : undefined })),
  };
}

export async function validateImport(rows: ImportQuestion[], ctx: ImportContext): Promise<ImportPreview> {
  const summary = { new: 0, update: 0, duplicate: 0, invalid: 0, total: rows.length, warnings: 0 };
  if (rows.length > MAX_ROWS) return { rows: [], summary, fatal: `too many rows (${rows.length} > ${MAX_ROWS})` };
  const out: PreviewRow[] = [];
  const seenCodes = new Map<string, number>();
  const seenHashes = new Map<string, number>();
  for (const [index, q] of rows.entries()) {
    const { errors, warnings } = validateRow(q, ctx);
    const code = q?.questionCode ?? null;
    let hash: string | null = null;
    try { hash = await contentHash(q); } catch { errors.push({ field: "row", message: "cannot compute content hash" }); }
    if (code) {
      const prev = seenCodes.get(code);
      if (prev !== undefined) errors.push({ field: "questionCode", message: `duplicate of row ${prev + 1} in this file` });
      else seenCodes.set(code, index);
    }
    if (hash) {
      const prev = seenHashes.get(hash);
      if (prev !== undefined) warnings.push({ field: "content", message: `same content as row ${prev + 1} — possible duplicate` });
      else seenHashes.set(hash, index);
    }
    let status: RowStatus = "new";
    if (errors.length) status = "invalid";
    else if (code && ctx.existing.has(code)) status = ctx.existing.get(code) === hash ? "duplicate" : "update";
    if (status === "update") warnings.push({ field: "content", message: "changes an existing question: a new version is created and it needs approval again" });
    summary[status]++;
    summary.warnings += warnings.length;
    out.push({ index, status, code, hash, errors, warnings, question: status === "invalid" ? null : normalise(q, ctx, index) });
  }
  return { rows: out, summary, fatal: null };
}

/** Convenience: parse by format with size guard; parse failures become a fatal preview. */
export async function previewImport(format: "json" | "csv", text: string, ctx: ImportContext): Promise<ImportPreview> {
  const empty = { rows: [], summary: { new: 0, update: 0, duplicate: 0, invalid: 0, total: 0, warnings: 0 } };
  if (new TextEncoder().encode(text).length > MAX_PAYLOAD_BYTES) return { ...empty, fatal: "file larger than 5 MB" };
  let rows: ImportQuestion[];
  try { rows = format === "csv" ? csvToImport(text) : jsonToImport(text); }
  catch (err) { return { ...empty, fatal: (err as Error).message }; }
  return validateImport(rows, ctx);
}
