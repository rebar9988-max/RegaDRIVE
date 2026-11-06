import { describe, expect, it } from "vitest";
import { handleDr, type DrEnv, type MailMessage } from "../../worker/dr/handler";
import { invalidateOverrides } from "../../worker/dr/db";
import type { D1Like, D1Stmt } from "../../worker/dr/db";
import { handleApi, type Env } from "../../worker/index";
import migration from "../../migrations/0003_dr_admin.sql?raw";

// D1 is SQLite: run the real migration on node:sqlite behind the D1 statement interface.
interface SqliteStatement { get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; run(...p: unknown[]): unknown }
interface SqliteDb { exec(sql: string): void; prepare(sql: string): SqliteStatement }
const sqliteModule = "node:" + "sqlite";
const { DatabaseSync } = (await import(/* @vite-ignore */ sqliteModule)) as { DatabaseSync: new (path: string) => SqliteDb };

function d1(): D1Like {
  const db = new DatabaseSync(":memory:");
  db.exec(migration);
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

describe("/dr owner control center", () => {
  it("fails closed without a database or owner address", async () => {
    const r = await handleDr(new Request("https://x.test/api/dr/session"), {});
    expect(r.status).toBe(503);
  });

  it("e-mails a 6-digit code only to the owner and signs in with a secure session cookie", async () => {
    const t = setup();
    expect((await t.call("/api/dr/session")).body.authenticated).toBe(false);
    const req = await t.call("/api/dr/auth/request", { body: {} });
    expect(req.status).toBe(200);
    expect(t.mails.length).toBe(1);
    expect(t.mails[0]!.to).toBe(OWNER);
    expect(/^\d{6}$/.test(t.lastCode())).toBe(true);
    expect(req.setCookie).toContain("HttpOnly; Secure; SameSite=Strict");

    const wrong = await t.call("/api/dr/auth/verify", { body: { code: t.lastCode() === "000000" ? "111111" : "000000" } });
    expect(wrong.status).toBe(401);
    expect(wrong.body.attemptsLeft).toBe(4);
    const ok = await t.call("/api/dr/auth/verify", { body: { code: t.lastCode() } });
    expect(ok.status).toBe(200);
    expect(ok.setCookie).toContain("__Host-dr_s=");
    expect((await t.call("/api/dr/session")).body.authenticated).toBe(true);
    // A used code cannot be reused.
    expect((await t.call("/api/dr/auth/verify", { body: { code: t.lastCode() } })).status).toBe(400);
  });

  it("rejects expired codes, too many attempts, missing CSRF header and request floods", async () => {
    const t = setup();
    await t.call("/api/dr/auth/request", { body: {} });
    expect((await t.call("/api/dr/auth/verify", { body: { code: t.lastCode() }, now: T0 + 5 * 60_000 + 1 })).body.error).toBe("CODE_EXPIRED");

    await t.call("/api/dr/auth/request", { body: {} });
    const code = t.lastCode();
    const bad = code === "999999" ? "888888" : "999999";
    for (let i = 0; i < 5; i++) await t.call("/api/dr/auth/verify", { body: { code: bad } });
    expect((await t.call("/api/dr/auth/verify", { body: { code } })).body.error).toBe("TOO_MANY_ATTEMPTS");

    expect((await t.call("/api/dr/auth/request", { body: {}, header: false })).status).toBe(403);
    for (let i = 0; i < 3; i++) await t.call("/api/dr/auth/request", { body: {} });
    expect((await t.call("/api/dr/auth/request", { body: {} })).status).toBe(429);
  });

  it("requires a session, expires idle sessions and logs every decision", async () => {
    const t = setup();
    expect((await t.call("/api/dr/overview")).status).toBe(401);
    await t.login();
    const o = await t.call("/api/dr/overview", { now: T0 + 60_000 });
    expect(o.status).toBe(200);
    const features = o.body.features as { key: string; state: string }[];
    expect(features.length).toBe(0); // no worker context in this direct call
    expect((await t.call("/api/dr/overview", { now: T0 + 60_000 + 31 * 60_000 })).status).toBe(401);
    const audit = await t.db.prepare("SELECT action, result FROM dr_audit_log ORDER BY id").all<{ action: string; result: string }>();
    expect(audit.results.some((a) => a.action === "login" && a.result === "allowed")).toBe(true);
    expect(audit.results.some((a) => a.result === "denied")).toBe(true);
  });

  it("enforces controls server-side: locked money features, step-up for critical changes, backups", async () => {
    const t = setup();
    await t.login();
    expect((await t.call("/api/dr/features", { body: { key: "payments", state: "ON" } })).body.error).toBe("FEATURE_LOCKED");

    // Fresh login counts as step-up for 10 minutes; afterwards critical changes need a new code.
    const later = T0 + 11 * 60_000;
    await t.call("/api/dr/session", { now: T0 + 5 * 60_000 }); // keep the session alive
    expect((await t.call("/api/dr/features", { body: { key: "emergency_lock", state: "ON" }, now: later })).body.error).toBe("STEP_UP_REQUIRED");
    await t.call("/api/dr/auth/request", { body: { purpose: "step_up" }, now: later });
    expect((await t.call("/api/dr/auth/verify", { body: { code: t.lastCode() }, now: later })).status).toBe(200);
    const on = await t.call("/api/dr/features", { body: { key: "emergency_lock", state: "ON" }, now: later });
    expect(on.status).toBe(200);
    expect(typeof on.body.backupId).toBe("string");

    // Non-critical switch works without step-up.
    expect((await t.call("/api/dr/features", { body: { key: "ai_groq", state: "OFF" }, now: later })).status).toBe(200);

    const restore = await t.call("/api/dr/backups/restore", { body: { id: on.body.backupId }, now: later });
    expect(restore.status).toBe(200);
    const rows = await t.db.prepare("SELECT key FROM dr_feature_states").all<{ key: string }>();
    expect(rows.results.length).toBe(0); // state before the emergency lock: no overrides
  });

  it("applies owner overrides to the public API (AI off, provider removed, emergency lock)", async () => {
    const t = setup();
    const env = { ASSETS: { fetch: async () => new Response() }, AI_ENABLED: "true", DB: t.db, DR_OWNER_EMAIL: OWNER } as unknown as Env;
    const flags = async () => (await handleApi(new Request("https://www.regaplatform.com/api/flags"), env, T0)).json() as Promise<{ aiEnabled: boolean }>;
    expect((await flags()).aiEnabled).toBe(true);
    await t.login();
    await t.call("/api/dr/features", { body: { key: "ai_gemini", state: "OFF" } });
    invalidateOverrides();
    const status = await (await handleApi(new Request("https://www.regaplatform.com/api/ai/status"), env, T0)).json() as { providers: { id: string; status: string }[] };
    expect(status.providers.find((p) => p.id === "gemini")?.status).toBe("DISABLED");
    await t.call("/api/dr/features", { body: { key: "emergency_lock", state: "ON" } });
    invalidateOverrides();
    expect((await flags()).aiEnabled).toBe(false);
    const explain = await handleApi(new Request("https://www.regaplatform.com/api/ai/explain", { method: "POST", body: "{}" }), env, T0);
    expect(explain.status).toBe(503);
  });
});
