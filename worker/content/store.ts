/**
 * Stored question import: commit, version, roll back, report. Server-side only.
 *
 * - The file is validated again on the server against the licence register read from the database; a client
 *   preview is never trusted.
 * - Everything is written in one atomic batch: either the whole file is stored or nothing is.
 * - Every question is stored hidden as a draft. Publication is a separate, owner-approved step that the
 *   database guards with its own triggers (migrations/0002 and 0005).
 * - Not reachable in production today: it needs the owner-activated content database (see worker/lib/admin.ts).
 */
import type { D1Like, D1Stmt } from "../dr/db";
import type { Question } from "../../src/content/types";
import { csvToImport, jsonToImport, validateImport, MAX_PAYLOAD_BYTES, type ImportPreview, type ImportQuestion, type MediaManifestEntry } from "../../src/lib/shared/importer";
import type { LicenseRecord, LicenseStatus } from "../../src/lib/shared/license";
import { TOPICS } from "../../src/content/topics";

/** D1 with atomic batches (Cloudflare D1 provides `batch`; the test adapter wraps a transaction). */
export interface ContentDb extends D1Like { batch(statements: D1Stmt[]): Promise<unknown> }

export type StoreError =
  | "BAD_FORMAT" | "TOO_LARGE" | "FATAL_FILE" | "INVALID_ROWS" | "EMPTY" | "ALREADY_IMPORTED" | "MEDIA_NOT_STORED"
  | "UNKNOWN_BATCH" | "ALREADY_ROLLED_BACK" | "LATER_BATCH_EXISTS" | "REASON_REQUIRED" | "WRITE_FAILED";
export type StoreResult<T> = ({ ok: true } & T) | { ok: false; error: StoreError; detail?: string; preview?: ImportPreview };

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const sha256Hex = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const list = (v: unknown): string[] => { try { const x = JSON.parse(String(v ?? "[]")) as unknown; return Array.isArray(x) ? x.filter((y): y is string => typeof y === "string") : []; } catch { return []; } };

interface LicenseRow {
  id: string; country: "DE" | "IT"; licensor: string; scope: string; status: LicenseStatus; valid_from: number; valid_until: number | null; evidence_ref: string;
  verified_by: string | null; verified_at: number | null; catalogue_versions: string; license_classes: string; attribution_text: string | null;
  right_question_text: number; right_official_media: number; right_translation: number; right_own_media: number; right_online: number; right_offline: number;
}
const toLicense = (r: LicenseRow): LicenseRecord => ({
  id: r.id, country: r.country, licensor: r.licensor, scope: r.scope, status: r.status, validFrom: day(r.valid_from), validUntil: r.valid_until === null ? null : day(r.valid_until),
  evidenceRef: r.evidence_ref, verifiedBy: r.verified_by, verifiedOn: r.verified_at === null ? null : day(r.verified_at),
  catalogueVersions: list(r.catalogue_versions), licenseClasses: list(r.license_classes), attributionText: r.attribution_text,
  rights: { questionText: r.right_question_text === 1, officialMedia: r.right_official_media === 1, translation: r.right_translation === 1, ownMedia: r.right_own_media === 1, online: r.right_online === 1, offline: r.right_offline === 1 },
});

export async function loadLicenses(db: D1Like): Promise<Map<string, LicenseRecord>> {
  const { results } = await db.prepare("SELECT * FROM content_licenses").all<LicenseRow>();
  return new Map(results.map((r) => [r.id, toLicense(r)]));
}

/** Stable id: official questions by their official number, original ones by their content. */
const questionId = (q: Question, hash: string) => (q.questionCode ? `off-${q.questionCode}` : `orig-${hash.slice(0, 20)}`);

interface Snapshot { question: Question; hash: string; licenseId: string | null }

