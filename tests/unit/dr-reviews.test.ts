import { describe, expect, it } from "vitest";
import { handleDr, type DrEnv, type MailMessage } from "../../worker/dr/handler";
import { invalidateOverrides } from "../../worker/dr/db";
import type { D1Like, D1Stmt } from "../../worker/dr/db";
import { handleApi, type Env } from "../../worker/index";
import migration from "../../migrations/0003_dr_admin.sql?raw";
import reviewsMigration from "../../migrations/0006_dr_content_reviews.sql?raw";
import itReviewsMigration from "../../migrations/0007_dr_content_reviews_italy.sql?raw";
import { approvedContent, REVIEW_ITEMS } from "../../worker/dr/reviews";
import { SIGNS } from "../../src/content/signs";
import { IT_QUESTIONS } from "../../src/content/italy/questions";
import { SIGN_QUIZ } from "../../src/content/signQuiz";

// D1 is SQLite: run the real migration on node:sqlite behind the D1 statement interface.
interface SqliteStatement { get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; run(...p: unknown[]): unknown }
interface SqliteDb { exec(sql: string): void; prepare(sql: string): SqliteStatement }
const sqliteModule = "node:" + "sqlite";
const { DatabaseSync } = (await import(/* @vite-ignore */ sqliteModule)) as { DatabaseSync: new (path: string) => SqliteDb };

function d1(): D1Like {
  const db = new DatabaseSync(":memory:");
  db.exec(migration);
  db.exec(reviewsMigration);
  db.exec(itReviewsMigration);
  const stmt = (sql: string, params: unknown[]): D1Stmt => ({
    bind: (...v: unknown[]) => stmt(sql, v),
    first: async <T,>() => (db.prepare(sql).get(...params) as T | undefined) ?? null,
    all: async <T,>() => ({ results: db.prepare(sql).all(...params) as T[] }),
    run: async () => db.prepare(sql).run(...params),
  });
  return { prepare: (sql: string) => stmt(sql, []) };
}

const OWNER = "regaplatform1@gmail.com";
const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);

function setup() {
  invalidateOverrides();
  const db = d1();
  const mails: MailMessage[] = [];
  const env: DrEnv = { DB: db, DR_OWNER_EMAIL: OWNER, REGADRIVE_RESEND_API_KEY: "re_test" };
  let cookie = "";
  const call = async (path: string, init: { method?: string; body?: unknown; now?: number; ip?: string; header?: boolean } = {}) => {
    const method = init.method ?? (init.body === undefined ? "GET" : "POST");
    const headers: Record<string, string> = { "cf-connecting-ip": init.ip ?? "203.0.113.7", "user-agent": "test" };
    if (cookie) headers.cookie = cookie;
    if (method !== "GET" && init.header !== false) headers["x-dr-request"] = "1";
    const r = await handleDr(new Request(`https://www.regaplatform.com${path}`, { method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) }), env, {
      now: init.now ?? T0,
      send: async (_key, msg) => { mails.push(msg); return { ok: true }; },
    });
    const set = r.headers.get("set-cookie") ?? "";
    const jar = new Map(cookie.split("; ").filter(Boolean).map((c) => c.split("=") as [string, string]));
    for (const m of set.matchAll(/(__Host-dr_[sc])=([0-9a-f]*);/g)) { if (m[2]) jar.set(m[1]!, m[2]); else jar.delete(m[1]!); }
    cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    return { status: r.status, body: await r.json() as Record<string, unknown>, setCookie: set };
  };
  const lastCode = () => /(\d{6})/.exec(mails.at(-1)?.text ?? "")?.[1] ?? "";
  const login = async (now = T0) => {
    await call("/api/dr/auth/request", { body: {}, now });
    return call("/api/dr/auth/verify", { body: { code: lastCode() }, now });
  };
  return { db, env, mails, call, lastCode, login };
}


