import { describe, expect, it } from "vitest";
import fixture from "../fixtures/import/valid.json?raw";
import { commitImport, contentProgress, loadLicenses, rollbackImport, type ContentDb } from "../../worker/content/store";
import { handleAdmin } from "../../worker/lib/admin";
import { readFlags } from "../../src/lib/shared/flags";
import type { D1Stmt } from "../../worker/dr/db";
import type { MediaManifestEntry } from "../../src/lib/shared/importer";
import { TOPICS } from "../../src/content/topics";
import { readFileSync } from "node:fs";
import { serveMedia, storeMedia, type MediaBucket } from "../../worker/content/media";

// D1 is SQLite: run the real migrations on node:sqlite behind the D1 interface (batch = one transaction).
interface SqliteStatement { get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; run(...p: unknown[]): unknown }
interface SqliteDb { exec(sql: string): void; prepare(sql: string): SqliteStatement }
const sqliteModule = "node:" + "sqlite";
const { DatabaseSync } = (await import(/* @vite-ignore */ sqliteModule)) as { DatabaseSync: new (path: string) => SqliteDb };
const migrations = Object.entries(import.meta.glob<string>("../../migrations/*.sql", { query: "?raw", import: "default", eager: true })).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);

const NOW = Date.UTC(2026, 5, 1, 12);
const KEY = `media/${"a".repeat(64)}.png`;
const MEDIA: MediaManifestEntry[] = [{ file: "fixture.png", kind: "image", key: KEY, bytes: 10, mime: "image/png" }];
type Stmt = D1Stmt & { sql: string; params: unknown[] };

