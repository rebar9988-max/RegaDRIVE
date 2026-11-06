/**
 * RegaDRIVE AI gateway — four free-only provider adapters behind one fail-closed router.
 * A provider is eligible only when: AI is enabled, its own RegaDRIVE secret is set, a model is
 * configured, and its zero-cost eligibility is confirmed (or, for OpenRouter, the model id ends in ":free").
 * There is never a paid fallback. Prompts are built server-side from reviewed content only.
 */
export type ProviderId = "gemini" | "groq" | "openrouter" | "workers-ai";
export type ProviderStatus = "ACTIVE" | "RATE_LIMITED" | "NOT_CONFIGURED" | "UNAVAILABLE" | "DISABLED";

export interface AiEnv {
  AI_ENABLED?: string;
  AI_PROVIDER_ORDER?: string;
  AI_MAX_RETRIES_PER_PROVIDER?: string;
  AI_DOMAIN_SCOPE?: string;
  AI_DAILY_REQUESTS_PER_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  AI_GEMINI_MODEL?: string;
  AI_GEMINI_FREE_TIER_CONFIRMED?: string;
  GROQ_API_KEY?: string;
  AI_GROQ_MODEL?: string;
  AI_GROQ_FREE_TIER_CONFIRMED?: string;
  OPENROUTER_API_KEY?: string;
  AI_OPENROUTER_MODEL?: string;
  AI_WORKERS_AI_MODEL?: string;
  AI_WORKERS_AI_FREE_CONFIRMED?: string;
  AI?: { run(model: string, input: unknown): Promise<unknown> };
}

export interface ChatRequest { system: string; user: string; maxTokens: number }
type Fetch = typeof fetch;

interface Adapter {
  id: ProviderId;
  configured(env: AiEnv): { ok: true } | { ok: false; reason: string };
  call(env: AiEnv, req: ChatRequest, f: Fetch, signal: AbortSignal): Promise<string>;
}

const yes = (v?: string) => v === "true";

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
  gemini: {
    id: "gemini",
    configured: (e) =>
      !e.GEMINI_API_KEY ? { ok: false, reason: "missing GEMINI_API_KEY" }
      : !e.AI_GEMINI_MODEL ? { ok: false, reason: "missing AI_GEMINI_MODEL" }
      : !yes(e.AI_GEMINI_FREE_TIER_CONFIRMED) ? { ok: false, reason: "free tier not confirmed by owner" }
      : { ok: true },
    async call(e, r, f, signal) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(e.AI_GEMINI_MODEL!)}:generateContent`;
      const j = await postJson(f, url, { "x-goog-api-key": e.GEMINI_API_KEY! }, {
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
    configured: (e) =>
      !e.GROQ_API_KEY ? { ok: false, reason: "missing GROQ_API_KEY" }
      : !e.AI_GROQ_MODEL ? { ok: false, reason: "missing AI_GROQ_MODEL" }
      : !yes(e.AI_GROQ_FREE_TIER_CONFIRMED) ? { ok: false, reason: "free tier not confirmed by owner" }
      : { ok: true },
    async call(e, r, f, signal) {
      return openAiText(await postJson(f, "https://api.groq.com/openai/v1/chat/completions", { authorization: `Bearer ${e.GROQ_API_KEY}` }, {
        model: e.AI_GROQ_MODEL, max_tokens: r.maxTokens, temperature: 0.2,
        messages: [{ role: "system", content: r.system }, { role: "user", content: r.user }],
      }, signal));
    },
  },
  openrouter: {
    id: "openrouter",
    configured: (e) =>
      !e.OPENROUTER_API_KEY ? { ok: false, reason: "missing OPENROUTER_API_KEY" }
      : !e.AI_OPENROUTER_MODEL ? { ok: false, reason: "missing AI_OPENROUTER_MODEL" }
      : !e.AI_OPENROUTER_MODEL.endsWith(":free") ? { ok: false, reason: "model is not a :free model" }
      : { ok: true },
    async call(e, r, f, signal) {
      return openAiText(await postJson(f, "https://openrouter.ai/api/v1/chat/completions", { authorization: `Bearer ${e.OPENROUTER_API_KEY}` }, {
        model: e.AI_OPENROUTER_MODEL, max_tokens: r.maxTokens, temperature: 0.2,
        // Never let OpenRouter route to a paid endpoint.
        provider: { allow_fallbacks: false },
        messages: [{ role: "system", content: r.system }, { role: "user", content: r.user }],
      }, signal));
    },
  },
  "workers-ai": {
    id: "workers-ai",
    configured: (e) =>
      !e.AI ? { ok: false, reason: "missing AI binding" }
      : !e.AI_WORKERS_AI_MODEL ? { ok: false, reason: "missing AI_WORKERS_AI_MODEL" }
      : !yes(e.AI_WORKERS_AI_FREE_CONFIRMED) ? { ok: false, reason: "free allocation not confirmed by owner" }
      : { ok: true },
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

  private dailyLimit(): number {
    const n = Number(this.env.AI_DAILY_REQUESTS_PER_PROVIDER ?? "200");
    return Number.isFinite(n) && n >= 0 ? n : 200;
  }

  status(): { id: ProviderId; status: ProviderStatus; detail: string }[] {
    return (Object.keys(ADAPTERS) as ProviderId[]).map((id) => {
      if (this.env.AI_ENABLED !== "true") return { id, status: "DISABLED", detail: "AI_ENABLED is not true" };
      if (!this.order().includes(id)) return { id, status: "DISABLED", detail: "not in AI_PROVIDER_ORDER" };
      const c = ADAPTERS[id].configured(this.env);
      if (!c.ok) return { id, status: "NOT_CONFIGURED", detail: c.reason };
      const h = this.h(id);
      const t = this.now();
      if (h.used >= this.dailyLimit() || h.rateLimitedUntil > t) return { id, status: "RATE_LIMITED", detail: "quota or provider rate limit" };
      if (h.openUntil > t) return { id, status: "UNAVAILABLE", detail: "circuit open after failures" };
      if (h.lastOk === true) return { id, status: "ACTIVE", detail: "last call succeeded" };
      return { id, status: "UNAVAILABLE", detail: h.lastOk === false ? "last call failed" : "configured, not yet verified by a successful call" };
    });
  }

  async complete(req: ChatRequest): Promise<{ provider: ProviderId; text: string } | { provider: null; error: string }> {
    if (this.env.AI_ENABLED !== "true") return { provider: null, error: "AI_DISABLED" };
    const retries = Math.min(Math.max(Number(this.env.AI_MAX_RETRIES_PER_PROVIDER ?? "1") || 0, 0), 2);
    for (const id of this.order()) {
      const adapter = ADAPTERS[id];
      if (!adapter.configured(this.env).ok) continue;
      const h = this.h(id);
      for (let attempt = 0; attempt <= retries; attempt++) {
        const t = this.now();
        if (h.openUntil > t || h.rateLimitedUntil > t || h.used >= this.dailyLimit()) break;
        h.used += 1;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
        try {
          const text = (await adapter.call(this.env, req, this.f, ctrl.signal)).trim();
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
  "Explain ONLY the reviewed learning content given to you, in simple Kurdish Sorani first, then simple German. " +
  "Do not add new traffic rules, fines, numbers, official question codes, licensing or exam claims that are not in the content. " +
  "If the content does not answer something, say that the learner should check the official StVO or their driving school. " +
  "Refuse any request outside driving-theory learning.";
