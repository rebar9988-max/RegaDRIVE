// Read-only production check with diagnostics, dependency-free (plain Node 22 fetch; no browser, no secrets).
// Usage: node scripts/live-content-check.mjs https://www.regaplatform.com [--expect-commit=<sha>]
// Why this exists: "HTTP 000" means the client never got an HTTP answer (DNS, TCP, TLS or timeout). Every failure here
// therefore prints WHICH layer failed, so a network problem of the checking machine is told apart from a site problem.
import dns from "node:dns/promises";
import tls from "node:tls";
import assert from "node:assert/strict";

const base = (process.argv[2] ?? "https://www.regaplatform.com").replace(/\/$/, "");
const expect = process.argv.find((a) => a.startsWith("--expect-commit="))?.split("=")[1];
const host = new URL(base).hostname;
const results = [];
const check = async (name, fn) => { try { const note = await fn(); results.push([name, "PASS", note ?? ""]); } catch (e) { results.push([name, "FAIL", String(e.cause?.code ?? e.message).slice(0, 300)]); } };

async function get(path, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fetch(base + path, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20000), headers: { "user-agent": "regadrive-live-check" } }); }
    catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw last;
}

await check("network layers (diagnostics)", async () => {
  const a = await dns.resolve4(host).catch((e) => { throw new Error(`DNS failed: ${e.code}`); });
  await new Promise((res, rej) => { const s = tls.connect({ host, port: 443, servername: host, timeout: 10000 }, () => { s.end(); res(); }); s.on("error", (e) => rej(new Error(`TLS/TCP failed: ${e.code ?? e.message}`))); s.on("timeout", () => { s.destroy(); rej(new Error("TCP timeout")); }); });
  return `DNS ${a.join(",")} · TLS ok`;
});
await check("/api/health", async () => {
  const r = await get("/api/health"); assert.equal(r.status, 200);
  const h = await r.json(); assert.equal(h.app, "regadrive"); assert.equal(h.contentMode, "production");
  return `version ${h.version}`;
});
await check("/build-info.json (deployed commit)", async () => {
  const r = await get("/build-info.json"); assert.equal(r.status, 200);
  const b = await r.json();
  if (expect) assert.ok(String(b.commit ?? b.sha ?? "").startsWith(expect.slice(0, 7)), `live commit ${b.commit ?? b.sha} != expected ${expect}`);
  return `commit ${String(b.commit ?? b.sha ?? "?").slice(0, 12)} · build ${b.buildId}`;
});
for (const p of ["/signs", "/sign-quiz", "/dr", "/practice", "/exam"]) {
  await check(`GET ${p}`, async () => { const r = await get(p); assert.equal(r.status, 200); assert.match(r.headers.get("content-type") ?? "", /text\/html/); const t = await r.text(); assert.ok(t.includes("<div id=\"root\"") || t.includes("id=\"root\""), "app shell"); return "200 html"; });
}
// Italy is free for every registered student, and that is enforced server-side, not only in the interface.
await check("Italy is free (server-side)", async () => {
  const r = await get("/api/flags"); assert.equal(r.status, 200);
  const f = await r.json();
  assert.equal(f.accessPolicy?.IT, "FREE_FOREVER", "Italy must be FREE_FOREVER");
  assert.equal(f.purchaseRequiredByCountry?.IT, false, "a purchase must never be required in Italy");
  assert.equal(f.purchaseRequired, false, "no purchase required at all while payments are off");
  assert.equal(f.checkoutEnabled, false, "checkout must stay off");
  assert.equal(f.paymentsEnabled, false, "payments must stay off");
  return `IT ${f.accessPolicy?.IT} · purchaseRequired IT=${f.purchaseRequiredByCountry?.IT} DE=${f.purchaseRequiredByCountry?.DE} · checkout ${f.checkoutEnabled}`;
});
await check("checkout refuses for Italy", async () => {
  const r = await fetch(`${base}/api/purchase/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ country: "IT" }) });
  const body = await r.json().catch(() => ({}));
  assert.equal(r.status, 403, `checkout answered ${r.status}`);
  assert.equal(body.error, "FREE_FOREVER_COUNTRY", `unexpected refusal: ${JSON.stringify(body)}`);
  return `POST /api/purchase/checkout (IT) → 403 ${body.error}`;
});
let approved;
await check("/api/content/approved", async () => {
  const r = await get("/api/content/approved"); assert.equal(r.status, 200);
  approved = await r.json();
  assert.equal(typeof approved.ok, "boolean");
  const s = Object.keys(approved.signs ?? {}).length, q = Object.keys(approved.signQuiz ?? {}).length;
  const its = Object.keys(approved.itSigns ?? {}).length, itq = Object.keys(approved.itQuestions ?? {}).length;
  if (approved.ok !== true) assert.equal(s + q + its + itq, 0, "fail closed");
  const ready = approved.ready ?? {};
  if (ready.de === false) assert.equal(s + q, 0, "German bank not ready: publishes nothing");
  if (ready.it === false) assert.equal(its + itq, 0, "Italian bank not ready: publishes nothing");
  return `ok=${approved.ok} · DE signs ${s}/40 · quiz ${q}/89 · IT signs ${its}/8 · questions ${itq}/12 · tables de=${ready.de} it=${ready.it}`;
});
await check("unauthenticated /dr review API refused", async () => {
  const r = await get("/api/dr/reviews"); assert.equal(r.status, 401);
});

let failed = 0;
for (const [n, s, note] of results) { if (s !== "PASS") failed++; console.log(`${s.padEnd(4)} ${n}${note ? ` — ${note}` : ""}`); }
console.log(`\n${base}: ${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
