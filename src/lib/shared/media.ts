/**
 * Secure media intake for question images and videos. Type is decided by magic bytes, never by the
 * client-supplied extension or MIME type. SVG/HTML/GIF and other active or unexpected formats are rejected.
 * Storage keys are content-addressed (sha256), so duplicates collapse and names cannot be abused for paths.
 */
import type { MediaKind } from "../../content/types";

export interface SniffResult { mime: string; ext: string; kind: MediaKind }
export const LIMITS: Record<MediaKind, number> = { image: 2 * 1024 * 1024, video: 25 * 1024 * 1024 };
const EXT_ALIASES: Record<string, string> = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp", mp4: "mp4", m4v: "mp4", webm: "webm" };

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

export function sniff(b: Uint8Array): SniffResult | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png", kind: "image" };
  if (startsWith(b, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpeg", kind: "image" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp", kind: "image" };
  if (ascii(b, 4, 8) === "ftyp") return { mime: "video/mp4", ext: "mp4", kind: "video" };
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: "video/webm", ext: "webm", kind: "video" };
  return null;
}

export interface MediaCheck { ok: boolean; errors: string[]; result?: SniffResult & { key: string; sha256: string; bytes: number } }

export async function checkMedia(fileName: string, bytes: Uint8Array): Promise<MediaCheck> {
  const errors: string[] = [];
  if (!/^[A-Za-z0-9._ -]{1,120}$/.test(fileName) || fileName.includes("..")) errors.push("file name contains unsupported characters");
  const s = sniff(bytes);
  if (!s) return { ok: false, errors: [...errors, "unsupported or unrecognised file type (allowed: PNG, JPEG, WebP, MP4, WebM)"] };
  const ext = EXT_ALIASES[fileName.split(".").pop()?.toLowerCase() ?? ""];
  if (!ext) errors.push("unsupported file extension");
  else if (ext !== s.ext) errors.push(`extension does not match content (content is ${s.mime})`);
  if (bytes.length === 0) errors.push("empty file");
  if (bytes.length > LIMITS[s.kind]) errors.push(`${s.kind} larger than ${LIMITS[s.kind] / 1024 / 1024} MB`);
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const sha256 = [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
  return { ok: errors.length === 0, errors, result: { ...s, sha256, bytes: bytes.length, key: `media/${sha256}.${s.ext}` } };
}
