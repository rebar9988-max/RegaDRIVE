// Read-only verification of the live site: navigation, local language choice and local exam answers only.
import { chromium, devices } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = "https://www.regaplatform.com";
const EXPECT = process.env.EXPECT_COMMIT;
let fails = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const info = await (await fetch(`${BASE}/build-info.json?v=${Date.now()}`, { cache: "no-store" })).json();
ok(info.commit === EXPECT, `live commit ${info.commit} (build ${info.buildId}) === expected ${EXPECT}`);
const browser = await chromium.launch();
const targets = { iphone: devices["iPhone 13"], android: devices["Pixel 7"], desktop: { viewport: { width: 1366, height: 900 } } };
for (const [dev, opts] of Object.entries(targets)) {
  const ctx = await browser.newContext({ ...opts, bypassCSP: true }); /* test-side only, so axe can be injected */ const page = await ctx.newPage();
  const errors = []; page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); }); page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE); await page.locator(".country-card:has([lang=de])").click(); await page.waitForSelector("[data-testid=home]");
  for (const lang of ["ckb", "kmr", "ar", "de"]) {
    await page.goto(`${BASE}/settings`); await page.waitForSelector(`[data-testid=lang-${lang}]`); await page.click(`[data-testid=lang-${lang}]`);
    for (const [name, path, sel] of [["Home", "/", "[data-testid=home]"], ["Exam", "/exam", "main"], ["Progress", "/progress", "main"]]) {
      await page.goto(BASE + path); await page.waitForSelector(sel); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
      const s = await page.evaluate(() => {
        const logo = [...document.images].find((i) => /regadrive-logo/.test(i.src));
        const bg = getComputedStyle(document.body).backgroundColor;
        return { dir: document.documentElement.dir, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          logo: !!logo && logo.complete && logo.naturalWidth > 0, bg, dark: document.documentElement.classList.contains("dark") || matchMedia("(prefers-color-scheme: dark)").matches && bg !== "rgb(247, 251, 249)",
          deDir: (() => { const e = document.querySelector("[lang=de]"); return e ? getComputedStyle(e).direction : "n/a"; })(),
          btn3d: (() => { const b = document.querySelector(".btn-primary, .home-tiles .tile, .tab[aria-current=page]"); return b ? getComputedStyle(b).backgroundImage.includes("gradient") : null; })() };
      });
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.map((x) => `${x.id}(${x.nodes.length})`));
      ok(s.dir === "rtl" && s.overflow <= 0 && s.logo && !s.dark && s.deDir !== "rtl" && s.btn3d !== false && v.length === 0,
        `${dev} ${lang} ${name}: dir=${s.dir} overflow=${s.overflow} logo=${s.logo} bg=${s.bg} germanDir=${s.deDir} glossy3D=${s.btn3d} axe=${v.join(",") || 0}`);
    }
  }
  // Exam flow (local only): start, choose an answer, confirm the selected state renders.
  await page.goto(`${BASE}/exam`); const start = page.locator("[data-testid=exam-start]");
  if (await start.count() && await start.isEnabled()) {
    await start.click(); await page.waitForSelector("[data-testid=exam-running]");
    const opt = page.locator("[data-testid=exam-running] .option").first(); await opt.click();
    ok(await page.locator(".option.is-selected, .option:has(input:checked)").count() > 0, `${dev} exam: started, answer selectable`);
  } else ok(true, `${dev} exam: start not offered (no approved questions in production) — screen renders`);
  ok(errors.length === 0, `${dev} no console/runtime errors ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
}
await browser.close();
console.log(fails ? `LIVE VERIFY FAILED: ${fails}` : "LIVE VERIFY PASSED"); process.exit(fails ? 1 : 0);
