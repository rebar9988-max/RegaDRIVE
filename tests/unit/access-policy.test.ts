import { describe, expect, it } from "vitest";
import { ACCESS_POLICY, IT_FREE_FOREVER_LABEL, accessModelFor, checkoutAllowedFor, isFreeForever, learningUnlocked, parseCountry, purchaseRequiredFor } from "../../src/lib/shared/accessPolicy";
import { readFlags } from "../../src/lib/shared/flags";
import { hasLifetimeAccess } from "../../src/lib/shared/payments";
import { handleApi, type Env } from "../../worker/index";
import { itContentFor } from "../../src/content/italy/access";
import { IT_QUESTIONS } from "../../src/content/italy/questions";

const env = (extra: Partial<Env> = {}): Env => ({
  ASSETS: { fetch: async () => new Response("asset") },
  APP_ENV: "production", PAYMENTS_ENABLED: "false", CHECKOUT_ENABLED: "false", LIVE_PAYMENT_WEBHOOKS_ENABLED: "false",
  PURCHASE_REQUIRED: "false", DATABASE_PRODUCTION_ENABLED: "false", AI_ENABLED: "true", ...extra,
});
const ACTIVE = { OWNER_PAYMENTS_ACTIVATION: "I-APPROVE-LIVE-ACTIVATION", OWNER_DATABASE_ACTIVATION: "I-APPROVE-LIVE-ACTIVATION", PAYMENTS_ENABLED: "true", CHECKOUT_ENABLED: "true", DATABASE_PRODUCTION_ENABLED: "true", PURCHASE_REQUIRED: "true" } as const;
const call = (path: string, init?: RequestInit, e = env()) => handleApi(new Request(`https://regadrive.test${path}`, init), e);

describe("Italy: FREE_FOREVER", () => {
  it("applies to IT only", () => {
    expect(ACCESS_POLICY).toEqual({ IT: "FREE_FOREVER", DE: "STANDARD" });
    expect(isFreeForever("IT")).toBe(true);
    for (const c of ["DE", null, undefined] as const) expect(isFreeForever(c)).toBe(false);
  });
  it("never requires a purchase, even when the purchase requirement is fully on", () => {
    expect(purchaseRequiredFor("IT", true)).toBe(false);
    expect(learningUnlocked({ country: "IT", purchaseRequired: true, hasLifetimeAccess: false })).toBe(true);
    // No trial that can expire: the result does not depend on time or purchase state at all.
    expect(learningUnlocked({ country: "IT", purchaseRequired: true, hasLifetimeAccess: hasLifetimeAccess("NOT_PURCHASED") })).toBe(true);
  });
  it("never offers checkout for Italy, whatever the payment flags say", async () => {
    expect(checkoutAllowedFor("IT")).toBe(false);
    for (const e of [env(), env(ACTIVE)]) {
      for (const init of [{ method: "POST", body: JSON.stringify({ country: "IT" }) }, { method: "POST", body: JSON.stringify({ country: " it " }) }]) {
        const r = await call("/api/purchase/checkout", init, e);
        expect(r.status).toBe(403);
        expect(await r.json()).toEqual({ error: "FREE_FOREVER_COUNTRY" });
      }
      const q = await call("/api/purchase/checkout?country=IT", { method: "POST" }, e);
      expect(q.status).toBe(403);
      expect(await q.json()).toEqual({ error: "FREE_FOREVER_COUNTRY" });
    }
  });
  it("reports the policy on /api/flags without changing the existing fields", async () => {
    const f = await (await call("/api/flags", undefined, env(ACTIVE))).json() as Record<string, unknown>;
    expect(f.accessPolicy).toEqual({ IT: "FREE_FOREVER", DE: "STANDARD" });
    expect(f.purchaseRequiredByCountry).toEqual({ IT: false, DE: true });
    expect(f.purchaseRequired).toBe(true);
  });
  it("shows the fixed Italian label", () => {
    expect(IT_FREE_FOREVER_LABEL).toBe("100% Gratis — Per sempre");
  });
  it("does not unlock unpublished or unreviewed Italian content", () => {
    const production = itContentFor("production");
    const approved = IT_QUESTIONS.filter((q) => q.reviewStatus === "approved").length;
    expect(production.questions.length).toBeLessThanOrEqual(approved);
    expect(production.questions.every((q) => q.reviewStatus === "approved")).toBe(true);
  });
});

describe("Germany: regression protection", () => {
  it("keeps the STANDARD model and the existing purchase logic exactly", () => {
    expect(accessModelFor("DE")).toBe("STANDARD");
    expect(accessModelFor(null)).toBe("STANDARD");
    expect(purchaseRequiredFor("DE", true)).toBe(true);
    expect(purchaseRequiredFor("DE", false)).toBe(false);
    expect(learningUnlocked({ country: "DE", purchaseRequired: true, hasLifetimeAccess: false })).toBe(false);
    expect(learningUnlocked({ country: "DE", purchaseRequired: true, hasLifetimeAccess: true })).toBe(true);
    expect(learningUnlocked({ country: "DE", purchaseRequired: false, hasLifetimeAccess: false })).toBe(true);
  });
  it("leaves price, flags and checkout behaviour unchanged", async () => {
    const f = readFlags(env(ACTIVE));
    expect(f).toMatchObject({ lifetimePriceEur: 20, subscriptionsEnabled: false, checkoutEnabled: true, purchaseRequired: true });
    expect(checkoutAllowedFor("DE")).toBe(true);
    const de = await call("/api/purchase/checkout", { method: "POST", body: JSON.stringify({ country: "DE" }) }, env(ACTIVE));
    expect(de.status).toBe(501); // unchanged: checkout exists behind the flags, not implemented yet
    const none = await call("/api/purchase/checkout", { method: "POST" }, env(ACTIVE));
    expect(none.status).toBe(501);
    const off = await call("/api/purchase/checkout", { method: "POST", body: JSON.stringify({ country: "DE" }) });
    expect(off.status).toBe(403);
    expect(await off.json()).toEqual({ error: "PAYMENTS_DISABLED" });
  });
  it("parses countries strictly", () => {
    expect(parseCountry("IT")).toBe("IT");
    expect(parseCountry("de")).toBe("DE");
    for (const v of ["FR", "", null, 7, {}]) expect(parseCountry(v)).toBeNull();
  });
});
