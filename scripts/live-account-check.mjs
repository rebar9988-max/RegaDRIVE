// Read-only live check of the student account page on a deployed RegaDRIVE.
// Usage: node scripts/live-account-check.mjs https://www.regaplatform.com [--expect-commit=<sha>]
//
// Never registers, signs in, backs up, restores or deletes anything: it uses no account and no credentials.
// It verifies the server-side safeguards (CSRF, no session → no data) and the signed-out account UI in all
// four learner languages at phone, small-phone, Android and desktop sizes, with axe WCAG 2.x A/AA.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium, devices } from "playwright";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const base = (process.argv[2] ?? "https://www.regaplatform.com").replace(/\/$/, "");
const expectCommit = process.argv.find((a) => a.startsWith("--expect-commit="))?.split("=")[1];
const PLATFORM_INJECTED = /static\.cloudflareinsights\.com|\/cdn-cgi\//;
mkdirSync("test-results", { recursive: true });

const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push([name, "PASS"]); }
  catch (e) { results.push([name, `FAIL: ${String(e.message).replace(/\s+/g, " ").slice(0, 700)}`]); }
};
const get = (p, init) => fetch(base + p, { ...init, signal: AbortSignal.timeout(15000) });
const post = (p, body, csrf = true) => get(p, { method: "POST", headers: csrf ? { "content-type": "application/json", "x-rd-request": "1" } : { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });

// ── Release identity ──────────────────────────────────────────────────
await check("live build is a production build" + (expectCommit ? ` of ${expectCommit.slice(0, 12)}` : ""), async () => {
  const info = await (await get("/build-info.json", { cache: "no-store" })).json();
  console.log(`Live build: ${info.buildId} commit ${info.commit}`);
  assert.equal(info.contentMode, "production");
  if (expectCommit) assert.equal(info.commit, expectCommit, "live commit");
});

// ── Server-side safeguards (no session, no data) ──────────────────────
await check("flags: student accounts on, official bank, payments and database off", async () => {
  const f = await (await get("/api/flags")).json();
  assert.equal(f.studentAuthEnabled, true, "studentAuthEnabled");
  assert.equal(f.officialQuestionBankEnabled, false, "officialQuestionBankEnabled (unlicensed TÜV/DEKRA bank stays off)");
  for (const k of ["paymentsEnabled", "checkoutEnabled", "purchaseRequired", "databaseProductionEnabled"]) assert.equal(f[k], false, k);
});
await check("profile: signed-out /api/me reveals nothing and sets no cookie", async () => {
  const r = await get("/api/me");
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { authenticated: false });
  assert.equal(r.headers.get("set-cookie"), null);
});
await check("progress backup/restore: refused without a session; writes need the CSRF header", async () => {
  const g = await get("/api/me/progress"); assert.equal(g.status, 401, "GET progress");
  assert.equal((await post("/api/me/progress", { progress: {}, baseVersion: 0 }, false)).status, 403, "POST without CSRF header");
  assert.equal((await post("/api/me/progress", { progress: {}, baseVersion: 0 })).status, 401, "POST without session");
});
await check("data export refused without a session", async () => { assert.equal((await get("/api/me/export")).status, 401); });
await check("account deletion: CSRF header and session required", async () => {
  assert.equal((await post("/api/me/delete", { password: "x" }, false)).status, 403, "without CSRF header");
  assert.equal((await post("/api/me/delete", { password: "x" })).status, 401, "without session");
});
await check("auth writes refused without the CSRF header (no account is created)", async () => {
  for (const p of ["/api/auth/register", "/api/auth/login", "/api/auth/verify-email", "/api/auth/reset-password"]) assert.equal((await post(p, {}, false)).status, 403, p);
});
await check("logout without a session is harmless and clears the cookie", async () => {
  const r = await post("/api/auth/logout", { all: false });
  assert.equal(r.status, 200); assert.match(r.headers.get("set-cookie") ?? "", /Max-Age=0|expires=Thu, 01 Jan 1970/i);
});

