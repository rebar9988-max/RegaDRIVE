// Read-only check that the production domain can safely receive the RegaDRIVE Worker.
// PASS: the domain serves RegaDRIVE (this app or the earlier RegaDrive prototype of the same project), or it
//       serves nothing yet (ownership is then enforced by Cloudflare when the custom domain is attached).
// FAIL: it serves any unrelated website — never overwritten.
import { retry, isNetworkError } from "./lib/retry.mjs";

const url = (process.argv[2] ?? "https://www.regaplatform.com").replace(/\/$/, "");
const get = (p) => retry(() => fetch(url + p, { redirect: "manual", signal: AbortSignal.timeout(10000) }), { attempts: 3, baseMs: 2000, isRecoverable: isNetworkError });

let verdict;
try {
  const h = await get("/api/health");
  const body = h.headers.get("content-type")?.includes("json") ? await h.json().catch(() => null) : null;
  if (body?.app === "regadrive") verdict = { ok: true, state: "serves-regadrive", detail: `version ${body.version}` };
  else {
    const home = await get("/");
    const text = (await home.text()).slice(0, 4000);
    const sameProject = /<title>[^<]*RegaDrive/i.test(text) || /class="brand"[^>]*>\s*RegaDrive/i.test(text);
    verdict = sameProject
      ? { ok: true, state: "serves-regadrive-prototype", detail: `HTTP ${home.status}; earlier RegaDrive version of this project` }
      : { ok: false, state: "serves-other-content", detail: `HTTP ${home.status}; existing content is not RegaDRIVE — refusing to overwrite (${text.replace(/\s+/g, " ").slice(0, 120)})` };
  }
} catch (e) {
  // Nothing is served there, so nothing can be overwritten; Cloudflare only attaches a zone this account owns.
  verdict = { ok: true, state: "not-serving", detail: String(e?.cause?.code ?? e?.message ?? e) };
}
console.log(JSON.stringify({ url, ...verdict }, null, 2));
process.exit(verdict.ok ? 0 : 1);
