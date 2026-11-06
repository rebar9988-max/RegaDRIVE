import { describe, expect, it, vi } from "vitest";
import { AiGateway, type AiEnv } from "../../worker/ai/gateway";

const base: AiEnv = { AI_ENABLED: "true", AI_PROVIDER_ORDER: "gemini,groq,openrouter,workers-ai", AI_MAX_RETRIES_PER_PROVIDER: "1" };
const req = { system: "s", user: "u", maxTokens: 50 };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("AI gateway (free-only)", () => {
  it("reports NOT_CONFIGURED for every provider without RegaDRIVE secrets and never calls the network", async () => {
    const f = vi.fn();
    const g = new AiGateway(base, f as unknown as typeof fetch);
    expect(g.status().map((s) => s.status)).toEqual(["NOT_CONFIGURED", "NOT_CONFIGURED", "NOT_CONFIGURED", "NOT_CONFIGURED"]);
    expect(await g.complete(req)).toEqual({ provider: null, error: "NO_FREE_PROVIDER_AVAILABLE" });
    expect(f).not.toHaveBeenCalled();
  });
  it("is DISABLED when AI_ENABLED is not true", async () => {
    const g = new AiGateway({ ...base, AI_ENABLED: "false", GROQ_API_KEY: "k", AI_GROQ_MODEL: "m", AI_GROQ_FREE_TIER_CONFIRMED: "true" });
    expect(g.status().every((s) => s.status === "DISABLED")).toBe(true);
    expect((await g.complete(req)).provider).toBeNull();
  });
  it("refuses OpenRouter models that are not :free and providers without owner free-tier confirmation", () => {
    const g = new AiGateway({ ...base, OPENROUTER_API_KEY: "k", AI_OPENROUTER_MODEL: "vendor/paid-model", GEMINI_API_KEY: "k", AI_GEMINI_MODEL: "m" });
    const st = Object.fromEntries(g.status().map((s) => [s.id, s]));
    expect(st.openrouter).toMatchObject({ status: "NOT_CONFIGURED", detail: "model is not a :free model" });
    expect(st.gemini).toMatchObject({ status: "NOT_CONFIGURED", detail: "free tier not confirmed by owner" });
  });
  it("falls back to the next free provider on rate limit and reports ACTIVE only after a real success", async () => {
    const env: AiEnv = { ...base, GEMINI_API_KEY: "g", AI_GEMINI_MODEL: "gm", AI_GEMINI_FREE_TIER_CONFIRMED: "true", GROQ_API_KEY: "q", AI_GROQ_MODEL: "qm", AI_GROQ_FREE_TIER_CONFIRMED: "true" };
    const f = vi.fn(async (url: string) => (String(url).includes("googleapis") ? new Response("{}", { status: 429 }) : ok({ choices: [{ message: { content: "Erklärung" } }] })));
    const g = new AiGateway(env, f as unknown as typeof fetch);
    expect(g.status().find((s) => s.id === "groq")!.status).toBe("UNAVAILABLE"); // configured but unverified
    expect(await g.complete(req)).toEqual({ provider: "groq", text: "Erklärung" });
    const st = Object.fromEntries(g.status().map((s) => [s.id, s.status]));
    expect(st).toMatchObject({ gemini: "RATE_LIMITED", groq: "ACTIVE" });
    // OpenRouter call must never ask for paid fallbacks.
    expect(f.mock.calls.some(([u]) => String(u).includes("openrouter"))).toBe(false);
  });
  it("enforces a per-provider daily quota and opens the circuit after repeated failures", async () => {
    const env: AiEnv = { ...base, AI_DAILY_REQUESTS_PER_PROVIDER: "2", GROQ_API_KEY: "q", AI_GROQ_MODEL: "qm", AI_GROQ_FREE_TIER_CONFIRMED: "true" };
    const f = vi.fn(async () => new Response("err", { status: 500 }));
    const g = new AiGateway(env, f as unknown as typeof fetch);
    await g.complete(req);
    await g.complete(req);
    expect(f).toHaveBeenCalledTimes(2); // quota of 2 reached, no further calls
    expect(g.status().find((s) => s.id === "groq")!.status).toBe("RATE_LIMITED");
  });
  it("sends no paid-routing to OpenRouter", async () => {
    const env: AiEnv = { ...base, AI_PROVIDER_ORDER: "openrouter", OPENROUTER_API_KEY: "o", AI_OPENROUTER_MODEL: "meta/x:free" };
    const f = vi.fn(async () => ok({ choices: [{ message: { content: "ok" } }] }));
    await new AiGateway(env, f as unknown as typeof fetch).complete(req);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.model.endsWith(":free")).toBe(true);
    expect(body.provider).toEqual({ allow_fallbacks: false });
  });
});
