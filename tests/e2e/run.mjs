// End-to-end tests against the real Workers runtime (wrangler dev, fully local).
// The remote-only Workers AI binding is removed for the test config; everything else is identical.
// Usage: npm run build:preview && npm run test:e2e   (screenshots → test-results/)
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
// E2E runs against the preview build (npm run build:preview). Student e-mails go to a local loopback sink
// (honoured only with APP_ENV=e2e — see worker/students/handler.ts); nothing is sent to Resend.
const MAIL_PORT = 8799;
cfg.vars = { ...cfg.vars, CONTENT_MODE: "preview", APP_ENV: "e2e", MAIL_API_URL: `http://127.0.0.1:${MAIL_PORT}/emails`, REGADRIVE_RESEND_API_KEY: "re_e2e_local_only" };
delete cfg.$schema;
writeFileSync(".wrangler-e2e.json", JSON.stringify(cfg, null, 2));

const outbox = [];
const mailSink = createServer((req, res) => {
  let b = "";
  req.on("data", (d) => (b += d));
  req.on("end", () => { try { outbox.push(JSON.parse(b)); } catch { /* ignore */ } res.writeHead(200, { "content-type": "application/json" }).end('{"id":"e2e"}'); });
}).listen(MAIL_PORT, "127.0.0.1");
const codeFor = (to) => /(\d{6})/.exec([...outbox].reverse().find((m) => m.to?.[0] === to)?.text ?? "")?.[1] ?? "";
// Fresh local student database with the reviewed migrations (local only — never touches Cloudflare).
rmSync(".wrangler/state", { recursive: true, force: true });
execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "regadrive-students", "--local", "-c", ".wrangler-e2e.json"], { stdio: "inherit", env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" } });

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
  // New users must choose their licence country first (src/app/CountrySelection.tsx). Every test context
  // chooses Germany once, exactly as a learner does; the choice persists in that context's IndexedDB.
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (opts) => {
    const ctx = await newContext(opts);
    const p = await ctx.newPage();
    await p.goto(BASE);
    await p.locator(".country-card:has([lang=de])").click();
    await p.waitForSelector("[data-testid=home]");
    await p.close();
    return ctx;
  };

  await test("API: health, flags OFF, student auth on separate DB, checkout refused", async () => {
    const h = await (await fetch(`${BASE}/api/health`)).json();
    const info = await (await fetch(`${BASE}/build-info.json`)).json();
    assert.equal(info.contentMode, "preview", "E2E must run against the preview build");
    assert.equal(h.database, "off"); assert.equal(h.payments, "off");
    const f = await (await fetch(`${BASE}/api/flags`)).json();
    for (const k of ["paymentsEnabled", "checkoutEnabled", "livePaymentWebhooksEnabled", "purchaseRequired", "databaseProductionEnabled", "aiPaidFallbackEnabled"]) assert.equal(f[k], false, k);
    assert.equal(f.studentAuthEnabled, true, "student accounts enabled");
    assert.deepEqual(await (await fetch(`${BASE}/api/me`)).json(), { authenticated: false });
    assert.equal((await fetch(`${BASE}/api/auth/login`, { method: "POST" })).status, 403, "state changes need the CSRF header");
    assert.equal((await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { origin: "https://evil.example", "x-rd-request": "1", "content-type": "application/json" }, body: "{}" })).status, 403, "cross-origin refused");
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
      await page.locator(".hero-logo").evaluate(async (img) => { if (!img.complete) await new Promise((resolve) => { img.addEventListener("load", resolve, { once: true }); img.addEventListener("error", resolve, { once: true }); }); });
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

  const stored = (page, key) => page.evaluate((k) => new Promise((res) => { const r = indexedDB.open("regadrive"); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get(k); g.onsuccess = () => res(g.result ?? null); }; }), key);
  const noOverflow = async (page, what) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `no horizontal overflow: ${what}`);

  await test("question interaction: title, square checkboxes, change selection, green/red after checking, error points, back/next/jump, modes [iPhone]", async () => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], bypassCSP: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/practice?topic=priority`);
    const card = page.locator("[data-testid=question-card]");
    await card.waitFor();
    assert.equal(await card.getAttribute("data-qid"), "rd-g-003");
    // The question text comes first, the answers below it.
    const y = async (sel) => (await page.locator(sel).first().boundingBox()).y;
    assert.ok(await y("legend.q-prompt") < await y("[data-testid=option-a]"), "question title above the answers");
    // Square checkbox, large enough to tap, empty before selection.
    const box = await page.locator("[data-testid=option-a] input").evaluate((e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { w: r.width, h: r.height, radius: parseFloat(c.borderTopLeftRadius), tick: getComputedStyle(e, "::after").transform }; });
    assert.equal(box.w, box.h, "checkbox is square");
    assert.ok(box.w >= 24 && box.radius <= 8, `checkbox is a clear square: ${JSON.stringify(box)}`);
    const optionHeight = (await page.locator("[data-testid=option-a]").boundingBox()).height;
    assert.ok(optionHeight >= 44, "the whole answer row is a touch target");
    // Tapping the answer text selects it; several can be selected and changed again before handing in.
    await page.locator("[data-testid=option-a] .bi").first().tap();
    await page.locator("[data-testid=option-b] input").check();
    assert.ok(await page.locator("[data-testid=option-a] input").isChecked() && await page.locator("[data-testid=option-b] input").isChecked(), "multiple selection");
    const tick = await page.locator("[data-testid=option-a] input").evaluate((e) => new Promise((res) => setTimeout(() => res(getComputedStyle(e, "::after").transform), 400)));
    assert.notEqual(tick, box.tick, "a tick is drawn inside the selected checkbox");
    await page.locator("[data-testid=option-b] input").uncheck();
    assert.equal(await page.locator("[data-testid=option-b] input").isChecked(), false, "selection can be changed");
    assert.equal(await page.locator("[data-testid=tag-correct], [data-testid=tag-wrong], [data-testid=feedback]").count(), 0, "nothing revealed before checking");
    await page.locator("[data-testid=check]").click();
    await page.locator("[data-testid=feedback].ok").waitFor();
    assert.equal(await page.locator("[data-testid=option-a] [data-testid=tag-correct]").count(), 1, "correct answer labelled in words");
    assert.equal(await page.locator("[data-testid=error-points]").count(), 0, "no error points for a correct answer");
    await page.locator("[data-testid=next]").click();
    // rd-g-004 has two correct answers: one right and one wrong selection must be shown green and red.
    assert.equal(await card.getAttribute("data-qid"), "rd-g-004");
    await page.locator("[data-testid=option-a] input").check();
    await page.locator("[data-testid=option-c] input").check();
    await page.locator("[data-testid=check]").click();
    await page.locator("[data-testid=feedback].bad").waitFor();
    assert.equal(await page.locator("[data-testid=tag-correct]").count(), 2, "both correct answers shown");
    assert.equal(await page.locator("[data-testid=option-c] [data-testid=tag-wrong]").count(), 1, "wrong selection shown");
    assert.ok(await page.locator("[data-testid=option-c]").evaluate((e) => e.classList.contains("is-wrong")) && await page.locator("[data-testid=option-b]").evaluate((e) => e.classList.contains("is-correct")));
    assert.match(await page.textContent("[data-testid=error-points]"), /4/, "error points of the question are shown");
    await axe(page, "practice answer revealed (iPhone)");
    await noOverflow(page, "revealed question");
    await page.screenshot({ path: `${OUT}/question-revealed-iphone.png`, fullPage: true });
    // Going back shows the checked question again, not an empty one, and does not score it twice.
    await page.locator("[data-testid=practice-prev]").click();
    assert.equal(await card.getAttribute("data-qid"), "rd-g-003");
    await page.locator("[data-testid=feedback].ok").waitFor();
    assert.ok(await page.locator("[data-testid=option-a] input").isChecked());
    assert.equal((await stored(page, "progress")).questions["rd-g-003"].attempts, 1);
    // Jump to a question number.
    await page.fill("[data-testid=jump]", "3");
    await page.press("[data-testid=jump]", "Enter");
    assert.equal(await page.textContent(".question-counter"), "3 / " + (await page.textContent(".question-counter")).split("/ ")[1]);
    // Bookmark, then the learning modes: bookmarked, incorrect, unanswered, all.
    await page.locator(".q-meta .chip").click();
    const third = await card.getAttribute("data-qid");
    await page.locator("[data-testid=mode-bookmarks]").click();
    assert.equal(await card.getAttribute("data-qid"), third, "bookmarked mode shows the saved question");
    assert.match(await page.textContent("[data-testid=mode-bookmarks]"), /\(1\)/);
    await page.locator("[data-testid=mode-incorrect]").click();
    assert.equal(await card.getAttribute("data-qid"), "rd-g-004", "incorrect mode shows the mistake");
    await page.locator("[data-testid=mode-unanswered]").click();
    const total = Number(/\((\d+)\)/.exec(await page.textContent("[data-testid=mode-all]"))[1]);
    assert.match(await page.textContent("[data-testid=mode-unanswered]"), new RegExp(`\\(${total - 2}\\)`), "unanswered = all minus the two answered");
    assert.ok(!["rd-g-003", "rd-g-004"].includes(await card.getAttribute("data-qid")));
    // The position is kept across a reload.
    await page.locator("[data-testid=mode-all]").click();
    await page.locator("[data-testid=practice-skip]").click();
    await page.locator("[data-testid=practice-skip]").click();
    const here = await card.getAttribute("data-qid");
    await page.waitForFunction(async (id) => await new Promise((res) => { const r = indexedDB.open("regadrive"); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("practice-resume"); g.onsuccess = () => res(g.result?.questionId === id); }; }), here);
    await page.goto(`${BASE}/practice`);
    await page.locator(`[data-testid=question-card][data-qid=${here}]`).waitFor();
    await ctx.close();
  });

  await test("exam: timer, question overview, flag, answers survive a reload, unanswered warning, full review [desktop + iPhone + iPad]", async () => {
    for (const [name, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["iphone", devices["iPhone 13"]], ["ipad", devices["iPad (gen 7)"]]]) {
      const ctx = await browser.newContext({ ...opts, bypassCSP: true });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/exam`);
      await page.click("[data-testid=exam-start]");
      await page.locator("[data-testid=exam-running]").waitFor();
      assert.equal(await page.locator("[data-testid=exam-timer]").getAttribute("data-timed"), "false", "no time limit unless the learner asks for one");
      assert.match(await page.textContent("[data-testid=exam-timer]"), /^00:0\d$/, "time used is shown");
      assert.equal(await page.locator("[data-testid=question-nav] button").count(), 30, "30 questions in the overview");
      const first = await page.locator("[data-testid=question-card]").getAttribute("data-qid");
      await page.locator("[data-testid=option-a] input").check();
      await page.locator("[data-testid=option-b] input").check();
      await page.click("[data-testid=exam-flag]");
      assert.equal(await page.textContent("[data-testid=exam-answered]"), "1/30");
      assert.ok(await page.locator("[data-testid=nav-1]").evaluate((e) => e.classList.contains("is-answered") && e.classList.contains("is-flagged")));
      await page.click("[data-testid=nav-5]");
      assert.equal(await page.locator("[data-testid=nav-5]").getAttribute("aria-current"), "step");
      assert.equal(await page.locator("[data-testid=feedback], [data-testid=tag-correct]").count(), 0, "no answer disclosed during the exam");
      await axe(page, `exam running (${name})`);
      await noOverflow(page, `exam running (${name})`);
      const small = await page.$$eval("[data-testid=question-nav] button", (els) => els.filter((e) => e.getBoundingClientRect().height < 44 || e.getBoundingClientRect().width < 44).length);
      assert.equal(small, 0, "overview buttons are touch targets ≥ 44px");
      await page.screenshot({ path: `${OUT}/exam-running-${name}.png`, fullPage: true });
      // Reload in the middle of the exam: nothing is lost.
      await page.waitForFunction(() => new Promise((res) => { const r = indexedDB.open("regadrive"); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("exam-session"); g.onsuccess = () => res(g.result?.pos === 4); }; }));
      await page.reload();
      await page.locator("[data-testid=exam-paused]").waitFor();
      await page.click("[data-testid=exam-resume]");
      assert.equal(await page.locator("[data-testid=nav-5]").getAttribute("aria-current"), "step", "same question after reload");
      assert.equal(await page.textContent("[data-testid=exam-answered]"), "1/30");
      await page.click("[data-testid=nav-1]");
      assert.equal(await page.locator("[data-testid=question-card]").getAttribute("data-qid"), first, "same exam after reload");
      assert.ok(await page.locator("[data-testid=option-a] input").isChecked() && await page.locator("[data-testid=option-b] input").isChecked(), "answers restored");
      // Handing in with open questions asks first.
      await page.click("[data-testid=exam-to-end]");
      await page.click("[data-testid=exam-submit]");
      assert.match(await page.textContent("[data-testid=exam-confirm]"), /29/);
      assert.equal(await page.locator("[data-testid=exam-result]").count(), 0);
      await page.click("[data-testid=exam-submit]");
      await page.locator("[data-testid=exam-result]").waitFor();
      assert.ok((await page.textContent("[data-testid=exam-result]")).includes("Nicht bestanden"), "29 open questions cannot pass");
      // Review: mistakes first, every question available, correct answers and own answers visible.
      assert.equal(await page.locator("[data-testid=review-wrong]").getAttribute("aria-pressed"), "true");
      assert.ok(await page.locator("[data-testid=tag-correct]").count() >= 1, "correct answers shown in the review");
      assert.ok(await page.locator("[data-testid=question-card] input").first().isDisabled(), "review is read-only");
      await page.click("[data-testid=review-all]");
      assert.equal(await page.locator("[data-testid=question-nav] button").count(), 30);
      assert.equal(await page.locator("[data-testid=question-card]").getAttribute("data-qid"), first);
      assert.ok(await page.locator("[data-testid=option-a] input").isChecked() && await page.locator("[data-testid=option-b] input").isChecked(), "own answers shown in the review");
      await axe(page, `exam review (${name})`);
      await noOverflow(page, `exam review (${name})`);
      await page.screenshot({ path: `${OUT}/exam-review-${name}.png`, fullPage: true });
      // Scored exactly once; the finished session is gone.
      const progress = await stored(page, "progress");
      assert.equal(progress.examHistory.length, 1);
      assert.equal(Object.keys(progress.questions).length, 30);
      assert.ok(Object.values(progress.questions).every((q) => q.attempts === 1));
      assert.equal(await stored(page, "exam-session"), null);
      await page.goto(`${BASE}/progress`);
      assert.equal(await page.locator("[data-testid=readiness]").getAttribute("data-level"), "learning");
      await ctx.close();
    }
  });

  await test("exam: no time limit by default; optional 45-minute practice limit hands in automatically", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.clock.install();
    await page.goto(`${BASE}/exam`);
    // Without the optional limit nothing is ever handed in automatically.
    await page.click("[data-testid=exam-start]");
    await page.clock.fastForward("02:00:00");
    assert.equal(await page.locator("[data-testid=exam-result]").count(), 0, "no automatic hand-in without a limit");
    assert.match(await page.textContent("[data-testid=exam-timer]"), /^120:0\d$/);
    await page.goto(`${BASE}/exam`);
    await page.locator("[data-testid=exam-timed]").check();
    await page.click("[data-testid=exam-start]");
    assert.equal(await page.locator("[data-testid=exam-timer]").getAttribute("data-timed"), "true");
    await page.locator("[data-testid=option-a] input").check();
    await page.clock.fastForward("44:00");
    assert.match(await page.textContent("[data-testid=exam-timer]"), /^0[01]:\d\d$/);
    assert.ok(await page.locator("[data-testid=exam-timer]").evaluate((e) => e.classList.contains("is-low")), "low time is highlighted");
    await page.clock.fastForward("02:00");
    await page.locator("[data-testid=exam-result]").waitFor();
    assert.ok((await page.textContent("[data-testid=exam-result]")).includes("automatisch abgegeben"));
    assert.equal((await stored(page, "progress")).examHistory.length, 1);
    await ctx.close();
  });

  await test("home: weak-topics empty state starts a real practice; country button is translated; broken screen recovers", async () => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], bypassCSP: true });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector("[data-testid=home]");
    assert.equal(await page.locator("[data-testid=coming-soon]").count(), 0, "nothing is labelled coming soon while content is available");
    const empty = page.locator("[data-testid=weak-empty]");
    assert.ok((await empty.textContent()).includes("Nach abgeschlossenen Übungen"));
    const btn = page.locator("[data-testid=weak-start]");
    assert.ok((await btn.boundingBox()).height >= 44, "touch target");
    await axe(page, "home with empty states");
    await btn.click();
    await page.locator("[data-testid=question-card]").waitFor();
    assert.equal(new URL(page.url()).pathname, "/practice");
    // The country button speaks the learner's language.
    assert.equal(await page.locator("button.country-switch").getAttribute("aria-label"), "گۆڕینی وڵات");
    await page.goto(`${BASE}/settings`);
    await page.click("[data-testid=lang-de]");
    assert.equal(await page.locator("button.country-switch").getAttribute("aria-label"), "Land wechseln");
    await page.click("[data-testid=lang-ckb]");
    await ctx.close();
    // A screen whose code cannot be loaded shows a recoverable message instead of a blank app.
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    const page2 = await ctx2.newPage();
    await page2.route(/\/assets\/Exam-.*\.js$/, (r) => r.abort());
    await page2.goto(BASE);
    await page2.waitForSelector("[data-testid=home]");
    await page2.locator('.sidenav a[href="/exam"]').click();
    await page2.locator("[data-testid=error-boundary]").waitFor();
    assert.equal(await page2.locator(".topbar .brand").count(), 1, "the app shell stays usable");
    await page2.locator('.sidenav a[href="/learn"]').click();
    await page2.locator(".lesson-list").waitFor();
    assert.equal(await page2.locator("[data-testid=error-boundary]").count(), 0, "navigating away clears the error");
    await ctx2.close();
  });

  await test("settings language switch never moves the mobile header [iPhone, as the live smoke test]", async () => {
    const ctx = await browser.newContext(devices["iPhone 13"]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/settings`);
    await page.waitForSelector("[data-testid=lang-ckb]");
    await page.addStyleTag({ content: "[data-testid=preview-banner] { display: none !important; }" });
    const layout = () => page.evaluate(() => [".topbar .brand", ".sidenav", ".tabbar"].map((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && r.width ? [Math.round(r.left), Math.round(r.right)] : null; }));
    const detail = () => page.evaluate(() => [".topbar", ".topbar > :first-child", ".topbar .brand", ".topbar > :last-child", ".country-switch", ".notification-menu"].map((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return `${s}=${r ? `${Math.round(r.left)}..${Math.round(r.right)}` : "none"}`; }).join(" ") + ` scrollW=${document.documentElement.scrollWidth} clientW=${document.documentElement.clientWidth}`);
    const before = await layout();
    const beforeDetail = await detail();
    // While settings load, Shell shows a hidden placeholder instead of the country button; it must take the same space.
    await page.evaluate(() => {
      const btn = document.querySelector("button.country-switch");
      const ph = document.createElement("span");
      ph.className = "country-switch"; ph.setAttribute("aria-hidden", "true"); ph.style.visibility = "hidden"; ph.textContent = "🇩🇪";
      btn.after(ph); btn.style.display = "none";
    });
    assert.deepEqual(await layout(), before, "loading placeholder keeps the header in place");
    await page.evaluate(() => { document.querySelector("span.country-switch").remove(); document.querySelector("button.country-switch").style.display = ""; });
    assert.deepEqual(await layout(), before);
    for (const lang of ["kmr", "ar", "de", "ckb"]) {
      await page.click(`[data-testid=lang-${lang}]`);
      assert.equal(await page.getAttribute("html", "lang"), lang);
      assert.deepEqual(await layout(), before, `header moved in ${lang}\n  ckb: ${beforeDetail}\n  ${lang}: ${await detail()}`);
    }
    await ctx.close();
  });

  await test("header language selector: one compact control, four languages, checkmark, saved choice, bottom sheet on phones", async () => {
    for (const [name, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["tablet", { viewport: { width: 820, height: 1100 } }], ["phone 360", { viewport: { width: 360, height: 740 } }], ["phone 320", { viewport: { width: 320, height: 700 } }]]) {
      // bypassCSP only so the axe test script can be injected; the app itself keeps its strict CSP.
      const ctx = await browser.newContext({ ...opts, bypassCSP: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(BASE);
      await page.waitForSelector("[data-testid=home]");
      await page.addStyleTag({ content: "[data-testid=preview-banner] { display: none !important; }" });
      assert.equal(await page.locator(".language-switch").count(), 0, `${name}: no large language buttons on the home page`);
      assert.equal(await page.locator(".topbar .brand-name").count(), 0, `${name}: no duplicate RegaDRIVE text in the header`);
      assert.equal(await page.locator(".topbar .brand img").count(), 1, `${name}: the official logo stays`);
      const trigger = page.locator("[data-testid=header-lang-trigger]");
      assert.equal((await trigger.locator(".lang-code").textContent()).trim(), "CKB", `${name}: Sorani is the default`);
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.equal(await overflow(), 0, `${name}: no horizontal overflow with the selector`);
      const tb = await trigger.boundingBox();
      assert.ok(tb.width >= 40 && tb.height >= 40, `${name}: the selector is a comfortable touch target (${tb.width}x${tb.height})`);

      await trigger.click();
      const panel = page.locator("[data-testid=header-lang-panel]");
      await panel.waitFor();
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
      assert.deepEqual(await panel.locator(".lang-option-code").allTextContents(), ["CKB", "KMR", "DE", "AR"], `${name}: exactly the four supported languages`);
      assert.equal(await panel.locator(".lang-check svg").count(), 1, `${name}: exactly one checkmark`);
      assert.equal(await panel.locator(".lang-option[aria-pressed=true] .lang-check svg").count(), 1, `${name}: the checkmark marks the active language`);
      const box = await panel.boundingBox();
      const vp = page.viewportSize();
      assert.ok(box.x >= -1 && box.x + box.width <= vp.width + 1, `${name}: the panel stays inside the screen`);
      if (vp.width <= 640) assert.ok(Math.abs(box.y + box.height - vp.height) <= 1, `${name}: phones get a bottom sheet`);
      else assert.ok(box.y >= tb.y + tb.height - 1, `${name}: wide screens get a dropdown under the button`);
      await axe(page, `language selector open (${name})`);
      await page.keyboard.press("Escape");
      assert.equal(await panel.count(), 0, `${name}: Escape closes the selector`);
      assert.ok(await trigger.evaluate((el) => el === document.activeElement), `${name}: focus returns to the button`);

      const headerBox = () => page.evaluate(() => [".topbar .brand", ".lang-trigger"].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }));
      const before = await headerBox();
      for (const [id, code] of [["kmr", "KMR"], ["de", "DE"], ["ar", "AR"], ["ckb", "CKB"]]) {
        await trigger.click();
        await page.click(`[data-testid=header-lang-${id}]`);
        assert.equal(await page.getAttribute("html", "lang"), id);
        assert.equal(await page.getAttribute("html", "dir"), "rtl", "the layout never mirrors");
        assert.equal((await trigger.locator(".lang-code").textContent()).trim(), code);
        assert.equal(await panel.count(), 0, `${name}: choosing a language closes the selector`);
        assert.deepEqual(await headerBox(), before, `${name}: the header does not move in ${id}`);
        assert.equal(await overflow(), 0, `${name}: no horizontal overflow in ${id}`);
      }
      await trigger.click();
      await page.click("[data-testid=header-lang-ar]");
      await page.waitForTimeout(400);
      await page.reload();
      await page.waitForSelector("[data-testid=home]");
      assert.equal(await page.getAttribute("html", "lang"), "ar", `${name}: the saved language is kept after a reload`);
      assert.equal((await page.locator("[data-testid=header-lang-trigger] .lang-code").textContent()).trim(), "AR");
      await page.screenshot({ path: `${OUT}/header-lang-${name.replace(" ", "-")}.png` });
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });

  await test("languages: Sorani, Kurmanji, Arabic and German change the words, never the layout", async () => {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      // bypassCSP only so the axe test script can be injected; the app itself keeps its strict CSP.
      const ctx = await browser.newContext({ viewport, bypassCSP: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(BASE);
      await page.waitForSelector("[data-testid=home]");
      // The preview-only test banner (never shown in production) has a different length per language.
      await page.addStyleTag({ content: "[data-testid=preview-banner] { display: none !important; }" });
      // Horizontal edges and vertical positions: nothing may move sideways or up and down.
      const boxes = () => page.evaluate(() => [".topbar .brand", ".lang-trigger", ".hero-logo", ".tabbar", ".sidenav", ".overview-card", ".learning-cta", ".home-menu"].map((sel) => {
        const el = document.querySelector(sel); const r = el?.getBoundingClientRect();
        return r && r.width > 0 ? [sel, Math.round(r.left), Math.round(r.right), Math.round(r.top + scrollY), Math.round(r.height)] : [sel, null];
      }));
      const before = await boxes();
      for (const lang of ["kmr", "ar", "de", "ckb"]) {
        await page.click("[data-testid=header-lang-trigger]");
        await page.click(`[data-testid=header-lang-${lang}]`);
        assert.equal(await page.locator("[data-testid=header-lang-panel]").count(), 0, "the selector closes after choosing");
        assert.equal(await page.getAttribute("html", "lang"), lang);
        assert.equal(await page.getAttribute("html", "dir"), "rtl", "the layout never mirrors");
        assert.deepEqual(await boxes(), before, `layout moved after switching to ${lang}`);
        assert.equal(await page.getAttribute("#home-title .pri", "lang"), lang);
        assert.ok((await page.textContent("#home-title .pri")).trim().length > 3);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.equal(overflow, 0, `no horizontal overflow in ${lang}`);
        if (viewport.width === 1280 && (lang === "kmr" || lang === "ar")) await axe(page, `home (${lang})`);
        await page.screenshot({ path: `${OUT}/home-${viewport.width}-${lang}.png` });
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });

  await test("student account: register → e-mail code → verify → log out → log in; reset; local progress kept [iPhone]", async () => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], bypassCSP: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const email = `e2e-${Date.now()}@example.de`;
    const pw = "E2E-sicheres-Passwort";
    // Local progress before having an account.
    await page.goto(`${BASE}/practice?topic=priority`);
    await page.locator("[data-testid=option-a] input").check();
    await page.locator("[data-testid=check]").click();
    await page.locator("[data-testid=feedback]").waitFor();
    const before = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("regadrive"); r.onsuccess = () => { try { const tx = r.result.transaction(r.result.objectStoreNames[0], "readonly"); const g = tx.objectStore(r.result.objectStoreNames[0]).get("progress"); g.onsuccess = () => res(Object.keys(g.result?.questions ?? {}).length); g.onerror = () => res(-1); } catch { res(-1); } }; r.onerror = () => res(-1); }));

    assert.ok(before > 0, "a local answer was stored before signing in");
    await page.goto(`${BASE}/account`);
    await page.locator("[data-testid=signin-form]").waitFor();
    await axe(page, "/account sign-in");
    await page.click("[data-testid=to-register]");
    await page.locator("[data-testid=register-form]").waitFor();
    await page.fill("[data-testid=auth-name]", "E2E");
    await page.fill("[data-testid=auth-email]", email);
    await page.fill("[data-testid=auth-password]", "kurz");
    await page.click("[data-testid=register-submit]");
    // Browser validation (minLength) or server validation stops weak passwords.
    assert.equal(await page.locator("[data-testid=verify-form]").count(), 0);
    await page.fill("[data-testid=auth-password]", pw);
    await axe(page, "/account register");
    await page.click("[data-testid=register-submit]");
    await page.locator("[data-testid=verify-form]").waitFor();
    await axe(page, "/account verify");
    await page.screenshot({ path: `${OUT}/account-verify-iphone.png`, fullPage: true });
    const code = codeFor(email);
    assert.match(code, /^\d{6}$/, "verification e-mail delivered to the sink");
    await page.fill("[data-testid=auth-code]", code === "000000" ? "111111" : "000000");
    await page.click("[data-testid=verify-submit]");
    await page.locator("[data-testid=auth-error]").waitFor();
    await page.fill("[data-testid=auth-code]", code);
    await page.click("[data-testid=verify-submit]");
    await page.locator("[data-testid=account-signed-in]").waitFor();
    assert.equal(await page.textContent("[data-testid=account-email]"), email);
    const cookies = await ctx.cookies();
    const sess = cookies.find((c) => c.name === "__Host-rd_session");
    assert.ok(sess && sess.httpOnly && sess.sameSite === "Lax" && sess.path === "/", "HttpOnly SameSite session cookie");
    assert.equal(await page.evaluate(() => document.cookie.includes("rd_session")), false, "token invisible to JavaScript");
    await axe(page, "/account signed in");
    await page.screenshot({ path: `${OUT}/account-signed-in-iphone.png`, fullPage: true });
    // Compact layout: account, learning progress and settings are separate; every label appears once.
    assert.equal(await page.locator("[data-testid=account-signed-in] .acct-section").count(), 3, "three separate sections");
    assert.equal(await page.locator("[data-testid=account-signed-in] .bi .de").count(), 0, "no duplicated German second line");
    assert.equal(await page.getAttribute("[data-testid=account-verified]", "data-verified"), "true", "verified e-mail shown");
    assert.match(await page.textContent("[data-testid=account-licence]"), /B/, "selected licence class shown");
    // Real figures only: the counts equal the learner's stored progress.
    const answeredText = (await page.textContent("[data-testid=account-answered] .acct-stat-value")).trim();
    assert.equal(Number(answeredText.split("/")[0]), before, "answered count comes from local progress");
    await page.locator("[data-testid=sync-status][data-state=none]").waitFor();
    const small = await page.$$eval("[data-testid=account-signed-in] button, [data-testid=account-signed-in] a, [data-testid=legal-nav] a", (els) => els.filter((e) => e.offsetParent && (e.getBoundingClientRect().height < 44 || e.getBoundingClientRect().width < 44)).length);
    assert.equal(small, 0, "account and legal footer touch targets ≥ 44px");
    // Nothing is hidden behind the floating bottom navigation.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const clear = await page.evaluate(() => { const last = document.querySelector("[data-testid=settings-all]").getBoundingClientRect(); const bar = document.querySelector(".tabbar").getBoundingClientRect(); return last.bottom <= bar.top; });
    assert.ok(clear, "last account row stays above the bottom navigation");
    await page.click("[data-testid=backup]");
    await page.locator("[data-testid=auth-info]").waitFor();
    await page.locator("[data-testid=sync-status][data-state=saved]").waitFor();
    await page.click("[data-testid=restore]");
    await page.locator("[data-testid=auth-info]").waitFor();
    await page.screenshot({ path: `${OUT}/account-synced-iphone.png`, fullPage: true });

    await page.click("[data-testid=logout]");
    await page.locator("[data-testid=signin-form]").waitFor();
    assert.deepEqual(await (await page.request.get(`${BASE}/api/me`)).json(), { authenticated: false });
    await page.fill("[data-testid=auth-email]", email);
    await page.fill("[data-testid=auth-password]", "falsches-Passwort-1");
    await page.click("[data-testid=signin-submit]");
    await page.locator("[data-testid=auth-error]").waitFor();
    await page.fill("[data-testid=auth-password]", pw);
    await page.click("[data-testid=signin-submit]");
    await page.locator("[data-testid=account-signed-in]").waitFor();
    await page.reload();
    await page.locator("[data-testid=account-signed-in]").waitFor(); // persistent session

    // Forgot / reset.
    await page.click("[data-testid=logout]");
    await page.locator("[data-testid=signin-form]").waitFor();
    await page.click("[data-testid=to-forgot]");
    await page.fill("[data-testid=auth-email]", email);
    await page.click("[data-testid=forgot-submit]");
    await page.locator("[data-testid=reset-form]").waitFor();
    await axe(page, "/account reset");
    await page.fill("[data-testid=auth-code]", codeFor(email));
    await page.fill("[data-testid=auth-password]", "Neues-E2E-Passwort");
    await page.click("[data-testid=reset-submit]");
    await page.locator("[data-testid=signin-form] [data-testid=auth-info]").waitFor();
    await page.fill("[data-testid=auth-email]", email);
    await page.fill("[data-testid=auth-password]", "Neues-E2E-Passwort");
    await page.click("[data-testid=signin-submit]");
    await page.locator("[data-testid=account-signed-in]").waitFor();

    // Local progress was never replaced.
    const after = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("regadrive"); r.onsuccess = () => { try { const tx = r.result.transaction(r.result.objectStoreNames[0], "readonly"); const g = tx.objectStore(r.result.objectStoreNames[0]).get("progress"); g.onsuccess = () => res(Object.keys(g.result?.questions ?? {}).length); g.onerror = () => res(-1); } catch { res(-1); } }; r.onerror = () => res(-1); }));
    assert.equal(after, before, "local progress preserved across sign-in, sign-out and reset");

    // German (LTR words, fixed RTL layout) and account deletion.
    await page.goto(`${BASE}/settings`);
    await page.click("[data-testid=lang-de]");
    // Settings are written to IndexedDB after the click; leaving the page before the write is committed
    // would load the old language again (seen on a fast CI runner). Wait for the stored value first.
    await page.waitForFunction(() => new Promise((res) => { const r = indexedDB.open("regadrive"); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("settings"); g.onsuccess = () => res(g.result?.lang === "de"); }; }));
    await page.goto(`${BASE}/account`);
    await page.locator("[data-testid=account-signed-in]").waitFor();
    assert.equal(await page.getAttribute("html", "dir"), "rtl");
    assert.match(await page.textContent("[data-testid=logout]"), /Abmelden/);
    assert.equal(await page.getAttribute("#auth-heading", "dir"), "ltr", "German labels read left-to-right");
    await axe(page, "/account signed in (de)");
    await page.screenshot({ path: `${OUT}/account-signed-in-de-iphone.png`, fullPage: true });
    await page.click("[data-testid=delete-start]");
    await page.click("[data-testid=delete-cancel]");
    assert.equal(await page.locator("[data-testid=delete-form]").count(), 0, "deletion can be cancelled");
    await page.click("[data-testid=delete-start]");
    await page.fill("[data-testid=delete-form] [data-testid=auth-password]", "Neues-E2E-Passwort");
    await page.click("[data-testid=delete-confirm]");
    await page.locator("[data-testid=signin-form] [data-testid=auth-info]").waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, "no horizontal overflow");
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await test("purchase disabled, services show no invented data", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/access`);
    assert.equal(await page.locator("[data-testid=buy]").count(), 0, "no inactive purchase action is presented");
    assert.match(await page.textContent("[data-testid=purchase]"), /Derzeit kostenlos|ئێستا بەخۆڕاییە/);
    assert.doesNotMatch(await page.textContent("[data-testid=purchase]"), /€20/, "no unapproved planned price is presented");
    assert.equal(await page.locator("input[autocomplete^=cc-], input[name*=card]").count(), 0, "no card fields");
    await page.goto(`${BASE}/services`);
    await page.click("form button[type=submit]");
    await page.locator("[data-testid=services-unavailable]").waitFor();
    await page.goto(`${BASE}/about`);
    await page.locator("#impressum").waitFor();
    await page.locator("#privacy").waitFor();
    assert.match(await page.locator("#privacy").textContent(), /Cloudflare/);
    assert.equal(await page.locator("nav a[href='/about#impressum']").count(), 1);
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
    // The owner workbench: bank progress, workflow, storage status (needs the /dr session), licence checklist.
    assert.ok((await page.textContent("[data-testid=content-progress]")).includes("NOT complete"));
    assert.ok((await page.textContent("[data-testid=content-workflow]")).includes("EDUCATIONAL_REVIEW"));
    await page.waitForFunction(() => document.querySelector("[data-testid=content-storage]")?.textContent?.includes("Sign in at /dr"));
    assert.ok((await page.textContent("[data-testid=license-report]")).includes("No licence on record"));
    assert.ok((await page.textContent("[data-testid=media-table]")).includes("fixture.png"));
    // A draft licence (not bought / not verified) rejects every licensed row; a verified one with rights accepts them.
    const licence = (over) => ({ licenses: [{ id: "LIC-FIXTURE", country: "DE", licensor: "Fixture", scope: "test", status: "verified", validFrom: "2026-01-01", validUntil: null, evidenceRef: "c-1", verifiedBy: "Owner", verifiedOn: "2026-01-02", catalogueVersions: ["2026-01-01"], licenseClasses: ["B"], rights: { questionText: true, officialMedia: true, translation: true, ownMedia: true, online: true, offline: true }, ...over }] });
    const register = (over) => ({ name: "register.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(licence(over))) });
    await page.setInputFiles("[data-testid=register-file]", register({ status: "draft", verifiedBy: null, verifiedOn: null }));
    await page.click("[data-testid=validate]");
    await page.waitForFunction(() => document.querySelector("[data-testid=summary]")?.textContent?.includes("invalid: 2"));
    assert.ok((await page.textContent("[data-testid=preview]")).includes("not verified by the owner"));
    await page.setInputFiles("[data-testid=register-file]", register({}));
    assert.ok((await page.textContent("[data-testid=license-report]")).includes("✓ Right: Sorani translation"));
    await page.click("[data-testid=validate]");
    await page.waitForFunction(() => document.querySelector("[data-testid=summary]")?.textContent?.includes("invalid: 0"));
    // Coverage is measured, never assumed: 2 valid records of 1,600, nothing ready, plan per topic shown.
    const report = await page.textContent("[data-testid=catalog-report]");
    assert.ok(report.includes("of target 1600") && report.includes("NOT complete"), report);
    assert.ok((await page.textContent("[data-testid=plan-report]")).includes("priority (Grundstoff): 1 / 180 valid, 0 ready"));
    // A media manifest that does not describe the attached file approves nothing.
    await page.setInputFiles("[data-testid=manifest-file]", { name: "manifest.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ scenarios: [], media: [{ file: "fixture.png", kind: "image", sha256: "0".repeat(64), origin: "original_regadrive", author: "x", tool: "Blender", sourceFile: "a.blend", thirdPartyAssets: [], aiGenerated: false, scenarioId: "none", createdOn: "2026-11-01", reviews: [] }] })) });
    const manifest = await page.textContent("[data-testid=manifest-report]");
    assert.ok(manifest.includes("approved: 0") && manifest.includes("hash_mismatch") && manifest.includes("no_instructor_review") && manifest.includes("unknown_scenario"), manifest);
    assert.ok((await page.textContent("[data-testid=catalog-report]")).includes("media_not_approved: 1"));
    assert.equal(await page.locator("[data-testid=preview-row]").count(), 2);
    assert.ok(await page.locator("[data-testid=commit]").isDisabled(), "import execution disabled");
    assert.equal(await page.locator("text=draft · hidden").count(), 2, "imports are draft and hidden");
    await axe(page, "/admin/import");
    // Without the licence registered (no id and no register file), every row is rejected.
    await page.setInputFiles("[data-testid=register-file]", []);
    await page.fill("[data-testid=licences]", "");
    await page.click("[data-testid=validate]");
    await page.waitForFunction(() => document.querySelector("[data-testid=summary]")?.textContent?.includes("invalid: 2"));
    await page.screenshot({ path: `${OUT}/admin-import.png`, fullPage: true });
    await ctx.close();
  });

  await test("language settings: German-only, translation without German, Arabic practice question", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, bypassCSP: true });
    const page = await ctx.newPage();
    // Settings are written to IndexedDB asynchronously; wait for the durable value before a full reload.
    const saved = (lang) => page.waitForFunction((l) => new Promise((res) => { const r = indexedDB.open("regadrive"); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("settings"); g.onsuccess = () => res(g.result?.lang === l); g.onerror = () => res(false); }; r.onerror = () => res(false); }), lang);
    await page.goto(`${BASE}/settings`);
    await page.click("[data-testid=lang-de]");
    await saved("de");
    assert.equal(await page.getAttribute("html", "dir"), "rtl");
    await page.goto(BASE);
    await page.waitForSelector("[data-testid=home]");
    assert.equal(await page.locator(".bi > .de:not(.ghost)").count(), 0, "German is the main text, not a second line");
    assert.equal(await page.locator("[lang=ckb]").count(), 0);
    await page.screenshot({ path: `${OUT}/home-desktop-de.png` });
    await page.goto(`${BASE}/settings`);
    await page.click("[data-testid=lang-kmr]");
    await page.click("[data-testid=with-german-off]");
    assert.equal(await page.locator(".bi > .de").count(), 0);
    await page.click("[data-testid=with-german-on]");
    assert.ok(await page.locator(".bi > .de").count() > 0);
    await page.click("[data-testid=lang-ar]");
    await saved("ar");
    await page.goto(`${BASE}/practice?topic=priority`);
    const card = page.locator("[data-testid=question-card]").first();
    await card.waitFor();
    const order = await card.locator("legend .bi > span").evaluateAll((els) => els.map((e) => [e.getAttribute("lang"), e.getAttribute("dir")]));
    assert.deepEqual(order, [["ar", "rtl"], ["de", "ltr"]]);
    await axe(page, "practice (ar)");
    await page.screenshot({ path: `${OUT}/practice-desktop-ar.png` });
    await ctx.close();
  });

  // Mirrors the live smoke check: a real phone (touch, isMobile) on /settings must keep the header in place in every language.
  await test("mobile phone emulation: settings header never moves between languages", async () => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], bypassCSP: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/settings`);
    await page.waitForSelector("[data-testid=lang-kmr]");
    await page.addStyleTag({ content: "[data-testid=preview-banner] { display: none !important; }" });
    await page.evaluate(() => document.fonts.ready);
    const snap = () => page.evaluate(() => {
      const box = (s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && r.width ? [Math.round(r.left), Math.round(r.right)] : null; };
      const wide = [...document.querySelectorAll("body *")].map((e) => ({ e, r: e.getBoundingClientRect() })).filter((x) => x.r.right > innerWidth + 1 || x.r.left < -1)
        .slice(0, 6).map((x) => `${x.e.tagName.toLowerCase()}.${String(x.e.className).slice(0, 40)}[${Math.round(x.r.left)},${Math.round(x.r.right)}]`);
      const bn = document.querySelector(".brand-name");
      return { layout: [".topbar .brand", ".sidenav", ".tabbar"].map(box), innerWidth, docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        vvScale: window.visualViewport?.scale, brandFont: bn ? getComputedStyle(bn).fontSize : null, brandDisplay: bn ? getComputedStyle(bn).display : null, wide };
    });
    const before = await snap();
    for (const lang of ["kmr", "ar", "de", "ckb"]) {
      await page.click(`[data-testid=lang-${lang}]`);
      const after = await snap();
      assert.deepEqual(after.layout, before.layout, `header moved in ${lang}\nbefore=${JSON.stringify(before)}\nafter=${JSON.stringify(after)}`);
    }
    await ctx.close();
  });

  await test("reference navigation, lesson filters and narrow layouts", async () => {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE);
    await page.click("[data-testid=header-lang-trigger]");
    await page.click("[data-testid=header-lang-ckb]");
    const hrefs = await page.locator(".tabbar a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    // Owner instruction 2026-11-12: the primary navigation is Learn, Practice, Exam; everything else is under "More".
    assert.deepEqual(hrefs, ["/", "/learn", "/practice", "/exam", "/more"]);
    await page.locator('.tabbar a[href="/more"]').click();
    await page.locator('main .list a[href="/account"]').waitFor();
    const more = await page.locator("main .list a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    for (const href of ["/account", "/progress", "/settings", "/signs", "/vocabulary", "/about"]) assert.ok(more.includes(href), `${href} stays reachable from More`);
    await page.locator('.tabbar a[href="/learn"]').click();
    await page.locator(".lesson-list > li").first().waitFor(); // the screen's code is loaded on demand
    const all = await page.locator(".lesson-list > li").count();
    assert.ok(all > 0);
    await page.locator(".lesson-filters button").nth(3).click();
    assert.equal(await page.locator(".lesson-list > li").count(), 0);
    await page.locator(".lesson-filters button").nth(2).click();
    assert.equal(await page.locator(".lesson-list > li").count(), all);
    await page.locator(".lesson-list a").first().click();
    const completedLessonId = decodeURIComponent(new URL(page.url()).pathname.split("/").pop());
    await page.locator("[data-testid=lesson-done]").click();
    // A full navigation destroys the document. Wait for the asynchronous
    // IndexedDB write, and fail if persistence never completes, before reload.
    await page.waitForFunction((id) => new Promise((resolve, reject) => {
      const request = indexedDB.open("regadrive");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("kv", "readonly");
        const saved = transaction.objectStore("kv").get("progress");
        saved.onsuccess = () => resolve(saved.result?.completedLessons?.includes(id) === true);
        saved.onerror = () => reject(saved.error);
        transaction.oncomplete = () => db.close();
      };
    }), completedLessonId, { timeout: 5000 });
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

  await test("/dr owner control center: sign-in page, fail-closed API, accessible on iPhone", async () => {
    const s = await (await fetch(`${BASE}/api/dr/session`)).json();
    assert.equal(s.authenticated, false);
    assert.match(s.to, /^re•+@gmail\.com$/, "only the masked owner address is shown");
    assert.equal((await fetch(`${BASE}/api/dr/overview`)).status, 401, "no data without a session");
    assert.equal((await fetch(`${BASE}/api/dr/auth/request`, { method: "POST" })).status, 403, "mutations need the x-dr-request header");
    assert.equal((await fetch(`${BASE}/api/dr/features`, { method: "POST", headers: { "x-dr-request": "1" }, body: JSON.stringify({ key: "payments", state: "ON" }) })).status, 401);
    const ctx = await browser.newContext({ ...devices["iPhone 13"], bypassCSP: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${BASE}/dr`);
    await page.getByRole("button", { name: "ناردنی کۆدی چوونەژوورەوە" }).waitFor();
    assert.equal(await page.locator(".tabbar").count(), 0, "student navigation is not shown on /dr");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "no horizontal overflow");
    await axe(page, "/dr");
    await page.screenshot({ path: `${OUT}/dr-login-iphone.png`, fullPage: true });
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
    // Screens that were never opened online work too: their code is precached by the service worker.
    for (const [path, sel] of [["/exam", "[data-testid=exam-start]"], ["/progress", "[data-testid=readiness]"], ["/signs", "main h1"]]) {
      await page.goto(`${BASE}${path}`);
      await page.locator(sel).first().waitFor();
      assert.equal(await page.locator("[data-testid=error-boundary]").count(), 0, `${path} works offline`);
    }
    await ctx.setOffline(false);
    await ctx.close();
  });
} finally {
  await browser?.close();
  dev.kill("SIGTERM");
  mailSink.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} E2E tests passed`);
process.exit(failed ? 1 : 0);
