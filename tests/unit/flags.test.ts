import { describe, expect, it } from "vitest";
import { readFlags } from "../../src/lib/shared/flags";

describe("feature flags fail closed", () => {
  it("everything money/data related is off by default", () => {
    const f = readFlags({});
    expect(f).toMatchObject({ paymentsEnabled: false, checkoutEnabled: false, livePaymentWebhooksEnabled: false, purchaseRequired: false, databaseProductionEnabled: false, aiFreeOnly: true, aiPaidFallbackEnabled: false, aiDailyCostLimitEur: 0, lifetimePriceEur: 20 });
  });
  it("cannot turn payments or the database on from config alone", () => {
    const f = readFlags({ PAYMENTS_ENABLED: "true", CHECKOUT_ENABLED: "true", LIVE_PAYMENT_WEBHOOKS_ENABLED: "true", PURCHASE_REQUIRED: "true", DATABASE_PRODUCTION_ENABLED: "true" });
    expect(f.paymentsEnabled || f.checkoutEnabled || f.livePaymentWebhooksEnabled || f.purchaseRequired || f.databaseProductionEnabled).toBe(false);
  });
  it("checkout requires payments; purchase lock requires payments AND database", () => {
    const f = readFlags({ OWNER_PAYMENTS_ACTIVATION: "I-APPROVE-LIVE-ACTIVATION", PAYMENTS_ENABLED: "true", CHECKOUT_ENABLED: "true", PURCHASE_REQUIRED: "true" });
    expect(f.checkoutEnabled).toBe(true);
    expect(f.purchaseRequired).toBe(false);
  });
  it("ignores attempts to enable paid AI or a non-zero AI budget", () => {
    const f = readFlags({ AI_FREE_ONLY: "false", AI_PAID_FALLBACK_ENABLED: "true", AI_DAILY_COST_LIMIT_EUR: "50" });
    expect(f).toMatchObject({ aiFreeOnly: true, aiPaidFallbackEnabled: false, aiDailyCostLimitEur: 0 });
  });
  it("only the exact string true enables a flag", () => {
    expect(readFlags({ AI_ENABLED: "TRUE" }).aiEnabled).toBe(false);
    expect(readFlags({ AI_ENABLED: "true" }).aiEnabled).toBe(true);
  });
});
