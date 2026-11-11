// Live smoke test for a deployed RegaDRIVE (also runs locally against `wrangler dev`).
// Usage: node scripts/smoke.mjs https://www.regaplatform.com   [--allow-http for local runs]
import assert from "node:assert/strict";
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { assertLiveBuild } from "./lib/deploy-identity.mjs";
import { retry, isNetworkError } from "./lib/retry.mjs";

mkdirSync("test-results", { recursive: true });
/** Scripts the hosting platform injects into HTML (e.g. Cloudflare Web Analytics / challenge scripts). Our strict
 *  CSP blocks them by design; they are reported as warnings, never hidden, and never count as app errors. */
const PLATFORM_INJECTED = /static\.cloudflareinsights\.com|\/cdn-cgi\//;
const warnings = [];

const base = (process.argv[2] ?? "https://www.regaplatform.com").replace(/\/$/, "");
const allowHttp = process.argv.includes("--allow-http");
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push([name, "PASS"]); }
  catch (e) { results.push([name, `FAIL: ${String(e.message).replace(/\s+/g, " ").slice(0, 600)}`]); }
};
const get = (p, init) => retry(() => fetch(base + p, { ...init, signal: AbortSignal.timeout(15000) }), { attempts: 3, isRecoverable: isNetworkError });

