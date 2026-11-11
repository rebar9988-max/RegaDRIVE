// Exits 0 only if Playwright's Chromium really launches and renders a page on this machine.
// CI uses it to install OS packages only when they are actually missing.
import { chromium } from "playwright";

try {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent("<p>ok</p>");
  const text = await page.textContent("p");
  await browser.close();
  if (text !== "ok") throw new Error("Chromium launched but did not render");
  console.log("Chromium ready");
} catch (e) {
  console.error(`Chromium not ready: ${e.message}`);
  process.exit(1);
}
