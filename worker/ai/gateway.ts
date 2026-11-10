/**
 * RegaDRIVE AI gateway — four free-only provider adapters behind one fail-closed router.
 * A provider is eligible only when: AI is enabled, its own RegaDRIVE secret is set, a model is
 * configured, and its zero-cost eligibility is confirmed (or, for OpenRouter, the model id ends in ":free").
 * There is never a paid fallback. Prompts are built server-side from reviewed content only.
 */
export type ProviderId = "gemini" | "groq" | "openrouter" | "workers-ai" | "freemodel";
export type ProviderStatus = "ACTIVE" | "RATE_LIMITED" | "NOT_CONFIGURED" | "UNAVAILABLE" | "DISABLED";

export interface AiEnv {
  AI_ENABLED?: string;
  AI_FREE_ONLY?: string;
  AI_PAID_FALLBACK_ENABLED?: string;
  AI_DAILY_COST_LIMIT_EUR?: string;
  AI_PROVIDER_ORDER?: string;
  AI_MAX_RETRIES_PER_PROVIDER?: string;
  AI_DOMAIN_SCOPE?: string;
  AI_DAILY_REQUESTS_PER_PROVIDER?: string;
  /** RegaDRIVE-only secrets (never Rega24/R&L keys). */
  REGADRIVE_GEMINI_API_KEY?: string;
  REGADRIVE_GROQ_API_KEY?: string;
  REGADRIVE_OPENROUTER_API_KEY?: string;
  REGADRIVE_FREEMODEL_API_KEY?: string;
  AI_FREEMODEL_MODEL?: string;
  AI_FREEMODEL_VERIFIED_ON?: string;
  AI_FREEMODEL_ZERO_COST_CONFIRMED?: string;
  AI_GEMINI_MODEL?: string;
  AI_GROQ_MODEL?: string;
  AI_OPENROUTER_MODEL?: string;
  AI_WORKERS_AI_MODEL?: string;
  /** YYYY-MM-DD written only after scripts/ai-verify.mjs passed for that provider and model. */
  AI_GEMINI_VERIFIED_ON?: string;
  AI_GROQ_VERIFIED_ON?: string;
  AI_OPENROUTER_VERIFIED_ON?: string;
  AI_WORKERS_AI_VERIFIED_ON?: string;
  AI?: { run(model: string, input: unknown): Promise<unknown> };
  DB?: { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } };
}

export interface ChatRequest { system: string; user: string; maxTokens: number }
type Fetch = typeof fetch;

interface Adapter {
  id: ProviderId;
  configured(env: AiEnv, now: number): Check;
  call(env: AiEnv, req: ChatRequest, f: Fetch, signal: AbortSignal): Promise<string>;
}

/** Free-tier policy per provider: caps are deliberately below the providers' published free limits. */
export const FREE_TIER_POLICY: Record<ProviderId, { dailyRequests: number; maxOutputTokens: number; verificationMaxAgeDays: number }> = {
  gemini: { dailyRequests: 200, maxOutputTokens: 400, verificationMaxAgeDays: 30 },
  groq: { dailyRequests: 500, maxOutputTokens: 400, verificationMaxAgeDays: 30 },
  openrouter: { dailyRequests: 40, maxOutputTokens: 400, verificationMaxAgeDays: 30 },
  "workers-ai": { dailyRequests: 50, maxOutputTokens: 400, verificationMaxAgeDays: 30 },
  freemodel: { dailyRequests: 20, maxOutputTokens: 300, verificationMaxAgeDays: 7 },
};

type Check = { ok: true } | { ok: false; reason: string };
const need = (cond: unknown, reason: string): Check => (cond ? { ok: true } : { ok: false, reason });
const first = (...checks: Check[]): Check => checks.find((c) => !c.ok) ?? { ok: true };