// Cloudflare's edge can keep serving the previous version for a short while after `wrangler deploy`.
// Before any check, wait (up to 120 s) until the expected build is live, so every check below tests the new release.
// The release-identity check itself stays strict: if the new build never appears, it still fails and the deploy rolls back.
if (process.env.EXPECTED_BUILD_ID) {
  const deadline = Date.now() + 120_000;
  for (;;) {
    let live = "";
    try { live = (await (await get("/build-info.json", { cache: "no-store" })).json()).buildId ?? ""; } catch { /* retry */ }
    if (live === process.env.EXPECTED_BUILD_ID) { console.log(`Edge serves ${live}`); break; }
    if (Date.now() > deadline) { console.log(`Edge still serves ${live || "unknown"} after 120 s`); break; }
    await new Promise((r) => setTimeout(r, 5000));
  }
}
await check("HTTPS", async () => { if (!allowHttp) assert.ok(base.startsWith("https://"), "target must be https"); assert.equal((await get("/")).status, 200); });
await check("health: regadrive, production content, DB off, payments off", async () => {
  const h = await (await get("/api/health")).json();
  assert.equal(h.app, "regadrive"); assert.equal(h.contentMode, "production"); assert.equal(h.database, "off"); assert.equal(h.payments, "off");
});
await check("live build matches the expected production release", async () => {
  const info = await (await get("/build-info.json", { cache: "no-store" })).json();
  if (process.env.EXPECTED_BUILD_ID || process.env.GITHUB_ACTIONS === "true") {
    assertLiveBuild(info, process.env.EXPECTED_BUILD_ID, process.env.EXPECTED_COMMIT || undefined);
  } else {
    assert.equal(info.contentMode, "production");
    console.log(`Live build: ${info.buildId} (standalone smoke; expected identity not supplied)`);
  }
});
await check("all payment/database flags OFF", async () => {
  const f = await (await get("/api/flags")).json();
  for (const k of ["paymentsEnabled", "checkoutEnabled", "livePaymentWebhooksEnabled", "purchaseRequired", "databaseProductionEnabled", "aiPaidFallbackEnabled"]) assert.equal(f[k], false, k);
});
await check("checkout/webhook refused", async () => {
  assert.equal((await get("/api/purchase/checkout", { method: "POST" })).status, 403);
  assert.equal((await get("/api/payments/webhook", { method: "POST", body: "{}" })).status, 403);
});
await check("student accounts live on the separate student database, CSRF-protected, no session leak", async () => {
  const f = await (await get("/api/flags")).json();
  assert.equal(f.studentAuthEnabled, true, "studentAuthEnabled");
  const me = await get("/api/me");
  assert.equal(me.status, 200); assert.deepEqual(await me.json(), { authenticated: false });
  assert.equal((await get("/api/auth/login", { method: "POST" })).status, 403, "state change without the CSRF header is refused");
  // Exercises the student schema and password hashing on the real database; reserved .invalid address, never registered.
  const r = await get("/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-rd-request": "1" }, body: JSON.stringify({ email: "smoke-test@regadrive.invalid", password: "not-a-real-password" }) });
  assert.equal(r.status, 401, `login with unknown account answers 401 (got ${r.status})`);
  assert.deepEqual(await r.json(), { error: "INVALID_CREDENTIALS" });
  assert.equal(r.headers.get("set-cookie"), null, "no cookie on failure");
});
await check("AI zero-cost controls", async () => {
  const a = await (await get("/api/ai/status")).json();
  assert.equal(a.paidFallback, false); assert.equal(a.costLimitEur, 0);
  // Five adapters exist (gemini, groq, openrouter, workers-ai and the opt-in freemodel). freemodel is not in AI_PROVIDER_ORDER, so it must stay inactive.
  assert.equal(a.providers.length, 5);
  assert.notEqual(a.providers.find((p) => p.id === "freemodel")?.status, "ACTIVE", "freemodel must not be active unless explicitly enabled");
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
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = `${m.text()} @ ${m.location()?.url ?? ""}`;
        (PLATFORM_INJECTED.test(text) ? warnings : errors).push(`[${name}] console: ${text}`);
      });
      page.on("requestfailed", (r) => {
        const text = `${r.url()} (${r.failure()?.errorText ?? "failed"})`;
        (PLATFORM_INJECTED.test(r.url()) ? warnings : errors).push(`[${name}] request failed: ${text}`);
      });
      await page.goto(base);
      // First visit: new learners choose their licence country (src/app/CountrySelection.tsx). Choose Germany, as a learner does.
      await page.waitForSelector("[data-testid=home], .country-card", { timeout: 20000 });
      if (await page.locator(".country-card").count()) await page.locator(".country-card:has([lang=de])").click();
      await page.waitForSelector("[data-testid=home]", { timeout: 20000 });
      assert.equal(await page.getAttribute("html", "dir"), "rtl");
      assert.equal(await page.getAttribute("html", "lang"), "ckb");
      // Wait for the logo to finish downloading over the real network (an instant check races the download).
      await page.waitForFunction(() => { const i = document.querySelector(".hero-logo"); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 })
        .catch(() => { throw new Error("official logo did not load within 15 s"); });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, "no horizontal overflow");
      assert.equal(await page.locator("[data-testid=preview-banner]").count(), 0, "no preview banner in production");
      await page.screenshot({ path: `test-results/smoke-home-${name}.png`, fullPage: true });
      await page.goto(`${base}/practice`);
      await page.waitForSelector("main#main > div:not([aria-busy])");
      const cards = await page.locator("[data-testid=question-card]").count();
      if (cards > 0) assert.equal(await page.locator("[data-testid=question-card] legend .bi > span").first().getAttribute("dir"), "rtl");
      await page.goto(`${base}/settings`);
      // Measure only after stored settings have loaded: before that the header has no country button yet.
      await page.waitForSelector("[data-testid=lang-ckb]");
      // Four languages; the layout never mirrors or moves, only the words change.
      const layout = () => page.evaluate(() => [".topbar .brand", ".sidenav", ".tabbar"].map((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && r.width ? [Math.round(r.left), Math.round(r.right)] : null; }));
      // The shell paints a splash screen (no country button in the header yet) until settings load from storage.
      // The language buttons only exist once the app is ready, so wait for them, the country button the learner
      // chose above, and the web fonts (font-display: swap) before taking the baseline; otherwise the header's
      // late arrivals would be mistaken for a layout move caused by switching language.
      await page.waitForSelector("[data-testid=lang-kmr]", { timeout: 20000 });
      await page.waitForSelector(".country-switch", { timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      const before = await layout();
      for (const lang of ["kmr", "ar", "de", "ckb"]) {
        await page.click(`[data-testid=lang-${lang}]`);
        assert.equal(await page.getAttribute("html", "lang"), lang);
        assert.equal(await page.getAttribute("html", "dir"), "rtl", `layout stays RTL in ${lang}`);
        assert.deepEqual(await layout(), before, `layout unchanged in ${lang}`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `no horizontal overflow in ${lang}`);
      }
      await page.screenshot({ path: `test-results/smoke-${name}.png`, fullPage: true }).catch(() => {});
      assert.deepEqual(errors, [], `runtime errors: ${errors.join(" | ")}`);
      await ctx.close();
    });
  }
} finally { await browser.close(); }

for (const w of warnings) console.log(`WARN ${w}`);
for (const [n, r] of results) console.log(`${r.startsWith("PASS") ? "PASS" : "FAIL"} ${n}${r.startsWith("PASS") ? "" : ` — ${r.slice(6)}`}`);
const failed = results.filter(([, r]) => !r.startsWith("PASS")).length;
console.log(`\nSMOKE ${failed ? "FAILED" : "PASSED"}: ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
