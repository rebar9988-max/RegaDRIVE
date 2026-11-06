import { describe, expect, it } from "vitest";
import fixture from "../fixtures/import/valid.json?raw";
import { handleApi, type Env } from "../../worker/index";
import { handleAdmin } from "../../worker/lib/admin";
import { readFlags } from "../../src/lib/shared/flags";
import type { AuditEvent } from "../../worker/lib/audit";

const TOKEN = "owner-test-token-0123456789abcdef0123456789";
const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const req = (path: string, init: RequestInit = {}) => new Request(`https://regadrive.test${path}`, { method: "POST", ...init });
const auth = { authorization: `Bearer ${TOKEN}` };

async function setup(envPatch: Record<string, string> = {}) {
  const events: AuditEvent[] = [];
  const env = { ADMIN_OWNER_TOKEN_SHA256: await sha(TOKEN), CONTENT_ADMIN_ENABLED: "true", ...envPatch };
  const run = (r: Request, now = Date.now()) => handleAdmin(r, env, readFlags(env), json, { sink: { write: (e) => { events.push(e); } }, now, knownLicenses: new Set(["LIC-FIXTURE"]) });
  return { events, run };
}

describe("owner-only admin API", () => {
  it("is disabled by default in the real Worker config (fail closed)", async () => {
    const env = { ASSETS: { fetch: async () => new Response() }, CONTENT_ADMIN_ENABLED: "false" } as Env;
    const r = await handleApi(req("/api/admin/import/validate", { body: "{}", headers: auth }), env);
    expect(r.status).toBe(403);
    const flags = await (await handleApi(new Request("https://regadrive.test/api/flags"), env)).json();
    expect(flags).toMatchObject({ officialQuestionBankEnabled: false, contentAdminEnabled: false, contentImportExecutionEnabled: false, publicOfficialMockExamsEnabled: false, contentAutoSyncEnabled: false, subscriptionsEnabled: false });
  });
  it("denies missing, wrong and weak tokens, and audits every denial", async () => {
    const { run, events } = await setup();
    expect((await run(req("/api/admin/import/validate"))).status).toBe(403);
    expect((await run(req("/api/admin/import/validate", { headers: { authorization: "Bearer short" } }))).status).toBe(403);
    expect((await run(req("/api/admin/import/validate", { headers: { authorization: `Bearer ${"x".repeat(40)}` } }))).status).toBe(403);
    expect(events.map((e) => e.outcome)).toEqual(["denied", "denied", "denied"]);
    expect(JSON.stringify(events)).not.toContain(TOKEN);
  });
  it("denies when no owner token is configured even with a token", async () => {
    const { run } = await setup({ ADMIN_OWNER_TOKEN_SHA256: "" });
    expect((await run(req("/api/admin/import/validate", { headers: auth, body: "{}" }))).status).toBe(403);
  });
  it("requires the Cloudflare Access identity when configured", async () => {
    const { run } = await setup({ ADMIN_ACCESS_EMAIL: "owner@example.com" });
    const body = JSON.stringify({ format: "json", data: "[]" });
    expect((await run(req("/api/admin/import/validate", { headers: auth, body }))).status).toBe(403);
    expect((await run(req("/api/admin/import/validate", { headers: { ...auth, "cf-access-authenticated-user-email": "owner@example.com" }, body }))).status).toBe(200);
  });
  it("validates an import as a dry run (nothing stored or published) and audits it", async () => {
    const { run, events } = await setup();
    const data = fixture;
    const media = [{ file: "fixture.png", kind: "image", key: `media/${"a".repeat(64)}.png`, bytes: 10, mime: "image/png" }];
    const r = await run(req("/api/admin/import/validate", { headers: auth, body: JSON.stringify({ format: "json", data, media }) }));
    const j = await r.json() as { dryRun: boolean; published: boolean; preview: { summary: { new: number; invalid: number } } };
    expect(r.status).toBe(200);
    expect(j).toMatchObject({ dryRun: true, published: false });
    expect(j.preview.summary).toMatchObject({ new: 2, invalid: 0 });
    expect(events.at(-1)).toMatchObject({ actor: "owner", outcome: "allowed", detail: { rows: 2, invalid: 0 } });
  });
  it("validates media uploads without storing them", async () => {
    const { run } = await setup();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
    const ok = await run(req("/api/admin/media/validate", { headers: { ...auth, "x-file-name": "a.png" }, body: png }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ dryRun: true, stored: false, ok: true });
    const bad = await run(req("/api/admin/media/validate", { headers: { ...auth, "x-file-name": "a.svg" }, body: "<svg/>" }));
    expect(bad.status).toBe(422);
  });
  it("keeps import execution, media storage and content edits disabled while the database is off", async () => {
    const { run, events } = await setup({ CONTENT_IMPORT_EXECUTION_ENABLED: "true", DATABASE_PRODUCTION_ENABLED: "true" });
    for (const p of ["/api/admin/import/commit", "/api/admin/media/upload", "/api/admin/content/publish"]) {
      const r = await run(req(p, { headers: auth, body: "{}" }));
      expect(r.status).toBe(503);
    }
    expect(events.every((e) => e.outcome === "denied")).toBe(true);
  });
  it("rate-limits admin requests", async () => {
    const { run } = await setup();
    const now = 1_900_000_000_000;
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await run(req("/api/admin/x", { headers: { ...auth, "cf-connecting-ip": "9.9.9.9" } }), now)).status;
    expect(last).toBe(429);
  });
});
