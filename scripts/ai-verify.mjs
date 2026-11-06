// Owner-run zero-cost verification for RegaDRIVE AI providers. Run locally with RegaDRIVE-only keys in the env:
//   REGADRIVE_GEMINI_API_KEY=… AI_GEMINI_MODEL=… node scripts/ai-verify.mjs --confirm-gemini-no-billing
// For each configured provider it verifies: model exists, zero price (where the API exposes it), a real tiny
// completion succeeds, and rate-limit headers are present. Only on PASS does it print the
// AI_<PROVIDER>_VERIFIED_ON value to set. Keys are never printed. Nothing is changed anywhere.
import { retry, isNetworkError } from "./lib/retry.mjs";

const today = new Date().toISOString().slice(0, 10);
const flag = (f) => process.argv.includes(f);
const env = process.env;
const req = (url, init = {}) => retry(() => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }), { attempts: 3, isRecoverable: isNetworkError });
const PROMPT = "Antworte nur mit: OK";
const results = [];

async function verify(id, fn) {
  try { const detail = await fn(); results.push({ id, status: "PASS", detail }); }
  catch (e) { results.push({ id, status: e.skip ? "NOT_CONFIGURED" : "FAIL", detail: e.message }); }
}
const skip = (m) => Object.assign(new Error(m), { skip: true });
const must = (c, m) => { if (!c) throw new Error(m); };

await verify("openrouter", async () => {
  const key = env.REGADRIVE_OPENROUTER_API_KEY, model = env.AI_OPENROUTER_MODEL;
  if (!key || !model) throw skip("REGADRIVE_OPENROUTER_API_KEY / AI_OPENROUTER_MODEL not set");
  must(model.endsWith(":free"), "model id does not end with :free");
  const models = await (await req("https://openrouter.ai/api/v1/models")).json();
  const m = models.data?.find((x) => x.id === model);
  must(m, `model ${model} not listed`);
  const p = m.pricing ?? {};
  must(["prompt", "completion", "request"].every((k) => p[k] === undefined || Number(p[k]) === 0), `model is not zero-priced: ${JSON.stringify(p)}`);
  const r = await req("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 5, provider: { allow_fallbacks: false }, messages: [{ role: "user", content: PROMPT }] }) });
  must(r.ok, `test call HTTP ${r.status}`);
  return `zero-priced; test call ok`;
});

await verify("groq", async () => {
  const key = env.REGADRIVE_GROQ_API_KEY, model = env.AI_GROQ_MODEL;
  if (!key || !model) throw skip("REGADRIVE_GROQ_API_KEY / AI_GROQ_MODEL not set");
  must(flag("--confirm-groq-free-plan"), "billing plan is not visible via API: confirm the Groq org is on the Free plan with --confirm-groq-free-plan");
  const list = await (await req("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${key}` } })).json();
  must(list.data?.some((x) => x.id === model), `model ${model} not available`);
  const r = await req("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: "user", content: PROMPT }] }) });
  must(r.ok, `test call HTTP ${r.status}`);
  const limit = r.headers.get("x-ratelimit-limit-requests");
  must(limit, "no rate-limit headers returned");
  return `test call ok; requests/day limit ${limit}`;
});

await verify("gemini", async () => {
  const key = env.REGADRIVE_GEMINI_API_KEY, model = env.AI_GEMINI_MODEL;
  if (!key || !model) throw skip("REGADRIVE_GEMINI_API_KEY / AI_GEMINI_MODEL not set");
  must(flag("--confirm-gemini-no-billing"), "billing is not visible via API: confirm the key's Google project has NO billing account with --confirm-gemini-no-billing");
  const info = await req(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, { headers: { "x-goog-api-key": key } });
  must(info.ok, `model lookup HTTP ${info.status}`);
  const r = await req(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: PROMPT }] }], generationConfig: { maxOutputTokens: 5 } }) });
  must(r.ok, `test call HTTP ${r.status}`);
  return "model available; test call ok";
});

await verify("workers-ai", async () => {
  const token = env.CLOUDFLARE_API_TOKEN, acct = env.CLOUDFLARE_ACCOUNT_ID, model = env.AI_WORKERS_AI_MODEL;
  if (!token || !acct || !model) throw skip("CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / AI_WORKERS_AI_MODEL not set");
  must(flag("--confirm-workers-free-plan"), "confirm the account is on the Workers Free plan (no paid overage) with --confirm-workers-free-plan");
  const r = await req(`https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/${model}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: PROMPT }], max_tokens: 5 }) });
  const j = await r.json().catch(() => ({}));
  must(r.ok && j.success, `test call HTTP ${r.status}`);
  return "test call ok";
});

for (const r of results) console.log(`${r.status.padEnd(14)} ${r.id}: ${r.detail}`);
const pass = results.filter((r) => r.status === "PASS");
if (pass.length) {
  console.log("\nSet these Worker vars (wrangler.jsonc) — valid for 30 days, then re-run this script:");
  for (const r of pass) console.log(`  AI_${r.id.toUpperCase().replace("-", "_")}_VERIFIED_ON = "${today}"`);
}
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
