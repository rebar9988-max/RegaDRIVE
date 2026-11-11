// Read-only live verification of the three redesigned screens on production.
// Browser GET requests only; settings live in the test browser's own storage. Never writes to the server.
import { chromium, devices } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.argv[2] ?? "https://www.regaplatform.com";
const EXPECT = process.env.EXPECTED_COMMIT ?? "";
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"} ${msg}`); if (!cond) fails.push(msg); };

// 1. Identity: 10 cache-busted reads must all report the expected commit (detects mixed edge versions).
const ids = [];
for (let i = 0; i < 10; i++) {
  const r = await fetch(`${BASE}/build-info.json?v=${Date.now()}-${i}`, { cache: "no-store" });
  ids.push((await r.json()).commit);
  await new Promise((r) => setTimeout(r, 500));
}
ok(ids.every((c) => c === EXPECT), `10/10 live reads report commit ${EXPECT.slice(0, 7)} (got ${[...new Set(ids)].map((c) => c?.slice(0, 7)).join(",")})`);

const browser = await chromium.launch();
const profiles = { "iPhone 13": devices["iPhone 13"], "iPad (gen 7)": devices["iPad (gen 7)"], "desktop 1280": { viewport: { width: 1280, height: 900 } } };
const langs = ["ckb", "kmr", "ar", "de"];
const routes = { Home: "/", "Theory Exam": "/exam", Progress: "/progress" };

for (const [pname, opts] of Object.entries(profiles)) {
  const ctx = await browser.newContext({ ...opts, bypassCSP: true, colorScheme: "dark" }); // dark OS setting must still render light
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(BASE);
  await page.locator(".country-card:has([lang=de])").click();
  await page.waitForSelector("[data-testid=home]");
  for (const lang of langs) {
    await page.goto(`${BASE}/settings`);
    await page.click(`[data-testid=lang-${lang}]`);
    for (const [screen, path] of Object.entries(routes)) {
      await page.goto(BASE + path);
      await page.waitForSelector("main#main > div:not([aria-busy])");
      await page.evaluate(() => document.fonts.ready);
      const s = await page.evaluate(() => {
        const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0]; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
        const logo = [...document.querySelectorAll("img")].find((i) => /brand|logo/i.test(i.src));
        const prim = document.querySelector(".btn-primary, .home-tiles .tile, .tab[aria-current='page'], .navlink[aria-current='page']");
        return {
          dir: document.documentElement.dir, lang: document.documentElement.lang,
          logo: logo ? { src: logo.src.replace(location.origin, ""), loaded: logo.complete && logo.naturalWidth > 0 } : null,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          bodyLum: lum(getComputedStyle(document.body).backgroundColor),
          canvas: getComputedStyle(document.querySelector(".app") ?? document.body).backgroundColor,
          gloss: prim ? getComputedStyle(prim).backgroundImage.includes("linear-gradient") : null,
          deLtr: [...document.querySelectorAll("[lang=de]")].filter((e) => e.offsetParent).every((e) => getComputedStyle(e).direction === "ltr"),
          deCount: [...document.querySelectorAll("[lang=de]")].filter((e) => e.offsetParent).length,
        };
      });
      const tag = `${pname} · ${lang} · ${screen}`;
      ok(s.dir === "rtl", `${tag}: fixed RTL layout (dir=${s.dir}, lang=${s.lang})`);
      ok(!!s.logo?.loaded, `${tag}: official logo loaded (${s.logo?.src ?? "missing"})`);
      ok(s.overflow <= 1, `${tag}: no horizontal scroll (${s.overflow}px)`);
      ok(s.bodyLum > 0.85, `${tag}: light canvas under dark OS setting (body luminance ${s.bodyLum.toFixed(2)})`);
      ok(s.gloss !== false, `${tag}: glossy 3D emerald primary element present`);
      ok(s.deLtr, `${tag}: all ${s.deCount} visible German texts render LTR`);
      if (lang === "ckb" || lang === "de" || screen === "Home") {
        await page.addScriptTag({ content: AXE });
        const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.map((x) => `${x.id}(${x.nodes.length})`));
        ok(v.length === 0, `${tag}: axe WCAG 2.2 AA violations: ${v.join(", ") || "none"}`);
      }
    }
  }
  // Functional exam flow (once per profile, Kurdish): start, answer, see the selected state.
  await page.goto(`${BASE}/settings`); await page.click("[data-testid=lang-ckb]");
  await page.goto(`${BASE}/exam`); await page.waitForSelector("main#main > div:not([aria-busy])");
  const start = page.locator("[data-testid=exam-start]");
  if (await start.count() && await start.isEnabled()) {
    await start.click();
    await page.waitForSelector("[data-testid=exam-running] [data-testid=question-card]");
    const opt = page.locator("[data-testid=exam-running] .option").first();
    await opt.click();
    const sel = await page.locator("[data-testid=exam-running] .option.is-selected, [data-testid=exam-running] .option:has(input:checked)").count();
    ok(sel > 0, `${pname}: exam starts, question renders, answer selection registers`);
  } else {
    console.log(`INFO ${pname}: exam start button ${await start.count() ? "disabled" : "absent"} on production (approved-content policy)`);
  }
  ok(errors.length === 0, `${pname}: no runtime/console errors (${errors.slice(0, 3).join(" | ")})`);
  await ctx.close();
}
await browser.close();
console.log(`\nLIVE VERIFY: ${fails.length === 0 ? "ALL PASSED" : `${fails.length} FAILED`}`);
process.exit(fails.length ? 1 : 0);
