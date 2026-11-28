import { describe, expect, it } from "vitest";
import { listStaging, parseStagingDecision, parseStagingDecisions, parseStagingQuery, recordStagingDecision, STAGING_PAGE_MAX, summariseStaging } from "../../worker/italy/stagingReview";
import { checkReviewMetadata } from "../../worker/dr/reviews";
import type { D1Like } from "../../worker/dr/db";

// D1 is SQLite: run the real content migrations on node:sqlite behind the D1 interface.
interface SqliteStatement { get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; run(...p: unknown[]): { changes: number | bigint } }
interface SqliteDb { exec(sql: string): void; prepare(sql: string): SqliteStatement }
const sqliteModule = "node:" + "sqlite";
const { DatabaseSync } = (await import(/* @vite-ignore */ sqliteModule)) as { DatabaseSync: new (path: string) => SqliteDb };
const migrations = Object.entries(import.meta.glob<string>("../../migrations-content/*.sql", { query: "?raw", import: "default", eager: true }))
  .sort(([a], [b]) => a.localeCompare(b));
// The rows are staged after 0005 and before 0006, which derives the draft chapters, as in production.
const before = migrations.filter(([f]) => f < "../../migrations-content/0006").map(([, sql]) => sql);
const after = migrations.filter(([f]) => f >= "../../migrations-content/0006").map(([, sql]) => sql);

