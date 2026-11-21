/**
 * Per-country access policy. Italy (IT) is FREE_FOREVER: every published Italian learning feature is open to
 * every registered Italian student, with no purchase, checkout, licence purchase, subscription or trial that can
 * expire. Germany (DE) keeps its existing model unchanged (STANDARD: governed by the PURCHASE_REQUIRED flag and
 * the lifetime-purchase state in payments.ts).
 *
 * This module only decides *payment-based* access. It never unlocks content that is unpublished or unreviewed:
 * the publication gates (src/content/pipeline.ts, src/content/italy/registry.ts) and authentication, rate limits
 * and abuse protection stay exactly as they are.
 * Pure and runtime-agnostic: shared by the Worker (server-side enforcement) and the app (UI).
 */
import type { Country } from "./license";

export type AccessModel = "FREE_FOREVER" | "STANDARD";

export const ACCESS_POLICY: Readonly<Record<Country, AccessModel>> = Object.freeze({ IT: "FREE_FOREVER", DE: "STANDARD" });

/** Fail closed towards "no free pass": anything that is not exactly the string "IT" gets the STANDARD model. */
export function parseCountry(value: unknown): Country | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  return v === "IT" || v === "DE" ? v : null;
}

export const accessModelFor = (country: Country | null | undefined): AccessModel => (country ? ACCESS_POLICY[country] : "STANDARD");
export const isFreeForever = (country: Country | null | undefined): boolean => accessModelFor(country) === "FREE_FOREVER";

/** Can a purchase be started for this country? Never for a FREE_FOREVER country, whatever the payment flags say. */
export const checkoutAllowedFor = (country: Country | null | undefined): boolean => !isFreeForever(country);

/** Is payment ever required to open lessons, questions, mock exams or progress in this country? */
export function purchaseRequiredFor(country: Country | null | undefined, globalPurchaseRequired: boolean): boolean {
  return isFreeForever(country) ? false : globalPurchaseRequired;
}

/**
 * May this student open the learning features? `registered` is the sign-in state; the lifetime purchase only
 * matters for STANDARD countries. Italian students need no purchase, ever.
 */
export function learningUnlocked(args: { country: Country | null | undefined; purchaseRequired: boolean; hasLifetimeAccess: boolean }): boolean {
  if (isFreeForever(args.country)) return true;
  return !args.purchaseRequired || args.hasLifetimeAccess;
}

/** The label shown on the Italian interface. Fixed wording, deliberately not translated. */
export const IT_FREE_FOREVER_LABEL = "100% Gratis — Per sempre";
