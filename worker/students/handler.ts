/**
 * Student accounts API (/api/auth/*, /api/me*). Fail closed everywhere.
 *
 * Data lives ONLY in the separate student D1 database (binding STUDENT_DB, migrations-students/). The owner /dr
 * database (binding DB) is read for nothing but the shared RegaDRIVE mail key fallback (dr_config.resend_api_key).
 *
 * - Passwords: PBKDF2-SHA256 (src/lib/shared/auth.ts). Unknown e-mail and wrong password take the same path and
 *   return the same error (anti-enumeration); register / resend / forgot always answer the same way.
 * - Codes: uniform 6 digits, stored as SHA-256(id:code), valid 10 minutes, single use, at most 5 tries.
 * - Sessions: random 256-bit token in a __Host- HttpOnly Secure SameSite=Lax cookie; only its hash is stored.
 *   A new token on every sign-in (no fixation), revoked on logout, password reset and account deletion.
 * - CSRF: every state-changing request needs JSON, the custom header `x-rd-request: 1` (forces a CORS preflight)
 *   and, when the browser sends one, a same-origin Origin (checked in worker/index.ts).
 * - Rate limits are durable (D1 student_rate_events) and keyed by hashed IP / e-mail.
 * - Logs and the database never contain passwords, codes, tokens or the mail key.
 */
import type { D1Like } from "../dr/db";
import { resendSender, sha256Hex, sixDigitCode, type MailSender } from "../dr/handler";
import { hashPassword, hashToken, newSessionToken, normalizeEmail, SESSION_COOKIE, sessionCookie, verifyPassword } from "../../src/lib/shared/auth";

export interface StudentEnv {
  STUDENT_DB?: D1Like;
  /** Sender on the verified RegaDRIVE domain, e.g. "RegaDRIVE <no-reply@regaplatform.com>". */
  STUDENT_MAIL_FROM?: string;
  REGADRIVE_RESEND_API_KEY?: string;
  /** Owner /dr database — used here only to read the RegaDRIVE mail key fallback. */
  DB?: D1Like;
  APP_ENV?: string;
  /** Local E2E mail sink. Honoured ONLY with APP_ENV=e2e and a loopback http://127.0.0.1 URL (preflight forbids it in config). */
  MAIL_API_URL?: string;
}
export interface StudentDeps { now?: number; send?: MailSender; enabled: boolean }

export const STUDENT_CODE_TTL_MS = 10 * 60_000;
export const STUDENT_MAX_CODE_ATTEMPTS = 5;
export const STUDENT_SESSION_MS = 30 * 24 * 3600_000;
export const UNVERIFIED_RETENTION_MS = 7 * 24 * 3600_000;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_PROGRESS_BYTES = 256 * 1024;
const MIN = 60_000;
const RATE = {
  registerIp: { max: 10, windowMs: 60 * MIN },
  registerEmail: { max: 3, windowMs: 60 * MIN },
  loginIpFail: { max: 20, windowMs: 15 * MIN },
  loginEmailFail: { max: 8, windowMs: 15 * MIN },
  verifyIp: { max: 30, windowMs: 15 * MIN },
  resendEmailShort: { max: 1, windowMs: MIN },
  mailEmail: { max: 5, windowMs: 60 * MIN },
  mailIp: { max: 10, windowMs: 60 * MIN },
  // Stay inside the free Resend allowance (100 e-mails/day shared with /dr): €0 policy.
  mailGlobal: { max: 80, windowMs: 24 * 60 * MIN },
  sensitiveIp: { max: 30, windowMs: 15 * MIN },
};

const HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex, nofollow",
};
function reply(body: unknown, status = 200, cookies: string[] = []): Response {
  const h = new Headers(HEADERS);
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(JSON.stringify(body), { status, headers: h });
}
const clearSessionCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
const ACCEPTED = { ok: true, next: "verify" } as const;

function readSessionToken(req: Request): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === SESSION_COOKIE) {
      const v = part.slice(i + 1).trim();
      return /^[A-Za-z0-9_-]{40,64}$/.test(v) ? v : null;
    }
  }
  return null;
}
const randomId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
const changes = (r: unknown): number => {
  const o = r as { meta?: { changes?: number }; changes?: number } | null;
  return Number(o?.meta?.changes ?? o?.changes ?? 0);
};
const LANGS = new Set(["ckb", "kmr", "ar", "de"]);
/** Display name: no control characters or angle brackets, at most 60 characters. */
const cleanName = (v: string | null) => [...(v ?? "")].filter((c) => c.charCodeAt(0) >= 32 && c !== "<" && c !== ">").join("").trim().slice(0, 60);

