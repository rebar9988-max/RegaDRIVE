/**
 * RegaDRIVE Worker — static assets + a small, fail-closed API.
 * Production database, payments, checkout and live webhooks are OFF and enforced here, server-side.
 */
import { readFlags, type FlagEnv } from "../src/lib/shared/flags";
import { verifyWebhookSignature } from "../src/lib/shared/payments";
import { AiGateway, SYSTEM_PROMPT, type AiEnv } from "./ai/gateway";
import { questionById } from "../src/content/questions";
import { isQuestionVisible } from "../src/content/access";
import { RateLimiter } from "./lib/rateLimit";
import { handleAdmin } from "./lib/admin";
import type { AdminEnv } from "./lib/adminAuth";
import { handleDr, type DrEnv } from "./dr/handler";
import { handleStudents, type StudentEnv } from "./students/handler";
import { loadOverrides } from "./dr/db";
import { applyOverrides } from "./dr/features";
import { QUESTIONS } from "../src/content/questions";
import { handlePage } from "./pages";
import { contentFor } from "../src/content/access";
import { serveMedia } from "./content/media";
import { approvedContent } from "./dr/reviews";

export interface Env extends FlagEnv, AiEnv, AdminEnv, DrEnv, StudentEnv {
  /** "preview" only for local/CI; production shows and explains approved content only. */
  CONTENT_MODE?: string;
  ASSETS: { fetch(req: Request): Promise<Response> };
  PAYMENT_WEBHOOK_SECRET?: string;
}

const VERSION = "0.1.0";
const SECURITY_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: SECURITY_HEADERS });

let gateway: AiGateway | null = null;
let gatewayEnv: Env | null = null;
const limiter = new RateLimiter(20, 60_000); // per client per minute, isolate-scoped (best effort)

export async function handleApi(req: Request, env: Env, now = Date.now()): Promise<Response> {
  const url = new URL(req.url);
  const baseFlags = readFlags(env);
  const p = url.pathname;
  // Owner overrides from /dr can only restrict what the deploy configuration allows (see worker/dr/features.ts).
  const effective = applyOverrides(baseFlags, env.AI_PROVIDER_ORDER, await loadOverrides(env.DB, now));
  const flags = effective.flags;
  const aiEnv = envForOrder(env, effective.providerOrder);

  if (p === "/api/health") {
    return json({ ok: true, app: "regadrive", version: VERSION, contentMode: env.CONTENT_MODE === "preview" ? "preview" : "production", database: flags.databaseProductionEnabled ? "on" : "off", payments: flags.paymentsEnabled ? "on" : "off" });
  }
  if (p === "/api/flags") {
    return json({
      paymentsEnabled: flags.paymentsEnabled, checkoutEnabled: flags.checkoutEnabled, livePaymentWebhooksEnabled: flags.livePaymentWebhooksEnabled,
      purchaseRequired: flags.purchaseRequired, databaseProductionEnabled: flags.databaseProductionEnabled,
      licenseEnforcementEnabled: flags.licenseEnforcementEnabled, aiEnabled: flags.aiEnabled, aiFreeOnly: flags.aiFreeOnly,
      aiPaidFallbackEnabled: flags.aiPaidFallbackEnabled, lifetimePriceEur: flags.lifetimePriceEur,
      officialQuestionBankEnabled: flags.officialQuestionBankEnabled, contentAdminEnabled: flags.contentAdminEnabled,
      contentImportExecutionEnabled: flags.contentImportExecutionEnabled, publicOfficialMockExamsEnabled: flags.publicOfficialMockExamsEnabled,
      contentAutoSyncEnabled: flags.contentAutoSyncEnabled, subscriptionsEnabled: flags.subscriptionsEnabled,
      studentAuthEnabled: flags.studentAuthEnabled && !!env.STUDENT_DB,
    });
  }

  // Mutating endpoints: same-origin only (CSRF defence for the /dr and student session cookies).
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (p !== "/api/payments/webhook" && origin !== null && origin !== url.origin) return json({ error: "FORBIDDEN_ORIGIN" }, 403);
  }

  if (p === "/api/content/approved" && req.method === "GET") {
    // Public, read-only: which signs / sign-quiz questions the publication gate lets through right now (ids + fingerprints only).
    return json(await approvedContent(env.DB));
  }

  if (p.startsWith("/api/dr/")) {
    // Owner control center: e-mail code sign-in, server-enforced controls, audit log.
    return handleDr(req, env, {
      now,
      context: () => ({
        flags: baseFlags,
        version: VERSION,
        contentMode: env.CONTENT_MODE === "preview" ? "preview" : "production",
        ai: getGateway(aiEnv).status(),
        content: contentSummary(),
      }),
    });
  }

  if (p.startsWith("/api/admin/")) {
    // Owner-only; never cached; preview/validation only while the database is off.
    return handleAdmin(req, env, flags, json);
  }

  if (p.startsWith("/api/auth/") || p === "/api/me" || p.startsWith("/api/me/")) {
    // Student accounts: separate student D1 (STUDENT_DB) only; off unless STUDENT_AUTH_ENABLED and the /dr switch allow it.
    return handleStudents(req, env, { now, enabled: flags.studentAuthEnabled });
  }

  if (p === "/api/purchase/checkout") {
    if (!flags.checkoutEnabled) return json({ error: "PAYMENTS_DISABLED" }, 403);
    return json({ error: "NOT_IMPLEMENTED" }, 501);
  }

  if (p === "/api/payments/webhook") {
    if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    if (!flags.livePaymentWebhooksEnabled) return json({ error: "WEBHOOKS_DISABLED" }, 403);
    const body = await req.text();
    const ok = await verifyWebhookSignature(env.PAYMENT_WEBHOOK_SECRET, req.headers.get("x-regadrive-signature"), body, Math.floor(now / 1000));
    if (!ok) return json({ error: "INVALID_SIGNATURE" }, 401);
    return json({ error: "NOT_IMPLEMENTED" }, 501);
  }

  if (p === "/api/services") {
    return json({ status: "unavailable", reason: "no verified provider data source configured", results: [] });
  }

  if (p === "/api/ai/status") {
    return json({ freeOnly: true, paidFallback: false, costLimitEur: 0, providers: getGateway(aiEnv).status() });
  }

  if (p === "/api/ai/explain") {
    if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    if (!flags.aiEnabled) return json({ error: "AI_DISABLED" }, 503);
    const client = req.headers.get("cf-connecting-ip") ?? "anon";
    if (!limiter.allow(client, now)) return json({ error: "RATE_LIMITED" }, 429);
    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: "BAD_REQUEST" }, 400); }
    const id = typeof body === "object" && body && "questionId" in body ? String((body as { questionId: unknown }).questionId).slice(0, 40) : "";
    const reqLang = typeof body === "object" && body && "lang" in body ? (body as { lang: unknown }).lang : "ckb";
    const lang = reqLang === "kmr" || reqLang === "ar" || reqLang === "de" ? reqLang : "ckb";
    const q = questionById(id);
    // Domain restriction: only reviewed RegaDRIVE content can be explained; free-text prompts are not accepted.
    if (!q) return json({ error: "UNKNOWN_CONTENT" }, 404);
    // Only content that passed the publication gate may be explained in production.
    if (!isQuestionVisible(q.id, env.CONTENT_MODE === "preview" ? "preview" : "production")) return json({ error: "CONTENT_NOT_APPROVED" }, 404);
    const correct = q.options.filter((o) => q.correct.includes(o.id));
    const user = [
      `Question (DE): ${q.prompt.de}`, `Question (CKB): ${q.prompt.ckb}`,
      `Correct answer(s) (DE): ${correct.map((o) => o.text.de).join(" | ")}`,
      `Reviewed explanation (DE): ${q.explanation.de}`, `Reviewed explanation (CKB): ${q.explanation.ckb}`,
      ...((lang === "kmr" || lang === "ar") && q.explanation[lang] ? [`Reviewed explanation (${lang.toUpperCase()}): ${q.explanation[lang]}`] : []),
      `Answer language: ${AI_LANG_NAMES[lang]}.`,
      "Explain this more simply in at most 5 short sentences.",
    ].join("\n");
    const r = await getGateway(aiEnv).complete({ system: SYSTEM_PROMPT, user, maxTokens: 350 });
    if (r.provider === null) return json({ error: r.error }, 503);
    return json({ provider: r.provider, text: r.text, generated: true });
  }

  return json({ error: "NOT_FOUND" }, 404);
}

