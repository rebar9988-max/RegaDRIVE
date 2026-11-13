import { describe, expect, it } from "vitest";
import { handleStudents, STUDENT_CODE_TTL_MS, STUDENT_SESSION_MS, STUDENT_SESSION_RENEW_MS, UNVERIFIED_RETENTION_MS, type StudentEnv } from "../../worker/students/handler";
import type { MailMessage } from "../../worker/dr/handler";
import type { D1Like, D1Stmt } from "../../worker/dr/db";
import { invalidateOverrides } from "../../worker/dr/db";
import { handleApi, type Env } from "../../worker/index";
import studentMigration from "../../migrations-students/0001_student_auth.sql?raw";
import drMigration from "../../migrations/0003_dr_admin.sql?raw";

interface SqliteStatement { get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; run(...p: unknown[]): unknown }
interface SqliteDb { exec(sql: string): void; prepare(sql: string): SqliteStatement }
const sqliteModule = "node:" + "sqlite";
const { DatabaseSync } = (await import(/* @vite-ignore */ sqliteModule)) as { DatabaseSync: new (path: string) => SqliteDb };

function d1(sql: string): { d1: D1Like; raw: SqliteDb } {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(sql);
  const stmt = (q: string, params: unknown[]): D1Stmt => ({
    bind: (...v: unknown[]) => stmt(q, v),
    first: async <T,>() => (db.prepare(q).get(...params) as T | undefined) ?? null,
    all: async <T,>() => ({ results: db.prepare(q).all(...params) as T[] }),
    run: async () => db.prepare(q).run(...params),
  });
  return { d1: { prepare: (q: string) => stmt(q, []) }, raw: db };
}

const T0 = Date.UTC(2026, 10, 11, 12, 0, 0);
const EMAIL = "Student.One@Example.de";
const PW = "sicheres-Passwort-123";

function setup(opts: { enabled?: boolean; mailOk?: boolean } = {}) {
  const { d1: db, raw } = d1(studentMigration);
  const mails: MailMessage[] = [];
  const env: StudentEnv = { STUDENT_DB: db, REGADRIVE_RESEND_API_KEY: "re_test" };
  let cookie = "";
  let clock = T0;
  const call = async (path: string, init: { method?: string; body?: unknown; ip?: string; header?: boolean; jar?: boolean; cookie?: string } = {}) => {
    const method = init.method ?? (init.body === undefined ? "GET" : "POST");
    const headers: Record<string, string> = { "cf-connecting-ip": init.ip ?? "203.0.113.9" };
    const c = init.cookie ?? cookie;
    if (c) headers.cookie = c;
    if (method !== "GET") { headers["content-type"] = "application/json"; if (init.header !== false) headers["x-rd-request"] = "1"; }
    const r = await handleStudents(new Request(`https://www.regaplatform.com${path}`, { method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) }), env, {
      now: clock, enabled: opts.enabled ?? true,
      send: async (_k, m) => { mails.push(m); return opts.mailOk === false ? { ok: false, error: "x" } : { ok: true }; },
    });
    const set = r.headers.get("set-cookie") ?? "";
    if (init.jar !== false) {
      const m = /__Host-rd_session=([^;]*);/.exec(set);
      if (m) cookie = m[1] ? `__Host-rd_session=${m[1]}` : "";
    }
    return { status: r.status, body: await r.json() as Record<string, unknown>, setCookie: set };
  };
  const lastCode = () => /(\d{6})/.exec(mails.at(-1)?.text ?? "")?.[1] ?? "";
  const tick = (ms: number) => { clock += ms; };
  const register = async (email = EMAIL, password = PW) => call("/api/auth/register", { body: { email, password, displayName: "Rebar", lang: "ckb" } });
  const registerAndVerify = async () => { await register(); return call("/api/auth/verify-email", { body: { email: EMAIL, code: lastCode() } }); };
  return { db, raw, env, mails, call, lastCode, tick, register, registerAndVerify, getCookie: () => cookie, setCookie: (c: string) => { cookie = c; } };
}

