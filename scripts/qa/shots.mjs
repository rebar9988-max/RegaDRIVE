// Temporary QA renderer (scratch branch only, never merged).
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const PORT = 8790, BASE = `http://127.0.0.1:${PORT}`, OUT = "qa-out";
mkdirSync(OUT, { recursive: true });
const cfg = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));
delete cfg.ai; delete cfg.$schema; cfg.vars = { ...cfg.vars, CONTENT_MODE: "preview" };
writeFileSync(".wrangler-qa.json", JSON.stringify(cfg));
const dev = spawn("npx", ["wrangler", "dev", "-c", ".wrangler-qa.json", "--port", String(PORT), "--ip", "127.0.0.1", "--show-interactive-dev-session=false"], { stdio: "ignore" });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
const browser = await chromium.launch();
async function shoot(name, path, viewport, lang, prep) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.locator(`.language-switch button[lang=${lang}]`).click();
  if (path !== "/") await page.goto(BASE + path);
  await page.locator("main h1").first().waitFor();
  if (prep) await prep(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
  await ctx.close();
}
const phone = { width: 390, height: 844 };
const answer = async (page) => { await page.locator("[data-testid^=option-]").first().click(); await page.locator("[data-testid=check]").click(); await page.locator("[data-testid=feedback]").waitFor(); };
await shoot("home-ckb", "/", phone, "ckb");
await shoot("learn-ckb", "/learn", phone, "ckb");
await shoot("practice-ckb", "/practice", phone, "ckb", answer);
await shoot("progress-ckb", "/progress", phone, "ckb");
await shoot("home-de", "/", phone, "de");
await shoot("home-320", "/", { width: 320, height: 700 }, "ckb");
await shoot("home-desktop", "/", { width: 1366, height: 900 }, "ckb");
await browser.close(); dev.kill();
process.exit(0);
