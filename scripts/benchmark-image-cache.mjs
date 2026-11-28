// Controlled local repeat-navigation benchmark; not a production CWV measurement.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const bytes = readFileSync('public/brand/regadrive-banner.webp');
const headers = readFileSync('public/_headers', 'utf8');
const after = headers.match(/\/brand\/\*\n {2}! Cache-Control\n {2}Cache-Control: ([^\n]+)/)?.[1];
if (!after) throw new Error('Missing brand cache policy');
const browser = await chromium.launch();
try {
  for (const policy of ['public, max-age=0, must-revalidate, no-transform', after]) {
    let requests = 0;
    const server = createServer((req, res) => {
      if (req.url === '/banner.webp') {
        requests++;
        res.writeHead(200, { 'content-type': 'image/webp', 'cache-control': policy }).end(bytes);
      } else res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }).end('<img src="/banner.webp" width="1668" height="556">');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const context = await browser.newContext({ serviceWorkers: 'block' });
    try {
      const page = await context.newPage();
      const base = `http://127.0.0.1:${server.address().port}`;
      for (let i = 0; i < 3; i++) {
        await page.goto(`${base}/visit-${i}`);
        await page.locator('img').evaluate(img => img.decode());
      }
      console.log(JSON.stringify({ policy, navigations: 3, imageRequests: requests, imageBodyBytes: requests * bytes.length }));
    } finally { await context.close(); await new Promise(resolve => server.close(resolve)); }
  }
} finally { await browser.close(); }