function writeQuestion(db: D1Like, id: string, s: Snapshot, isNew: boolean): D1Stmt[] {
  const q = s.question;
  const out: D1Stmt[] = [];
  if (isNew) {
    out.push(db.prepare(`INSERT INTO questions (id, topic_id, question_code, points, category_type, license_classes, source_type, license_id, content_version, review_status,
        publication_status, prompt_ckb, prompt_de, explanation_ckb, explanation_de, answer_type, numeric_answer, catalogue_version, content_hash, stage, country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'hidden', ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'DE')`)
      .bind(id, q.topicId, q.questionCode, q.points, q.categoryType, JSON.stringify(q.licenseClasses), q.sourceType, s.licenseId, q.contentVersion,
        q.prompt.ckb, q.prompt.de, q.explanation.ckb, q.explanation.de, q.answerType ?? "choice", q.numericAnswer ?? null, q.catalogueVersion ?? null, s.hash));
  } else {
    // Allowed for licensed wording only because the new hash is already recorded as a version (trigger in 0005).
    out.push(db.prepare(`UPDATE questions SET topic_id = ?, points = ?, category_type = ?, license_classes = ?, content_version = ?, prompt_ckb = ?, prompt_de = ?,
        explanation_ckb = ?, explanation_de = ?, answer_type = ?, numeric_answer = ?, catalogue_version = ?, content_hash = ? WHERE id = ?`)
      .bind(q.topicId, q.points, q.categoryType, JSON.stringify(q.licenseClasses), q.contentVersion, q.prompt.ckb, q.prompt.de, q.explanation.ckb, q.explanation.de,
        q.answerType ?? "choice", q.numericAnswer ?? null, q.catalogueVersion ?? null, s.hash, id));
    out.push(db.prepare("DELETE FROM answer_options WHERE question_id = ?").bind(id));
    out.push(db.prepare("DELETE FROM question_media WHERE question_id = ?").bind(id));
  }
  q.options.forEach((o, i) => out.push(db.prepare("INSERT INTO answer_options (question_id, option_id, position, text_ckb, text_de, is_correct) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, o.id, i, o.text.ckb, o.text.de, q.correct.includes(o.id) ? 1 : 0)));
  (q.media ?? []).forEach((m, i) => {
    out.push(db.prepare("INSERT INTO question_media (question_id, media_id, role, position, alt_de, alt_ckb) SELECT ?, id, 'stimulus', ?, ?, ? FROM media_assets WHERE storage_key = ?")
      .bind(id, i, m.alt.de, m.alt.ckb || null, m.key));
    if (m.posterKey) out.push(db.prepare("INSERT INTO question_media (question_id, media_id, role, position, alt_de, alt_ckb) SELECT ?, id, 'poster', ?, ?, ? FROM media_assets WHERE storage_key = ?")
      .bind(id, i, m.alt.de, m.alt.ckb || null, m.posterKey));
  });
  return out;
}

export interface CommitInput { format: "json" | "csv"; text: string; fileName: string; actor: string; now: number; media?: MediaManifestEntry[] }
export interface CommitSummary { batchId: string; inserted: number; updated: number; duplicates: number; /** Sorani fields offered for unchanged questions (stored only where the text differs). */ translationFields: number; preview: ImportPreview }

export async function commitImport(db: ContentDb, input: CommitInput): Promise<StoreResult<CommitSummary>> {
  if (input.format !== "json" && input.format !== "csv") return { ok: false, error: "BAD_FORMAT" };
  if (new TextEncoder().encode(input.text).length > MAX_PAYLOAD_BYTES) return { ok: false, error: "TOO_LARGE" };
  let rows: ImportQuestion[];
  try { rows = input.format === "csv" ? csvToImport(input.text) : jsonToImport(input.text); }
  catch (e) { return { ok: false, error: "FATAL_FILE", detail: (e as Error).message }; }
  if (rows.length === 0) return { ok: false, error: "EMPTY" };

  const fileSha = await sha256Hex(input.text);
  if (await db.prepare("SELECT 1 AS x FROM import_batches WHERE file_sha256 = ? AND status = 'committed'").bind(fileSha).first()) return { ok: false, error: "ALREADY_IMPORTED", detail: "this exact file is already stored" };

  // What is stored already: official questions by number, original ones by content id.
  const existing = new Map<string, string>();
  const stored = new Map<string, { hash: string; version: number }>();
  const codes = [...new Set(rows.map((r) => r?.questionCode).filter((c): c is string => typeof c === "string" && c.length > 0))];
  for (const part of chunks(codes, 50)) {
    const { results } = await db.prepare(`SELECT q.id, q.question_code AS code, q.content_hash AS hash, (SELECT MAX(version) FROM question_versions v WHERE v.question_id = q.id) AS version
      FROM questions q WHERE q.question_code IN (${part.map(() => "?").join(",")})`).bind(...part).all<{ id: string; code: string; hash: string | null; version: number | null }>();
    for (const r of results) { existing.set(r.code, r.hash ?? ""); stored.set(r.id, { hash: r.hash ?? "", version: r.version ?? 0 }); }
  }

  const media = new Map((input.media ?? []).map((m) => [m.file, m]));
  const preview = await validateImport(rows, {
    knownTopics: new Set(TOPICS.map((t) => t.id)), knownLicenses: new Set(), existing, media,
    licenses: await loadLicenses(db), today: day(input.now),
  });
  if (preview.fatal) return { ok: false, error: "FATAL_FILE", detail: preview.fatal, preview };
  if (preview.summary.invalid > 0) return { ok: false, error: "INVALID_ROWS", detail: `${preview.summary.invalid} invalid row(s); nothing was stored`, preview };

  // Every referenced media file must already be registered; a question is never stored with a dangling picture.
  const keys = [...new Set(preview.rows.flatMap((r) => (r.question?.media ?? []).flatMap((m) => [m.key, ...(m.posterKey ? [m.posterKey] : [])])))];
  const have = new Set<string>();
  for (const part of chunks(keys, 50)) {
    const { results } = await db.prepare(`SELECT storage_key AS k FROM media_assets WHERE storage_key IN (${part.map(() => "?").join(",")})`).bind(...part).all<{ k: string }>();
    for (const r of results) have.add(r.k);
  }
  const missing = keys.filter((k) => !have.has(k));
  if (missing.length) return { ok: false, error: "MEDIA_NOT_STORED", detail: `${missing.length} media file(s) are not stored yet: ${missing.slice(0, 5).join(", ")}`, preview };

  const batchId = `imp-${fileSha.slice(0, 16)}-${input.now.toString(36)}`;
  const statements: D1Stmt[] = [];
  let inserted = 0, updated = 0, duplicates = 0, translated = 0;
  const seenIds = new Set<string>();
  statements.push(db.prepare(`INSERT INTO import_batches (id, format, file_name, file_sha256, uploaded_by, status, rows_total, rows_new, rows_update, rows_duplicate, rows_invalid, created_at, committed_at)
    VALUES (?, ?, ?, ?, ?, 'committed', ?, ?, ?, ?, 0, ?, ?)`)
    .bind(batchId, input.format, input.fileName.slice(0, 200), fileSha, input.actor, preview.summary.total, preview.summary.new, preview.summary.update, preview.summary.duplicate, input.now, input.now));

  for (const row of preview.rows) {
    const q = row.question!;
    const hash = row.hash!;
    const id = questionId(q, hash);
    let known = stored.get(id);
    if (!known && !q.questionCode) {
      const r = await db.prepare("SELECT content_hash AS hash, (SELECT MAX(version) FROM question_versions v WHERE v.question_id = q.id) AS version FROM questions q WHERE q.id = ?").bind(id).first<{ hash: string | null; version: number | null }>();
      if (r) known = { hash: r.hash ?? "", version: r.version ?? 0 };
    }
    if (seenIds.has(id)) { duplicates++; continue; }
    if (known && known.hash === hash) {
      // Same German content and answer key: only new or changed Sorani text is taken over, as a draft. A changed
      // translation takes the question offline until it is reviewed again. Empty cells never erase a translation.
      duplicates++;
      seenIds.add(id);
      const hide = "UPDATE questions SET publication_status = 'hidden', stage = 'TRANSLATION_REVIEW', review_status = 'draft' WHERE id = ?";
      const upsert = (field: string, text: string) => db.prepare(`INSERT INTO question_translations (question_id, field, locale, text, status, translator, updated_at) VALUES (?, ?, 'ckb', ?, 'draft', ?, ?)
        ON CONFLICT (question_id, field, locale) DO UPDATE SET text = excluded.text, status = 'draft', translator = excluded.translator, updated_at = excluded.updated_at WHERE question_translations.text IS NOT excluded.text`)
        .bind(id, field, text, input.actor, input.now);
      for (const [column, field, text] of [["prompt_ckb", "prompt", q.prompt.ckb], ["explanation_ckb", "explanation", q.explanation.ckb]] as const) {
        if (!text) continue;
        statements.push(upsert(field, text),
          db.prepare(`${hide} AND ${column} IS NOT ?`).bind(id, text),
          db.prepare(`UPDATE questions SET ${column} = ? WHERE id = ? AND ${column} IS NOT ?`).bind(text, id, text));
        translated++;
      }
      for (const o of q.options) {
        if (!o.text.ckb) continue;
        statements.push(upsert(`option:${o.id}`, o.text.ckb),
          db.prepare(`${hide} AND EXISTS (SELECT 1 FROM answer_options WHERE question_id = ? AND option_id = ? AND text_ckb IS NOT ?)`).bind(id, id, o.id, o.text.ckb),
          db.prepare("UPDATE answer_options SET text_ckb = ? WHERE question_id = ? AND option_id = ? AND text_ckb IS NOT ?").bind(o.text.ckb, id, o.id, o.text.ckb));
        translated++;
      }
      continue;
    }
    seenIds.add(id);
    const snap: Snapshot = { question: { ...q, id }, hash, licenseId: q.licenseId ?? null };
    const version = (known?.version ?? 0) + 1;
    const versionRow = db.prepare("INSERT INTO question_versions (question_id, version, content_hash, catalogue_version, snapshot, import_batch_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, version, hash, q.catalogueVersion ?? null, JSON.stringify(snap), batchId, input.actor, input.now);
    if (known) {
      // Record the version first: the database lets licensed wording change only to a recorded version.
      statements.push(versionRow, ...writeQuestion(db, id, snap, false));
      updated++;
    } else {
      statements.push(...writeQuestion(db, id, snap, true), versionRow);
      inserted++;
    }
    for (const [field, text] of [["prompt", q.prompt.ckb], ["explanation", q.explanation.ckb], ...q.options.map((o) => [`option:${o.id}`, o.text.ckb] as const)] as const) {
      if (!text) continue;
      statements.push(db.prepare(`INSERT INTO question_translations (question_id, field, locale, text, status, translator, updated_at) VALUES (?, ?, 'ckb', ?, 'draft', ?, ?)
        ON CONFLICT (question_id, field, locale) DO UPDATE SET text = excluded.text, status = 'draft', translator = excluded.translator, updated_at = excluded.updated_at`)
        .bind(id, field, text, input.actor, input.now));
    }
  }
  try { await db.batch(statements); }
  catch (e) { return { ok: false, error: "WRITE_FAILED", detail: String((e as Error).message ?? e).slice(0, 300), preview }; }
  return { ok: true, batchId, inserted, updated, duplicates, translationFields: translated, preview };
}

export interface RollbackSummary { batchId: string; removed: number; restored: number }

/** Undo one stored import: new questions are removed, changed questions return to their previous version. */
export async function rollbackImport(db: ContentDb, batchId: string, actor: string, reason: string, now: number): Promise<StoreResult<RollbackSummary>> {
  if (!reason.trim()) return { ok: false, error: "REASON_REQUIRED" };
  const batch = await db.prepare("SELECT id, status FROM import_batches WHERE id = ?").bind(batchId).first<{ id: string; status: string }>();
  if (!batch) return { ok: false, error: "UNKNOWN_BATCH" };
  if (batch.status !== "committed" || await db.prepare("SELECT 1 AS x FROM import_rollbacks WHERE batch_id = ?").bind(batchId).first()) return { ok: false, error: "ALREADY_ROLLED_BACK" };

  const { results: mine } = await db.prepare("SELECT question_id AS id, version FROM question_versions WHERE import_batch_id = ?").bind(batchId).all<{ id: string; version: number }>();
  const statements: D1Stmt[] = [];
  let removed = 0, restored = 0;
  for (const v of mine) {
    const latest = await db.prepare("SELECT MAX(version) AS n FROM question_versions WHERE question_id = ?").bind(v.id).first<{ n: number }>();
    if ((latest?.n ?? v.version) !== v.version) return { ok: false, error: "LATER_BATCH_EXISTS", detail: `question ${v.id} was changed by a later import; roll that one back first` };
    if (v.version === 1) {
      statements.push(db.prepare("DELETE FROM questions WHERE id = ?").bind(v.id)); // options, versions, translations and media links cascade
      removed++;
    } else {
      const prev = await db.prepare("SELECT snapshot FROM question_versions WHERE question_id = ? AND version = ?").bind(v.id, v.version - 1).first<{ snapshot: string }>();
      const snap = JSON.parse(prev?.snapshot ?? "null") as Snapshot | null;
      if (!snap?.question) return { ok: false, error: "WRITE_FAILED", detail: `previous version of ${v.id} cannot be read` };
      statements.push(...writeQuestion(db, v.id, snap, false), db.prepare("DELETE FROM question_versions WHERE question_id = ? AND version = ?").bind(v.id, v.version));
      restored++;
    }
  }
  statements.push(
    db.prepare("INSERT INTO import_rollbacks (batch_id, rolled_back_by, reason, questions_removed, questions_restored, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(batchId, actor, reason.trim().slice(0, 500), removed, restored, now),
    // 'rejected' frees the file hash, so a corrected file — or the same one — can be imported again.
    db.prepare("UPDATE import_batches SET status = 'rejected' WHERE id = ?").bind(batchId),
  );
  try { await db.batch(statements); }
  catch (e) { return { ok: false, error: "WRITE_FAILED", detail: String((e as Error).message ?? e).slice(0, 300) }; }
  return { ok: true, batchId, removed, restored };
}

export interface ContentProgress {
  questions: { total: number; published: number; byStage: Record<string, number>; bySource: Record<string, number>; byCountry: Record<string, number>; withSorani: number; withMedia: number };
  translations: Record<string, number>;
  media: { total: number; images: number; videos: number; withProvenance: number; reviewed: number; scenes: number; scenarios: number };
  licenses: { id: string; status: string; country: string; validUntil: string | null; questions: number }[];
  batches: { id: string; fileName: string | null; status: string; total: number; createdAt: number; rolledBack: boolean }[];
}

const tally = async (db: D1Like, sql: string) => Object.fromEntries((await db.prepare(sql).all<{ k: string; n: number }>()).results.map((r) => [r.k, r.n]));

/** Read-only numbers for the owner's progress report. Counts real rows only. */
export async function contentProgress(db: D1Like): Promise<ContentProgress> {
  const one = async (sql: string) => (await db.prepare(sql).first<{ n: number }>())?.n ?? 0;
  return {
    questions: {
      total: await one("SELECT COUNT(*) AS n FROM questions"),
      published: await one("SELECT COUNT(*) AS n FROM questions WHERE publication_status = 'published'"),
      byStage: await tally(db, "SELECT stage AS k, COUNT(*) AS n FROM questions GROUP BY stage"),
      bySource: await tally(db, "SELECT source_type AS k, COUNT(*) AS n FROM questions GROUP BY source_type"),
      byCountry: await tally(db, "SELECT country AS k, COUNT(*) AS n FROM questions GROUP BY country"),
      withSorani: await one("SELECT COUNT(*) AS n FROM questions WHERE length(prompt_ckb) > 0"),
      withMedia: await one("SELECT COUNT(DISTINCT question_id) AS n FROM question_media"),
    },
    translations: await tally(db, "SELECT status AS k, COUNT(*) AS n FROM question_translations GROUP BY status"),
    media: {
      total: await one("SELECT COUNT(*) AS n FROM media_assets"),
      images: await one("SELECT COUNT(*) AS n FROM media_assets WHERE kind = 'image'"),
      videos: await one("SELECT COUNT(*) AS n FROM media_assets WHERE kind = 'video'"),
      withProvenance: await one("SELECT COUNT(*) AS n FROM media_provenance"),
      reviewed: await one("SELECT COUNT(*) AS n FROM media_assets m WHERE EXISTS (SELECT 1 FROM content_reviews r WHERE r.content_kind = 'media' AND r.content_id = m.id AND r.role = 'driving_instructor' AND r.outcome = 'pass' AND r.content_hash = m.sha256)"),
      scenes: await one("SELECT COUNT(*) AS n FROM scene_library"),
      scenarios: await one("SELECT COUNT(*) AS n FROM scenario_sheets"),
    },
    licenses: (await db.prepare("SELECT l.id, l.status, l.country, l.valid_until AS until, (SELECT COUNT(*) FROM questions q WHERE q.license_id = l.id) AS questions FROM content_licenses l ORDER BY l.id")
      .all<{ id: string; status: string; country: string; until: number | null; questions: number }>()).results.map((l) => ({ id: l.id, status: l.status, country: l.country, validUntil: l.until === null ? null : day(l.until), questions: l.questions })),
    batches: (await db.prepare("SELECT b.id, b.file_name AS fileName, b.status, b.rows_total AS total, b.created_at AS createdAt, EXISTS (SELECT 1 FROM import_rollbacks r WHERE r.batch_id = b.id) AS rolledBack FROM import_batches b ORDER BY b.created_at DESC LIMIT 50")
      .all<{ id: string; fileName: string | null; status: string; total: number; createdAt: number; rolledBack: number }>()).results.map((b) => ({ ...b, rolledBack: !!b.rolledBack })),
  };
}
