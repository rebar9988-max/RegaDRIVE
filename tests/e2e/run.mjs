// End-to-end tests against the real Workers runtime (wrangler dev, fully local).
// The remote-only Workers AI binding is removed for the test config; everything else is identical.
// Usage: npm run build:preview && npm run test:e2e   (screenshots → test-results/)
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { chromium, devices } from "playwright";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = "test-results";
mkdirSync(OUT, { recursive: true });

const cfg = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));
delete cfg.ai;
cfg.vars = { ...cfg.vars, CONTENT_MODE: "preview" }; // E2E runs against the preview build (npm run build:preview)
delete cfg.$schema;
writeFileSync(".wrangler-e2e.json", JSON.stringify(cfg, null, 2));

const dev = spawn("npx", ["wrangler", "dev", "-c", ".wrangler-e2e.json", "--port", String(PORT), "--ip", "127.0.0.1", "--show-interactive-dev-session=false"], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
let devLog = "";
dev.stdout.on("data", (d) => (devLog += d));
dev.stderr.on("data", (d) => (devLog += d));

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`wrangler dev did not start\n${devLog}`);
}

const results = [];
async function test(name, fn) {
  const t = Date.now();
  try { await fn(); results.push({ name, ok: true }); console.log(`PASS ${name} (${Date.now() - t}ms)`); }
  catch (e) { results.push({ name, ok: false }); console.log(`FAIL ${name}\n  ${e?.stack ?? e}`); }
}

async function axe(page, label) {
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0]?.target })));
  assert.deepEqual(r, [], `axe violations on ${label}: ${JSON.stringify(r, null, 1)}`);
}

