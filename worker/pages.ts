/**
 * Page routing for requests that match no static file. The app is a single-page application, so its routes are
 * answered with the app shell (index.html). Unknown paths (for example URLs of the domain's previous site, or
 * scanner probes such as /wp-login.php) get the same shell with HTTP 404 and noindex instead of a "soft 404"
 * 200, so search engines drop them. Missing files (a path with an extension) get a plain 404.
 * Idea and route list first proposed in PR #7 (fix/site-quality-audit).
 */
import { LESSONS } from "../src/content/lessons";

const LESSON_IDS = new Set(LESSONS.map((l) => l.id));
const PAGES = new Set(["", "learn", "signs", "practice", "exam", "progress", "vocabulary", "services", "account", "access", "settings", "about", "more", "dr", "admin/import"]);

export function isAppRoute(pathname: string): boolean {
  const p = pathname.replace(/^\/+|\/+$/g, "");
  if (PAGES.has(p)) return true;
  if (p.startsWith("dr/")) return true; // owner control center: client-side sections, access enforced by the API
  if (p.startsWith("learn/")) {
    const id = p.slice(6);
    return !id.includes("/") && LESSON_IDS.has(id);
  }
  return false;
}

interface Assets { fetch(req: Request): Promise<Response> }

export async function handlePage(req: Request, assets: Assets): Promise<Response> {
  const url = new URL(req.url);
  const fileLike = /\.[a-z0-9]{1,8}$/i.test(url.pathname);
  if (fileLike) {
    return new Response(req.method === "HEAD" ? null : "Not found", { status: 404, headers: {
      "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'", "x-frame-options": "DENY", "referrer-policy": "strict-origin-when-cross-origin",
    } });
  }
  // The shell is the static index.html, so it carries the site's security headers from public/_headers.
  const shell = await assets.fetch(new Request(new URL("/", url), { method: req.method, headers: req.headers }));
  if (isAppRoute(url.pathname)) return shell;
  const headers = new Headers(shell.headers);
  headers.set("x-robots-tag", "noindex");
  headers.set("cache-control", "no-store");
  return new Response(req.method === "HEAD" ? null : shell.body, { status: 404, headers });
}