// ── Account page UI in four languages × four sizes ────────────────────
const SIZES = [
  ["iphone13", devices["iPhone 13"]],
  ["small-320", { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ["pixel7", devices["Pixel 7"]],
  ["desktop", { viewport: { width: 1366, height: 900 } }],
];
const LANGS = ["ckb", "de", "kmr", "ar"];
const DIR = { ckb: "rtl", ar: "rtl", de: "ltr", kmr: "ltr" };

const browser = await chromium.launch();
try {
  for (const [size, opts] of SIZES) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error" && !PLATFORM_INJECTED.test(`${m.text()} ${m.location()?.url ?? ""}`)) errors.push(`console: ${m.text()}`); });
    await check(`${size}: first visit, choose Germany`, async () => {
      await page.goto(base);
      await page.waitForSelector("[data-testid=home], .country-card", { timeout: 20000 });
      if (await page.locator(".country-card").count()) await page.locator(".country-card:has([lang=de])").click();
      await page.waitForSelector("[data-testid=home]", { timeout: 20000 });
    });
    for (const lang of LANGS) {
      await check(`${size} ${lang}: account sign-in page — logo, ${DIR[lang]} labels, no overflow, targets, nav clear, axe AA`, async () => {
        await page.goto(`${base}/settings`);
        await page.waitForSelector(`[data-testid=lang-${lang}]`, { timeout: 20000 });
        await page.click(`[data-testid=lang-${lang}]`);
        await page.goto(`${base}/account`);
        await page.waitForSelector("[data-testid=signin-form]", { timeout: 20000 });
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.getAttribute("html", "lang"), lang);
        assert.equal(await page.getAttribute("html", "dir"), "rtl", "page layout never mirrors");
        assert.equal(await page.getAttribute("#auth-heading", "dir"), DIR[lang], "heading direction");
        assert.equal(await page.getAttribute(".acct-head h1", "dir"), DIR[lang], "page title direction");
        await page.waitForFunction(() => { const i = document.querySelector(".acct-logo"); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
        assert.equal(await page.locator(".acct-page .bi .de").count(), 0, "no duplicated German line");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, "no horizontal overflow");
        const small = await page.$$eval("main button, main a, main input:not([type=checkbox])", (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => (e.textContent || e.id).trim().slice(0, 40)));
        assert.deepEqual(small, [], "touch targets ≥ 44 px");
        const clear = await page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
          const bar = document.querySelector(".tabbar"); if (!bar || getComputedStyle(bar).display === "none") return true;
          const links = [...document.querySelectorAll("[data-testid=legal-nav] a")]; const last = links[links.length - 1] ?? document.querySelector("[data-testid=signin-form]");
          return last.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top;
        });
        assert.ok(clear, "footer stays above the bottom navigation");
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.addScriptTag({ content: AXE });
        const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.map((x) => ({ id: x.id, n: x.nodes.length, target: x.nodes[0]?.target })));
        assert.deepEqual(v, [], `axe: ${JSON.stringify(v)}`);
        await page.screenshot({ path: `test-results/live-account-${size}-${lang}.png`, fullPage: true });
      });
    }
    await check(`${size}: register and forgot-password forms open and return (nothing submitted)`, async () => {
      await page.click("[data-testid=to-register]"); await page.waitForSelector("[data-testid=register-form]");
      assert.equal(await page.getAttribute("#auth-password", "minlength"), "10", "strong password required");
      await page.click("[data-testid=to-signin]"); await page.waitForSelector("[data-testid=signin-form]");
      await page.click("[data-testid=to-forgot]"); await page.waitForSelector("[data-testid=forgot-form]");
      await page.click("[data-testid=to-signin]"); await page.waitForSelector("[data-testid=signin-form]");
    });
    await check(`${size}: no runtime errors`, async () => { assert.deepEqual(errors, []); });
    await ctx.close();
  }
} finally { await browser.close(); }

for (const [n, r] of results) console.log(`${r.startsWith("PASS") ? "PASS" : "FAIL"} ${n}${r.startsWith("PASS") ? "" : ` — ${r.slice(6)}`}`);
const failed = results.filter(([, r]) => !r.startsWith("PASS")).length;
console.log(`\nLIVE ACCOUNT CHECK ${failed ? "FAILED" : "PASSED"}: ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