const flow = (ids: string[], over: Record<string, unknown> = {}) => ({ ids, outcome: "pass", reviewedOn: "2026-11-07", confirm: true, ...over });
const TR = (ids: string[], o: Record<string, unknown> = {}) => flow(ids, { stage: "TRANSLATION_REVIEW", reviewerName: "Test Translator Alpha", evidenceRef: "signed-list-2026-11-07.pdf", ...o });
const ED = (ids: string[], o: Record<string, unknown> = {}) => flow(ids, { stage: "EDUCATIONAL_REVIEW", reviewerName: "Test Instructor Beta", evidenceRef: "fahrlehrer-protokoll-2026-11-07", ...o });
const AP = (ids: string[], o: Record<string, unknown> = {}) => flow(ids, { stage: "APPROVED", reviewerName: "Test Owner Gamma", evidenceRef: "owner-approval-2026-11-07", ...o });
type Item = { id: string; kind: string; status: string; publishable: boolean; stages: Record<"TRANSLATION_REVIEW" | "EDUCATIONAL_REVIEW" | "APPROVED", { state: string; reviewer?: string; evidenceRef?: string }> };

describe("/dr Content Review & Approval", () => {
  it("covers exactly the 40 signs and 89 sign-quiz questions, all unpublished while nothing is reviewed", async () => {
    expect(REVIEW_ITEMS.filter((i) => i.kind === "sign").length).toBe(40);
    expect(REVIEW_ITEMS.filter((i) => i.kind === "signQuiz").length).toBe(89);
    expect(REVIEW_ITEMS.every((i) => i.valid)).toBe(true);
    const t = setup();
    const out = await approvedContent(t.env.DB);
    expect(out).toEqual({ ok: true, signs: {}, signQuiz: {}, itSigns: {}, itQuestions: {}, ready: { de: true, it: true } });
    await t.login();
    const r = await t.call("/api/dr/reviews");
    expect(r.status).toBe(200);
    const items = r.body.items as Item[];
    // 40 German signs + 89 German sign-quiz questions + 8 Italian signs + 12 Italian questions.
    expect(items.length).toBe(149);
    expect(items.every((i) => !i.publishable && i.status === "AWAITING_REVIEW")).toBe(true);
    expect((r.body.counts as { published: number }).published).toBe(0);
  });

  it("needs the owner session, the x-dr-request header and a fresh step-up code to record anything", async () => {
    const t = setup();
    expect((await t.call("/api/dr/reviews")).status).toBe(401);
    expect((await t.call("/api/dr/reviews", { body: TR(["s102"]) })).status).toBe(401);
    await t.login();
    expect((await t.call("/api/dr/reviews", { body: TR(["s102"]), header: false })).status).toBe(403);
    const late = await t.call("/api/dr/reviews", { body: TR(["s102"]), now: T0 + 11 * 60_000 });
    expect(late.status).toBe(401);
    expect(late.body.error).toBe("STEP_UP_REQUIRED");
    expect(((await t.call("/api/dr/reviews")).body.counts as { published: number }).published).toBe(0);
  });

  it("refuses AI/automated names, missing evidence, bad dates, wrong order and equal reviewers", async () => {
    const t = setup();
    await t.login();
    const err = async (b: unknown) => (await t.call("/api/dr/reviews", { body: b })).body;
    for (const name of ["Claude", "AI reviewer", "automated", "ab", ""]) expect(((await err(TR(["s102"], { reviewerName: name }))) as { errors: { error: string }[] }).errors[0]!.error).toBe("REVIEWER_NAME_INVALID");
    expect(((await err(TR(["s102"], { evidenceRef: "x" }))) as { errors: { error: string }[] }).errors[0]!.error).toBe("EVIDENCE_REQUIRED");
    expect(((await err(TR(["s102"], { reviewedOn: "2026-12-31" }))) as { errors: { error: string }[] }).errors[0]!.error).toBe("REVIEW_DATE_INVALID");
    expect(((await err(TR(["s102"], { confirm: false }))) as { errors: { error: string }[] }).errors[0]!.error).toBe("CONFIRMATION_REQUIRED");
    expect(((await err(ED(["s102"]))) as { errors: { error: string }[] }).errors[0]!.error).toBe("TRANSLATION_REVIEW_FIRST");
    expect(((await err(AP(["s102"]))) as { errors: { error: string }[] }).errors[0]!.error).toBe("BOTH_REVIEWS_FIRST");
    expect((await t.call("/api/dr/reviews", { body: { ...TR(["s102"]), stage: "PUBLISHED" } })).status).toBe(400);
    expect((await t.call("/api/dr/reviews", { body: TR([]) })).status).toBe(400);
    expect((await t.call("/api/dr/reviews", { body: TR(["s102"]) })).status).toBe(200);
    expect(((await err(ED(["s102"], { reviewerName: "test translator alpha" }))) as { errors: { error: string }[] }).errors[0]!.error).toBe("REVIEWERS_MUST_DIFFER");
    expect(((await err({ ...TR(["s102"]), outcome: "fail" })) as { errors: { error: string }[] }).errors[0]!.error).toBe("NOTE_REQUIRED_FOR_FAIL");
  });

  it("is all-or-nothing: one bad id in a batch saves nothing", async () => {
    const t = setup();
    await t.login();
    const r = await t.call("/api/dr/reviews", { body: TR(["s102", "s108", "does-not-exist"]) });
    expect(r.status).toBe(422);
    expect(((await t.call("/api/dr/reviews")).body.history as unknown[]).length).toBe(0);
  });

  it("publishes an item automatically only after translation, educational and owner approval, and hides everything else", async () => {
    const t = setup();
    await t.login();
    const sign = SIGNS[0]!.id, quiz = SIGN_QUIZ[0]!.id, other = SIGN_QUIZ[1]!.id;
    expect((await t.call("/api/dr/reviews", { body: TR([sign, quiz, other]) })).status).toBe(200);
    expect((await approvedContent(t.env.DB)).signs).toEqual({});
    expect((await t.call("/api/dr/reviews", { body: ED([sign, quiz]) })).status).toBe(200);
    expect(Object.keys((await approvedContent(t.env.DB)).signs)).toEqual([]);
    expect((await t.call("/api/dr/reviews", { body: AP([sign, quiz]) })).status).toBe(200);
    const out = await approvedContent(t.env.DB);
    expect(Object.keys(out.signs)).toEqual([sign]);
    expect(Object.keys(out.signQuiz)).toEqual([quiz]);
    const list = (await t.call("/api/dr/reviews")).body;
    const byId = new Map((list.items as Item[]).map((i) => [i.id, i]));
    expect(byId.get(sign)!.publishable).toBe(true);
    expect(byId.get(other)!.publishable).toBe(false);
    expect(byId.get(other)!.status).toBe("TRANSLATION_REVIEW_DONE");
    expect((list.counts as { published: number }).published).toBe(2);
    // The public endpoint exposes ids and fingerprints only.
    const pub = await handleApi(new Request("https://www.regaplatform.com/api/content/approved"), { DB: t.env.DB } as unknown as Env);
    expect(pub.status).toBe(200);
    expect(await pub.json()).toEqual(out);
  });

  it("records reviewer, role, date, evidence and who recorded it; every decision is audited; a rejection blocks publication", async () => {
    const t = setup();
    await t.login();
    const id = SIGNS[1]!.id;
    await t.call("/api/dr/reviews", { body: TR([id]) });
    await t.call("/api/dr/reviews", { body: { ...ED([id]), outcome: "fail", note: "Sign meaning wrong in Sorani" } });
    const row = ((await t.call("/api/dr/reviews")).body.history as Record<string, unknown>[])[0]!;
    expect(row).toMatchObject({ content_id: id, stage: "EDUCATIONAL_REVIEW", outcome: "fail", reviewer_role: "driving_instructor", reviewed_on: "2026-11-07", evidence_ref: "fahrlehrer-protokoll-2026-11-07" });
    expect(String(row.recorded_by)).toMatch(/^owner:/);
    const it = ((await t.call("/api/dr/reviews")).body.items as Item[]).find((i) => i.id === id)!;
    expect(it.status).toBe("REJECTED");
    expect(it.publishable).toBe(false);
    const audit = (await t.call("/api/dr/audit?limit=50")).body.entries as { action: string; result: string }[];
    expect(audit.some((a) => a.action === "review.TRANSLATION_REVIEW.pass" && a.result === "allowed")).toBe(true);
    expect(audit.some((a) => a.action === "review.EDUCATIONAL_REVIEW.fail" && a.result === "allowed")).toBe(true);
  });

  it("withdrawing a decision takes the item offline again but keeps the history", async () => {
    const t = setup();
    await t.login();
    const id = SIGNS[2]!.id;
    for (const b of [TR([id]), ED([id]), AP([id])]) expect((await t.call("/api/dr/reviews", { body: b })).status).toBe(200);
    expect(Object.keys((await approvedContent(t.env.DB)).signs)).toEqual([id]);
    const rows = (await t.call("/api/dr/reviews")).body.history as { id: number; stage: string }[];
    const approved = rows.find((r) => r.stage === "APPROVED")!;
    expect((await t.call("/api/dr/reviews/revoke", { body: { rowId: approved.id, reason: "x" } })).status).toBe(400);
    expect((await t.call("/api/dr/reviews/revoke", { body: { rowId: approved.id, reason: "Owner withdrew approval" } })).status).toBe(200);
    expect((await t.call("/api/dr/reviews/revoke", { body: { rowId: approved.id, reason: "Owner withdrew approval" } })).status).toBe(409);
    expect((await approvedContent(t.env.DB)).signs).toEqual({});
    expect(((await t.call("/api/dr/reviews")).body.history as unknown[]).length).toBe(3);
  });

  it("an approval stops counting when the reviewed content changes (fingerprint) and when the rules version differs", async () => {
    const t = setup();
    await t.login();
    const id = SIGNS[3]!.id;
    for (const b of [TR([id]), ED([id]), AP([id])]) await t.call("/api/dr/reviews", { body: b });
    expect(Object.keys((await approvedContent(t.env.DB)).signs)).toEqual([id]);
    await t.env.DB!.prepare("UPDATE dr_content_reviews SET content_hash = 'stale' WHERE content_id = ?").bind(id).run();
    expect((await approvedContent(t.env.DB)).signs).toEqual({});
    const q = SIGN_QUIZ[5]!.id;
    for (const b of [TR([q]), ED([q]), AP([q])]) await t.call("/api/dr/reviews", { body: b });
    expect(Object.keys((await approvedContent(t.env.DB)).signQuiz)).toEqual([q]);
    await t.env.DB!.prepare("UPDATE dr_content_reviews SET rules_version = 'old-rules' WHERE content_id = ? AND stage = 'EDUCATIONAL_REVIEW'").bind(q).run();
    expect((await approvedContent(t.env.DB)).signQuiz).toEqual({});
  });

  it("reviews the Italian wording through all three stages without granting learner publication", async () => {
    const t = setup();
    await t.login();
    const id = IT_QUESTIONS[0]!.id;
    const list = () => t.call("/api/dr/reviews");
    const draft = async () => ((await list()).body.italyQuestions as (Item & { hash: string })[]).find((item) => item.id === id)!;
    const initial = await draft();
    const submit = (decision: Record<string, unknown>) => t.call("/api/dr/reviews", { body: { ...decision, questionHash: initial.hash } });
    expect(initial.status).toBe("AWAITING_REVIEW");
    expect((await submit(AP([id]))).body.error).toBe("BOTH_REVIEWS_FIRST");
    expect((await submit(TR([id, SIGNS[0]!.id]))).status).toBe(400);
    for (const decision of [TR([id]), ED([id]), AP([id])]) expect((await submit(decision)).status).toBe(200);
    expect(await draft()).toMatchObject({ status: "APPROVED", publishable: false });
    expect((await approvedContent(t.db)).itQuestions).toEqual({});
    expect((await submit(AP([id], { outcome: "fail", note: "The reviewer found an error." }))).status).toBe(200);
    expect((await draft()).status).toBe("REJECTED");
    const history = await t.call(`/api/dr/reviews/translation?id=${id}`);
    expect(history.body.decisions).toHaveLength(4);
  });

  it("counts Germany and Italy apart, and the two add up to the total (149 = 129 + 20)", async () => {
    const t = setup();
    await t.login();
    const r = await t.call("/api/dr/reviews");
    const counts = r.body.counts as { total: number; byCountry: Record<"de" | "it", { total: number; published: number; awaiting: number; inReview: number; rejected: number }> };
    expect(counts.byCountry.de.total).toBe(40 + 89);
    expect(counts.byCountry.it.total).toBe(8 + IT_QUESTIONS.length);
    expect(counts.byCountry.de.total + counts.byCountry.it.total).toBe(counts.total);
    expect(counts.total).toBe((r.body.items as unknown[]).length);
    for (const c of Object.values(counts.byCountry)) expect(c.published + c.awaiting + c.inReview + c.rejected).toBe(c.total);
  });

  it("records one decision for several Italian questions only when every one of them may take it", async () => {
    const t = setup();
    await t.login();
    const [a, b] = [IT_QUESTIONS[0]!.id, IT_QUESTIONS[1]!.id];
    const drafts = async () => new Map(((await t.call("/api/dr/reviews")).body.italyQuestions as (Item & { hash: string })[]).map((i) => [i.id, i]));
    const d0 = await drafts();
    const hashes = { [a]: d0.get(a)!.hash, [b]: d0.get(b)!.hash };
    const post = (decision: Record<string, unknown>) => t.call("/api/dr/reviews", { body: decision });
    // Mixed with a German item, a missing fingerprint, or an approval before the reviews: nothing is recorded.
    expect((await post({ ...TR([a, SIGNS[0]!.id]), questionHashes: hashes })).body.error).toBe("ITALY_REVIEW_MIXED");
    expect((await post({ ...TR([a, b]), questionHashes: { [a]: hashes[a] } })).status).toBe(409);
    const refused = await post({ ...AP([a, b]), questionHashes: hashes });
    expect(refused.status).toBe(422);
    expect(refused.body).toMatchObject({ error: "REJECTED", rejectedCount: 2 });
    expect((await post({ ...TR([a, b], { reviewerName: "AI reviewer" }), questionHashes: hashes })).status).toBe(422);
    expect([...(await drafts()).values()].every((i) => i.stages.TRANSLATION_REVIEW.state === "pending")).toBe(true);
    // A valid batch is recorded for both, each as its own row with the named reviewer and evidence.
    expect((await post({ ...TR([a, b]), questionHashes: hashes })).body).toMatchObject({ ok: true, recorded: 2 });
    const after = await drafts();
    for (const id of [a, b]) expect(after.get(id)!.stages.TRANSLATION_REVIEW).toMatchObject({ state: "pass", reviewer: "Test Translator Alpha", evidenceRef: "signed-list-2026-11-07.pdf" });
    // All or nothing: one question that is not ready refuses the whole selection.
    const c = IT_QUESTIONS[2]!.id;
    const mixed = await post({ ...ED([a, c]), questionHashes: { [a]: after.get(a)!.hash, [c]: after.get(c)!.hash } });
    expect(mixed.body).toMatchObject({ error: "REJECTED", errors: [{ id: c, error: "TRANSLATION_REVIEW_FIRST" }] });
    expect((await drafts()).get(a)!.stages.EDUCATIONAL_REVIEW.state).toBe("pending");
    // Editorial decisions never publish an Italian question.
    expect((await approvedContent(t.db)).itQuestions).toEqual({});
    const audit = (await t.call("/api/dr/audit?limit=50")).body.entries as { action: string; result: string }[];
    expect(audit.filter((x) => x.action === "review.TRANSLATION_REVIEW.pass" && x.result === "allowed")).toHaveLength(1);
    expect(audit.some((x) => x.action === "review.APPROVED.pass" && x.result === "denied")).toBe(true);
  });

  it("records only human translation edits, resets the review for new wording, and rejects stale writes", async () => {
    const t = setup();
    const question = IT_QUESTIONS[0]!;
    const id = question.id;
    const route = "/api/dr/reviews/translation";
    const metadata = TR([id]);
    expect((await t.call(route, { body: { id } })).status).toBe(401);
    await t.login();
    const draft = async () => ((await t.call("/api/dr/reviews")).body.italyQuestions as (Item & { hash: string })[]).find((item) => item.id === id)!;
    const initial = await draft();
    expect((await t.call("/api/dr/reviews", { body: { ...metadata, questionHash: initial.hash } })).status).toBe(200);
    const original = { prompt: { ckb: question.prompt.ckb, kmrArab: question.prompt.kmrArab }, explanation: { ckb: question.explanation.ckb, kmrArab: question.explanation.kmrArab } };
    const revised = { ...original, prompt: { ...original.prompt, ckb: "دەقی تاقیکردنەوەی سۆرانی" } };
    const edit = { ...metadata, id, questionHash: initial.hash, translations: revised };
    expect((await t.call(route, { body: edit, header: false })).status).toBe(403);
    expect((await t.call(route, { body: edit, now: T0 + 11 * 60_000 })).body.error).toBe("STEP_UP_REQUIRED");
    expect((await t.call(route, { body: { ...edit, id: SIGNS[0]!.id } })).status).toBe(404);
    expect((await t.call(route, { body: { ...edit, translations: original } })).body.error).toBe("NO_TRANSLATION_CHANGES");
    expect((await t.call(route, { body: { ...edit, translations: { ...revised, prompt: { ...revised.prompt, ckb: "invalid" } } } })).status).toBe(422);
    const attempts = await Promise.all([t.call(route, { body: edit }), t.call(route, { body: edit })]);
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([200, 409]);
    expect((await t.call("/api/dr/reviews", { body: { ...AP([id]), questionHash: initial.hash } })).status).toBe(409);
    const edited = await draft();
    expect(edited).toMatchObject({ status: "AWAITING_REVIEW", translations: revised });
    expect(edited.hash).not.toBe(initial.hash);
    expect(question.prompt.ckb).toBe(original.prompt.ckb);
    const history = await t.call(`${route}?id=${id}`);
    expect(history.body.edits).toEqual([expect.objectContaining({ reviewerName: "Test Translator Alpha", reviewedOn: metadata.reviewedOn, before: original, after: revised })]);
    expect(history.body.decisions).toHaveLength(1);
    expect((await approvedContent(t.db)).itQuestions).toEqual({});
  });

  it("fails closed: no database or an unmigrated database publishes nothing", async () => {
    expect(await approvedContent(undefined)).toEqual({ ok: false, signs: {}, signQuiz: {}, itSigns: {}, itQuestions: {}, ready: { de: false, it: false } });
    const bare = new DatabaseSync(":memory:");
    const stmt = (sql: string, params: unknown[]): D1Stmt => ({ bind: (...v: unknown[]) => stmt(sql, v), first: async <T,>() => (bare.prepare(sql).get(...params) as T | undefined) ?? null, all: async <T,>() => ({ results: bare.prepare(sql).all(...params) as T[] }), run: async () => bare.prepare(sql).run(...params) });
    expect(await approvedContent({ prepare: (s: string) => stmt(s, []) })).toEqual({ ok: false, signs: {}, signQuiz: {}, itSigns: {}, itQuestions: {}, ready: { de: false, it: false } });
  });
});
