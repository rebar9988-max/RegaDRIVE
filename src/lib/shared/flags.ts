/**
 * Server-enforced feature flags. Every flag fails CLOSED: anything other than the exact
 * string "true" is false, and in production the safety-critical flags are forced off
 * unless an explicit owner activation is recorded (see docs/OWNER_ACTIVATION.md).
 */
export interface FlagEnv {
  APP_ENV?: string;
  PAYMENTS_ENABLED?: string;
  CHECKOUT_ENABLED?: string;
  LIVE_PAYMENT_WEBHOOKS_ENABLED?: string;
  PURCHASE_REQUIRED?: string;
  DATABASE_PRODUCTION_ENABLED?: string;
  LICENSE_ENFORCEMENT_ENABLED?: string;
  AI_ENABLED?: string;
  AI_FREE_ONLY?: string;
  AI_PAID_FALLBACK_ENABLED?: string;
  AI_DAILY_COST_LIMIT_EUR?: string;
  LIFETIME_PRICE_EUR?: string;
  /** Owner-set acknowledgement required before any money-moving flag may turn on. */
  OWNER_PAYMENTS_ACTIVATION?: string;
  /** Owner-set acknowledgement required before the production database may turn on. */
  OWNER_DATABASE_ACTIVATION?: string;
}

export interface Flags {
  paymentsEnabled: boolean;
  checkoutEnabled: boolean;
  livePaymentWebhooksEnabled: boolean;
  purchaseRequired: boolean;
  databaseProductionEnabled: boolean;
  licenseEnforcementEnabled: boolean;
  aiEnabled: boolean;
  aiFreeOnly: boolean;
  aiPaidFallbackEnabled: boolean;
  aiDailyCostLimitEur: number;
  lifetimePriceEur: number;
}

const on = (v: string | undefined): boolean => v === "true";
const ACTIVATION_PHRASE = "I-APPROVE-LIVE-ACTIVATION";

export function readFlags(env: FlagEnv): Flags {
  const paymentsApproved = env.OWNER_PAYMENTS_ACTIVATION === ACTIVATION_PHRASE;
  const dbApproved = env.OWNER_DATABASE_ACTIVATION === ACTIVATION_PHRASE;
  const paymentsEnabled = paymentsApproved && on(env.PAYMENTS_ENABLED);
  const databaseProductionEnabled = dbApproved && on(env.DATABASE_PRODUCTION_ENABLED);
  const price = Number(env.LIFETIME_PRICE_EUR ?? "20");
  return {
    paymentsEnabled,
    // Checkout and live webhooks can never be on while payments are off.
    checkoutEnabled: paymentsEnabled && on(env.CHECKOUT_ENABLED),
    livePaymentWebhooksEnabled: paymentsEnabled && on(env.LIVE_PAYMENT_WEBHOOKS_ENABLED),
    // A purchase can only be required when payments really work AND a database stores entitlements.
    purchaseRequired: paymentsEnabled && databaseProductionEnabled && on(env.PURCHASE_REQUIRED),
    databaseProductionEnabled,
    licenseEnforcementEnabled: on(env.LICENSE_ENFORCEMENT_ENABLED),
    aiEnabled: on(env.AI_ENABLED),
    // Free-only cannot be switched off from configuration; paid fallback is never honoured.
    aiFreeOnly: true,
    aiPaidFallbackEnabled: false,
    aiDailyCostLimitEur: 0,
    lifetimePriceEur: Number.isFinite(price) && price > 0 ? price : 20,
  };
}
