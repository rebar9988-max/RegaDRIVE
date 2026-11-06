/**
 * /dr — RegaDRIVE owner control center API (/api/dr/*). Fail closed everywhere.
 *
 * Sign-in: a 6-digit code is e-mailed ONLY to DR_OWNER_EMAIL (wrangler.jsonc var), valid 5 minutes, max 5 tries,
 * stored as a SHA-256 hash. Sessions are random 256-bit tokens in a __Host- HttpOnly, Secure, SameSite=Strict
 * cookie; only their hash is stored. Sessions end after 30 min idle or 8 h. Critical changes need a fresh code
 * (step-up, valid 10 min). Every decision is written to dr_audit_log.
 */
import type { D1Like } from "./db";
import { invalidateOverrides, loadOverrides } from "./db";
import { FEATURES, featureByKey, resolveFeatures, type FeatureState } from "./features";
import type { Flags } from "../../src/lib/shared/flags";

export interface DrEnv {
  DB?: D1Like;
  /** The only address that can ever receive a /dr sign-in code. */
  DR_OWNER_EMAIL?: string;
  /** Sender on the verified RegaDRIVE domain, e.g. "RegaDRIVE <security@regaplatform.com>". */
  DR_MAIL_FROM?: string;
  /** RegaDRIVE-only Resend key (sending access, regaplatform.com only). Falls back to dr_config.resend_api_key. */
  REGADRIVE_RESEND_API_KEY?: string;
}

export interface MailMessage { from: string; to: string; subject: string; text: string; html: string }
export type MailSender = (key: string, msg: MailMessage) => Promise<{ ok: boolean; error?: string }>;

export interface DrContext {
  flags: Flags;
  version: string;
  contentMode: "production" | "preview";
  ai: { id: string; status: string; detail: string }[];
  content: Record<string, unknown>;
}
export interface DrDeps { now?: number; send?: MailSender; context?: () => DrContext }

