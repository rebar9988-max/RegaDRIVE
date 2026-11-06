// Read-only check that the production domain can safely receive the RegaDRIVE Worker.
// PASS: domain already serves RegaDRIVE, or it is not serving anything AND the owner verified ownership.
// FAIL: it serves an unrelated website (never overwritten), or ownership is unverified.
import { retry, isNetworkError } from "./lib/retry.mjs";

const url = (process.argv[2] ?? "https://www.regaplatform.com").replace(/\/$/, "");
const ownerVerified = process.env.REGAPLATFORM_DOMAIN_VERIFIED === "true";
const get = (p) => retry(() => fetch(url + p, { redirect: "manual", signal: AbortSignal.timeout(10000) }), { attempts: 3, baseMs: 2000, isRecoverable: isNetworkError });

let verdict;
try {
  const h = await get("/api/health");
  const body = h.headers.get("content-type")?.includes("json") ? await h.json().catch(() => null) : null;
  if (body?.app === "regadrive") verdict = { ok: true, state: "serves-regadrive", detail: `version ${body.version}` };
  else {
    const home = await get("/");
    const text = (await home.text()).slice(0, 4000);
    verdict = { ok: false, state: "serves-other-content", detail: `HTTP ${home.status}; existing content is not RegaDRIVE — refusing to overwrite (${text.replace(/\s+/g, " ").slice(0, 120)})` };
  }
} catch (e) {
  verdict = ownerVerified
    ? { ok: true, state: "not-serving-owner-verified", detail: String(e?.cause?.code ?? e?.message ?? e) }
    : { ok: false, state: "unreachable-unverified", detail: `cannot reach ${url} (${e?.cause?.code ?? e?.message ?? e}) and REGAPLATFORM_DOMAIN_VERIFIED is not true` };
}
console.log(JSON.stringify({ url, ...verdict }, null, 2));
process.exit(verdict.ok ? 0 : 1);
