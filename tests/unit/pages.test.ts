import { describe, expect, it } from "vitest";
import { handlePage, isAppRoute } from "../../worker/pages";

const SHELL = '<!doctype html><div id="root"></div>';
const assets = { fetch: async (r: Request) => new Response(new URL(r.url).pathname === "/" ? SHELL : "", { status: 200, headers: { "content-security-policy": "default-src 'self'", "content-type": "text/html" } }) };
const get = (path: string, method = "GET") => handlePage(new Request(`https://www.regaplatform.com${path}`, { method }), assets);

describe("page routing (real 404s instead of soft 404s)", () => {
  it("knows the app's routes", () => {
    for (const p of ["/", "/learn", "/learn/l-priority", "/practice", "/practice/", "/exam", "/progress", "/settings", "/more", "/account", "/about", "/dr", "/dr/anything"]) expect(isAppRoute(p), p).toBe(true);
    for (const p of ["/wp-login", "/old-page", "/learn/nope", "/learn/l-priority/x", "/practice/x", "/drx"]) expect(isAppRoute(p), p).toBe(false);
  });
  it("serves the app shell with 200 and the site's headers for app routes", async () => {
    const r = await get("/practice?topic=priority");
    expect(r.status).toBe(200);
    expect(await r.text()).toBe(SHELL);
    expect(r.headers.get("content-security-policy")).toBe("default-src 'self'");
    expect(r.headers.get("x-robots-tag")).toBeNull();
  });
  it("answers unknown paths with the shell, 404, noindex and no caching", async () => {
    const r = await get("/old-page-of-a-previous-site");
    expect(r.status).toBe(404);
    expect(await r.text()).toBe(SHELL); // the app shows its own "not found" page
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-security-policy")).toBe("default-src 'self'");
  });
  it("answers missing files with a plain, locked-down 404", async () => {
    for (const p of ["/wp-login.php", "/missing.png", "/a/b.js"]) {
      const r = await get(p);
      expect(r.status, p).toBe(404);
      expect(r.headers.get("content-type")).toMatch(/^text\/plain/);
      expect(r.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'");
      expect(r.headers.get("x-robots-tag")).toBe("noindex");
    }
  });
  it("sends no body for HEAD", async () => {
    expect(await (await get("/missing.png", "HEAD")).text()).toBe("");
    expect(await (await get("/nope", "HEAD")).text()).toBe("");
  });
});
