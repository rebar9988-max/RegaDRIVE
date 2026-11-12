/** Owner-only content administration API. Preview/validation only until the owner activates the content database. */
import type { Flags } from "../../src/lib/shared/flags";
import { previewImport, type MediaManifestEntry } from "../../src/lib/shared/importer";
import { checkMedia } from "../../src/lib/shared/media";
import { TOPICS } from "../../src/content/topics";
import { authenticateOwner, type AdminEnv } from "./adminAuth";
import { audit, consoleAuditSink, type AuditSink } from "./audit";
import { RateLimiter } from "./rateLimit";
import { commitImport, contentProgress, rollbackImport, type ContentDb } from "../content/store";
import { storeMedia, type MediaBucket } from "../content/media";

const limiter = new RateLimiter(30, 60_000);
const MAX_MEDIA_BYTES = 26 * 1024 * 1024;

export interface AdminDeps { sink?: AuditSink; now?: number; knownLicenses?: ReadonlySet<string> }
type Json = (body: unknown, status?: number) => Response;

/** CONTENT_DB / MEDIA: the content database and media bucket. Bound, but used only after the owner's activation. */
export type AdminRuntimeEnv = AdminEnv & { CONTENT_DB?: ContentDb; MEDIA?: MediaBucket };

export async function handleAdmin(req: Request, env: AdminRuntimeEnv, flags: Flags, json: Json, deps: AdminDeps = {}): Promise<Response> {
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

  if (path === "/api/admin/import/commit" || path === "/api/admin/import/rollback" || path === "/api/admin/media/upload" || path.startsWith("/api/admin/content/")) {
    // Stored imports need the owner-activated content database AND its binding. Until the owner activates it
    // (docs/OWNER_ACTIVATION.md), every one of these routes answers 503 and writes nothing.
    const db = env.CONTENT_DB;
    const reason = !flags.contentImportExecutionEnabled ? "CONTENT_IMPORT_EXECUTION disabled (requires owner-activated production database)"
      : !flags.databaseProductionEnabled ? "production content database not activated by the owner"
      : !db ? "storage not configured" : null;
    if (reason || !db) {
      await audit(sink, actor, action, "denied", { reason });
      return json({ error: "IMPORT_EXECUTION_DISABLED", reason }, 503);
    }
    const now = deps.now ?? Date.now();
    if (path === "/api/admin/content/progress" && req.method === "GET") {
      await audit(sink, actor, action, "allowed", {});
      return json({ progress: await contentProgress(db) });
    }
    if (path === "/api/admin/import/commit" && req.method === "POST") {
      let body: { format?: string; data?: string; fileName?: string; media?: MediaManifestEntry[] };
      try { body = await req.json(); } catch { return json({ error: "BAD_REQUEST" }, 400); }
      if ((body.format !== "json" && body.format !== "csv") || typeof body.data !== "string") return json({ error: "BAD_REQUEST" }, 400);
      const r = await commitImport(db, { format: body.format, text: body.data, fileName: typeof body.fileName === "string" ? body.fileName : "upload", actor, now, media: Array.isArray(body.media) ? body.media : [] });
      await audit(sink, actor, action, r.ok ? "allowed" : "failed", r.ok ? { batch: r.batchId, inserted: r.inserted, updated: r.updated, duplicates: r.duplicates } : { error: r.error, detail: r.detail ?? null });
      // Stored as hidden drafts only; publication is a separate owner-approved step.
      return json(r.ok ? { stored: true, published: false, ...r } : { stored: false, published: false, ...r }, r.ok ? 200 : 422);
    }
    if (path === "/api/admin/import/rollback" && req.method === "POST") {
      let body: { batchId?: string; reason?: string };
      try { body = await req.json(); } catch { return json({ error: "BAD_REQUEST" }, 400); }
      if (typeof body.batchId !== "string" || typeof body.reason !== "string") return json({ error: "BAD_REQUEST" }, 400);
      const r = await rollbackImport(db, body.batchId, actor, body.reason, now);
      await audit(sink, actor, action, r.ok ? "allowed" : "failed", r.ok ? { batch: r.batchId, removed: r.removed, restored: r.restored } : { error: r.error, detail: r.detail ?? null });
      return json(r, r.ok ? 200 : 422);
    }
    if (path === "/api/admin/media/upload" && req.method === "POST") {
      if (!env.MEDIA) {
        await audit(sink, actor, action, "denied", { reason: "media storage not bound" });
        return json({ error: "IMPORT_EXECUTION_DISABLED", reason: "media storage not bound" }, 503);
      }
      const name = req.headers.get("x-file-name") ?? "";
      if (Number(req.headers.get("content-length") ?? "0") > MAX_MEDIA_BYTES) { await audit(sink, actor, action, "denied", { reason: "too large" }); return json({ error: "TOO_LARGE" }, 413); }
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (bytes.length > MAX_MEDIA_BYTES) return json({ error: "TOO_LARGE" }, 413);
      const r = await storeMedia(db, env.MEDIA, name, bytes, actor, now);
      await audit(sink, actor, action, r.ok ? "allowed" : "failed", r.ok ? { id: r.id, key: r.key, bytes: r.bytes, duplicate: r.duplicate } : { file: name.slice(0, 120), errors: r.errors.length });
      // Stored, never shown: a file is served only once a published question uses it.
      return json(r.ok ? { stored: true, published: false, ...r } : { stored: false, ...r }, r.ok ? 200 : 422);
    }
    await audit(sink, actor, action, "denied", { reason: "unknown content route" });
    return json({ error: "NOT_FOUND" }, 404);
  }

  await audit(sink, actor, action, "denied", { reason: "unknown admin route" });
  return json({ error: "NOT_FOUND" }, 404);
}
