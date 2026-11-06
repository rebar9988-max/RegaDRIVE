import { describe, expect, it } from "vitest";
import { applyPaymentEvent, hasLifetimeAccess, InvalidTransitionError, MemoryIdempotencyStore, nextPurchaseState, signWebhook, verifyWebhookSignature } from "../../src/lib/shared/payments";

const NOW = 1_800_000_000;
describe("purchase state machine", () => {
  it("follows the lifetime purchase lifecycle", () => {
    expect(nextPurchaseState("NOT_PURCHASED", "checkout.created")).toBe("PAYMENT_PENDING");
    expect(nextPurchaseState("PAYMENT_PENDING", "payment.succeeded")).toBe("ACTIVE_LIFETIME");
    expect(nextPurchaseState("PAYMENT_PENDING", "payment.failed")).toBe("PAYMENT_FAILED");
    expect(nextPurchaseState("ACTIVE_LIFETIME", "payment.refunded")).toBe("REFUNDED");
    expect(nextPurchaseState("ACTIVE_LIFETIME", "entitlement.revoked")).toBe("REVOKED");
  });
  it("rejects invalid transitions (no access without payment, no reactivation after refund)", () => {
    expect(() => nextPurchaseState("NOT_PURCHASED", "payment.succeeded")).toThrow(InvalidTransitionError);
    expect(() => nextPurchaseState("REFUNDED", "payment.succeeded")).toThrow(InvalidTransitionError);
    expect(hasLifetimeAccess("REFUNDED")).toBe(false);
    expect(hasLifetimeAccess("ACTIVE_LIFETIME")).toBe(true);
  });
  it("applies duplicate webhook events only once", async () => {
    const store = new MemoryIdempotencyStore();
    const ev = { id: "evt_1", type: "payment.succeeded" as const, studentId: "s1" };
    const first = await applyPaymentEvent(store, "PAYMENT_PENDING", ev);
    expect(first).toEqual({ state: "ACTIVE_LIFETIME", duplicate: false });
    const second = await applyPaymentEvent(store, first.state, ev);
    expect(second).toEqual({ state: "ACTIVE_LIFETIME", duplicate: true });
  });
});

describe("webhook signatures", () => {
  it("accepts a valid signature and rejects tampering, staleness, missing secret and bad format", async () => {
    const body = '{"id":"evt_1"}';
    const sig = await signWebhook("whsec_test", NOW, body);
    const h = `t=${NOW},v1=${sig}`;
    expect(await verifyWebhookSignature("whsec_test", h, body, NOW)).toBe(true);
    expect(await verifyWebhookSignature("whsec_test", h, body + " ", NOW)).toBe(false);
    expect(await verifyWebhookSignature("other", h, body, NOW)).toBe(false);
    expect(await verifyWebhookSignature("whsec_test", h, body, NOW + 301)).toBe(false);
    expect(await verifyWebhookSignature(undefined, h, body, NOW)).toBe(false);
    expect(await verifyWebhookSignature("whsec_test", null, body, NOW)).toBe(false);
    expect(await verifyWebhookSignature("whsec_test", "garbage", body, NOW)).toBe(false);
  });
});