// Stable per (env, provider order) so the gateway's free-tier counters are not reset on every request.
let orderCache: { base: Env; order: string; env: Env } | null = null;
function envForOrder(env: Env, order: string): Env {
  if (order === (env.AI_PROVIDER_ORDER ?? "gemini,groq,openrouter,workers-ai")) return env;
  if (!orderCache || orderCache.base !== env || orderCache.order !== order) orderCache = { base: env, order, env: { ...env, AI_PROVIDER_ORDER: order } };
  return orderCache.env;
}

const AI_LANG_NAMES = { ckb: "Kurdish Sorani (Arabic script)", kmr: "Kurdish Kurmanji (Latin script)", ar: "Arabic", de: "German" } as const;

function contentSummary() {
  const prod = contentFor("production");
  const all = contentFor("preview");
  const review = { draft: 0, pending: 0, approved: 0 } as Record<string, number>;
  for (const q of QUESTIONS) review[q.reviewStatus] = (review[q.reviewStatus] ?? 0) + 1;
  return {
    total: { questions: all.questions.length, lessons: all.lessons.length, signs: all.signs.length, vocabulary: all.vocabulary.length },
    published: { questions: prod.questions.length, lessons: prod.lessons.length, signs: prod.signs.length, vocabulary: prod.vocabulary.length },
    questionReview: review,
    languages: ["ckb", "kmr", "ar", "de"],
  };
}

function getGateway(env: Env): AiGateway {
  if (!gateway || gatewayEnv !== env) { gateway = new AiGateway(env); gatewayEnv = env; }
  return gateway;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await handleApi(req, env); }
      catch { return json({ error: "INTERNAL" }, 500); }
    }
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/media/")) {
      // Question media: only once the owner activated the content database, and only files of published questions.
      if (readFlags(env).databaseProductionEnabled && env.CONTENT_DB && env.MEDIA) {
        try { return await serveMedia(req, env.CONTENT_DB, env.MEDIA); }
        catch { return new Response("Unavailable", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }); }
      }
    }
    if (req.method === "GET" || req.method === "HEAD") return handlePage(req, env.ASSETS);
    return env.ASSETS.fetch(req);
  },
};
