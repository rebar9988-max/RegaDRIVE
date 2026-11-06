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

export interface Env extends FlagEnv, AiEnv {
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
  const flags = readFlags(env);
  const p = url.pathname;

  if (p === "/api/health") {
    return json({ ok: true, app: "regadrive", version: VERSION, contentMode: env.CONTENT_MODE === "preview" ? "preview" : "production", database: flags.databaseProductionEnabled ? "on" : "off", payments: flags.paymentsEnabled ? "on" : "off" });
  }
  if (p === "/api/flags") {
    return json({
      paymentsEnabled: flags.paymentsEnabled, checkoutEnabled: flags.checkoutEnabled, livePaymentWebhooksEnabled: flags.livePaymentWebhooksEnabled,
      purchaseRequired: flags.purchaseRequired, databaseProductionEnabled: flags.databaseProductionEnabled,
      licenseEnforcementEnabled: flags.licenseEnforcementEnabled, aiEnabled: flags.aiEnabled, aiFreeOnly: flags.aiFreeOnly,
      aiPaidFallbackEnabled: flags.aiPaidFallbackEnabled, lifetimePriceEur: flags.lifetimePriceEur,
    });
  }

  // Mutating endpoints: same-origin only (CSRF defence; there are no cookies yet, but keep the rule from day one).
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (p !== "/api/payments/webhook" && origin !== null && origin !== url.origin) return json({ error: "FORBIDDEN_ORIGIN" }, 403);
  }

  if (p.startsWith("/api/auth/") || p.startsWith("/api/me")) {
    // No student data can be served or stored without the (disabled) production database.
    if (!flags.databaseProductionEnabled) return json({ error: "AUTH_UNAVAILABLE", reason: "DATABASE_PRODUCTION_ENABLED=false" }, 503);
    return json({ error: "NOT_IMPLEMENTED" }, 501);
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
    return json({ freeOnly: true, paidFallback: false, costLimitEur: 0, providers: getGateway(env).status() });
  }

  if (p === "/api/ai/explain") {
    if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    if (!flags.aiEnabled) return json({ error: "AI_DISABLED" }, 503);
    const client = req.headers.get("cf-connecting-ip") ?? "anon";
    if (!limiter.allow(client, now)) return json({ error: "RATE_LIMITED" }, 429);
    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: "BAD_REQUEST" }, 400); }
    const id = typeof body === "object" && body && "questionId" in body ? String((body as { questionId: unknown }).questionId).slice(0, 40) : "";
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
      "Explain this more simply in at most 5 short sentences.",
    ].join("\n");
    const r = await getGateway(env).complete({ system: SYSTEM_PROMPT, user, maxTokens: 350 });
    if (r.provider === null) return json({ error: r.error }, 503);
    return json({ provider: r.provider, text: r.text, generated: true });
  }

  return json({ error: "NOT_FOUND" }, 404);
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
    return env.ASSETS.fetch(req);
  },
};
