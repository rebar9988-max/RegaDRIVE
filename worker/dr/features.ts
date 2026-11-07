/**
 * /dr feature controls. Owner overrides live in D1 (dr_feature_states) and are enforced by the Worker.
 * Safety rule: an override can only RESTRICT what the deploy configuration allows. Money, the student database
 * and licensed content can never be switched on from the panel — they need the owner activation steps in
 * docs/OWNER_ACTIVATION.md and are reported as LOCKED.
 */
import type { Flags } from "../../src/lib/shared/flags";

export type FeatureState = "ON" | "OFF" | "LOCKED";
export type FeatureGroup = "safety" | "ai" | "payments" | "content" | "students";

export interface FeatureDef {
  key: string;
  group: FeatureGroup;
  ckb: string;
  en: string;
  /** Owner may switch it ON/OFF/LOCKED from /dr. Non-controllable features are always LOCKED. */
  controllable: boolean;
  /** Changing it needs a fresh e-mail code (step-up). */
  critical: boolean;
  /** What the deploy configuration allows (the ceiling). */
  allowed(flags: Flags): boolean;
  /** Default when no override is stored. */
  defaultOn: boolean;
}

export const FEATURES: readonly FeatureDef[] = [
  { key: "emergency_lock", group: "safety", ckb: "قوفڵی کاتی (Emergency Lock)", en: "Emergency lock", controllable: true, critical: true, allowed: () => true, defaultOn: false },
  { key: "ai_explanations", group: "ai", ckb: "ڕوونکردنەوەی AI", en: "AI explanations", controllable: true, critical: false, allowed: (f) => f.aiEnabled, defaultOn: true },
  { key: "ai_gemini", group: "ai", ckb: "Gemini", en: "Gemini", controllable: true, critical: false, allowed: (f) => f.aiEnabled, defaultOn: true },
  { key: "ai_groq", group: "ai", ckb: "Groq", en: "Groq", controllable: true, critical: false, allowed: (f) => f.aiEnabled, defaultOn: true },
  { key: "ai_openrouter", group: "ai", ckb: "OpenRouter", en: "OpenRouter", controllable: true, critical: false, allowed: (f) => f.aiEnabled, defaultOn: true },
  { key: "ai_workers_ai", group: "ai", ckb: "Workers AI", en: "Workers AI", controllable: true, critical: false, allowed: (f) => f.aiEnabled, defaultOn: true },
  { key: "payments", group: "payments", ckb: "پارەدان", en: "Payments", controllable: false, critical: true, allowed: (f) => f.paymentsEnabled, defaultOn: false },
  { key: "checkout", group: "payments", ckb: "کڕین (Checkout)", en: "Checkout", controllable: false, critical: true, allowed: (f) => f.checkoutEnabled, defaultOn: false },
  { key: "payment_webhooks", group: "payments", ckb: "Webhook ـی پارەدان", en: "Payment webhooks", controllable: false, critical: true, allowed: (f) => f.livePaymentWebhooksEnabled, defaultOn: false },
  { key: "license_enforcement", group: "payments", ckb: "مۆڵەتی بەکارهێنان", en: "License enforcement", controllable: false, critical: true, allowed: (f) => f.licenseEnforcementEnabled, defaultOn: false },
  { key: "student_accounts", group: "students", ckb: "هەژماری خوێندکاران", en: "Student accounts (database)", controllable: false, critical: true, allowed: (f) => f.databaseProductionEnabled, defaultOn: false },
  { key: "official_question_bank", group: "content", ckb: "بانکی پرسیاری فەرمی", en: "Official question bank", controllable: false, critical: true, allowed: (f) => f.officialQuestionBankEnabled, defaultOn: false },
  { key: "official_mock_exams", group: "content", ckb: "تاقیکردنەوەی فەرمی", en: "Official mock exams", controllable: false, critical: true, allowed: (f) => f.publicOfficialMockExamsEnabled, defaultOn: false },
  { key: "content_import", group: "content", ckb: "هاوردەکردنی ناوەڕۆک", en: "Content import", controllable: false, critical: true, allowed: (f) => f.contentImportExecutionEnabled, defaultOn: false },
];

export const featureByKey = (k: string) => FEATURES.find((f) => f.key === k);

export interface FeatureView {
  key: string; group: FeatureGroup; ckb: string; en: string; controllable: boolean; critical: boolean;
  /** Stored/selected state shown on the switch. */
  state: FeatureState;
  /** What the Worker actually enforces right now. */
  effective: boolean;
  /** Why it is not effective (if not). */
  reason: string | null;
}

export type Overrides = ReadonlyMap<string, FeatureState>;

export function resolveFeatures(flags: Flags, overrides: Overrides): FeatureView[] {
  const emergency = overrides.get("emergency_lock") === "ON";
  return FEATURES.map((d) => {
    const allowed = d.allowed(flags);
    if (!d.controllable) {
      return { key: d.key, group: d.group, ckb: d.ckb, en: d.en, controllable: false, critical: d.critical, state: "LOCKED", effective: allowed, reason: allowed ? null : "owner activation required (docs/OWNER_ACTIVATION.md)" };
    }
    const state: FeatureState = overrides.get(d.key) ?? (d.defaultOn ? "ON" : "OFF");
    if (d.key === "emergency_lock") return { key: d.key, group: d.group, ckb: d.ckb, en: d.en, controllable: true, critical: true, state, effective: state === "ON", reason: null };
    let reason: string | null = null;
    if (!allowed) reason = "disabled by deploy configuration";
    else if (state !== "ON") reason = state === "LOCKED" ? "locked by owner" : "switched off by owner";
    else if (emergency) reason = "emergency lock is active";
    return { key: d.key, group: d.group, ckb: d.ckb, en: d.en, controllable: true, critical: d.critical, state, effective: reason === null, reason };
  });
}

const PROVIDER_KEYS: Record<string, string> = { gemini: "ai_gemini", groq: "ai_groq", openrouter: "ai_openrouter", "workers-ai": "ai_workers_ai" };

/** Effective public flags + AI provider order after owner overrides. */
export function applyOverrides(flags: Flags, providerOrder: string | undefined, overrides: Overrides): { flags: Flags; providerOrder: string } {
  const views = new Map(resolveFeatures(flags, overrides).map((v) => [v.key, v]));
  const aiOn = views.get("ai_explanations")?.effective === true;
  const order = (providerOrder ?? "gemini,groq,openrouter,workers-ai").split(",").map((s) => s.trim()).filter((id) => {
    const k = PROVIDER_KEYS[id];
    return k !== undefined && views.get(k)?.effective === true;
  });
  return { flags: { ...flags, aiEnabled: flags.aiEnabled && aiOn }, providerOrder: order.join(",") };
}
