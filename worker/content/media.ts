/**
 * Question media in R2 (`regadrive-media`). Keys are content-addressed (`media/<sha256>.<ext>`), the type is decided by
 * magic bytes (src/lib/shared/media.ts), and a file is served only while a published question uses it (directly or
 * as a poster/thumbnail/container variant). Unpublishing, a licence loss (database trigger) or a rollback therefore
 * takes the file offline at once, without deleting anything.
 */
import { checkMedia, type MediaCheck } from "../../src/lib/shared/media";
import type { ContentDb } from "./store";

/** The subset of the R2 bucket binding used here. */
export interface MediaBucket {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string }; sha256?: string }): Promise<unknown>;
  get(key: string, options?: { range?: { offset: number; length?: number } | { suffix: number } }): Promise<MediaObject | null>;
}
export interface MediaObject { body: ReadableStream | null; size: number; range?: { offset?: number; length?: number }; httpEtag?: string }

export const MEDIA_KEY = /^media\/([0-9a-f]{64})\.(png|jpeg|webp|mp4|webm)$/;

export type StoreMediaResult =
  | { ok: true; id: string; key: string; sha256: string; mime: string; bytes: number; duplicate: boolean }
  | { ok: false; errors: string[] };

/** Validate, store in R2 and register in media_assets. The same bytes uploaded twice give the same record. */
export async function storeMedia(db: ContentDb, bucket: MediaBucket, fileName: string, bytes: Uint8Array, actor: string, now: number): Promise<StoreMediaResult> {
  const check: MediaCheck = await checkMedia(fileName, bytes);
  if (!check.ok || !check.result) return { ok: false, errors: check.errors };
  const r = check.result;
  const existing = await db.prepare("SELECT id FROM media_assets WHERE sha256 = ?").bind(r.sha256).first<{ id: string }>();
  if (existing) return { ok: true, id: existing.id, key: r.key, sha256: r.sha256, mime: r.mime, bytes: r.bytes, duplicate: true };
  // Object first: a row never points at a missing file. A failed insert leaves only an unreferenced, unserved object.
  await bucket.put(r.key, bytes, { httpMetadata: { contentType: r.mime }, sha256: r.sha256 });
  const id = `m-${r.sha256.slice(0, 32)}`;
  // Original RegaDRIVE media carries no licence id; licensed media is linked by the import, never by an upload.
  await db.prepare("INSERT INTO media_assets (id, kind, storage_key, sha256, mime, bytes, license_id, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)")
    .bind(id, r.kind, r.key, r.sha256, r.mime, r.bytes, actor.slice(0, 120), now).run();
  return { ok: true, id, key: r.key, sha256: r.sha256, mime: r.mime, bytes: r.bytes, duplicate: false };
}

const PUBLISHED_MEDIA = `SELECT m.mime FROM media_assets m WHERE m.storage_key = ? AND (
  EXISTS (SELECT 1 FROM question_media qm JOIN questions q ON q.id = qm.question_id WHERE qm.media_id = m.id AND q.publication_status = 'published')
  OR EXISTS (SELECT 1 FROM media_variants v JOIN question_media qm ON qm.media_id = v.media_id JOIN questions q ON q.id = qm.question_id
             WHERE v.variant_media_id = m.id AND q.publication_status = 'published'))`;

function parseRange(header: string | null): { offset: number; length?: number } | { suffix: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  if (m[1] === "") return { suffix: Number(m[2]) };
  const start = Number(m[1]);
  if (m[2] === "") return { offset: start };
  const end = Number(m[2]);
  return end < start ? "invalid" : { offset: start, length: end - start + 1 };
}

const notFound = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "x-content-type-options": "nosniff" } });

/** GET/HEAD /media/<sha256>.<ext>: only files of published questions, with byte ranges for video seeking. */
export async function serveMedia(req: Request, db: ContentDb, bucket: MediaBucket): Promise<Response> {
  const key = new URL(req.url).pathname.slice(1);
  if (!MEDIA_KEY.test(key)) return notFound();
  const row = await db.prepare(PUBLISHED_MEDIA).bind(key).first<{ mime: string }>();
  if (!row) return notFound();
  const range = parseRange(req.headers.get("range"));
  if (range === "invalid") return new Response(null, { status: 416 });
  let obj: MediaObject | null;
  try { obj = await bucket.get(key, range ? { range } : undefined); }
  catch { return new Response(null, { status: 416 }); } // R2 rejects a range outside the file
  if (!obj) return notFound();
  const headers = new Headers({
    "content-type": row.mime,
    // Content-addressed: the bytes behind a key never change. Short shared cache so unpublishing takes effect quickly.
    "cache-control": "public, max-age=300",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; sandbox",
    "cross-origin-resource-policy": "same-origin",
    "content-disposition": "inline",
  });
  if (obj.httpEtag) headers.set("etag", obj.httpEtag);
  let status = 200;
  if (range) {
    const offset = obj.range?.offset ?? ("suffix" in range ? Math.max(0, obj.size - range.suffix) : range.offset);
    const length = obj.range?.length ?? obj.size - offset;
    if (offset >= obj.size || length <= 0) return new Response(null, { status: 416, headers: { "content-range": `bytes */${obj.size}` } });
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set("content-length", String(length));
    status = 206;
  } else headers.set("content-length", String(obj.size));
  return new Response(req.method === "HEAD" ? null : obj.body, { status, headers });
}
