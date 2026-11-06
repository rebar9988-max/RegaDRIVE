/**
 * Owner-only admin authentication (fail closed).
 * - ADMIN_OWNER_TOKEN_SHA256: hex SHA-256 of the owner's admin token (set with `wrangler secret put`). Only the
 *   hash is stored server-side; the token is sent as `Authorization: Bearer <token>`.
 * - ADMIN_ACCESS_EMAIL (optional): additionally require Cloudflare Access to have authenticated this email.
 *   Only meaningful when the admin path is protected by a Cloudflare Access application.
 */
export interface AdminEnv { ADMIN_OWNER_TOKEN_SHA256?: string; ADMIN_ACCESS_EMAIL?: string }

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

export async function authenticateOwner(req: Request, env: AdminEnv): Promise<{ ok: true; actor: string } | { ok: false; reason: string }> {
  const expected = env.ADMIN_OWNER_TOKEN_SHA256?.toLowerCase();
  if (!expected || !/^[0-9a-f]{64}$/.test(expected)) return { ok: false, reason: "admin not configured" };
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token.length < 32) return { ok: false, reason: "missing or weak token" };
  if (!equal(await sha256Hex(token), expected)) return { ok: false, reason: "invalid token" };
  if (env.ADMIN_ACCESS_EMAIL) {
    const email = req.headers.get("cf-access-authenticated-user-email")?.toLowerCase();
    if (email !== env.ADMIN_ACCESS_EMAIL.toLowerCase()) return { ok: false, reason: "cloudflare access identity mismatch" };
  }
  return { ok: true, actor: env.ADMIN_ACCESS_EMAIL ? `owner:${env.ADMIN_ACCESS_EMAIL}` : "owner" };
}