/** Same wire format as Resend, for the local E2E sink only. */
const loopbackSender = (url: string): MailSender => async (key, msg) => {
  try {
    const r = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from: msg.from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }) });
    return r.ok ? { ok: true } : { ok: false, error: `mail sink HTTP ${r.status}` };
  } catch { return { ok: false, error: "mail sink unreachable" }; }
};

let dummyHash: Promise<string> | null = null;
/** Spend the same PBKDF2 work for unknown accounts as for real ones (timing equalisation). */
const burnPasswordCheck = async (pw: string) => { dummyHash ??= hashPassword(`dummy-${randomId()}`); await verifyPassword(pw, await dummyHash); };

let lastHousekeeping = 0;

interface StudentRow { id: string; email_normalized: string; display_name: string; password_hash: string; lang: string; email_verified_at: number | null; created_at: number; updated_at: number }
interface ChallengeRow { id: string; student_id: string; purpose: string; code_hash: string; expires_at: number; consumed_at: number | null; attempts: number }

export async function handleStudents(req: Request, env: StudentEnv, deps: StudentDeps): Promise<Response> {
  const now = deps.now ?? Date.now();
  const url = new URL(req.url);
  const path = url.pathname;
  const db = env.STUDENT_DB;
  if (!deps.enabled || !db) return reply({ error: "AUTH_UNAVAILABLE" }, 503);
  const send: MailSender = deps.send
    ?? (env.APP_ENV === "e2e" && /^http:\/\/127\.0\.0\.1:\d+\//.test(env.MAIL_API_URL ?? "") ? loopbackSender(env.MAIL_API_URL!) : resendSender);

  const ipKey = (await sha256Hex(`ip:${req.headers.get("cf-connecting-ip") ?? "local"}`)).slice(0, 24);
  const emailKey = async (email: string) => (await sha256Hex(`em:${email}`)).slice(0, 24);
  const event = async (type: string, studentId: string | null = null) => {
    try { await db.prepare("INSERT INTO student_auth_events (student_id, event_type, created_at) VALUES (?, ?, ?)").bind(studentId, type, now).run(); }
    catch { /* auditing never breaks the request */ }
  };
  const count = async (bucket: string, windowMs: number) =>
    (await db.prepare("SELECT COUNT(*) AS n FROM student_rate_events WHERE bucket = ? AND at > ?").bind(bucket, now - windowMs).first<{ n: number }>())?.n ?? 0;
  const hit = (bucket: string) => db.prepare("INSERT INTO student_rate_events (bucket, at) VALUES (?, ?)").bind(bucket, now).run();
  /** Check-and-record. Returns true when the bucket is already full. */
  const limited = async (bucket: string, rule: { max: number; windowMs: number }) => {
    if (await count(bucket, rule.windowMs) >= rule.max) return true;
    await hit(bucket);
    return false;
  };
  const housekeeping = async () => {
    if (Math.abs(now - lastHousekeeping) < 10 * MIN) return;
    lastHousekeeping = now;
    try {
      await db.prepare("DELETE FROM student_rate_events WHERE at < ?").bind(now - 24 * 60 * MIN).run();
      await db.prepare("DELETE FROM email_challenges WHERE expires_at < ?").bind(now - 24 * 60 * MIN).run();
      await db.prepare("DELETE FROM student_sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)").bind(now, now - 24 * 60 * MIN).run();
      await db.prepare("DELETE FROM student_auth_events WHERE created_at < ?").bind(now - 90 * 24 * 60 * MIN).run();
      await db.prepare("DELETE FROM students WHERE email_verified_at IS NULL AND created_at < ?").bind(now - UNVERIFIED_RETENTION_MS).run();
    } catch { /* best effort */ }
  };

  // ── session ────────────────────────────────────────────────────────────
  const token = readSessionToken(req);
  const tokenHash = token ? await hashToken(token) : null;
  const current = await (async () => {
    if (!tokenHash) return null;
    const row = await db.prepare(
      "SELECT s.id AS session_id, s.last_seen_at, s.expires_at, st.* FROM student_sessions s JOIN students st ON st.id = s.student_id WHERE s.token_hash = ? AND s.revoked_at IS NULL",
    ).bind(tokenHash).first<StudentRow & { session_id: string; last_seen_at: number; expires_at: number }>();
    if (!row || row.expires_at <= now || row.email_verified_at === null) return null;
    if (now - row.last_seen_at > 60 * MIN) await db.prepare("UPDATE student_sessions SET last_seen_at = ? WHERE id = ?").bind(now, row.session_id).run();
    return row;
  })();
  const publicStudent = (s: StudentRow) => ({ email: s.email_normalized, displayName: s.display_name, lang: s.lang, emailVerified: s.email_verified_at !== null, createdAt: s.created_at });

  const startSession = async (studentId: string): Promise<string> => {
    // Rotation: never keep a token the client brought with it.
    if (tokenHash) await db.prepare("UPDATE student_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").bind(now, tokenHash).run();
    const t = newSessionToken();
    await db.prepare("INSERT INTO student_sessions (id, student_id, token_hash, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(randomId(), studentId, await hashToken(t), now, now, now + STUDENT_SESSION_MS).run();
    return sessionCookie(t, Math.floor(STUDENT_SESSION_MS / 1000));
  };

  if (req.method === "GET" && path === "/api/me") {
    if (!current) return reply({ authenticated: false });
    return reply({ authenticated: true, student: publicStudent(current) });
  }

  // ── CSRF + body ────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (req.headers.get("x-rd-request") !== "1" || !(req.headers.get("content-type") ?? "").startsWith("application/json")) return reply({ error: "FORBIDDEN" }, 403);
    const limit = path === "/api/me/progress" ? MAX_PROGRESS_BYTES + 1024 : MAX_BODY_BYTES;
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > limit) return reply({ error: "PAYLOAD_TOO_LARGE" }, 413);
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return reply({ error: "BAD_REQUEST" }, 400);
      body = parsed as Record<string, unknown>;
    } catch { return reply({ error: "BAD_REQUEST" }, 400); }
  }
  const str = (k: string, max: number): string | null => (typeof body[k] === "string" && (body[k] as string).length <= max ? body[k] as string : null);
  const emailIn = () => { const e = str("email", 254); return e ? normalizeEmail(e) : null; };
  const codeIn = () => { const c = str("code", 12)?.replace(/\s/g, "") ?? ""; return /^\d{6}$/.test(c) ? c : null; };
  const passwordOk = (pw: string | null, email: string): pw is string => !!pw && pw.length >= 10 && pw.length <= 256 && pw.trim().toLowerCase() !== email;

  // ── mail ───────────────────────────────────────────────────────────────
  const mailKey = async (): Promise<string | null> => {
    if (env.REGADRIVE_RESEND_API_KEY) return env.REGADRIVE_RESEND_API_KEY;
    try { return (await env.DB?.prepare("SELECT value FROM dr_config WHERE key = 'resend_api_key'").first<{ value: string }>())?.value ?? null; }
    catch { return null; }
  };
  /** Creates a fresh code (older open codes of the same purpose are closed) and e-mails it. */
  const sendCode = async (student: StudentRow, purpose: "verify_email" | "reset_password"): Promise<boolean> => {
    const ek = await emailKey(student.email_normalized);
    if (await limited(`mail:e:${ek}`, RATE.mailEmail) || await limited(`mail:ip:${ipKey}`, RATE.mailIp) || await limited("mail:global", RATE.mailGlobal)) {
      await event("mail_rate_limited", student.id);
      return false;
    }
    const key = await mailKey();
    if (!key) { await event("mail_not_configured", student.id); return false; }
    await db.prepare("UPDATE email_challenges SET consumed_at = ? WHERE student_id = ? AND purpose = ? AND consumed_at IS NULL").bind(now, student.id, purpose).run();
    const id = randomId();
    const code = sixDigitCode();
    await db.prepare("INSERT INTO email_challenges (id, student_id, purpose, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, student.id, purpose, await sha256Hex(`${id}:${code}`), now + STUDENT_CODE_TTL_MS, now).run();
    const verify = purpose === "verify_email";
    const sent = await send(key, {
      from: env.STUDENT_MAIL_FROM || "RegaDRIVE <no-reply@regaplatform.com>",
      to: student.email_normalized,
      subject: verify ? "RegaDRIVE — کۆدی پشتڕاستکردنەوە · Bestätigungscode" : "RegaDRIVE — گۆڕینی وشەی نهێنی · Passwort zurücksetzen",
      text: [
        verify ? "کۆدی پشتڕاستکردنەوەی ئیمەیڵەکەت لە RegaDRIVE:" : "کۆدی گۆڕینی وشەی نهێنی لە RegaDRIVE:",
        code,
        "تەنها ١٠ خولەک کار دەکات. ئەگەر خۆت داوات نەکردووە، ئەم ئیمەیڵە پشتگوێ بخە.",
        "",
        verify ? "Dein RegaDRIVE-Bestätigungscode:" : "Dein Code zum Zurücksetzen des RegaDRIVE-Passworts:",
        code,
        "Der Code ist 10 Minuten gültig. Wenn du das nicht angefordert hast, ignoriere diese E-Mail.",
        "",
        "RegaDRIVE · www.regaplatform.com",
      ].join("\n"),
      html: `<div style="font-family:Tahoma,Arial,sans-serif;font-size:16px;color:#17213c;max-width:480px">`
        + `<p dir="rtl" lang="ckb">${verify ? "کۆدی پشتڕاستکردنەوەی ئیمەیڵەکەت لە RegaDRIVE:" : "کۆدی گۆڕینی وشەی نهێنی لە RegaDRIVE:"}</p>`
        + `<p style="font-size:32px;font-weight:800;letter-spacing:6px;direction:ltr;text-align:center">${code}</p>`
        + `<p dir="rtl" lang="ckb">تەنها ١٠ خولەک کار دەکات. ئەگەر خۆت داوات نەکردووە، ئەم ئیمەیڵە پشتگوێ بخە.</p>`
        + `<p dir="ltr" lang="de">${verify ? "Dein RegaDRIVE-Bestätigungscode (10 Minuten gültig). Wenn du das nicht angefordert hast, ignoriere diese E-Mail." : "Dein Code zum Zurücksetzen des Passworts (10 Minuten gültig). Wenn du das nicht angefordert hast, ignoriere diese E-Mail."}</p>`
        + `<p style="color:#58657c;font-size:13px">RegaDRIVE · www.regaplatform.com</p></div>`,
    });
    if (!sent.ok) {
      await db.prepare("UPDATE email_challenges SET consumed_at = ? WHERE id = ?").bind(now, id).run();
      await event("mail_failed", student.id);
      return false;
    }
    await event(verify ? "verify_code_sent" : "reset_code_sent", student.id);
    return true;
  };
  /** Duplicate registration: tell the real owner, never the requester. */
  const sendExistsNotice = async (student: StudentRow): Promise<void> => {
    const ek = await emailKey(student.email_normalized);
    if (await limited(`mail:e:${ek}`, RATE.mailEmail) || await limited(`mail:ip:${ipKey}`, RATE.mailIp) || await limited("mail:global", RATE.mailGlobal)) return;
    const key = await mailKey();
    if (!key) return;
    const sent = await send(key, {
      from: env.STUDENT_MAIL_FROM || "RegaDRIVE <no-reply@regaplatform.com>",
      to: student.email_normalized,
      subject: "RegaDRIVE — هەژمارەکەت هەیە · Du hast bereits ein Konto",
      text: [
        "کەسێک هەوڵیدا بەم ئیمەیڵە هەژمارێکی نوێ لە RegaDRIVE دروست بکات، بەڵام هەژمارێکت هەیە. بچۆ ژوورەوە یان وشەی نهێنی بگۆڕە. ئەگەر خۆت نەبوویت، پشتگوێی بخە.",
        "",
        "Jemand wollte mit dieser E-Mail-Adresse ein neues RegaDRIVE-Konto anlegen, aber es gibt bereits eines. Melde dich an oder setze dein Passwort zurück. Warst du das nicht, ignoriere diese E-Mail.",
        "",
        "RegaDRIVE · www.regaplatform.com/account",
      ].join("\n"),
      html: `<div style="font-family:Tahoma,Arial,sans-serif;font-size:16px;color:#17213c;max-width:480px">`
        + `<p dir="rtl" lang="ckb">کەسێک هەوڵیدا بەم ئیمەیڵە هەژمارێکی نوێ لە RegaDRIVE دروست بکات، بەڵام هەژمارێکت هەیە. بچۆ ژوورەوە یان وشەی نهێنی بگۆڕە. ئەگەر خۆت نەبوویت، پشتگوێی بخە.</p>`
        + `<p dir="ltr" lang="de">Jemand wollte mit dieser E-Mail-Adresse ein neues RegaDRIVE-Konto anlegen, aber es gibt bereits eines. Melde dich an oder setze dein Passwort zurück. Warst du das nicht, ignoriere diese E-Mail.</p>`
        + `<p style="color:#58657c;font-size:13px">RegaDRIVE · www.regaplatform.com/account</p></div>`,
    });
    await event(sent.ok ? "exists_notice_sent" : "mail_failed", student.id);
  };
  /** Validates and consumes a code. Wrong codes count against the challenge; 5 misses close it. */
  const checkCode = async (student: StudentRow, purpose: "verify_email" | "reset_password", code: string): Promise<boolean> => {
    const ch = await db.prepare("SELECT * FROM email_challenges WHERE student_id = ? AND purpose = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1")
      .bind(student.id, purpose).first<ChallengeRow>();
    if (!ch || ch.expires_at <= now || ch.attempts >= STUDENT_MAX_CODE_ATTEMPTS) return false;
    const ok = (await sha256Hex(`${ch.id}:${code}`)) === ch.code_hash;
    if (!ok) {
      await db.prepare("UPDATE email_challenges SET attempts = attempts + 1, consumed_at = CASE WHEN attempts + 1 >= ? THEN ? ELSE consumed_at END WHERE id = ? AND consumed_at IS NULL")
        .bind(STUDENT_MAX_CODE_ATTEMPTS, now, ch.id).run();
      return false;
    }
    // Single use, also under concurrent requests.
    return changes(await db.prepare("UPDATE email_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(now, ch.id).run()) === 1;
  };
  const byEmail = (email: string) => db.prepare("SELECT * FROM students WHERE email_normalized = ?").bind(email).first<StudentRow>();

  // ── routes ─────────────────────────────────────────────────────────────
  if (req.method === "POST" && path === "/api/auth/register") {
    await housekeeping();
    const email = emailIn();
    const password = str("password", 256);
    const displayName = cleanName(str("displayName", 120));
    const lang = typeof body.lang === "string" && LANGS.has(body.lang) ? body.lang : "ckb";
    if (!email) return reply({ error: "INVALID_EMAIL" }, 400);
    if (!passwordOk(password, email)) return reply({ error: "WEAK_PASSWORD" }, 400);
    if (await limited(`reg:ip:${ipKey}`, RATE.registerIp) || await limited(`reg:e:${await emailKey(email)}`, RATE.registerEmail)) return reply({ error: "RATE_LIMITED" }, 429);
    const hash = await hashPassword(password);
    const existing = await byEmail(email);
    if (existing && existing.email_verified_at !== null) {
      // Duplicate: same answer as a new registration. The real owner is told by e-mail and can sign in or reset.
      await event("register_duplicate", existing.id);
      await sendExistsNotice(existing);
      return reply(ACCEPTED, 202);
    }
    let student: StudentRow;
    if (existing) {
      // An unverified registration proves nothing; whoever controls the inbox may replace it.
      await db.prepare("UPDATE students SET password_hash = ?, display_name = ?, lang = ?, updated_at = ? WHERE id = ? AND email_verified_at IS NULL")
        .bind(hash, displayName, lang, now, existing.id).run();
      await db.prepare("UPDATE student_sessions SET revoked_at = ? WHERE student_id = ? AND revoked_at IS NULL").bind(now, existing.id).run();
      student = { ...existing, password_hash: hash, display_name: displayName, lang };
    } else {
      const id = randomId();
      try {
        await db.prepare("INSERT INTO students (id, email_normalized, display_name, password_hash, lang, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(id, email, displayName, hash, lang, now, now).run();
      } catch {
        return reply(ACCEPTED, 202); // lost a race against a parallel registration of the same address
      }
      student = { id, email_normalized: email, display_name: displayName, password_hash: hash, lang, email_verified_at: null, created_at: now, updated_at: now };
      await event("register", id);
    }
    if (!(await sendCode(student, "verify_email"))) return reply({ error: "MAIL_FAILED" }, 503);
    return reply(ACCEPTED, 202);
  }

  if (req.method === "POST" && path === "/api/auth/resend-code") {
    const email = emailIn();
    if (!email) return reply({ error: "INVALID_EMAIL" }, 400);
    const ek = await emailKey(email);
    if (await count(`resend:e:${ek}`, RATE.resendEmailShort.windowMs) >= RATE.resendEmailShort.max) return reply({ error: "RATE_LIMITED", retryAfterSec: 60 }, 429);
    await hit(`resend:e:${ek}`);
    const s = await byEmail(email);
    if (s && s.email_verified_at === null) await sendCode(s, "verify_email");
    return reply(ACCEPTED, 202);
  }

  if (req.method === "POST" && path === "/api/auth/verify-email") {
    const email = emailIn();
    const code = codeIn();
    if (!email || !code) return reply({ error: "INVALID_CODE" }, 400);
    if (await limited(`verify:ip:${ipKey}`, RATE.verifyIp)) return reply({ error: "RATE_LIMITED" }, 429);
    const s = await byEmail(email);
    if (!s || s.email_verified_at !== null || !(await checkCode(s, "verify_email", code))) {
      await event("verify_failed", s?.id ?? null);
      return reply({ error: "INVALID_CODE" }, 400);
    }
    await db.prepare("UPDATE students SET email_verified_at = ?, updated_at = ? WHERE id = ?").bind(now, now, s.id).run();
    await event("verified", s.id);
    const cookie = await startSession(s.id);
    return reply({ ok: true, student: publicStudent({ ...s, email_verified_at: now }) }, 200, [cookie]);
  }

  if (req.method === "POST" && path === "/api/auth/login") {
    await housekeeping();
    const email = emailIn();
    const password = str("password", 256);
    if (!email || !password) return reply({ error: "INVALID_CREDENTIALS" }, 401);
    const ek = await emailKey(email);
    if (await count(`loginfail:ip:${ipKey}`, RATE.loginIpFail.windowMs) >= RATE.loginIpFail.max
      || await count(`loginfail:e:${ek}`, RATE.loginEmailFail.windowMs) >= RATE.loginEmailFail.max) {
      return reply({ error: "RATE_LIMITED", retryAfterSec: 900 }, 429);
    }
    const s = await byEmail(email);
    const ok = s ? await verifyPassword(password, s.password_hash) : (await burnPasswordCheck(password), false);
    if (!s || !ok) {
      await hit(`loginfail:ip:${ipKey}`);
      await hit(`loginfail:e:${ek}`);
      await event("login_failed", s?.id ?? null);
      return reply({ error: "INVALID_CREDENTIALS" }, 401);
    }
    if (s.email_verified_at === null) return reply({ error: "EMAIL_NOT_VERIFIED" }, 403);
    await event("login", s.id);
    const cookie = await startSession(s.id);
    return reply({ ok: true, student: publicStudent(s) }, 200, [cookie]);
  }

  if (req.method === "POST" && path === "/api/auth/logout") {
    if (current && body.all === true) await db.prepare("UPDATE student_sessions SET revoked_at = ? WHERE student_id = ? AND revoked_at IS NULL").bind(now, current.id).run();
    else if (tokenHash) await db.prepare("UPDATE student_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").bind(now, tokenHash).run();
    if (current) await event(body.all === true ? "logout_all" : "logout", current.id);
    return reply({ ok: true }, 200, [clearSessionCookie]);
  }

  if (req.method === "POST" && path === "/api/auth/forgot-password") {
    await housekeeping();
    const email = emailIn();
    if (!email) return reply({ error: "INVALID_EMAIL" }, 400);
    if (await limited(`forgot:ip:${ipKey}`, RATE.sensitiveIp)) return reply({ error: "RATE_LIMITED" }, 429);
    const s = await byEmail(email);
    if (s && s.email_verified_at !== null) await sendCode(s, "reset_password");
    return reply({ ok: true, next: "reset" }, 202);
  }

  if (req.method === "POST" && path === "/api/auth/reset-password") {
    const email = emailIn();
    const code = codeIn();
    const password = str("password", 256);
    if (!email || !code) return reply({ error: "INVALID_CODE" }, 400);
    if (!passwordOk(password, email)) return reply({ error: "WEAK_PASSWORD" }, 400);
    if (await limited(`reset:ip:${ipKey}`, RATE.sensitiveIp)) return reply({ error: "RATE_LIMITED" }, 429);
    const s = await byEmail(email);
    if (!s || s.email_verified_at === null || !(await checkCode(s, "reset_password", code))) {
      await event("reset_failed", s?.id ?? null);
      return reply({ error: "INVALID_CODE" }, 400);
    }
    await db.prepare("UPDATE students SET password_hash = ?, updated_at = ? WHERE id = ?").bind(await hashPassword(password), now, s.id).run();
    await db.prepare("UPDATE student_sessions SET revoked_at = ? WHERE student_id = ? AND revoked_at IS NULL").bind(now, s.id).run();
    await event("password_reset", s.id);
    return reply({ ok: true }, 200, [clearSessionCookie]);
  }

  // ── signed-in student only ─────────────────────────────────────────────
  if (path.startsWith("/api/me")) {
    if (!current) return reply({ error: "UNAUTHENTICATED" }, 401, tokenHash ? [clearSessionCookie] : []);

    if (req.method === "POST" && path === "/api/me") {
      const name = body.displayName === undefined ? current.display_name : cleanName(str("displayName", 120));
      const lang = typeof body.lang === "string" && LANGS.has(body.lang) ? body.lang : current.lang;
      await db.prepare("UPDATE students SET display_name = ?, lang = ?, updated_at = ? WHERE id = ?").bind(name, lang, now, current.id).run();
      return reply({ ok: true, student: publicStudent({ ...current, display_name: name, lang }) });
    }

    if (path === "/api/me/progress" && req.method === "GET") {
      const row = await db.prepare("SELECT payload_json, version, updated_at FROM student_progress WHERE student_id = ?").bind(current.id).first<{ payload_json: string; version: number; updated_at: number }>();
      return reply(row ? { progress: JSON.parse(row.payload_json), version: row.version, updatedAt: row.updated_at } : { progress: null, version: 0, updatedAt: null });
    }
    if (path === "/api/me/progress" && req.method === "POST") {
      const p = body.progress as { version?: unknown } | undefined;
      const base = typeof body.baseVersion === "number" && Number.isInteger(body.baseVersion) ? body.baseVersion : -1;
      if (!p || typeof p !== "object" || Array.isArray(p) || p.version !== 1) return reply({ error: "BAD_REQUEST" }, 400);
      const payload = JSON.stringify(p);
      if (payload.length > MAX_PROGRESS_BYTES) return reply({ error: "PAYLOAD_TOO_LARGE" }, 413);
      const row = await db.prepare("SELECT version FROM student_progress WHERE student_id = ?").bind(current.id).first<{ version: number }>();
      const have = row?.version ?? 0;
      if (base !== have) return reply({ error: "VERSION_CONFLICT", version: have }, 409);
      const r = row
        ? await db.prepare("UPDATE student_progress SET payload_json = ?, version = version + 1, updated_at = ? WHERE student_id = ? AND version = ?").bind(payload, now, current.id, have).run()
        : await db.prepare("INSERT OR IGNORE INTO student_progress (student_id, payload_json, version, updated_at) VALUES (?, ?, 1, ?)").bind(current.id, payload, now).run();
      if (changes(r) !== 1) return reply({ error: "VERSION_CONFLICT" }, 409);
      return reply({ ok: true, version: have + 1, updatedAt: now });
    }

    if (path === "/api/me/export" && req.method === "GET") {
      const progress = await db.prepare("SELECT payload_json, version, updated_at FROM student_progress WHERE student_id = ?").bind(current.id).first<{ payload_json: string; version: number; updated_at: number }>();
      const { results: sessions } = await db.prepare("SELECT created_at, last_seen_at, expires_at, revoked_at FROM student_sessions WHERE student_id = ? ORDER BY created_at DESC LIMIT 50").bind(current.id).all();
      return reply({ exportedAt: now, account: publicStudent(current), sessions, progress: progress ? { data: JSON.parse(progress.payload_json), version: progress.version, updatedAt: progress.updated_at } : null });
    }

    if (path === "/api/me/delete" && req.method === "POST") {
      const password = str("password", 256);
      if (await limited(`delete:ip:${ipKey}`, RATE.sensitiveIp)) return reply({ error: "RATE_LIMITED" }, 429);
      if (!password || !(await verifyPassword(password, current.password_hash))) return reply({ error: "INVALID_CREDENTIALS" }, 401);
      // Cascades to codes, sessions and progress; security events keep no reference (ON DELETE SET NULL).
      await db.prepare("DELETE FROM students WHERE id = ?").bind(current.id).run();
      await event("account_deleted");
      return reply({ ok: true, deleted: true }, 200, [clearSessionCookie]);
    }
  }

  return reply({ error: "NOT_FOUND" }, 404);
}