function setup() {
  const raw = new DatabaseSync(":memory:");
  for (const sql of before) raw.exec(sql);
  const h = "a".repeat(64);
  const ins = raw.prepare(`INSERT INTO italy_catalogue_staging (source_id, source_row_sha256, batch, question_it, correct_answer, answer_original, source_group, image, image_sha256, ckb, kmr_arab)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  ins.run("21810", h, "batch-001", "Il segnale raffigurato preavvisa confine di Stato", 1, "VERO", "Quesito n° 4328 - Segnali di indicazione", "images/it_21810.jpg", h, "نیشانەی نیشاندراو", "نیشانا نیشاندایی");
  ins.run("21816", h, "batch-001", "Il segnale raffigurato è posto dietro al veicolo", 0, "FALSO", "Quesito n° 4328 - Segnali di pericolo", null, null, "نیشانەی نیشاندراو", "نیشانا نیشاندایی");
  for (const sql of after) raw.exec(sql);
  const stmt = (sql: string, params: unknown[]) => ({
    bind: (...v: unknown[]) => stmt(sql, v),
    first: async <T,>() => (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    all: async <T,>() => ({ results: raw.prepare(sql).all(...params) as T[] }),
    run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...params).changes) } }),
  });
  const db = { prepare: (sql: string) => stmt(sql, []) } as unknown as D1Like;
  const row = (id: string) => raw.prepare("SELECT * FROM italy_catalogue_staging WHERE source_id = ?").get(id) as Record<string, unknown>;
  return { db, row };
}

const decision = { sourceId: "21810", language: "ckb", status: "approved", reviewerName: "Ahmed Karim", reviewedOn: "2026-11-20", evidenceRef: "signed-review-2026-11", note: "" };

describe("staged Italian catalogue review", () => {
  it("parses list queries within bounds", () => {
    const q = parseStagingQuery(new URLSearchParams("offset=-5&limit=9999&chapter=17&status=done&q=%20segnale%20"));
    expect(q).toEqual({ offset: 0, limit: STAGING_PAGE_MAX, chapter: null, status: null, search: "segnale", checks: null, queue: null });
    expect(parseStagingQuery(new URLSearchParams("queue=ready")).queue).toBe("ready");
    expect(parseStagingQuery(new URLSearchParams("")).limit).toBe(25);
    expect(parseStagingQuery(new URLSearchParams("queue=all")).queue).toBeNull();
    expect(parseStagingQuery(new URLSearchParams("checks=errors")).checks).toBe("errors");
    expect(parseStagingQuery(new URLSearchParams("checks=approved")).checks).toBeNull();
    expect(parseStagingQuery(new URLSearchParams("chapter=8&status=pending")).chapter).toBe(8);
  });

  it("lists rows in all three languages with the image reference and the draft chapter", async () => {
    const { db } = setup();
    const res = await listStaging(db, parseStagingQuery(new URLSearchParams("")));
    expect(res.total).toBe(2);
    expect(res.rows[0]).toMatchObject({ source_id: "21810", question_it: expect.stringContaining("segnale"), ckb: "نیشانەی نیشاندراو", kmr_arab: "نیشانا نیشاندایی", image: "images/it_21810.jpg", chapter_draft: 8, ckb_status: "pending" });
    expect((await listStaging(db, parseStagingQuery(new URLSearchParams("chapter=2")))).rows.map((r) => r.source_id)).toEqual(["21816"]);
    expect((await listStaging(db, parseStagingQuery(new URLSearchParams("q=21816")))).total).toBe(1);
  });

  it("rejects malformed decisions and machine reviewers", () => {
    expect(parseStagingDecision({ ...decision, language: "it" })).toBe("BAD_LANGUAGE");
    expect(parseStagingDecision({ ...decision, status: "published" })).toBe("BAD_STATUS");
    expect(parseStagingDecision({ ...decision, sourceId: "../x" })).toBe("UNKNOWN_ITEM");
    const machine = parseStagingDecision({ ...decision, reviewerName: "Claude" });
    expect(typeof machine).toBe("object");
    expect(checkReviewMetadata(machine as Exclude<typeof machine, string>, "2026-11-27")).toBe("REVIEWER_NAME_INVALID");
    expect(checkReviewMetadata({ ...decision, evidenceRef: "x" }, "2026-11-27")).toBe("EVIDENCE_REQUIRED");
  });

  it("records one language decision without publishing or touching the source", async () => {
    const { db, row } = setup();
    const parsed = parseStagingDecision(decision);
    if (typeof parsed === "string") throw new Error(parsed);
    expect(await recordStagingDecision(db, parsed, "owner:test")).toBe(true);
    const r = row("21810");
    expect(r).toMatchObject({ ckb_status: "approved", kmr_arab_status: "pending", publish_status: "unpublished", reviewer_name: "Ahmed Karim", correct_answer: 1 });
    expect(String(r.review_notes)).toContain("evidence: signed-review-2026-11");
    expect(await recordStagingDecision(db, { ...parsed, sourceId: "99999" }, "owner:test")).toBe(false);
  });

  it("parses bulk decisions for selected questions only, within the page limit", () => {
    const many = parseStagingDecisions({ ...decision, sourceId: undefined, sourceIds: ["21810", "21816"] });
    expect(Array.isArray(many) && many.map((d) => d.sourceId)).toEqual(["21810", "21816"]);
    expect(parseStagingDecisions({ ...decision, sourceIds: [] })).toBe("NO_ITEMS");
    expect(parseStagingDecisions({ ...decision, sourceIds: ["21810", "21810"] })).toBe("REPEATED_ITEM");
    expect(parseStagingDecisions({ ...decision, sourceIds: Array.from({ length: STAGING_PAGE_MAX + 1 }, (_, i) => String(i + 1)) })).toBe("TOO_MANY_ITEMS");
    expect(parseStagingDecisions({ ...decision, sourceIds: ["21810", "x"] })).toBe("UNKNOWN_ITEM");
    const single = parseStagingDecisions(decision);
    expect(Array.isArray(single) && single.length).toBe(1);
  });

  it("records a bulk decision for each selected question and leaves the others untouched", async () => {
    const { db, row } = setup();
    const many = parseStagingDecisions({ ...decision, language: "kmrArab", status: "needs_revision", sourceIds: ["21816"] });
    if (typeof many === "string") throw new Error(many);
    for (const d of many) expect(await recordStagingDecision(db, d, "owner:test")).toBe(true);
    expect(row("21816")).toMatchObject({ kmr_arab_status: "needs_revision", ckb_status: "pending", publish_status: "unpublished" });
    expect(row("21810")).toMatchObject({ kmr_arab_status: "pending", ckb_status: "pending" });
  });

  it("attaches the automatic checks and the blockers to every listed row, and filters on the checks", async () => {
    const { db } = setup();
    const res = await listStaging(db, parseStagingQuery(new URLSearchParams("")));
    expect(res.rows[0]).toMatchObject({ source_id: "21810", checks: { errors: 0, warnings: 0 }, blockers: ["CKB_NOT_APPROVED", "KMR_ARAB_NOT_APPROVED", "IMAGE_RIGHTS_UNVERIFIED"] });
    expect((await listStaging(db, parseStagingQuery(new URLSearchParams("checks=clean")))).total).toBe(2);
    expect((await listStaging(db, parseStagingQuery(new URLSearchParams("checks=errors")))).rows).toEqual([]);
    const page = await listStaging(db, parseStagingQuery(new URLSearchParams("checks=clean&limit=1&offset=1")));
    expect(page.total).toBe(2);
    expect(page.rows.map((r) => r.source_id)).toEqual(["21816"]);
  });

  it("summarises the whole staged catalogue: nothing is publishable", async () => {
    const { db } = setup();
    const sum = await summariseStaging(db);
    expect(sum).toMatchObject({ total: 2, publishable: 0, readyForHumanReview: 2, checks: { rowsWithErrors: 0, rowsClean: 2 } });
    expect(sum.rowBlockers.IMAGE_RIGHTS_UNVERIFIED).toBe(1);
    expect(sum.catalogueBlockers).toContain("TEXT_RIGHTS_UNVERIFIED");
  });

  it("lists the final-approval queue by chapter, and drops a row once it needs revision", async () => {
    const { db } = setup();
    const ready = await listStaging(db, parseStagingQuery(new URLSearchParams("queue=ready")));
    expect(ready.total).toBe(2);
    expect(ready.rows.map((r) => [r.source_id, r.chapter_draft])).toEqual([["21816", 2], ["21810", 8]]);
    const revise = parseStagingDecision({ ...decision, sourceId: "21816", status: "needs_revision" });
    if (typeof revise === "string") throw new Error(revise);
    await recordStagingDecision(db, revise, "owner:test");
    expect((await listStaging(db, parseStagingQuery(new URLSearchParams("queue=ready")))).rows.map((r) => r.source_id)).toEqual(["21810"]);
    const sum = await summariseStaging(db);
    expect(sum.readyForFinalApproval).toEqual({ total: 1, withWarnings: 0, byChapter: { "8": 1 } });
  });
});