describe("student e-mail authentication", () => {
  it("fails closed when disabled or without the student database", async () => {
    const t = setup({ enabled: false });
    expect((await t.call("/api/me")).status).toBe(503);
    const r = await handleStudents(new Request("https://x.test/api/me"), {}, { enabled: true });
    expect(r.status).toBe(503);
  });

  it("register → e-mail code → verify → session → logout → login again (acceptance flow)", async () => {
    const t = setup();
    expect((await t.call("/api/me")).body).toEqual({ authenticated: false });
    const reg = await t.register();
    expect(reg.status).toBe(202);
    expect(reg.body).toEqual({ ok: true, next: "verify" });
    expect(t.mails).toHaveLength(1);
    expect(t.mails[0]!.to).toBe("student.one@example.de");
    expect(t.mails[0]!.from).toContain("regaplatform.com");
    expect(t.lastCode()).toMatch(/^\d{6}$/);
    // Not signed in and cannot sign in before verification.
    expect((await t.call("/api/auth/login", { body: { email: EMAIL, password: PW } })).body.error).toBe("EMAIL_NOT_VERIFIED");
    const v = await t.call("/api/auth/verify-email", { body: { email: EMAIL, code: t.lastCode() } });
    expect(v.status).toBe(200);
    expect(v.setCookie).toMatch(/^__Host-rd_session=[A-Za-z0-9_-]{40,}; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=\d+$/);
    const me = await t.call("/api/me");
    expect(me.body).toMatchObject({ authenticated: true, student: { email: "student.one@example.de", displayName: "Rebar", emailVerified: true } });
    const out = await t.call("/api/auth/logout", { body: {} });
    expect(out.setCookie).toContain("Max-Age=0");
    expect((await t.call("/api/me")).body.authenticated).toBe(false);
    const login = await t.call("/api/auth/login", { body: { email: "student.one@EXAMPLE.de", password: PW } });
    expect(login.status).toBe(200);
    expect((await t.call("/api/me")).body.authenticated).toBe(true);
  });

  it("stores no plaintext password, code or session token", async () => {
    const t = setup();
    await t.registerAndVerify();
    const token = t.getCookie().split("=")[1]!;
    const dump = JSON.stringify([
      t.raw.prepare("SELECT * FROM students").all(), t.raw.prepare("SELECT * FROM email_challenges").all(),
      t.raw.prepare("SELECT * FROM student_sessions").all(), t.raw.prepare("SELECT * FROM student_auth_events").all(),
      t.raw.prepare("SELECT * FROM student_rate_events").all(),
    ]);
    expect(dump).not.toContain(PW);
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(`"${t.lastCode()}"`);
    expect(JSON.stringify(t.raw.prepare("SELECT * FROM student_auth_events").all())).not.toContain("example.de");
    expect(JSON.stringify(t.raw.prepare("SELECT * FROM student_rate_events").all())).not.toContain("203.0.113");
  });

  it("prevents duplicate accounts without revealing that the e-mail exists", async () => {
    const t = setup();
    await t.registerAndVerify();
    const again = await t.call("/api/auth/register", { body: { email: "STUDENT.ONE@example.de", password: "anderes-Passwort-999" }, jar: false });
    expect(again.status).toBe(202);
    expect(again.body).toEqual({ ok: true, next: "verify" });
    expect(t.raw.prepare("SELECT COUNT(*) AS n FROM students").get()).toEqual({ n: 1 });
    expect(t.mails.at(-1)!.subject).toContain("Du hast bereits ein Konto");
    // The original password still works; the attacker's does not.
    expect((await t.call("/api/auth/login", { body: { email: EMAIL, password: "anderes-Passwort-999" } })).status).toBe(401);
    expect((await t.call("/api/auth/login", { body: { email: EMAIL, password: PW } })).status).toBe(200);
  });

  it("a failed e-mail gives the same answer for an existing and a new address (no enumeration through mail limits)", async () => {
    const t = setup({ mailOk: false });
    // An existing, verified account (created directly so that no mail is needed).
    t.raw.prepare("INSERT INTO students (id, email_normalized, display_name, password_hash, lang, email_verified_at, created_at, updated_at) VALUES ('s1', 'known@example.de', '', 'pbkdf2-sha256$100000$s$h', 'ckb', ?, ?, ?)").run(T0, T0, T0);
    const existing = await t.call("/api/auth/register", { body: { email: "known@example.de", password: PW }, ip: "198.51.100.7" });
    const fresh = await t.call("/api/auth/register", { body: { email: "new@example.de", password: PW }, ip: "198.51.100.8" });
    expect([existing.status, existing.body]).toEqual([fresh.status, fresh.body]);
    expect(existing.status).toBe(503);
  });

  it("stores only a well-formed progress document (a corrupt backup never reaches another device)", async () => {
    const t = setup();
    await t.registerAndVerify();
    const dirty = { version: 1, questions: { q1: { attempts: 2, correctCount: 9, streak: 1, lastCorrect: true, lastAnsweredAt: 5 }, bad: "x" }, scored: {}, bookmarks: ["q1", 7], completedLessons: [], days: { nope: 3 }, examHistory: ["junk"], injected: "<script>" };
    expect((await t.call("/api/me/progress", { body: { progress: dirty, baseVersion: 0 } })).status).toBe(200);
    expect((await t.call("/api/me/progress")).body.progress).toEqual({ version: 1, questions: { q1: { attempts: 2, correctCount: 2, streak: 1, lastCorrect: true, lastAnsweredAt: 5 } }, scored: {}, bookmarks: ["q1"], completedLessons: [], days: {}, examHistory: [] });
    expect((await t.call("/api/me/progress", { body: { progress: [1, 2], baseVersion: 1 } })).status).toBe(400);
  });

  it("answers identically for unknown e-mails (login, forgot, resend)", async () => {
    const t = setup();
    await t.registerAndVerify();
    const known = await t.call("/api/auth/login", { body: { email: EMAIL, password: "falsches-Passwort-1" }, ip: "198.51.100.1" });
    const unknown = await t.call("/api/auth/login", { body: { email: "nobody@example.de", password: "falsches-Passwort-1" }, ip: "198.51.100.1" });
    expect([known.status, known.body]).toEqual([unknown.status, unknown.body]);
    const f1 = await t.call("/api/auth/forgot-password", { body: { email: EMAIL } });
    const f2 = await t.call("/api/auth/forgot-password", { body: { email: "nobody@example.de" } });
    expect([f1.status, f1.body]).toEqual([f2.status, f2.body]);
    const r1 = await t.call("/api/auth/resend-code", { body: { email: EMAIL } });
    const r2 = await t.call("/api/auth/resend-code", { body: { email: "nobody@example.de" } });
    expect([r1.status, r1.body]).toEqual([r2.status, r2.body]);
  });

  it("validates input server-side", async () => {
    const t = setup();
    expect((await t.call("/api/auth/register", { body: { email: "not-an-email", password: PW } })).body.error).toBe("INVALID_EMAIL");
    expect((await t.call("/api/auth/register", { body: { email: EMAIL, password: "kurz" } })).body.error).toBe("WEAK_PASSWORD");
    expect((await t.call("/api/auth/register", { body: { email: EMAIL, password: "student.one@example.de" } })).body.error).toBe("WEAK_PASSWORD");
    expect((await t.call("/api/auth/register", { body: { email: EMAIL, password: "x".repeat(300) } })).body.error).toBe("WEAK_PASSWORD");
    expect((await t.call("/api/auth/register", { body: ["array"] })).status).toBe(400);
    const big = await t.call("/api/auth/register", { body: { email: EMAIL, password: PW, pad: "x".repeat(10_000) } });
    expect(big.status).toBe(413);
    expect(t.mails).toHaveLength(0);
  });

  it("requires the CSRF header and JSON for every state change", async () => {
    const t = setup();
    expect((await t.call("/api/auth/register", { body: { email: EMAIL, password: PW }, header: false })).status).toBe(403);
    const form = await handleStudents(new Request("https://www.regaplatform.com/api/auth/login", { method: "POST", headers: { "x-rd-request": "1", "content-type": "application/x-www-form-urlencoded" }, body: "email=a" }), t.env, { enabled: true });
    expect(form.status).toBe(403);
    expect(t.mails).toHaveLength(0);
  });

  it("codes: single use, 5 tries, expire after 10 minutes, resend closes the old code", async () => {
    const t = setup();
    await t.register();
    const code = t.lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) expect((await t.call("/api/auth/verify-email", { body: { email: EMAIL, code: wrong } })).body.error).toBe("INVALID_CODE");
    expect((await t.call("/api/auth/verify-email", { body: { email: EMAIL, code: wrong } })).status).toBe(400);
    // Fifth miss closed the challenge: even the right code fails now.
    expect((await t.call("/api/auth/verify-email", { body: { email: EMAIL, code } })).body.error).toBe("INVALID_CODE");

    t.tick(61_000);
    await t.call("/api/auth/resend-code", { body: { email: EMAIL } });
    const c2 = t.lastCode();
    expect((await t.call("/api/auth/resend-code", { body: { email: EMAIL } })).status).toBe(429); // 1 per minute
    t.tick(STUDENT_CODE_TTL_MS + 1);
    expect((await t.call("/api/auth/verify-email", { body: { email: EMAIL, code: c2 } })).body.error).toBe("INVALID_CODE"); // expired

    t.tick(61_000);
    await t.call("/api/auth/resend-code", { body: { email: EMAIL } });
    const c3 = t.lastCode();
    t.tick(61_000);
    await t.call("/api/auth/resend-code", { body: { email: EMAIL } });
    const c4 = t.lastCode();
    if (c3 !== c4) expect((await t.call("/api/auth/verify-email", { body: { email: EMAIL, code: c3 } })).body.error).toBe("INVALID_CODE"); // superseded
    expect((await t.call("/api/auth/verify-email", { body: { email: EMAIL, code: c4 } })).status).toBe(200);
    // Replay of a consumed code.
    expect((await t.call("/api/auth/verify-email", { body: { email: EMAIL, code: c4 } })).status).toBe(400);
  });

  it("locks out password guessing per account and per IP (durable counters)", async () => {
    const t = setup();
    await t.registerAndVerify();
    await t.call("/api/auth/logout", { body: {} });
    for (let i = 0; i < 8; i++) expect((await t.call("/api/auth/login", { body: { email: EMAIL, password: `falsch-${i}-xxxxxx` }, ip: `198.51.100.${i}` })).status).toBe(401);
    // Account locked, even with the right password, from a new IP.
    expect((await t.call("/api/auth/login", { body: { email: EMAIL, password: PW }, ip: "192.0.2.50" })).status).toBe(429);
    t.tick(15 * 60_000 + 1);
    expect((await t.call("/api/auth/login", { body: { email: EMAIL, password: PW }, ip: "192.0.2.50" })).status).toBe(200);
    // Per-IP limit across many accounts.
    for (let i = 0; i < 20; i++) await t.call("/api/auth/login", { body: { email: `x${i}@example.de`, password: "falsch-xxxxxxxx" }, ip: "192.0.2.99", jar: false });
    expect((await t.call("/api/auth/login", { body: { email: EMAIL, password: PW }, ip: "192.0.2.99", jar: false })).status).toBe(429);
  });

  it("rotates the session on sign-in (no fixation) and expires sessions", async () => {
    const t = setup();
    await t.registerAndVerify();
    const first = t.getCookie();
    await t.call("/api/auth/login", { body: { email: EMAIL, password: PW } });
    const second = t.getCookie();
    expect(second).not.toBe(first);
    expect((await t.call("/api/me", { cookie: first, jar: false })).body.authenticated).toBe(false);
    expect((await t.call("/api/me")).body.authenticated).toBe(true);
    // A forged / unknown token is rejected.
    expect((await t.call("/api/me", { cookie: `__Host-rd_session=${"A".repeat(43)}`, jar: false })).body.authenticated).toBe(false);
    t.tick(STUDENT_SESSION_MS + 1);
    expect((await t.call("/api/me")).body.authenticated).toBe(false);
  });

  it("keeps a returning student signed in: sliding renewal, same token, at most once a day, secure cookie", async () => {
    const t = setup();
    await t.registerAndVerify();
    const token = t.getCookie();
    const countSessions = () => (t.raw.prepare("SELECT COUNT(*) AS n FROM student_sessions").get() as { n: number }).n;
    const n0 = countSessions();
    // Same day: no renewal, no Set-Cookie, no extra writes.
    const same = await t.call("/api/me");
    expect(same.setCookie).toBe("");
    // A day later: renewed with the SAME token and a fresh, fully secure cookie.
    t.tick(STUDENT_SESSION_RENEW_MS + 1);
    const r = await t.call("/api/me");
    expect(r.body.authenticated).toBe(true);
    expect(r.setCookie).toMatch(/^__Host-rd_session=[A-Za-z0-9_-]{40,}; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=\d+$/);
    expect(`__Host-rd_session=${/__Host-rd_session=([^;]*)/.exec(r.setCookie)![1]}`).toBe(token);
    expect(countSessions()).toBe(n0); // no new tokens minted
    // Visiting regularly keeps the student in far beyond the idle lifetime of a single window.
    for (let i = 0; i < 6; i++) { t.tick(STUDENT_SESSION_MS * 0.9); expect((await t.call("/api/me")).body.authenticated).toBe(true); }
    // Restart-equivalent: a brand-new "browser" holding only the cookie is recognised.
    expect((await t.call("/api/me", { cookie: t.getCookie(), jar: false })).body.authenticated).toBe(true);
    // Idle for longer than the lifetime: signed out safely.
    t.tick(STUDENT_SESSION_MS + 1);
    expect((await t.call("/api/me")).body.authenticated).toBe(false);
  });

  it("never renews a revoked session; logout invalidates it server-side and clears the cookie", async () => {
    const t = setup();
    await t.registerAndVerify();
    const token = t.getCookie();
    const out = await t.call("/api/auth/logout", { body: {} });
    expect(out.setCookie).toMatch(/Max-Age=0/);
    t.tick(STUDENT_SESSION_RENEW_MS + 1);
    const r = await t.call("/api/me", { cookie: token, jar: false });
    expect(r.body.authenticated).toBe(false);
    expect(r.setCookie).toBe("");
    expect(t.raw.prepare("SELECT revoked_at FROM student_sessions").all()).toEqual([{ revoked_at: T0 }]);
  });

  it("logout everywhere revokes every session of the student", async () => {
    const t = setup();
    await t.registerAndVerify();
    const a = t.getCookie();
    await t.call("/api/auth/login", { body: { email: EMAIL, password: PW }, cookie: "", jar: true });
    const b = t.getCookie();
    expect((await t.call("/api/me", { cookie: a, jar: false })).body.authenticated).toBe(true);
    await t.call("/api/auth/logout", { body: { all: true }, cookie: b });
    expect((await t.call("/api/me", { cookie: a, jar: false })).body.authenticated).toBe(false);
  });

  it("forgot / reset password: code by e-mail, revokes sessions, old password stops working", async () => {
    const t = setup();
    await t.registerAndVerify();
    const session = t.getCookie();
    const f = await t.call("/api/auth/forgot-password", { body: { email: EMAIL } });
    expect(f.status).toBe(202);
    expect(t.mails.at(-1)!.subject).toContain("Passwort zurücksetzen");
    const code = t.lastCode();
    expect((await t.call("/api/auth/reset-password", { body: { email: EMAIL, code, password: "kurz" } })).body.error).toBe("WEAK_PASSWORD");
    const r = await t.call("/api/auth/reset-password", { body: { email: EMAIL, code, password: "neues-Passwort-456" } });
    expect(r.status).toBe(200);
    expect((await t.call("/api/me", { cookie: session, jar: false })).body.authenticated).toBe(false);
    expect((await t.call("/api/auth/login", { body: { email: EMAIL, password: PW } })).status).toBe(401);
    expect((await t.call("/api/auth/login", { body: { email: EMAIL, password: "neues-Passwort-456" } })).status).toBe(200);
    expect((await t.call("/api/auth/reset-password", { body: { email: EMAIL, code, password: "drittes-Passwort-789" } })).body.error).toBe("INVALID_CODE"); // replay
    // A verification code cannot be used as a reset code.
    expect((await t.call("/api/auth/reset-password", { body: { email: "nobody@example.de", code, password: "drittes-Passwort-789" } })).body.error).toBe("INVALID_CODE");
  });

  it("an unverified registration can be taken over by the real inbox owner", async () => {
    const t = setup();
    await t.call("/api/auth/register", { body: { email: EMAIL, password: "angreifer-Passwort-1" } });
    t.tick(61_000);
    await t.register();
    await t.call("/api/auth/verify-email", { body: { email: EMAIL, code: t.lastCode() } });
    await t.call("/api/auth/logout", { body: {} });
    expect((await t.call("/api/auth/login", { body: { email: EMAIL, password: "angreifer-Passwort-1" } })).status).toBe(401);
    expect((await t.call("/api/auth/login", { body: { email: EMAIL, password: PW } })).status).toBe(200);
  });

  it("reports mail failure on registration and does not leave a usable code", async () => {
    const t = setup({ mailOk: false });
    expect((await t.register()).body.error).toBe("MAIL_FAILED");
    expect(t.raw.prepare("SELECT COUNT(*) AS n FROM email_challenges WHERE consumed_at IS NULL").get()).toEqual({ n: 0 });
  });

  it("caps e-mails per address (cost and abuse protection)", async () => {
    const t = setup();
    await t.register();
    for (let i = 0; i < 6; i++) { t.tick(61_000); await t.call("/api/auth/resend-code", { body: { email: EMAIL } }); }
    expect(t.mails.length).toBe(5);
  });

  it("progress backup is opt-in, versioned and owned by the student", async () => {
    const t = setup();
    expect((await t.call("/api/me/progress")).status).toBe(401);
    await t.registerAndVerify();
    expect((await t.call("/api/me/progress")).body).toEqual({ progress: null, version: 0, updatedAt: null });
    const p = { version: 1, questions: { q1: { attempts: 1, correctCount: 1, streak: 1, lastCorrect: true, lastAnsweredAt: T0 } }, scored: {}, bookmarks: [], completedLessons: [], days: {}, examHistory: [] };
    expect((await t.call("/api/me/progress", { body: { progress: p, baseVersion: 0 } })).body).toMatchObject({ ok: true, version: 1 });
    expect((await t.call("/api/me/progress", { body: { progress: p, baseVersion: 0 } })).status).toBe(409); // stale writer
    expect((await t.call("/api/me/progress", { body: { progress: { version: 2 }, baseVersion: 1 } })).status).toBe(400);
    expect((await t.call("/api/me/progress")).body).toMatchObject({ progress: p, version: 1 });
    // Another student never sees it.
    const other = await t.call("/api/auth/register", { body: { email: "zwei@example.de", password: PW }, cookie: "", jar: false });
    expect(other.status).toBe(202);
    const v = await t.call("/api/auth/verify-email", { body: { email: "zwei@example.de", code: t.lastCode() }, cookie: "" });
    expect(v.status).toBe(200);
    expect((await t.call("/api/me/progress")).body.progress).toBeNull();
  });

  it("export and account deletion (password required, cascades, signs out)", async () => {
    const t = setup();
    await t.registerAndVerify();
    const ex = await t.call("/api/me/export");
    expect(ex.body).toMatchObject({ account: { email: "student.one@example.de" } });
    expect(JSON.stringify(ex.body)).not.toMatch(/hash/);
    expect((await t.call("/api/me/delete", { body: { password: "falsch-xxxxxxxx" } })).status).toBe(401);
    const del = await t.call("/api/me/delete", { body: { password: PW } });
    expect(del.body).toEqual({ ok: true, deleted: true });
    for (const tbl of ["students", "email_challenges", "student_sessions", "student_progress"]) expect(t.raw.prepare(`SELECT COUNT(*) AS n FROM ${tbl}`).get()).toEqual({ n: 0 });
    expect((await t.call("/api/me")).body.authenticated).toBe(false);
    // The address can register again from scratch.
    expect((await t.register()).status).toBe(202);
  });

  it("mail goes only to Resend in production; the loopback test sink needs APP_ENV=e2e", async () => {
    const urls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (u: string | URL | Request) => { urls.push(String(u)); return new Response("{}", { status: 200 }); }) as typeof fetch;
    try {
      for (const [appEnv, sink, expected] of [
        ["production", "http://127.0.0.1:8799/emails", "https://api.resend.com/emails"],
        ["e2e", "https://evil.example/emails", "https://api.resend.com/emails"],
        ["e2e", "http://127.0.0.1:8799/emails", "http://127.0.0.1:8799/emails"],
      ] as const) {
        const { d1: db } = d1(studentMigration);
        urls.length = 0;
        const r = await handleStudents(new Request("https://www.regaplatform.com/api/auth/register", { method: "POST", headers: { "x-rd-request": "1", "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PW }) }),
          { STUDENT_DB: db, REGADRIVE_RESEND_API_KEY: "re_test", APP_ENV: appEnv, MAIL_API_URL: sink }, { enabled: true, now: T0 });
        expect(r.status).toBe(202);
        expect(urls).toEqual([expected]);
      }
    } finally { globalThis.fetch = orig; }
  });

  it("removes unverified registrations after the retention period", async () => {
    const t = setup();
    await t.call("/api/auth/register", { body: { email: "alt@example.de", password: PW } });
    t.tick(UNVERIFIED_RETENTION_MS + 11 * 60_000);
    await t.register();
    expect(t.raw.prepare("SELECT email_normalized FROM students").all()).toEqual([{ email_normalized: "student.one@example.de" }]);
  });
});

describe("worker integration", () => {
  const baseEnv = (extra: Partial<Env> = {}): Env => ({
    ASSETS: { fetch: async () => new Response("asset") }, APP_ENV: "production", PAYMENTS_ENABLED: "false", DATABASE_PRODUCTION_ENABLED: "false", ...extra,
  });
  it("routes /api/auth and /api/me to the student database only when enabled", async () => {
    invalidateOverrides();
    const students = d1(studentMigration);
    const off = await handleApi(new Request("https://www.regaplatform.com/api/me"), baseEnv({ STUDENT_DB: students.d1 }));
    expect(off.status).toBe(503);
    const on = await handleApi(new Request("https://www.regaplatform.com/api/me"), baseEnv({ STUDENT_DB: students.d1, STUDENT_AUTH_ENABLED: "true" }));
    expect(await on.json()).toEqual({ authenticated: false });
    const flags = await (await handleApi(new Request("https://www.regaplatform.com/api/flags"), baseEnv({ STUDENT_DB: students.d1, STUDENT_AUTH_ENABLED: "true" }))).json() as Record<string, unknown>;
    expect(flags).toMatchObject({ studentAuthEnabled: true, databaseProductionEnabled: false, paymentsEnabled: false, checkoutEnabled: false });
    const cross = await handleApi(new Request("https://www.regaplatform.com/api/auth/login", { method: "POST", headers: { origin: "https://evil.example", "x-rd-request": "1", "content-type": "application/json" }, body: "{}" }), baseEnv({ STUDENT_DB: students.d1, STUDENT_AUTH_ENABLED: "true" }));
    expect(cross.status).toBe(403);
  });
  it("the owner can switch student accounts off from /dr, and the emergency lock stops them", async () => {
    const students = d1(studentMigration);
    const dr = d1(drMigration);
    const env = baseEnv({ STUDENT_DB: students.d1, STUDENT_AUTH_ENABLED: "true", DB: dr.d1 });
    invalidateOverrides();
    expect((await handleApi(new Request("https://www.regaplatform.com/api/me"), env)).status).toBe(200);
    dr.raw.exec(`INSERT INTO dr_feature_states (key, state, updated_at, updated_by) VALUES ('student_accounts', 'OFF', ${T0}, 'owner')`);
    invalidateOverrides();
    expect((await handleApi(new Request("https://www.regaplatform.com/api/me"), env)).status).toBe(503);
    dr.raw.exec(`UPDATE dr_feature_states SET state = 'ON' WHERE key = 'student_accounts'`);
    dr.raw.exec(`INSERT INTO dr_feature_states (key, state, updated_at, updated_by) VALUES ('emergency_lock', 'ON', ${T0}, 'owner')`);
    invalidateOverrides();
    expect((await handleApi(new Request("https://www.regaplatform.com/api/me"), env)).status).toBe(503);
    invalidateOverrides();
  });
  it("student records are never written to the /dr database", async () => {
    const students = d1(studentMigration);
    const dr = d1(drMigration);
    invalidateOverrides();
    const env = baseEnv({ STUDENT_DB: students.d1, STUDENT_AUTH_ENABLED: "true", DB: dr.d1 });
    const r = await handleApi(new Request("https://www.regaplatform.com/api/auth/register", { method: "POST", headers: { "x-rd-request": "1", "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PW }) }), env);
    expect(r.status).toBe(503); // no mail key configured in this test → MAIL_FAILED, but the account row lives only in STUDENT_DB
    const drTables = dr.raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    expect(drTables.some((x) => /student|email_challenges/.test(x.name))).toBe(false);
    expect(students.raw.prepare("SELECT COUNT(*) AS n FROM students").get()).toEqual({ n: 1 });
  });
});
