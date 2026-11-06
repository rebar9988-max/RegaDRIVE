import { describe, expect, it } from "vitest";
import worker, { handleApi, APP_ROUTE, type Env } from "../../worker/index";
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
    expect(known.status).toBe(503);
    expect(await known.json()).toEqual({ error: "NO_FREE_PROVIDER_AVAILABLE" });
    const status = await (await call("/api/ai/status")).json() as { providers: { status: string }[]; paidFallback: boolean };
    expect(status.paidFallback).toBe(false);
    expect(status.providers.some((p) => p.status === "ACTIVE")).toBe(false);
  });
  it("blocks cross-origin mutating requests", async () => {
    const r = await call("/api/ai/explain", { method: "POST", body: "{}", headers: { origin: "https://evil.example" } });
    expect(r.status).toBe(403);
  });
  it("services finder never invents providers", async () => {
    expect(await (await call("/api/services")).json()).toMatchObject({ status: "unavailable", results: [] });
  });
  it("serves app routes with 200 and unknown (e.g. legacy foreign) paths with 404 + noindex", async () => {
    const e = env({ ASSETS: { fetch: async () => new Response("<html>shell</html>", { status: 200, headers: { "content-security-policy": "default-src 'self'" } }) } });
    const get = (p: string) => worker.fetch(new Request(`https://regadrive.test${p}`), e);
    for (const p of ["/", "/learn", "/learn/l-priority", "/practice", "/exam", "/about", "/access"]) expect((await get(p)).status).toBe(200);
    for (const p of ["/businesses/old-page", "/de/marketplace", "/admin/import", "/learn/a/b"]) {
      const r = await get(p);
      expect(r.status).toBe(404);
      expect(r.headers.get("x-robots-tag")).toBe("noindex");
      expect(r.headers.get("content-security-policy")).toContain("default-src");
    }
    expect(APP_ROUTE.test("/learn/")).toBe(true);
  });
});