function setup(opts: { licence?: "verified" | "draft" | "none"; media?: boolean; topics?: string[] } = {}) {
  const raw = new DatabaseSync(":memory:");
  for (const sql of migrations) raw.exec(sql);
  raw.exec("PRAGMA foreign_keys = ON");
  for (const t of TOPICS.filter((x) => !opts.topics || opts.topics.includes(x.id))) raw.prepare("INSERT INTO topics VALUES (?, ?, ?, ?)").run(t.id, t.title.ckb, t.title.de, t.category);
  if ((opts.licence ?? "verified") !== "none") {
    raw.prepare(`INSERT INTO content_licenses (id, licensor, scope, valid_from, evidence_ref, status, verified_by, verified_at, right_question_text, right_official_media, right_translation, right_own_media, right_online, right_offline, catalogue_versions, license_classes)
      VALUES ('LIC-FIXTURE', 'Fixture Licensor', 'test', ?, 'contract-1', ?, ?, ?, 1, 1, 1, 1, 1, 1, '["2026-01-01"]', '["B"]')`)
      .run(Date.UTC(2026, 0, 1), opts.licence ?? "verified", opts.licence === "draft" ? null : "Owner", opts.licence === "draft" ? null : NOW);
  }
  if (opts.media ?? true) raw.prepare("INSERT INTO media_assets VALUES ('m1', 'image', ?, ?, 'image/png', 10, NULL, NULL, NULL, 'LIC-FIXTURE', 'owner', ?)").run(KEY, "a".repeat(64), NOW);
  const stmt = (sql: string, params: unknown[]): Stmt => ({
    sql, params,
    bind: (...v: unknown[]) => stmt(sql, v),
    first: async <T,>() => (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    all: async <T,>() => ({ results: raw.prepare(sql).all(...params) as T[] }),
    run: async () => raw.prepare(sql).run(...params),
  });
  const db: ContentDb = {
    prepare: (sql: string) => stmt(sql, []),
    batch: async (statements) => {
      raw.exec("BEGIN");
      try { for (const s of statements as Stmt[]) raw.prepare(s.sql).run(...s.params); raw.exec("COMMIT"); }
      catch (e) { raw.exec("ROLLBACK"); throw e; }
    },
  };
  const count = (table: string, where = "1") => (raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get() as { n: number }).n;
  const row = (sql: string, ...p: unknown[]) => raw.prepare(sql).get(...p) as Record<string, unknown>;
  return { db, raw, count, row };
}
const file = (edit: (rows: Record<string, unknown>[]) => void = () => undefined) => { const d = JSON.parse(fixture) as { questions: Record<string, unknown>[] }; edit(d.questions); return JSON.stringify(d); };
const commit = (db: ContentDb, text = fixture, now = NOW, fileName = "bank.json") => commitImport(db, { format: "json", text, fileName, actor: "owner", now, media: MEDIA });
const ID1 = "off-0.0.00-001";

describe("stored import", () => {
  it("stores the whole file as hidden drafts with version 1, draft translations and media links", async () => {
    const { db, count, row } = setup();
    const r = await commit(db);
    expect(r).toMatchObject({ ok: true, inserted: 2, updated: 0, duplicates: 0 });
    expect(count("questions")).toBe(2);
    expect(count("questions", "publication_status = 'hidden' AND stage = 'DRAFT' AND review_status = 'draft' AND country = 'DE'")).toBe(2);
    expect(row("SELECT * FROM questions WHERE id = ?", ID1)).toMatchObject({ question_code: "0.0.00-001", points: 4, source_type: "licensed_official", license_id: "LIC-FIXTURE", catalogue_version: "2026-01-01", prompt_de: "Platzhalter-Testfrage eins" });
    expect(count("answer_options", `question_id = '${ID1}'`)).toBe(2);
    expect(count("answer_options", `question_id = '${ID1}' AND is_correct = 1 AND option_id = 'a'`)).toBe(1);
    expect(count("question_versions", "version = 1")).toBe(2);
    expect(count("question_translations", "status = 'draft'")).toBe(4); // prompt, explanation, two options of row 1
    expect(count("question_media", `question_id = '${ID1}'`)).toBe(1);
    expect(row("SELECT * FROM import_batches")).toMatchObject({ status: "committed", rows_total: 2, rows_new: 2, rows_invalid: 0, file_name: "bank.json" });
    expect(row("SELECT numeric_answer, answer_type FROM questions WHERE question_code = '0.0.00-002'")).toEqual({ numeric_answer: 40, answer_type: "number" });
  });

  it("stores nothing while the licence is not bought, not verified or not on record", async () => {
    for (const licence of ["draft", "none"] as const) {
      const { db, count } = setup({ licence, media: licence === "draft" });
      const r = await commit(db);
      expect(r).toMatchObject({ ok: false, error: "INVALID_ROWS" });
      expect(count("questions") + count("import_batches") + count("question_versions")).toBe(0);
    }
  });

  it("the database refuses to publish what was imported until it is approved", async () => {
    const { db, raw } = setup();
    await commit(db);
    expect(() => raw.exec(`UPDATE questions SET publication_status = 'published' WHERE id = '${ID1}'`)).toThrow(); // blocked by the approval and media-review triggers
  });

  it("refuses a file whose media is not stored, and the same file twice", async () => {
    const a = setup({ media: false });
    // Without the media asset the licence fixture row cannot reference it either; register the licence only.
    expect(await commit(a.db)).toMatchObject({ ok: false, error: "MEDIA_NOT_STORED" });
    expect(a.count("questions")).toBe(0);
    const b = setup();
    expect((await commit(b.db)).ok).toBe(true);
    expect(await commit(b.db, fixture, NOW + 1)).toMatchObject({ ok: false, error: "ALREADY_IMPORTED" });
    expect(b.count("import_batches")).toBe(1);
  });

  it("is atomic: one row the database rejects means nothing is stored", async () => {
    const { db, count } = setup({ topics: ["priority"] }); // topic of row 2 is missing in the database
    expect(await commit(db)).toMatchObject({ ok: false, error: "WRITE_FAILED" });
    expect(count("questions") + count("import_batches") + count("answer_options") + count("question_versions")).toBe(0);
  });

  it("rejects malformed, empty and oversized files", async () => {
    const { db } = setup();
    expect(await commit(db, "{not json")).toMatchObject({ ok: false, error: "FATAL_FILE" });
    expect(await commit(db, "[]")).toMatchObject({ ok: false, error: "EMPTY" });
    expect(await commit(db, " ".repeat(5 * 1024 * 1024 + 1))).toMatchObject({ ok: false, error: "TOO_LARGE" });
  });

  it("a changed question becomes version 2, goes offline, and unchanged rows are duplicates", async () => {
    const { db, raw, count, row } = setup();
    await commit(db);
    // Publish row 1 properly, then import a new catalogue wording for it.
    const h1 = row("SELECT content_hash AS h FROM questions WHERE id = ?", ID1).h as string;
    raw.prepare("INSERT INTO media_provenance VALUES ('m1', 'licensed', 'Licensor', NULL, NULL, '[]', 0, NULL, ?)").run(NOW);
    raw.prepare("INSERT INTO content_reviews VALUES ('rm', 'm1', 'media', 'EDUCATIONAL_REVIEW', 'Instructor', 'driving_instructor', 'pass', 'e', ?, ?)").run("a".repeat(64), NOW);
    raw.prepare("INSERT INTO content_reviews VALUES ('ra', ?, 'question', 'APPROVED', 'Owner', 'content_owner', 'pass', 'e', ?, ?)").run(ID1, h1, NOW);
    raw.exec(`UPDATE questions SET stage = 'APPROVED' WHERE id = '${ID1}'`);
    raw.exec(`UPDATE questions SET publication_status = 'published' WHERE id = '${ID1}'`);

    const r = await commit(db, file((q) => { (q[0]!.prompt as { de: string }).de = "Platzhalter-Testfrage eins, neue Fassung"; }), NOW + 1000, "bank-v2.json");
    expect(r).toMatchObject({ ok: true, inserted: 0, updated: 1, duplicates: 1 });
    expect(row("SELECT prompt_de, publication_status, stage FROM questions WHERE id = ?", ID1)).toEqual({ prompt_de: "Platzhalter-Testfrage eins, neue Fassung", publication_status: "hidden", stage: "DRAFT" });
    expect(count("question_versions", `question_id = '${ID1}'`)).toBe(2);
    expect(count("answer_options", `question_id = '${ID1}'`)).toBe(2);
    expect(count("questions")).toBe(2);
    expect(() => raw.exec(`UPDATE questions SET stage = 'APPROVED' WHERE id = '${ID1}'; UPDATE questions SET publication_status = 'published' WHERE id = '${ID1}'`)).toThrow(); // old approval does not cover it
  });

  it("rollback restores the previous version, removes new questions and frees the file for a new import", async () => {
    const { db, count, row } = setup();
    const first = await commit(db);
    const second = await commit(db, file((q) => { (q[0]!.prompt as { de: string }).de = "Geänderte Fassung"; q[0]!.correct = ["b"]; }), NOW + 1000);
    if (!first.ok || !second.ok) throw new Error("setup failed");
    expect(await rollbackImport(db, first.batchId, "owner", "wrong file", NOW + 2000)).toMatchObject({ ok: false, error: "LATER_BATCH_EXISTS" });
    expect(await rollbackImport(db, second.batchId, "owner", "  ", NOW + 2000)).toMatchObject({ ok: false, error: "REASON_REQUIRED" });

    expect(await rollbackImport(db, second.batchId, "owner", "wrong release", NOW + 2000)).toMatchObject({ ok: true, removed: 0, restored: 1 });
    expect(row("SELECT prompt_de FROM questions WHERE id = ?", ID1).prompt_de).toBe("Platzhalter-Testfrage eins");
    expect(count("answer_options", `question_id = '${ID1}' AND is_correct = 1 AND option_id = 'a'`)).toBe(1);
    expect(count("question_versions", `question_id = '${ID1}'`)).toBe(1);
    expect(count("question_media", `question_id = '${ID1}'`)).toBe(1);
    expect(row("SELECT * FROM import_rollbacks WHERE batch_id = ?", second.batchId)).toMatchObject({ rolled_back_by: "owner", reason: "wrong release", questions_restored: 1 });
    expect(await rollbackImport(db, second.batchId, "owner", "again", NOW + 3000)).toMatchObject({ ok: false, error: "ALREADY_ROLLED_BACK" });
    expect(await rollbackImport(db, "nope", "owner", "x", NOW)).toMatchObject({ ok: false, error: "UNKNOWN_BATCH" });

    expect(await rollbackImport(db, first.batchId, "owner", "start over", NOW + 4000)).toMatchObject({ ok: true, removed: 2, restored: 0 });
    expect(count("questions") + count("answer_options") + count("question_versions") + count("question_translations") + count("question_media")).toBe(0);
    expect(count("media_assets")).toBe(1); // media files are kept
    expect((await commit(db, fixture, NOW + 5000)).ok).toBe(true); // the same file can be imported again
  });

  it("takes over new Sorani text for unchanged questions as a draft and never erases a translation", async () => {
    const { db, raw, count, row } = setup();
    await commit(db);
    raw.exec("UPDATE question_translations SET status = 'approved'");
    const r = await commit(db, file((q) => { (q[0]!.prompt as { ckb: string }).ckb = "پرسیاری نوێکراوە"; delete (q[0]!.explanation as { ckb?: string }).ckb; }), NOW + 1000);
    expect(r).toMatchObject({ ok: true, inserted: 0, updated: 0, duplicates: 2 });
    expect(row("SELECT prompt_ckb, explanation_ckb, stage FROM questions WHERE id = ?", ID1)).toEqual({ prompt_ckb: "پرسیاری نوێکراوە", explanation_ckb: "ڕوونکردنەوەی تاقیکردنەوە", stage: "TRANSLATION_REVIEW" });
    expect(row("SELECT status FROM question_translations WHERE question_id = ? AND field = 'prompt'", ID1).status).toBe("draft");
    expect(row("SELECT status FROM question_translations WHERE question_id = ? AND field = 'explanation'", ID1).status).toBe("approved"); // untouched
    expect(count("question_versions")).toBe(2); // German content unchanged: no new version
  });

  it("keeps original and licensed content apart: original rows need no licence and never get an official number", async () => {
    const { db, count, row } = setup({ licence: "none", media: false });
    const original = JSON.stringify([{ questionCode: null, catalogueVersion: null, sourceType: "original", licenseId: null, categoryType: "Grundstoff", points: 3, licenseClasses: ["B"], topicId: "priority", answerType: "choice",
      prompt: { de: "Eigene Übungsfrage", ckb: "پرسیاری خۆمان" }, options: [{ id: "a", de: "Ja", ckb: "بەڵێ" }, { id: "b", de: "Nein", ckb: "نەخێر" }], correct: ["a"], explanation: { de: "Erklärung", ckb: "ڕوونکردنەوە" } }]);
    expect(await commit(db, original)).toMatchObject({ ok: true, inserted: 1 });
    const q = row("SELECT id, question_code, license_id, source_type FROM questions");
    expect(q).toMatchObject({ question_code: null, license_id: null, source_type: "original" });
    expect(String(q.id)).toMatch(/^orig-[0-9a-f]{20}$/);
    expect(await commit(db, `${original} `, NOW + 1)).toMatchObject({ ok: true, inserted: 0, duplicates: 1 }); // same content, other file
    expect(count("questions")).toBe(1);
  });

  it("reports real numbers only", async () => {
    const { db } = setup();
    expect((await contentProgress(db)).questions).toMatchObject({ total: 0, published: 0 });
    const c = await commit(db);
    const p = await contentProgress(db);
    expect(p.questions).toMatchObject({ total: 2, published: 0, byStage: { DRAFT: 2 }, bySource: { licensed_official: 2 }, byCountry: { DE: 2 }, withSorani: 1, withMedia: 1 });
    expect(p.translations).toEqual({ draft: 4 });
    expect(p.media).toMatchObject({ total: 1, images: 1, videos: 0, withProvenance: 0, reviewed: 0 });
    expect(p.licenses).toEqual([{ id: "LIC-FIXTURE", status: "verified", country: "DE", validUntil: null, questions: 2 }]);
    expect(p.batches[0]).toMatchObject({ id: c.ok ? c.batchId : "", status: "committed", total: 2, rolledBack: false });
    expect((await loadLicenses(db)).get("LIC-FIXTURE")!.rights.translation).toBe(true);
  });
});

describe("admin routes for stored imports", () => {
  const TOKEN = "owner-test-token-0123456789abcdef0123456789";
  const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  const call = async (env: Record<string, unknown>, path: string, body?: unknown) =>
    handleAdmin(new Request(`https://regadrive.test${path}`, { method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: body === undefined ? undefined : JSON.stringify(body) }),
      { ...env, ADMIN_OWNER_TOKEN_SHA256: await sha(TOKEN) }, readFlags(env), json, { sink: { write: () => undefined }, now: NOW });
  const ACTIVE = { CONTENT_ADMIN_ENABLED: "true", CONTENT_IMPORT_EXECUTION_ENABLED: "true", DATABASE_PRODUCTION_ENABLED: "true", OWNER_DATABASE_ACTIVATION: "I-APPROVE-LIVE-ACTIVATION" };

  it("answer 503 and write nothing unless the owner activated the database, the import flag and the binding", async () => {
    const { db, count } = setup();
    const body = { format: "json", data: fixture, media: MEDIA };
    for (const env of [
      { CONTENT_ADMIN_ENABLED: "true", CONTENT_DB: db },
      { ...ACTIVE, OWNER_DATABASE_ACTIVATION: "yes", CONTENT_DB: db },
      { ...ACTIVE, CONTENT_IMPORT_EXECUTION_ENABLED: "false", CONTENT_DB: db },
      { ...ACTIVE }, // activated but no binding (today's wrangler.jsonc)
    ]) {
      for (const [path, b] of [["/api/admin/import/commit", body], ["/api/admin/import/rollback", { batchId: "x", reason: "y" }], ["/api/admin/content/progress", undefined]] as const) {
        expect((await call(env, path, b)).status).toBe(503);
      }
    }
    expect(count("questions") + count("import_batches")).toBe(0);
  });

  it("store, report and roll back once everything is activated", async () => {
    const { db, count } = setup();
    const env = { ...ACTIVE, CONTENT_DB: db };
    const stored = await (await call(env, "/api/admin/import/commit", { format: "json", data: fixture, fileName: "bank.json", media: MEDIA })).json() as { stored: boolean; published: boolean; batchId: string; inserted: number };
    expect(stored).toMatchObject({ stored: true, published: false, inserted: 2 });
    const progress = await (await call(env, "/api/admin/content/progress")).json() as { progress: { questions: { total: number; published: number } } };
    expect(progress.progress.questions).toMatchObject({ total: 2, published: 0 });
    expect((await call(env, "/api/admin/import/commit", { format: "json", data: fixture, media: MEDIA })).status).toBe(422);
    expect((await call(env, "/api/admin/import/rollback", { batchId: stored.batchId, reason: "test" })).status).toBe(200);
    expect(count("questions")).toBe(0);
    expect((await call(env, "/api/admin/media/upload", {})).status).toBe(503); // no media bucket bound
  });

  it("upload media only with the activation and the bucket, deduplicated by content", async () => {
    const { db, count } = setup({ media: false });
    const bucket = fakeBucket();
    const png = new Uint8Array(readFileSync("tests/fixtures/media/sample-test-pattern.png"));
    const upload = async (env: Record<string, unknown>, name: string, bytes: Uint8Array) =>
      handleAdmin(new Request("https://regadrive.test/api/admin/media/upload", { method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "x-file-name": name }, body: bytes as BodyInit }),
        { ...env, ADMIN_OWNER_TOKEN_SHA256: await sha(TOKEN) }, readFlags(env), json, { sink: { write: () => undefined }, now: NOW });
    expect((await upload({ ...ACTIVE, CONTENT_DB: db, MEDIA: bucket, OWNER_DATABASE_ACTIVATION: "no" }, "a.png", png)).status).toBe(503);
    expect((await upload({ ...ACTIVE, CONTENT_DB: db }, "a.png", png)).status).toBe(503);
    expect(bucket.objects.size + count("media_assets")).toBe(0);
    const env = { ...ACTIVE, CONTENT_DB: db, MEDIA: bucket };
    const first = await (await upload(env, "scene.png", png)).json() as { stored: boolean; published: boolean; key: string; duplicate: boolean };
    expect(first).toMatchObject({ stored: true, published: false, duplicate: false });
    expect(first.key).toMatch(/^media\/[0-9a-f]{64}\.png$/);
    expect((await (await upload(env, "again.png", png)).json() as { duplicate: boolean }).duplicate).toBe(true);
    expect(count("media_assets")).toBe(1);
    expect(bucket.objects.size).toBe(1);
    // Type by magic bytes: a PNG renamed .webp, and an SVG, are refused and nothing is stored.
    expect((await upload(env, "scene.webp", png)).status).toBe(422);
    expect((await upload(env, "x.png", new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).status).toBe(422);
    expect(count("media_assets")).toBe(1);
  });
});

function fakeBucket() {
  const objects = new Map<string, Uint8Array>();
  const bucket: MediaBucket & { objects: typeof objects } = {
    objects,
    put: async (key, value) => { objects.set(key, value); return {}; },
    get: async (key, opts) => {
      const b = objects.get(key);
      if (!b) return null;
      const r = opts?.range;
      const offset = !r ? 0 : "suffix" in r ? b.length - r.suffix : r.offset;
      if (offset >= b.length) throw new Error("InvalidRange");
      const length = !r ? b.length : "suffix" in r ? r.suffix : r.length ?? b.length - offset;
      const part = b.subarray(offset, offset + length);
      return { body: new Blob([part as BlobPart]).stream(), size: b.length, range: r ? { offset, length: part.length } : undefined, httpEtag: '"e"' };
    },
  };
  return bucket;
}

describe("media serving", () => {
  const png = new Uint8Array(readFileSync("tests/fixtures/media/sample-test-pattern.png"));
  const get = (db: ContentDb, bucket: MediaBucket, key: string, headers: Record<string, string> = {}) => serveMedia(new Request(`https://regadrive.test/${key}`, { headers }), db, bucket);

  it("serves a file only while a published question uses it", async () => {
    const { db, raw } = setup({ media: false });
    const bucket = fakeBucket();
    const stored = await storeMedia(db, bucket, "scene.png", png, "owner", NOW);
    if (!stored.ok) throw new Error("upload failed");
    expect((await get(db, bucket, stored.key)).status).toBe(404); // stored, not used
    raw.exec(`INSERT INTO topics VALUES ('t-media','x','x','Grundstoff') ON CONFLICT DO NOTHING`);
    raw.prepare(`INSERT INTO questions (id,topic_id,points,category_type,license_classes,source_type,content_version,review_status,prompt_ckb,prompt_de,explanation_ckb,explanation_de,content_hash) VALUES ('qm','t-media',3,'Grundstoff','["B"]','original','v','pending','p','p','e','e','hq')`).run();
    raw.prepare("INSERT INTO question_media VALUES ('qm', ?, 'stimulus', 0, 'Bild', NULL)").run(stored.id);
    expect((await get(db, bucket, stored.key)).status).toBe(404); // used by a hidden draft
    // Publish through the real gates: owner approval of this content, media provenance and an instructor review of this exact file.
    raw.prepare(`INSERT INTO content_reviews VALUES ('ra','qm','question','APPROVED','Owner','content_owner','pass','evidence/a','hq',${NOW})`).run();
    raw.exec("UPDATE questions SET stage = 'APPROVED' WHERE id = 'qm'");
    expect(() => raw.exec("UPDATE questions SET publication_status = 'published' WHERE id = 'qm'")).toThrow(/media/);
    raw.prepare(`INSERT INTO media_provenance (media_id, origin, author, tool, source_file, created_at) VALUES (?, 'original_regadrive', 'RegaDRIVE', 'FFmpeg test pattern', 'tests/fixtures/media', ${NOW})`).run(stored.id);
    raw.prepare(`INSERT INTO content_reviews VALUES ('rm', ?, 'media', 'EDUCATIONAL_REVIEW', 'Instructor', 'driving_instructor', 'pass', 'evidence/m', ?, ${NOW})`).run(stored.id, stored.sha256);
    raw.exec("UPDATE questions SET publication_status = 'published' WHERE id = 'qm'");
    const ok = await get(db, bucket, stored.key);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ok.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(png);
    const part = await get(db, bucket, stored.key, { range: "bytes=0-9" });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-9/${png.length}`);
    expect((await part.arrayBuffer()).byteLength).toBe(10);
    expect((await get(db, bucket, stored.key, { range: `bytes=${png.length + 5}-` })).status).toBe(416);
    expect((await get(db, bucket, stored.key, { range: "bytes=9-3" })).status).toBe(416);
    raw.exec("UPDATE questions SET publication_status = 'hidden' WHERE id = 'qm'");
    expect((await get(db, bucket, stored.key)).status).toBe(404); // unpublished: offline at once
  });

  it("refuses keys that are not content-addressed media", async () => {
    const { db } = setup({ media: false });
    for (const key of ["media/../index.html", "media/abc.png", `media/${"a".repeat(64)}.svg`, `media/${"a".repeat(64)}.png/x`]) {
      expect((await get(db, fakeBucket(), key)).status).toBe(404);
    }
  });
});
