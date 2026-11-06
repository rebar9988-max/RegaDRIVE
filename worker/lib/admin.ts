/** Owner-only content administration API. Preview/validation only while the database and storage are off. */
import type { Flags } from "../../src/lib/shared/flags";
import { previewImport, type MediaManifestEntry } from "../../src/lib/shared/importer";
import { checkMedia } from "../../src/lib/shared/media";
import { TOPICS } from "../../src/content/topics";
import { authenticateOwner, type AdminEnv } from "./adminAuth";
import { audit, consoleAuditSink, type AuditSink } from "./audit";
import { RateLimiter } from "./rateLimit";

const limiter = new RateLimiter(30, 60_000);
const MAX_MEDIA_BYTES = 26 * 1024 * 1024;

export interface AdminDeps { sink?: AuditSink; now?: number; knownLicenses?: ReadonlySet<string> }
type Json = (body: unknown, status?: number) => Response;

export async function handleAdmin(req: Request, env: AdminEnv, flags: Flags, json: Json, deps: AdminDeps = {}): Promise<Response> {
  const sink = deps.sink ?? consoleAuditSink;
  const action = `${req.method} ${new URL(req.url).pathname}`;
  const ip = req.headers.get("cf-connecting-ip") ?? "anon";

  if (!flags.contentAdminEnabled) {
    await audit(sink, "anonymous", action, "denied", { reason: "CONTENT_ADMIN_ENABLED=false" });
    return json({ error: "ADMIN_DISABLED" }, 403);
  }
  if (!limiter.allow(`admin:${ip}`, deps.now ?? Date.now())) {
    await audit(sink, "anonymous", action, "denied", { reason: "rate limited" });
    return json({ error: "RATE_LIMITED" }, 429);
  }
  const auth = await authenticateOwner(req, env);
  if (!auth.ok) {
    await audit(sink, "anonymous", action, "denied", { reason: auth.reason });
    return json({ error: "FORBIDDEN" }, 403);
  }
  const actor = auth.actor;
  const path = new URL(req.url).pathname;

  if (path === "/api/admin/import/validate" && req.method === "POST") {
    let body: { format?: string; data?: string; media?: MediaManifestEntry[] };
    try { body = await req.json(); } catch { return json({ error: "BAD_REQUEST" }, 400); }
    if ((body.format !== "json" && body.format !== "csv") || typeof body.data !== "string") return json({ error: "BAD_REQUEST" }, 400);
    const media = new Map((Array.isArray(body.media) ? body.media : []).filter((m) => m && typeof m.file === "string" && /^media\/[0-9a-f]{64}\.(png|jpeg|webp|mp4|webm)$/.test(m.key)).map((m) => [m.file, m]));
    const preview = await previewImport(body.format, body.data, {
      knownTopics: new Set(TOPICS.map((t) => t.id)),
      knownLicenses: deps.knownLicenses ?? new Set(),
      existing: new Map(), // no production database: nothing stored yet
      media,
    });
    await audit(sink, actor, action, "allowed", { format: body.format, rows: preview.summary.total, invalid: preview.summary.invalid, fatal: preview.fatal ?? null });
    return json({ dryRun: true, published: false, preview });
  }

  if (path === "/api/admin/media/validate" && req.method === "POST") {
    const name = req.headers.get("x-file-name") ?? "";
    const len = Number(req.headers.get("content-length") ?? "0");
    if (len > MAX_MEDIA_BYTES) { await audit(sink, actor, action, "denied", { reason: "too large" }); return json({ error: "TOO_LARGE" }, 413); }
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length > MAX_MEDIA_BYTES) return json({ error: "TOO_LARGE" }, 413);
    const r = await checkMedia(name, bytes);
    await audit(sink, actor, action, r.ok ? "allowed" : "failed", { file: name.slice(0, 120), bytes: bytes.length, ok: r.ok });
    return json({ dryRun: true, stored: false, ...r }, r.ok ? 200 : 422);
  }

  if (path === "/api/admin/import/commit" || path === "/api/admin/media/upload" || path.startsWith("/api/admin/content/")) {
    const reason = !flags.contentImportExecutionEnabled ? "CONTENT_IMPORT_EXECUTION disabled (requires owner-activated production database)" : "storage not configured";
    await audit(sink, actor, action, "denied", { reason });
    return json({ error: "IMPORT_EXECUTION_DISABLED", reason }, 503);
  }

  await audit(sink, actor, action, "denied", { reason: "unknown admin route" });
  return json({ error: "NOT_FOUND" }, 404);
}
