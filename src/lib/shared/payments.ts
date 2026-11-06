/** Provider-independent lifetime-purchase foundation. Never moves money by itself. */
export type PurchaseState =
  | "NOT_PURCHASED"
  | "PAYMENT_PENDING"
  | "ACTIVE_LIFETIME"
  | "PAYMENT_FAILED"
  | "REFUNDED"
  | "REVOKED";

export type PaymentEventType =
  | "checkout.created"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded"
  | "entitlement.revoked";

const TRANSITIONS: Record<PurchaseState, Partial<Record<PaymentEventType, PurchaseState>>> = {
  NOT_PURCHASED: { "checkout.created": "PAYMENT_PENDING" },
  PAYMENT_PENDING: { "payment.succeeded": "ACTIVE_LIFETIME", "payment.failed": "PAYMENT_FAILED" },
  PAYMENT_FAILED: { "checkout.created": "PAYMENT_PENDING" },
  ACTIVE_LIFETIME: { "payment.refunded": "REFUNDED", "entitlement.revoked": "REVOKED" },
  REFUNDED: {},
  REVOKED: {},
};

export class InvalidTransitionError extends Error {}

export function nextPurchaseState(current: PurchaseState, event: PaymentEventType): PurchaseState {
  const next = TRANSITIONS[current][event];
  if (!next) throw new InvalidTransitionError(`${event} is not allowed from ${current}`);
  return next;
}

export function hasLifetimeAccess(state: PurchaseState): boolean {
  return state === "ACTIVE_LIFETIME";
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signWebhook(secret: string, timestamp: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`)));
}

/**
 * Verifies header format `t=<unix seconds>,v1=<hex hmac>` over `${t}.${body}`.
 * Rejects missing secrets, malformed headers, stale/future timestamps and bad signatures.
 */
export async function verifyWebhookSignature(
  secret: string | undefined,
  header: string | null,
  body: string,
  nowSeconds: number,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isInteger(t) || !v1 || !/^[0-9a-f]{64}$/.test(v1)) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  return timingSafeEqualHex(await signWebhook(secret, t, body), v1);
}

export interface IdempotencyStore {
  /** Returns false when the key was already recorded. */
  claim(key: string): Promise<boolean>;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private keys = new Set<string>();
  async claim(key: string): Promise<boolean> {
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    return true;
  }
}

export interface PaymentEvent {
  id: string;
  type: PaymentEventType;
  studentId: string;
}

/** Applies a verified event once. Duplicate deliveries are acknowledged without a second transition. */
export async function applyPaymentEvent(
  store: IdempotencyStore,
  current: PurchaseState,
  event: PaymentEvent,
): Promise<{ state: PurchaseState; duplicate: boolean }> {
  if (!(await store.claim(event.id))) return { state: current, duplicate: true };
  return { state: nextPurchaseState(current, event.type), duplicate: false };
}
