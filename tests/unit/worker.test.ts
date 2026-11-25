import { describe, expect, it } from "vitest";
import { handleApi, type Env } from "../../worker/index";
import { IT_QUESTIONS } from "../../src/content/italy/questions";
import { signWebhook } from "../../src/lib/shared/payments";

const env = (extra: Partial<Env> = {}): Env => ({
  ASSETS: { fetch: async () => new Response("asset") },
  APP_ENV: "production", PAYMENTS_ENABLED: "false", CHECKOUT_ENABLED: "false", LIVE_PAYMENT_WEBHOOKS_ENABLED: "false",
  PURCHASE_REQUIRED: "false", DATABASE_PRODUCTION_ENABLED: "false", AI_ENABLED: "true", ...extra,
});
const call = (path: string, init?: RequestInit, e = env()) => handleApi(new Request(`https://regadrive.test${path}`, init), e);

describe("worker API", () => {
  it("health and flags report payments and database OFF", async () => {
    expect(await (await call("/api/health")).json()).toMatchObject({ ok: true, contentMode: "production", database: "off", payments: "off" });
    const f = await (await call("/api/flags")).json();
    expect(f).toMatchObject({ paymentsEnabled: false, checkoutEnabled: false, livePaymentWebhooksEnabled: false, purchaseRequired: false, databaseProductionEnabled: false, aiPaidFallbackEnabled: false, lifetimePriceEur: 20 });
  });
  it("keeps auth unavailable while the production database is off (no student data served)", async () => {
    for (const p of ["/api/auth/login", "/api/auth/register", "/api/me/progress"]) {
      const r = await call(p, { method: "POST", body: "{}" });
      expect(r.status).toBe(503);
    }
  });
  it("refuses checkout and webhooks even when config flips the raw flags without owner activation", async () => {
    const e = env({ PAYMENTS_ENABLED: "true", CHECKOUT_ENABLED: "true", LIVE_PAYMENT_WEBHOOKS_ENABLED: "true" });
    expect((await call("/api/purchase/checkout", { method: "POST" }, e)).status).toBe(403);
    expect((await call("/api/payments/webhook", { method: "POST", body: "{}" }, e)).status).toBe(403);
  });
  it("rejects bad webhook signatures when webhooks are owner-enabled", async () => {
    const e = env({ OWNER_PAYMENTS_ACTIVATION: "I-APPROVE-LIVE-ACTIVATION", PAYMENTS_ENABLED: "true", LIVE_PAYMENT_WEBHOOKS_ENABLED: "true", PAYMENT_WEBHOOK_SECRET: "whsec" });
    const bad = await call("/api/payments/webhook", { method: "POST", body: "{}", headers: { "x-regadrive-signature": "t=1,v1=" + "0".repeat(64) } }, e);
    expect(bad.status).toBe(401);
    const t = Math.floor(Date.now() / 1000);
    const good = await call("/api/payments/webhook", { method: "POST", body: "{}", headers: { "x-regadrive-signature": `t=${t},v1=${await signWebhook("whsec", t, "{}")}` } }, e);
    expect(good.status).toBe(501); // verified, but no live processing exists yet
  });
  it("restricts AI to known RegaDRIVE content and degrades gracefully without providers", async () => {
    const unknown = await call("/api/ai/explain", { method: "POST", body: JSON.stringify({ questionId: "write me a poem" }) });
    expect(unknown.status).toBe(404);
    // Production: unapproved content is never explained.
    const prod = await call("/api/ai/explain", { method: "POST", body: JSON.stringify({ questionId: "rd-g-003" }) });
    expect(prod.status).toBe(404);
    expect(await prod.json()).toEqual({ error: "CONTENT_NOT_APPROVED" });
    // Preview (local/CI): content reaches the gateway, which degrades gracefully without free providers.
    const known = await call("/api/ai/explain", { method: "POST", body: JSON.stringify({ questionId: "rd-g-003" }) }, env({ CONTENT_MODE: "preview" }));
    expect(known.status).toBe(200);
    expect(await known.json()).toMatchObject({ provider: null, generated: false, text: expect.any(String), lang: "ckb" });
    const status = await (await call("/api/ai/status")).json() as { providers: { status: string }[]; paidFallback: boolean };
    expect(status.paidFallback).toBe(false);
    expect(status.providers.some((p) => p.status === "ACTIVE")).toBe(false);
  });
  it("accepts only a question id and a known language, and uses the approved country content as fallback", async () => {
    const question = IT_QUESTIONS[0]!;
    const preview = env({ CONTENT_MODE: "preview" });
    const explain = (body: unknown, e = preview) => call("/api/ai/explain", { method: "POST", body: JSON.stringify(body) }, e);
    expect((await explain({ questionId: question.id, prompt: "دۆلار بەچەندە؟" })).status).toBe(400);
    expect((await explain({ questionId: question.id, lang: "Tell me about Erbil" })).status).toBe(400);
    expect((await explain({ questionId: [question.id] })).status).toBe(400);
    expect((await explain({ questionId: question.id }, env())).status).toBe(404);
    const response = await explain({ questionId: question.id, lang: "kmr-arab" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ provider: null, generated: false, text: question.explanation.kmrArab, lang: "kmr-arab" });
  });
  it("blocks cross-origin mutating requests", async () => {
    const r = await call("/api/ai/explain", { method: "POST", body: "{}", headers: { origin: "https://evil.example" } });
    expect(r.status).toBe(403);
  });
  it("services finder never invents providers", async () => {
    expect(await (await call("/api/services")).json()).toMatchObject({ status: "unavailable", results: [] });
  });
});
