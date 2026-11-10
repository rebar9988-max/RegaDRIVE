import { describe, expect, it, vi } from "vitest";
import { AiGateway, FREE_TIER_POLICY, globalCostGuard, verificationFresh, type AiEnv, type ProviderId, type ProviderStatus } from "../../worker/ai/gateway";

import type { D1Like, D1Stmt } from "../../worker/dr/db";

/** Complete structural D1 mock; quota tests only exercise bind/run. */
function mockD1(run: (sql: string) => Promise<unknown>): D1Like {
  return {
    prepare(sql: string): D1Stmt {
      const stmt: D1Stmt = {
        bind: () => stmt,
        first: async <T>() => null as T | null,
        all: async <T>() => ({ results: [] as T[] }),
        run: () => run(sql),
      };
      return stmt;
    },
  };
}

const NOW = Date.parse("2026-11-06T12:00:00Z");
const FRESH = "2026-11-01";
const base: AiEnv = { AI_ENABLED: "true", AI_FREE_ONLY: "true", AI_PAID_FALLBACK_ENABLED: "false", AI_DAILY_COST_LIMIT_EUR: "0", AI_DOMAIN_SCOPE: "regadrive", AI_PROVIDER_ORDER: "gemini,groq,openrouter,workers-ai", AI_MAX_RETRIES_PER_PROVIDER: "1" };
const groq: AiEnv = { REGADRIVE_GROQ_API_KEY: "q", AI_GROQ_MODEL: "qm", AI_GROQ_VERIFIED_ON: FRESH };
const req = { system: "s", user: "u", maxTokens: 5000 };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const gw = (env: AiEnv, f: unknown = vi.fn()) => new AiGateway(env, f as typeof fetch, () => NOW);
const statusOf = (g: AiGateway) => Object.fromEntries(g.status().map((s) => [s.id, s])) as unknown as Record<ProviderId, { status: ProviderStatus; detail: string }>;