let browser;
try {
  await waitUp();
  browser = await chromium.launch();

  await test("API: health, flags OFF, auth unavailable, checkout refused", async () => {
    const h = await (await fetch(`${BASE}/api/health`)).json();
    const info = await (await fetch(`${BASE}/build-info.json`)).json();
    assert.equal(info.contentMode, "preview", "E2E must run against the preview build");
    assert.equal(h.database, "off"); assert.equal(h.payments, "off");
    const f = await (await fetch(`${BASE}/api/flags`)).json();
    for (const k of ["paymentsEnabled", "checkoutEnabled", "livePaymentWebhooksEnabled", "purchaseRequired", "databaseProductionEnabled", "aiPaidFallbackEnabled"]) assert.equal(f[k], false, k);
    assert.equal((await fetch(`${BASE}/api/auth/login`, { method: "POST" })).status, 503);
    assert.equal((await fetch(`${BASE}/api/purchase/checkout`, { method: "POST" })).status, 403);
    assert.equal((await fetch(`${BASE}/api/payments/webhook`, { method: "POST", body: "{}" })).status, 403);
    const ai = await fetch(`${BASE}/api/ai/explain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId: "rd-g-003" }) });
    assert.equal(ai.status, 503, "AI must degrade gracefully with no configured free provider");
  });

  for (const [name, opts] of [
    ["iphone", devices["iPhone 13"]],
    ["android", devices["Pixel 7"]],
    ["tablet", devices["iPad Mini"]],
    ["desktop", { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 }],
  ]) {
    await test(`home renders logo, RTL, no overflow, no console errors [${name}]`, async () => {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      await page.goto(BASE);
      await page.waitForSelector("[data-testid=home]");
      assert.equal(await page.getAttribute("html", "dir"), "rtl");
      assert.equal(await page.getAttribute("html", "lang"), "ckb");
      const logoOk = await page.$eval(".hero-logo", (img) => img.complete && img.naturalWidth > 0);
      assert.ok(logoOk, "official logo loads");
      const emblemOk = await page.$eval(".brand img", (img) => img.complete && img.naturalWidth > 0);
      assert.ok(emblemOk, "header emblem loads");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.equal(overflow, 0, "no horizontal overflow");
      // Quick tiles and stat tiles must be equal height (no ragged layout).
      const heights = await page.$$eval(".grid-tiles > .tile", (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      assert.ok(new Set(heights.slice(0, 2)).size === 1 && new Set(heights.slice(2, 4)).size === 1, `tile rows equal height: ${heights}`);
      assert.equal(heights.length, 4, "four quick navigation tiles");
      const stats = await page.$$eval(".compact-stats > .stat", (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      assert.equal(stats.length, 2, "both supplementary statistics remain available");
      assert.equal(new Set(stats).size, 1, `stat tiles equal height: ${stats}`);
      const small = await page.$$eval("a.btn, button.btn, .tab, .chip, .navlink", (els) => els.filter((e) => e.offsetParent && (e.getBoundingClientRect().height < 44 || e.getBoundingClientRect().width < 44)).length);
      assert.equal(small, 0, "touch targets ≥ 44px");
      await page.screenshot({ path: `${OUT}/home-${name}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await ctx.close();
    });
  }

  await test("accessibility (axe WCAG 2.x A/AA) on key pages, RTL and mobile", async () => {
    // bypassCSP only so the axe test script can be injected; the app itself keeps its strict CSP.
    for (const opts of [{ viewport: { width: 1280, height: 900 } }, devices["iPhone 13"]]) {
    const ctx = await browser.newContext({ ...opts, bypassCSP: true });
    const page = await ctx.newPage();
    for (const path of ["/", "/practice", "/exam", "/signs", "/learn/l-priority", "/vocabulary", "/settings", "/access", "/account", "/services"]) {
      await page.goto(BASE + path);
      await page.waitForSelector("main#main > div:not([aria-busy])");
      await axe(page, path);
    }
    await ctx.close();
    }
  });

  await test("bilingual question: Kurdish RTL first, German LTR below; multi-answer checkboxes; feedback; no duplicate scoring", async () => {
    const ctx = await browser.newContext(devices["iPhone 13"]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/practice?topic=priority`);
    const card = page.locator("[data-testid=question-card]").first();
    await card.waitFor();
    const order = await card.locator("legend .bi > span").evaluateAll((els) => els.map((e) => [e.getAttribute("lang"), e.getAttribute("dir")]));
    assert.deepEqual(order, [["ckb", "rtl"], ["de", "ltr"]]);
    // rd-g-003: single correct answer "a"
    assert.equal(await card.getAttribute("data-qid"), "rd-g-003");
    assert.ok(await page.locator("[data-testid=check]").isDisabled(), "cannot check without a selection");
    assert.equal(await page.locator("[data-testid=feedback]").count(), 0, "answer not disclosed before checking");
    await page.locator("[data-testid=option-a] input").check();
    await page.locator("[data-testid=check]").click();
    await page.locator("[data-testid=feedback].ok").waitFor();
    assert.ok(await page.locator("[data-testid=option-b] input").isDisabled(), "options locked after checking");
    await page.locator("[data-testid=next]").click();
    // rd-g-004: two correct answers a+b; choosing only a must be wrong
    assert.equal(await page.locator("[data-testid=question-card]").getAttribute("data-qid"), "rd-g-004");
    await page.locator("[data-testid=option-a] input").check();
    await page.locator("[data-testid=check]").click();
    await page.locator("[data-testid=feedback].bad").waitFor();
    const stored = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("regadrive"); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("progress"); g.onsuccess = () => res(g.result); }; }));
    assert.equal(stored.questions["rd-g-003"].attempts, 1);
    assert.equal(stored.questions["rd-g-004"].attempts, 1);
    assert.equal(stored.questions["rd-g-004"].lastCorrect, false);
    await page.screenshot({ path: `${OUT}/practice-iphone.png`, fullPage: true });
    // Progress survives a reload.
    await page.reload();
    await page.goto(`${BASE}/practice?status=incorrect`);
    await page.locator("[data-testid=question-card][data-qid=rd-g-004]").waitFor();
    await ctx.close();
  });

  await test("search by Kurdish and German", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/practice`);
    await page.locator("[data-testid=practice-filter-toggle]").click();
    await page.fill("[data-testid=search]", "Rettungsgasse");
    await page.locator("[data-testid=question-card][data-qid=rd-g-020]").waitFor();
    await page.fill("[data-testid=search]", "پشتێنی سەلامەتی");
    await page.locator("[data-testid=question-card][data-qid=rd-g-021]").waitFor();
    await ctx.close();
  });

  await test("mock exam: 30 questions, no answer disclosure, scored once, labelled as simulation", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/exam`);
    await page.click("[data-testid=exam-start]");
    for (let i = 0; i < 29; i++) {
      assert.equal(await page.locator("[data-testid=feedback]").count(), 0);
      await page.locator("[data-testid=option-a] input").check();
      await page.click("[data-testid=exam-next]");
    }
    await page.locator("[data-testid=option-a] input").check();
    await page.click("[data-testid=exam-submit]");
    await page.locator("[data-testid=exam-result]").waitFor();
    const text = await page.textContent("[data-testid=exam-result]");
    assert.ok(text.includes("keine amtliche Prüfung"));
    await page.screenshot({ path: `${OUT}/exam-result-desktop.png`, fullPage: false });
    await ctx.close();
  });

  await test("language modes: German-only switches document to LTR", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/settings`);
    await page.click("[data-testid=mode-de]");
    assert.equal(await page.getAttribute("html", "dir"), "ltr");
    await page.goto(BASE);
    await page.waitForSelector("[data-testid=home]");
    assert.equal(await page.locator("[lang=ckb]:not(.language-switch button)").count(), 0);
    // The language picker keeps its native-language label in every mode.
    await page.locator(".language-switch button[lang=ckb]").click();
    assert.equal(await page.getAttribute("html", "dir"), "rtl");
    await page.locator(".language-switch button[lang=de]").click();
    assert.equal(await page.getAttribute("html", "dir"), "ltr");
    await page.screenshot({ path: `${OUT}/home-desktop-de.png` });
    await ctx.close();
  });

  await test("purchase disabled, account unavailable, services show no invented data", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/access`);
    assert.ok(await page.locator("[data-testid=buy]").isDisabled());
    assert.ok((await page.textContent("[data-testid=purchase]")).includes("€20"));
    assert.equal(await page.locator("input[autocomplete^=cc-], input[name*=card]").count(), 0, "no card fields");
    await page.goto(`${BASE}/services`);
    await page.click("form button[type=submit]");
    await page.locator("[data-testid=services-unavailable]").waitFor();
    await ctx.close();
  });

  await test("owner import workbench (preview build only): validate fixture locally, never import or publish", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, bypassCSP: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/import`);
    await page.waitForSelector("[data-testid=admin-import]");
    await page.fill("[data-testid=licences]", "LIC-FIXTURE");
    await page.setInputFiles("[data-testid=question-file]", "tests/fixtures/import/valid.json");
    await page.setInputFiles("[data-testid=media-files]", { name: "fixture.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]) });
    await page.waitForFunction(() => document.querySelector("[data-testid=row-count]")?.textContent?.startsWith("2"));
    await page.click("[data-testid=validate]");
    await page.locator("[data-testid=summary]").waitFor();
    const summary = await page.textContent("[data-testid=summary]");
    assert.ok(summary.includes("new: 2") && summary.includes("invalid: 0"), summary);
    assert.equal(await page.locator("[data-testid=preview-row]").count(), 2);
    assert.ok(await page.locator("[data-testid=commit]").isDisabled(), "import execution disabled");
    assert.equal(await page.locator("text=draft · hidden").count(), 2, "imports are draft and hidden");
    await axe(page, "/admin/import");
    // Without the licence registered, every row is rejected.
    await page.fill("[data-testid=licences]", "");
    await page.click("[data-testid=validate]");
    await page.waitForFunction(() => document.querySelector("[data-testid=summary]")?.textContent?.includes("invalid: 2"));
    await page.screenshot({ path: `${OUT}/admin-import.png`, fullPage: true });
    await ctx.close();
  });

  await test("reference navigation, lesson filters and narrow layouts", async () => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE);
    await page.locator(".language-switch button[lang=ckb]").click();
    const hrefs = await page.locator(".tabbar a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    assert.deepEqual(hrefs, ["/", "/learn", "/exam", "/progress", "/settings"]);
    await page.locator('.tabbar a[href="/learn"]').click();
    const all = await page.locator(".lesson-list > li").count();
    assert.ok(all > 0);
    await page.locator(".lesson-filters button").nth(3).click();
    assert.equal(await page.locator(".lesson-list > li").count(), 0);
    await page.locator(".lesson-filters button").nth(2).click();
    assert.equal(await page.locator(".lesson-list > li").count(), all);
    await page.locator(".lesson-list a").first().click();
    await page.locator("[data-testid=lesson-done]").click();
    await page.goto(`${BASE}/learn`);
    await page.locator(".lesson-filters button").nth(3).click();
    assert.equal(await page.locator(".lesson-list > li").count(), 1);
    for (const path of ["/", "/learn", "/practice", "/progress", "/settings", "/more", "/account"]) {
      await page.goto(BASE + path);
      await page.locator("main h1").waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, path);
      await page.screenshot({ path: `${OUT}/design-320-${path.slice(1) || "home"}.png`, fullPage: true });
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await test("offline: app shell and practice work after first visit (service worker)", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector("[data-testid=home]");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // let the SW control the page and cache hashed assets
    await page.waitForSelector("[data-testid=home]");
    await ctx.setOffline(true);
    await page.goto(`${BASE}/practice`);
    await page.locator("[data-testid=question-card]").waitFor();
    await page.locator("[data-testid=offline-pill]").waitFor();
    await page.screenshot({ path: `${OUT}/offline-practice.png` });
    await ctx.setOffline(false);
    await ctx.close();
  });
} finally {
  await browser?.close();
  dev.kill("SIGTERM");
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} E2E tests passed`);
process.exit(failed ? 1 : 0);