export const CODE_TTL_MS = 5 * 60_000;
export const MAX_CODE_ATTEMPTS = 5;
export const SESSION_ABSOLUTE_MS = 8 * 3600_000;
export const SESSION_IDLE_MS = 30 * 60_000;
export const STEP_UP_MS = 10 * 60_000;
const SESSION_COOKIE = "__Host-dr_s";
const CHALLENGE_COOKIE = "__Host-dr_c";
const RATE = {
  requestPerIp: { max: 5, windowMs: 15 * 60_000 },
  requestGlobal: { max: 15, windowMs: 60 * 60_000 },
  verifyPerIp: { max: 15, windowMs: 15 * 60_000 },
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
const setCookie = (name: string, value: string, maxAgeSec: number) => `${name}=${value}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Strict`;
const clearCookie = (name: string) => `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      const v = part.slice(i + 1).trim();
      return /^[0-9a-f]{16,128}$/.test(v) ? v : null;
    }
  }
  return null;
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Uniform 6-digit code (rejection sampling, no modulo bias). */
export function sixDigitCode(): string {
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const v = buf[0] ?? 4_294_967_295;
    if (v < 4_294_000_000) return String(v % 1_000_000).padStart(6, "0");
  }
}
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
export function maskEmail(e: string): string {
  const [u, d] = e.split("@");
  if (!u || !d) return "•••";
  return `${u.slice(0, 2)}${"•".repeat(Math.max(3, u.length - 2))}@${d}`;
}

export const resendSender: MailSender = async (key, msg) => {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: msg.from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    return r.ok ? { ok: true } : { ok: false, error: `mail provider HTTP ${r.status}` };
  } catch {
    return { ok: false, error: "mail provider unreachable" };
  }
};

interface SessionRow { token_hash: string; email: string; created_at: number; expires_at: number; last_seen_at: number; step_up_until: number; ip: string | null; user_agent: string | null }
interface CodeRow { id: string; purpose: "login" | "step_up"; session_hash: string | null; code_hash: string; created_at: number; expires_at: number; attempts: number; consumed_at: number | null }

export async function handleDr(req: Request, env: DrEnv, deps: DrDeps = {}): Promise<Response> {
  const now = deps.now ?? Date.now();
  const url = new URL(req.url);
  const path = url.pathname;
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  const owner = (env.DR_OWNER_EMAIL ?? "").trim().toLowerCase();
  const db = env.DB;

  if (!db || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner)) {
    return reply({ error: "DR_NOT_CONFIGURED", missing: [!db ? "database" : null, !owner ? "owner email" : null].filter(Boolean) }, 503);
  }
  const audit = async (actor: string, action: string, result: "allowed" | "denied" | "failed", detail: Record<string, unknown> = {}) => {
    try {
      await db.prepare("INSERT INTO dr_audit_log (at, actor, action, result, detail, ip) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(now, actor, action, result, JSON.stringify(detail).slice(0, 2000), ip).run();
    } catch { /* auditing must never break the request; Workers logs keep the error */ }
  };
  const limited = async (bucket: string, rule: { max: number; windowMs: number }): Promise<boolean> => {
    const row = await db.prepare("SELECT COUNT(*) AS n FROM dr_rate_events WHERE bucket = ? AND at > ?").bind(bucket, now - rule.windowMs).first<{ n: number }>();
    if ((row?.n ?? 0) >= rule.max) return true;
    await db.prepare("INSERT INTO dr_rate_events (bucket, at) VALUES (?, ?)").bind(bucket, now).run();
    return false;
  };

  if (req.method !== "GET" && req.headers.get("x-dr-request") !== "1") {
    await audit("anonymous", `${req.method} ${path}`, "denied", { reason: "missing x-dr-request header" });
    return reply({ error: "FORBIDDEN" }, 403);
  }

  // ── session ────────────────────────────────────────────────────────────
  const session = await (async (): Promise<SessionRow | null> => {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) return null;
    const row = await db.prepare("SELECT * FROM dr_sessions WHERE token_hash = ? AND revoked_at IS NULL").bind(await sha256Hex(token)).first<SessionRow>();
    if (!row || row.expires_at <= now || row.last_seen_at + SESSION_IDLE_MS <= now || row.email !== owner) return null;
    if (now - row.last_seen_at > 60_000) {
      await db.prepare("UPDATE dr_sessions SET last_seen_at = ? WHERE token_hash = ?").bind(now, row.token_hash).run();
      row.last_seen_at = now;
    }
    return row;
  })();
  const actor = session ? `owner:${maskEmail(owner)}` : "anonymous";

  if (path === "/api/dr/session" && req.method === "GET") {
    if (!session) return reply({ authenticated: false, to: maskEmail(owner) });
    return reply({ authenticated: true, email: maskEmail(owner), expiresAt: Math.min(session.expires_at, session.last_seen_at + SESSION_IDLE_MS), stepUpUntil: session.step_up_until });
  }

  // ── sign-in / step-up codes ────────────────────────────────────────────
  if (path === "/api/dr/auth/request" && req.method === "POST") {
    let body: { purpose?: string } = {};
    try { body = await req.json(); } catch { /* empty body = login */ }
    const purpose = body.purpose === "step_up" ? "step_up" : "login";
    if (purpose === "step_up" && !session) return reply({ error: "UNAUTHENTICATED" }, 401);
    if (await limited(`req:${ip}`, RATE.requestPerIp) || await limited("req:global", RATE.requestGlobal)) {
      await audit(actor, "code.request", "denied", { purpose, reason: "rate limited" });
      return reply({ error: "RATE_LIMITED" }, 429);
    }
    let key = env.REGADRIVE_RESEND_API_KEY;
    if (!key) key = (await db.prepare("SELECT value FROM dr_config WHERE key = 'resend_api_key'").first<{ value: string }>())?.value;
    if (!key) {
      await audit(actor, "code.request", "failed", { purpose, reason: "mail key not configured" });
      return reply({ error: "MAIL_NOT_CONFIGURED" }, 503);
    }
    const id = randomHex(16);
    const code = sixDigitCode();
    await db.prepare("INSERT INTO dr_login_codes (id, purpose, session_hash, code_hash, created_at, expires_at, ip) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, purpose, session?.token_hash ?? null, await sha256Hex(`${id}:${code}`), now, now + CODE_TTL_MS, ip).run();
    const when = new Date(now).toISOString().replace("T", " ").slice(0, 16) + " UTC";
    const sent = await (deps.send ?? resendSender)(key, {
      from: env.DR_MAIL_FROM || "RegaDRIVE <security@regaplatform.com>",
      to: owner,
      subject: purpose === "login" ? "RegaDRIVE /dr — کۆدی چوونەژوورەوە" : "RegaDRIVE /dr — پشتڕاستکردنەوەی گۆڕانکاری",
      text: `کۆدەکەت: ${code}\n\nتەنها ٥ خولەک کار دەکات. ئەگەر خۆت داوات نەکردووە، ئەم ئیمەیڵە پشتگوێ بخە.\nIP: ${ip} · ${when}\n\nRegaDRIVE SUPER ADMIN`,
      html: `<div dir="rtl" style="font-family:Tahoma,sans-serif;font-size:16px;color:#17213c"><p>کۆدی ${purpose === "login" ? "چوونەژوورەوەی" : "پشتڕاستکردنەوەی"} RegaDRIVE /dr:</p><p style="font-size:32px;font-weight:800;letter-spacing:6px;direction:ltr;color:#4338ca">${code}</p><p>تەنها ٥ خولەک کار دەکات. ئەگەر خۆت داوات نەکردووە، پشتگوێی بخە.</p><p style="color:#58657c;font-size:13px;direction:ltr">IP ${ip} · ${when}</p></div>`,
    });
    if (!sent.ok) {
      await db.prepare("UPDATE dr_login_codes SET consumed_at = ? WHERE id = ?").bind(now, id).run();
      await audit(actor, "code.request", "failed", { purpose, reason: sent.error ?? "mail failed" });
      return reply({ error: "MAIL_FAILED" }, 502);
    }
    await audit(actor, "code.request", "allowed", { purpose });
    await db.prepare("DELETE FROM dr_rate_events WHERE at < ?").bind(now - 86_400_000).run();
    return reply({ sent: true, to: maskEmail(owner), expiresInSec: CODE_TTL_MS / 1000 }, 200, [setCookie(CHALLENGE_COOKIE, id, CODE_TTL_MS / 1000)]);
  }

  if (path === "/api/dr/auth/verify" && req.method === "POST") {
    if (await limited(`verify:${ip}`, RATE.verifyPerIp)) {
      await audit(actor, "code.verify", "denied", { reason: "rate limited" });
      return reply({ error: "RATE_LIMITED" }, 429);
    }
    let body: { code?: unknown };
    try { body = await req.json(); } catch { return reply({ error: "BAD_REQUEST" }, 400); }
    const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
    const id = readCookie(req, CHALLENGE_COOKIE);
    if (!/^\d{6}$/.test(code) || !id) return reply({ error: "BAD_REQUEST" }, 400);
    const row = await db.prepare("SELECT * FROM dr_login_codes WHERE id = ?").bind(id).first<CodeRow>();
    if (!row || row.consumed_at !== null || row.expires_at <= now) {
      await audit(actor, "code.verify", "denied", { reason: "expired or unknown code" });
      return reply({ error: "CODE_EXPIRED" }, 401, [clearCookie(CHALLENGE_COOKIE)]);
    }
    if (row.attempts >= MAX_CODE_ATTEMPTS) {
      await audit(actor, "code.verify", "denied", { reason: "too many attempts" });
      return reply({ error: "TOO_MANY_ATTEMPTS" }, 429, [clearCookie(CHALLENGE_COOKIE)]);
    }
    await db.prepare("UPDATE dr_login_codes SET attempts = attempts + 1 WHERE id = ?").bind(id).run();
    if (!equal(await sha256Hex(`${id}:${code}`), row.code_hash)) {
      const left = MAX_CODE_ATTEMPTS - row.attempts - 1;
      await audit(actor, "code.verify", "denied", { purpose: row.purpose, reason: "wrong code", attemptsLeft: left });
      return reply({ error: "WRONG_CODE", attemptsLeft: left }, 401);
    }
    await db.prepare("UPDATE dr_login_codes SET consumed_at = ? WHERE id = ?").bind(now, id).run();

    if (row.purpose === "step_up") {
      if (!session || session.token_hash !== row.session_hash) {
        await audit(actor, "stepup.verify", "denied", { reason: "session mismatch" });
        return reply({ error: "UNAUTHENTICATED" }, 401, [clearCookie(CHALLENGE_COOKIE)]);
      }
      await db.prepare("UPDATE dr_sessions SET step_up_until = ? WHERE token_hash = ?").bind(now + STEP_UP_MS, session.token_hash).run();
      await audit(actor, "stepup.verify", "allowed");
      return reply({ ok: true, stepUpUntil: now + STEP_UP_MS }, 200, [clearCookie(CHALLENGE_COOKIE)]);
    }
    const token = randomHex(32);
    await db.prepare("INSERT INTO dr_sessions (token_hash, email, created_at, expires_at, last_seen_at, step_up_until, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(await sha256Hex(token), owner, now, now + SESSION_ABSOLUTE_MS, now, now + STEP_UP_MS, ip, (req.headers.get("user-agent") ?? "").slice(0, 200)).run();
    await audit(`owner:${maskEmail(owner)}`, "login", "allowed");
    return reply({ ok: true }, 200, [clearCookie(CHALLENGE_COOKIE), setCookie(SESSION_COOKIE, token, SESSION_ABSOLUTE_MS / 1000)]);
  }

  if (path === "/api/dr/auth/logout" && req.method === "POST") {
    if (session) {
      await db.prepare("UPDATE dr_sessions SET revoked_at = ? WHERE token_hash = ?").bind(now, session.token_hash).run();
      await audit(actor, "logout", "allowed");
    }
    return reply({ ok: true }, 200, [clearCookie(SESSION_COOKIE)]);
  }

  // ── everything below: owner session required ───────────────────────────
  if (!session) {
    await audit("anonymous", `${req.method} ${path}`, "denied", { reason: "no session" });
    return reply({ error: "UNAUTHENTICATED" }, 401);
  }
  const steppedUp = session.step_up_until > now;
  const needStepUp = async (action: string) => {
    await audit(actor, action, "denied", { reason: "step-up required" });
    return reply({ error: "STEP_UP_REQUIRED" }, 401);
  };
  const snapshot = async (reason: string): Promise<string> => {
    const { results } = await db.prepare("SELECT key, state FROM dr_feature_states ORDER BY key").all<{ key: string; state: FeatureState }>();
    const id = `bk-${now.toString(36)}-${randomHex(3)}`;
    await db.prepare("INSERT INTO dr_backups (id, created_at, created_by, reason, snapshot) VALUES (?, ?, ?, ?, ?)").bind(id, now, actor, reason.slice(0, 200), JSON.stringify(results)).run();
    return id;
  };

  if (path === "/api/dr/overview" && req.method === "GET") {
    const ctx = deps.context?.();
    const flags = ctx?.flags;
    const overrides = await loadOverrides(db, now, true);
    const t0 = Date.now();
    const counts = await db.prepare(`SELECT
        (SELECT COUNT(*) FROM dr_sessions WHERE revoked_at IS NULL AND expires_at > ?1 AND last_seen_at > ?2) AS activeSessions,
        (SELECT COUNT(*) FROM dr_audit_log) AS auditEntries,
        (SELECT COUNT(*) FROM dr_audit_log WHERE action = 'login' AND at > ?3) AS logins24h,
        (SELECT COUNT(*) FROM dr_audit_log WHERE result = 'denied' AND at > ?3) AS denied24h,
        (SELECT COUNT(*) FROM dr_audit_log WHERE action = 'code.request' AND result = 'allowed' AND at > ?3) AS codesSent24h,
        (SELECT COUNT(*) FROM dr_audit_log WHERE action = 'code.request' AND result = 'failed' AND at > ?3) AS mailFailures24h,
        (SELECT COUNT(*) FROM dr_backups) AS backups`).bind(now, now - SESSION_IDLE_MS, now - 86_400_000).first<Record<string, number>>();
    const dbLatencyMs = Date.now() - t0;
    const sessions = (await db.prepare("SELECT token_hash, created_at, last_seen_at, ip, user_agent FROM dr_sessions WHERE revoked_at IS NULL AND expires_at > ? AND last_seen_at > ? ORDER BY last_seen_at DESC LIMIT 20")
      .bind(now, now - SESSION_IDLE_MS).all<SessionRow>()).results.map((s) => ({ current: s.token_hash === session.token_hash, createdAt: s.created_at, lastSeenAt: s.last_seen_at, ip: s.ip, userAgent: s.user_agent }));
    const backups = (await db.prepare("SELECT id, created_at, created_by, reason FROM dr_backups ORDER BY created_at DESC LIMIT 20").all()).results;
    const mailKey = !!env.REGADRIVE_RESEND_API_KEY || !!(await db.prepare("SELECT 1 AS x FROM dr_config WHERE key = 'resend_api_key'").first());
    return reply({
      now, owner: maskEmail(owner),
      system: { app: "regadrive", version: ctx?.version ?? "?", contentMode: ctx?.contentMode ?? "production", colo: (req as Request & { cf?: { colo?: string } }).cf?.colo ?? null },
      database: { ok: true, latencyMs: dbLatencyMs, name: "regadrive-db", adminTables: true, studentData: flags?.databaseProductionEnabled ? "on" : "off", ...counts },
      features: flags ? resolveFeatures(flags, overrides) : [],
      ai: ctx?.ai ?? [],
      content: ctx?.content ?? {},
      email: { owner: maskEmail(owner), from: env.DR_MAIL_FROM || "RegaDRIVE <security@regaplatform.com>", provider: "Resend", configured: mailKey },
      payments: flags ? { enabled: flags.paymentsEnabled, checkout: flags.checkoutEnabled, webhooks: flags.livePaymentWebhooksEnabled, purchaseRequired: flags.purchaseRequired, priceEur: flags.lifetimePriceEur } : null,
      security: { sessions, steppedUp, stepUpUntil: session.step_up_until, sessionExpiresAt: Math.min(session.expires_at, session.last_seen_at + SESSION_IDLE_MS) },
      backups,
    });
  }

  if (path === "/api/dr/audit" && req.method === "GET") {
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100") || 100));
    const { results } = await db.prepare("SELECT id, at, actor, action, result, detail, ip FROM dr_audit_log ORDER BY id DESC LIMIT ?").bind(limit).all();
    return reply({ entries: results });
  }

  if (path === "/api/dr/features" && req.method === "POST") {
    let body: { key?: unknown; state?: unknown };
    try { body = await req.json(); } catch { return reply({ error: "BAD_REQUEST" }, 400); }
    const def = typeof body.key === "string" ? featureByKey(body.key) : undefined;
    const state = body.state === "ON" || body.state === "OFF" || body.state === "LOCKED" ? body.state : null;
    if (!def || !state) return reply({ error: "BAD_REQUEST" }, 400);
    const action = `feature.${def.key}=${state}`;
    if (!def.controllable) {
      await audit(actor, action, "denied", { reason: "requires owner activation outside the panel" });
      return reply({ error: "FEATURE_LOCKED", reason: "owner activation required (docs/OWNER_ACTIVATION.md)" }, 403);
    }
    // Critical features, and leaving LOCKED, need a fresh code.
    const current = (await loadOverrides(db, now, true)).get(def.key);
    if ((def.critical || current === "LOCKED") && !steppedUp) return needStepUp(action);
    const backupId = def.critical ? await snapshot(`before ${action}`) : null;
    await db.prepare("INSERT INTO dr_feature_states (key, state, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
      .bind(def.key, state, now, actor).run();
    invalidateOverrides();
    await audit(actor, action, "allowed", { from: current ?? "default", backupId });
    return reply({ ok: true, key: def.key, state, backupId });
  }

  if (path === "/api/dr/sessions/revoke-others" && req.method === "POST") {
    if (!steppedUp) return needStepUp("sessions.revoke-others");
    await db.prepare("UPDATE dr_sessions SET revoked_at = ? WHERE revoked_at IS NULL AND token_hash != ?").bind(now, session.token_hash).run();
    await audit(actor, "sessions.revoke-others", "allowed");
    return reply({ ok: true });
  }

  if (path === "/api/dr/backups" && req.method === "POST") {
    const id = await snapshot("manual restore point");
    await audit(actor, "backup.create", "allowed", { id });
    return reply({ ok: true, id });
  }

  if (path === "/api/dr/backups/restore" && req.method === "POST") {
    let body: { id?: unknown };
    try { body = await req.json(); } catch { return reply({ error: "BAD_REQUEST" }, 400); }
    if (typeof body.id !== "string") return reply({ error: "BAD_REQUEST" }, 400);
    if (!steppedUp) return needStepUp("backup.restore");
    const row = await db.prepare("SELECT snapshot FROM dr_backups WHERE id = ?").bind(body.id).first<{ snapshot: string }>();
    if (!row) return reply({ error: "NOT_FOUND" }, 404);
    let items: { key: string; state: FeatureState }[];
    try { items = JSON.parse(row.snapshot); } catch { return reply({ error: "CORRUPT_BACKUP" }, 422); }
    const valid = items.filter((i) => featureByKey(i.key)?.controllable && ["ON", "OFF", "LOCKED"].includes(i.state));
    const safety = await snapshot(`before restore of ${body.id}`);
    await db.prepare("DELETE FROM dr_feature_states").run();
    for (const i of valid) {
      await db.prepare("INSERT INTO dr_feature_states (key, state, updated_at, updated_by) VALUES (?, ?, ?, ?)").bind(i.key, i.state, now, actor).run();
    }
    invalidateOverrides();
    await audit(actor, "backup.restore", "allowed", { id: body.id, restored: valid.length, safetyBackup: safety });
    return reply({ ok: true, restored: valid.length, safetyBackup: safety });
  }

  await audit(actor, `${req.method} ${path}`, "denied", { reason: "unknown route" });
  return reply({ error: "NOT_FOUND" }, 404);
}

export const DR_FEATURE_KEYS = FEATURES.map((f) => f.key);