describe("zero-cost guard", () => {
  it("reports NOT_CONFIGURED for every provider without RegaDRIVE secrets and never calls the network", async () => {
    const f = vi.fn();
    const g = gw(base, f);
    expect(statusOf(g)).toMatchObject({
      gemini: { status: "NOT_CONFIGURED" },
      groq: { status: "NOT_CONFIGURED" },
      openrouter: { status: "NOT_CONFIGURED" },
      "workers-ai": { status: "NOT_CONFIGURED" },
      freemodel: { status: "DISABLED" }, // not in the explicitly authorized provider order
    });
    expect(await g.complete(req)).toEqual({ provider: null, error: "NO_FREE_PROVIDER_AVAILABLE" });
    expect(f).not.toHaveBeenCalled();
  });
  it.each([
    [{ AI_ENABLED: "false" }, "AI_ENABLED is not true"],
    [{ AI_FREE_ONLY: "false" }, "AI_FREE_ONLY must be true"],
    [{ AI_PAID_FALLBACK_ENABLED: "true" }, "paid fallback requested"],
    [{ AI_DAILY_COST_LIMIT_EUR: "5" }, "non-zero AI cost limit requested"],
    [{ AI_DOMAIN_SCOPE: "rega24" }, "AI_DOMAIN_SCOPE must be regadrive"],
  ])("stops ALL providers on inconsistent cost config %o", async (patch, reason) => {
    const f = vi.fn(async () => ok({ choices: [{ message: { content: "x" } }] }));
    const g = gw({ ...base, ...groq, ...patch }, f);
    expect(globalCostGuard({ ...base, ...patch })).toEqual({ ok: false, reason });
    expect(g.status().every((s) => s.status === "DISABLED")).toBe(true);
    expect((await g.complete(req)).provider).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("a configuration flag alone is not enough: free-tier verification must exist and be fresh", () => {
    expect(verificationFresh(undefined, NOW, 30).ok).toBe(false);
    expect(verificationFresh("yes", NOW, 30).ok).toBe(false);
    expect(verificationFresh("2026-09-01", NOW, 30)).toEqual({ ok: false, reason: "free-tier verification expired" });
    expect(verificationFresh("2027-01-01", NOW, 30).ok).toBe(false);
    expect(verificationFresh(FRESH, NOW, 30).ok).toBe(true);
    const st = statusOf(gw({ ...base, ...groq, AI_GROQ_VERIFIED_ON: undefined }));
    expect(st.groq.status).toBe("NOT_CONFIGURED");
  });
  it("rejects paid OpenRouter models and old non-prefixed (possibly shared) secret names", () => {
    const st = statusOf(gw({ ...base, REGADRIVE_OPENROUTER_API_KEY: "k", AI_OPENROUTER_MODEL: "vendor/paid-model", AI_OPENROUTER_VERIFIED_ON: FRESH, ...({ GEMINI_API_KEY: "shared" } as AiEnv) }));
    expect(st.openrouter).toMatchObject({ status: "NOT_CONFIGURED", detail: "model is not a :free model" });
    expect(st.gemini).toMatchObject({ status: "NOT_CONFIGURED", detail: "missing REGADRIVE_GEMINI_API_KEY" });
  });
});

describe("provider routing", () => {
  it("falls back to the next free provider on rate limit; ACTIVE only after a real success", async () => {
    const env: AiEnv = { ...base, ...groq, REGADRIVE_GEMINI_API_KEY: "g", AI_GEMINI_MODEL: "gm", AI_GEMINI_VERIFIED_ON: FRESH };
    const f = vi.fn(async (url: string) => (String(url).includes("googleapis") ? new Response("{}", { status: 429 }) : ok({ choices: [{ message: { content: "Erklärung" } }] })));
    const g = gw(env, f);
    expect(statusOf(g).groq.status).toBe("UNAVAILABLE"); // configured but not yet proven
    expect(await g.complete(req)).toEqual({ provider: "groq", text: "Erklärung" });
    expect(statusOf(g)).toMatchObject({ gemini: { status: "RATE_LIMITED" }, groq: { status: "ACTIVE" } });
  });
  it("caps output tokens to the free-tier policy", async () => {
    const f = vi.fn(async () => ok({ choices: [{ message: { content: "ok" } }] }));
    await gw({ ...base, ...groq }, f).complete(req);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.max_tokens).toBe(FREE_TIER_POLICY.groq.maxOutputTokens);
  });
  it("enforces a per-provider daily quota (owner may lower, never raise) and stops at the cap", async () => {
    const f = vi.fn(async () => new Response("err", { status: 500 }));
    const g = gw({ ...base, ...groq, AI_DAILY_REQUESTS_PER_PROVIDER: "2" }, f);
    await g.complete(req);
    await g.complete(req);
    await g.complete(req);
    expect(f).toHaveBeenCalledTimes(2);
    expect(statusOf(g).groq.status).toBe("RATE_LIMITED");
    const raised = gw({ ...base, ...groq, AI_DAILY_REQUESTS_PER_PROVIDER: "999999" });
    expect((raised as unknown as { dailyLimit(id: string): number }).dailyLimit("groq")).toBe(FREE_TIER_POLICY.groq.dailyRequests);
  });
  it("opens the circuit after repeated failures", async () => {
    const f = vi.fn(async () => new Response("err", { status: 500 }));
    const g = gw({ ...base, ...groq, AI_MAX_RETRIES_PER_PROVIDER: "2" }, f);
    await g.complete(req);
    expect(f).toHaveBeenCalledTimes(3);
    expect(g.costGuard("groq")).toEqual({ ok: false, reason: "circuit open after failures" });
  });
  it("sends no paid routing to OpenRouter", async () => {
    const env: AiEnv = { ...base, AI_PROVIDER_ORDER: "openrouter", REGADRIVE_OPENROUTER_API_KEY: "o", AI_OPENROUTER_MODEL: "meta/x:free", AI_OPENROUTER_VERIFIED_ON: FRESH };
    const f = vi.fn(async () => ok({ choices: [{ message: { content: "ok" } }] }));
    await gw(env, f).complete(req);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.model.endsWith(":free")).toBe(true);
    expect(body.provider).toEqual({ allow_fallbacks: false });
  });
});


describe("FreeModel durable quota fail-closed", () => {
  it("never calls FreeModel if the D1 quota reservation fails", async () => {
    const f = vi.fn();
    const db = mockD1(async () => { throw new Error("D1 unavailable"); });
    const env: AiEnv = {
      ...base, DB: db, AI_PROVIDER_ORDER: "freemodel",
      REGADRIVE_FREEMODEL_API_KEY: "test-only",
      AI_FREEMODEL_MODEL: "test-model",
      AI_FREEMODEL_ZERO_COST_CONFIRMED: "true",
      AI_FREEMODEL_VERIFIED_ON: FRESH,
    };
    const result = await gw(env, f).complete(req);
    expect(result).toEqual({ provider: null, error: "NO_FREE_PROVIDER_AVAILABLE" });
    expect(f).not.toHaveBeenCalled();
  });
  it("rejects a monthly reservation with no remaining capacity", async () => {
    const f = vi.fn();
    const db = mockD1(async (sql) => ({ meta: { changes: sql.startsWith("UPDATE") ? 0 : 1 } }));
    const env: AiEnv = {
      ...base, DB: db, AI_PROVIDER_ORDER: "freemodel",
      REGADRIVE_FREEMODEL_API_KEY: "test-only",
      AI_FREEMODEL_MODEL: "test-model",
      AI_FREEMODEL_ZERO_COST_CONFIRMED: "true",
      AI_FREEMODEL_VERIFIED_ON: FRESH,
    };
    expect(await gw(env, f).complete(req)).toEqual({ provider: null, error: "NO_FREE_PROVIDER_AVAILABLE" });
    expect(f).not.toHaveBeenCalled();
  });
});