/** Whole-gateway zero-cost configuration. Any inconsistency stops ALL providers (fail closed). */
export function globalCostGuard(e: AiEnv): Check {
  return first(
    need(e.AI_ENABLED === "true", "AI_ENABLED is not true"),
    need(e.AI_FREE_ONLY === undefined || e.AI_FREE_ONLY === "true", "AI_FREE_ONLY must be true"),
    need(e.AI_PAID_FALLBACK_ENABLED === undefined || e.AI_PAID_FALLBACK_ENABLED === "false", "paid fallback requested"),
    need(e.AI_DAILY_COST_LIMIT_EUR === undefined || e.AI_DAILY_COST_LIMIT_EUR === "0", "non-zero AI cost limit requested"),
    need(e.AI_DOMAIN_SCOPE === undefined || e.AI_DOMAIN_SCOPE === "regadrive", "AI_DOMAIN_SCOPE must be regadrive"),
  );
}

/** A provider's free-tier verification must exist and be recent; a flag alone is never enough. */
export function verificationFresh(on: string | undefined, now: number, maxAgeDays: number): Check {
  if (!on || !/^\d{4}-\d{2}-\d{2}$/.test(on)) return { ok: false, reason: "free-tier verification missing (run scripts/ai-verify.mjs)" };
  const age = (now - Date.parse(`${on}T00:00:00Z`)) / 86_400_000;
  if (!(age >= -1)) return { ok: false, reason: "free-tier verification date is in the future" };
  if (age > maxAgeDays) return { ok: false, reason: "free-tier verification expired" };
  return { ok: true };
}

async function postJson(f: Fetch, url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal) {
  const res = await f(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal });
  if (res.status === 429) throw new RateLimited();
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}
class RateLimited extends Error {}

const openAiText = (j: Record<string, unknown>): string => {
  const choices = j.choices as { message?: { content?: string } }[] | undefined;
  return choices?.[0]?.message?.content ?? "";
};

