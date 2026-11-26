/**
 * RegaDRIVE Worker — static assets + a small, fail-closed API.
 * Production database, payments, checkout and live webhooks are OFF and enforced here, server-side.
 */
import { readFlags, type FlagEnv } from "../src/lib/shared/flags";
import { verifyWebhookSignature } from "../src/lib/shared/payments";
import { ACCESS_POLICY, checkoutAllowedFor, parseCountry, purchaseRequiredFor } from "../src/lib/shared/accessPolicy";
import type { Country } from "../src/lib/shared/license";
import { AiGateway, type AiEnv } from "./ai/gateway";
import { explanationFor, parseExplanationRequest } from "./ai/explanation";
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
import { approvedItalyContent } from "./italy/published";

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
      // Additive: per-country access model. IT never requires a purchase; DE keeps purchaseRequired above.
      accessPolicy: ACCESS_POLICY,
      purchaseRequiredByCountry: { IT: purchaseRequiredFor("IT", flags.purchaseRequired), DE: purchaseRequiredFor("DE", flags.purchaseRequired) },
    });
  }

  // Mutating endpoints: same-origin only (CSRF defence for the /dr and student session cookies).
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (p !== "/api/payments/webhook" && origin !== null && origin !== url.origin) return json({ error: "FORBIDDEN_ORIGIN" }, 403);
  }

  if (p === "/api/content/approved" && req.method === "GET") {
    // Public, read-only: which signs / sign-quiz questions the publication gate lets through right now (ids + fingerprints only).
    return json(await approvedContent(env.DB, env.CONTENT_DB));
  }

  if (p === "/api/content/italy" && req.method === "GET") {
    // Public, read-only, no account needed: the Italian items the publication gate lets through, with
    // their content, so an imported and reviewed catalogue reaches learners without a code change.
    return json(await approvedItalyContent(env.DB, env.CONTENT_DB));
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
    // Italy is FREE_FOREVER: no purchase can start for it, regardless of the payment flags. Germany is unchanged.
    if (!checkoutAllowedFor(await requestedCountry(req, url))) return json({ error: "FREE_FOREVER_COUNTRY" }, 403);
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
    const request = parseExplanationRequest(body);
    if (!request) return json({ error: "BAD_REQUEST" }, 400);
    const content = await explanationFor(request, env.CONTENT_MODE === "preview" ? "preview" : "production", env.DB);
    if ("error" in content) return json({ error: content.error }, 404);
    const result = await getGateway(aiEnv).complete(content.chat);
    if (result.provider === null) return json({ provider: null, generated: false, ...content.fallback });
    return json({ provider: result.provider, text: result.text, lang: content.fallback.lang, generated: true });
  }

  return json({ error: "NOT_FOUND" }, 404);
}

/** Country a request is about: ?country= or a JSON body { country }. Unknown or missing means no country. */
async function requestedCountry(req: Request, url: URL): Promise<Country | null> {
  const fromQuery = parseCountry(url.searchParams.get("country"));
  if (fromQuery) return fromQuery;
  if (req.method !== "POST") return null;
  try {
    const body: unknown = await req.clone().json();
    return typeof body === "object" && body && "country" in body ? parseCountry((body as { country: unknown }).country) : null;
  } catch { return null; }
}

// Stable per (env, provider order) so the gateway's free-tier counters are not reset on every request.
let orderCache: { base: Env; order: string; env: Env } | null = null;
function envForOrder(env: Env, order: string): Env {
  if (order === (env.AI_PROVIDER_ORDER ?? "gemini,groq,openrouter,workers-ai")) return env;
  if (!orderCache || orderCache.base !== env || orderCache.order !== order) orderCache = { base: env, order, env: { ...env, AI_PROVIDER_ORDER: order } };
  return orderCache.env;
}

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
