// Live smoke test for a deployed RegaDRIVE (also runs locally against `wrangler dev`).
// Usage: node scripts/smoke.mjs https://www.regaplatform.com   [--allow-http for local runs]
import assert from "node:assert/strict";
import { chromium, devices } from "playwright";
import { retry, isNetworkError } from "./lib/retry.mjs";

const base = (process.argv[2] ?? "https://www.regaplatform.com").replace(/\/$/, "");
const allowHttp = process.argv.includes("--allow-http");
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push([name, "PASS"]); } catch (e) { results.push([name, `FAIL: ${e.message.split("\n")[0]}`]); }
};
const get = (p, init) => retry(() => fetch(base + p, { ...init, signal: AbortSignal.timeout(15000) }), { attempts: 3, isRecoverable: isNetworkError });

await check("HTTPS", async () => { if (!allowHttp) assert.ok(base.startsWith("https://"), "target must be https"); assert.equal((await get("/")).status, 200); });
await check("health: regadrive, production content, DB off, payments off", async () => {
  const h = await (await get("/api/health")).json();
  assert.equal(h.app, "regadrive"); assert.equal(h.contentMode, "production"); assert.equal(h.database, "off"); assert.equal(h.payments, "off");
});
await check("build is a production content build", async () => assert.equal((await (await get("/build-info.json")).json()).contentMode, "production"));
await check("all payment/database flags OFF", async () => {
  const f = await (await get("/api/flags")).json();
  for (const k of ["paymentsEnabled", "checkoutEnabled", "livePaymentWebhooksEnabled", "purchaseRequired", "databaseProductionEnabled", "aiPaidFallbackEnabled"]) assert.equal(f[k], false, k);
});
await check("checkout/webhook/auth refused", async () => {
  assert.equal((await get("/api/purchase/checkout", { method: "POST" })).status, 403);
  assert.equal((await get("/api/payments/webhook", { method: "POST", body: "{}" })).status, 403);
  assert.equal((await get("/api/auth/login", { method: "POST" })).status, 503);
});
await check("AI zero-cost controls", async () => {
  const a = await (await get("/api/ai/status")).json();
  assert.equal(a.paidFallback, false); assert.equal(a.costLimitEur, 0); assert.equal(a.providers.length, 4);
  const r = await get("/api/ai/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId: "not-a-question" }) });
  assert.equal(r.status, 404, "AI must refuse non-RegaDRIVE content");
});
await check("critical routes and official assets", async () => {
  for (const p of ["/", "/learn", "/practice", "/exam", "/signs", "/vocabulary", "/access", "/about", "/manifest.webmanifest", "/sw.js"]) assert.equal((await get(p)).status, 200, p);
  const logo = await get("/brand/regadrive-logo.webp");
  assert.equal(logo.status, 200); assert.match(logo.headers.get("content-type") ?? "", /image\/webp/);
});
await check("security headers", async () => {
  const r = await get("/");
  assert.match(r.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});

const browser = await chromium.launch();
try {
  for (const [name, opts] of [["mobile", devices["iPhone 13"]], ["desktop", { viewport: { width: 1366, height: 900 } }]]) {
    await check(`browser ${name}: RTL Kurdish, logo, layout, no runtime errors`, async () => {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      await page.goto(base);
      await page.waitForSelector("[data-testid=home]", { timeout: 20000 });
      assert.equal(await page.getAttribute("html", "dir"), "rtl");
      assert.equal(await page.getAttribute("html", "lang"), "ckb");
      assert.ok(await page.$eval(".hero-logo", (i) => i.complete && i.naturalWidth > 0), "official logo");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, "no horizontal overflow");
      assert.equal(await page.locator("[data-testid=preview-banner]").count(), 0, "no preview banner in production");
      await page.goto(`${base}/practice`);
      await page.waitForSelector("main#main > div:not([aria-busy])");
      const cards = await page.locator("[data-testid=question-card]").count();
      if (cards > 0) assert.equal(await page.locator("[data-testid=question-card] legend .bi > span").first().getAttribute("dir"), "rtl");
      await page.goto(`${base}/settings`);
      await page.click("[data-testid=mode-de]");
      assert.equal(await page.getAttribute("html", "dir"), "ltr", "German LTR");
      await page.screenshot({ path: `test-results/smoke-${name}.png`, fullPage: true }).catch(() => {});
      assert.deepEqual(errors, []);
      await ctx.close();
    });
  }
} finally { await browser.close(); }

for (const [n, r] of results) console.log(`${r.startsWith("PASS") ? "PASS" : "FAIL"} ${n}${r.startsWith("PASS") ? "" : ` — ${r.slice(6)}`}`);
const failed = results.filter(([, r]) => !r.startsWith("PASS")).length;
console.log(`\nSMOKE ${failed ? "FAILED" : "PASSED"}: ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