export const ADAPTERS: Record<ProviderId, Adapter> = {
  freemodel: {
    id: "freemodel",
    configured: (e, now) => first(
      need(e.REGADRIVE_FREEMODEL_API_KEY, "missing REGADRIVE_FREEMODEL_API_KEY"),
      need(e.AI_FREEMODEL_MODEL, "missing AI_FREEMODEL_MODEL"),
      need(e.DB, "missing durable D1 quota database"),
      need(e.AI_FREEMODEL_ZERO_COST_CONFIRMED === "true", "FreeModel zero-cost policy not independently confirmed"),
      verificationFresh(e.AI_FREEMODEL_VERIFIED_ON, now, FREE_TIER_POLICY.freemodel.verificationMaxAgeDays),
    ),
    async call(e, r, f, signal) {
      return openAiText(await postJson(f, "https://freemodel.in/v1/chat/completions", { authorization: `Bearer ${e.REGADRIVE_FREEMODEL_API_KEY}` }, {
        model: e.AI_FREEMODEL_MODEL, max_tokens: r.maxTokens, temperature: 0.2,
        messages: [{ role: "system", content: r.system }, { role: "user", content: r.user }],
      }, signal));
    },
  },
  gemini: {
    id: "gemini",
    configured: (e, now) => first(
      need(e.REGADRIVE_GEMINI_API_KEY, "missing REGADRIVE_GEMINI_API_KEY"),
      need(e.AI_GEMINI_MODEL, "missing AI_GEMINI_MODEL"),
      verificationFresh(e.AI_GEMINI_VERIFIED_ON, now, FREE_TIER_POLICY.gemini.verificationMaxAgeDays),
    ),
    async call(e, r, f, signal) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(e.AI_GEMINI_MODEL!)}:generateContent`;
      const j = await postJson(f, url, { "x-goog-api-key": e.REGADRIVE_GEMINI_API_KEY! }, {
        systemInstruction: { parts: [{ text: r.system }] },
        contents: [{ role: "user", parts: [{ text: r.user }] }],
        generationConfig: { maxOutputTokens: r.maxTokens, temperature: 0.2 },
      }, signal);
      const c = j.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined;
      return c?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    },
  },
  groq: {
    id: "groq",
    configured: (e, now) => first(
      need(e.REGADRIVE_GROQ_API_KEY, "missing REGADRIVE_GROQ_API_KEY"),
      need(e.AI_GROQ_MODEL, "missing AI_GROQ_MODEL"),
      verificationFresh(e.AI_GROQ_VERIFIED_ON, now, FREE_TIER_POLICY.groq.verificationMaxAgeDays),
    ),
    async call(e, r, f, signal) {
      return openAiText(await postJson(f, "https://api.groq.com/openai/v1/chat/completions", { authorization: `Bearer ${e.REGADRIVE_GROQ_API_KEY}` }, {
        model: e.AI_GROQ_MODEL, max_tokens: r.maxTokens, temperature: 0.2,
        messages: [{ role: "system", content: r.system }, { role: "user", content: r.user }],
      }, signal));
    },
  },
  openrouter: {
    id: "openrouter",
    configured: (e, now) => first(
      need(e.REGADRIVE_OPENROUTER_API_KEY, "missing REGADRIVE_OPENROUTER_API_KEY"),
      need(e.AI_OPENROUTER_MODEL, "missing AI_OPENROUTER_MODEL"),
      need(e.AI_OPENROUTER_MODEL?.endsWith(":free"), "model is not a :free model"),
      verificationFresh(e.AI_OPENROUTER_VERIFIED_ON, now, FREE_TIER_POLICY.openrouter.verificationMaxAgeDays),
    ),
    async call(e, r, f, signal) {
      return openAiText(await postJson(f, "https://openrouter.ai/api/v1/chat/completions", { authorization: `Bearer ${e.REGADRIVE_OPENROUTER_API_KEY}` }, {
        model: e.AI_OPENROUTER_MODEL, max_tokens: r.maxTokens, temperature: 0.2,
        // Never let OpenRouter route to a paid endpoint.
        provider: { allow_fallbacks: false },
        messages: [{ role: "system", content: r.system }, { role: "user", content: r.user }],
      }, signal));
    },
  },
  "workers-ai": {
    id: "workers-ai",
    configured: (e, now) => first(
      need(e.AI, "missing AI binding"),
      need(e.AI_WORKERS_AI_MODEL, "missing AI_WORKERS_AI_MODEL"),
      verificationFresh(e.AI_WORKERS_AI_VERIFIED_ON, now, FREE_TIER_POLICY["workers-ai"].verificationMaxAgeDays),
    ),
    async call(e, r) {
      const out = (await e.AI!.run(e.AI_WORKERS_AI_MODEL!, {
        max_tokens: r.maxTokens,
        messages: [{ role: "system", content: r.system }, { role: "user", content: r.user }],
      })) as { response?: string };
      return out.response ?? "";
    },
  },
};

interface Health { day: string; used: number; failures: number; openUntil: number; lastOk: boolean | null; rateLimitedUntil: number }

/** Isolate-scoped health/quota tracking (best effort; resets when the isolate is recycled). */
export class AiGateway {
  private health = new Map<ProviderId, Health>();
  constructor(private env: AiEnv, private f: Fetch = fetch, private now: () => number = Date.now, private timeoutMs = 8000) {}

  order(): ProviderId[] {
    const ids = (this.env.AI_PROVIDER_ORDER ?? "gemini,groq,openrouter,workers-ai").split(",").map((s) => s.trim());
    return ids.filter((id): id is ProviderId => id in ADAPTERS);
  }

  private h(id: ProviderId): Health {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    let h = this.health.get(id);
    if (!h || h.day !== day) {
      h = { day, used: 0, failures: 0, openUntil: 0, lastOk: h?.lastOk ?? null, rateLimitedUntil: 0 };
      this.health.set(id, h);
    }
    return h;
  }

  /** Owner may lower, never raise, the free-tier cap. */
  private dailyLimit(id: ProviderId): number {
    const cap = FREE_TIER_POLICY[id].dailyRequests;
    const n = Number(this.env.AI_DAILY_REQUESTS_PER_PROVIDER ?? cap);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, cap) : cap;
  }

  /** Atomic D1 reservation across Workers isolates. Fail closed if unavailable. */
  private async reserveFreeModel(): Promise<boolean> {
    const db = this.env.DB;
    if (!db) return false;
    const month = new Date(this.now()).toISOString().slice(0, 7);
    // Reserve an intentionally conservative 1000 tokens per call (input + output).
    // 200 calls / 200k reserved tokens per month, well below the 1M upstream allowance.
    try {
      await db.prepare("INSERT OR IGNORE INTO ai_freemodel_monthly_quota (month, requests, reserved_tokens) VALUES (?, 0, 0)").bind(month).run();
      const result = await db.prepare("UPDATE ai_freemodel_monthly_quota SET requests = requests + 1, reserved_tokens = reserved_tokens + 1000 WHERE month = ? AND requests < 200 AND reserved_tokens + 1000 <= 200000").bind(month).run() as { meta?: { changes?: number } };
      return result.meta?.changes === 1;
    } catch { return false; }
  }

  /** Cost guard evaluated immediately before every provider request. */
  costGuard(id: ProviderId): Check {
    const g = globalCostGuard(this.env);
    if (!g.ok) return g;
    if (!this.order().includes(id)) return { ok: false, reason: "not in AI_PROVIDER_ORDER" };
    const c = ADAPTERS[id].configured(this.env, this.now());
    if (!c.ok) return c;
    const h = this.h(id);
    const t = this.now();
    if (h.used >= this.dailyLimit(id)) return { ok: false, reason: "daily free quota reached" };
    if (h.rateLimitedUntil > t) return { ok: false, reason: "provider rate limit" };
    if (h.openUntil > t) return { ok: false, reason: "circuit open after failures" };
    return { ok: true };
  }

  status(): { id: ProviderId; status: ProviderStatus; detail: string }[] {
    return (Object.keys(ADAPTERS) as ProviderId[]).map((id) => {
      const g = globalCostGuard(this.env);
      if (!g.ok) return { id, status: "DISABLED", detail: g.reason };
      if (!this.order().includes(id)) return { id, status: "DISABLED", detail: "not in AI_PROVIDER_ORDER" };
      const c = ADAPTERS[id].configured(this.env, this.now());
      if (!c.ok) return { id, status: "NOT_CONFIGURED", detail: c.reason };
      const h = this.h(id);
      const t = this.now();
      if (h.used >= this.dailyLimit(id) || h.rateLimitedUntil > t) return { id, status: "RATE_LIMITED", detail: "quota or provider rate limit" };
      if (h.openUntil > t) return { id, status: "UNAVAILABLE", detail: "circuit open after failures" };
      if (h.lastOk === true) return { id, status: "ACTIVE", detail: "last call succeeded" };
      return { id, status: "UNAVAILABLE", detail: h.lastOk === false ? "last call failed" : "configured, not yet verified by a successful call" };
    });
  }

  async complete(req: ChatRequest): Promise<{ provider: ProviderId; text: string } | { provider: null; error: string }> {
    if (!globalCostGuard(this.env).ok) return { provider: null, error: "AI_DISABLED" };
    const retries = Math.min(Math.max(Number(this.env.AI_MAX_RETRIES_PER_PROVIDER ?? "1") || 0, 0), 2);
    for (const id of this.order()) {
      const adapter = ADAPTERS[id];
      const h = this.h(id);
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (!this.costGuard(id).ok) break; // fail closed before EVERY request
        if (id === "freemodel" && !(await this.reserveFreeModel())) break;
        h.used += 1;
        const capped = { ...req, maxTokens: Math.min(req.maxTokens, FREE_TIER_POLICY[id].maxOutputTokens) };
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
        try {
          const text = (await adapter.call(this.env, capped, this.f, ctrl.signal)).trim();
          if (!text) throw new Error("EMPTY");
          h.failures = 0;
          h.lastOk = true;
          return { provider: id, text: text.slice(0, 4000) };
        } catch (err) {
          h.lastOk = false;
          if (err instanceof RateLimited) { h.rateLimitedUntil = this.now() + 60_000; break; }
          h.failures += 1;
          if (h.failures >= 3) h.openUntil = this.now() + 60_000;
        } finally {
          clearTimeout(timer);
        }
      }
    }
    return { provider: null, error: "NO_FREE_PROVIDER_AVAILABLE" };
  }
}

export const SYSTEM_PROMPT =
  "You are the RegaDRIVE study helper for German driving theory (Klasse B). " +
  "Explain ONLY the reviewed learning content given to you, in the answer language named in the request (default: simple Kurdish Sorani), followed by the key terms in simple German. " +
  "Do not add new traffic rules, fines, numbers, official question codes, licensing or exam claims that are not in the content. " +
  "If the content does not answer something, say that the learner should check the official StVO or their driving school. " +
  "Refuse any request outside driving-theory learning.";
