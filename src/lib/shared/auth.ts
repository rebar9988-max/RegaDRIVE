/** Authentication primitives compatible with Workers WebCrypto. No live auth is exposed while the DB is off. */
const PBKDF2_ITERATIONS = 100_000; // Workers WebCrypto maximum
const enc = new TextEncoder();

const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10 || password.length > 256) throw new Error("PASSWORD_LENGTH");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, iter, salt, hash] = stored.split("$");
  if (alg !== "pbkdf2-sha256" || !iter || !salt || !hash) return false;
  const actual = await derive(password, unb64(salt), Number(iter));
  const expected = unb64(hash);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= (actual[i] ?? 0) ^ (expected[i] ?? 0);
  return diff === 0;
}

export function normalizeEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(e) ? e : null;
}

/** Opaque session token for the cookie; only its SHA-256 hash is stored server-side. */
export function newSessionToken(): string {
  return b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c] ?? "");
}

export async function hashToken(token: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(token));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const SESSION_COOKIE = "__Host-rd_session";
export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export class ForbiddenError extends Error {}
/** Object-level authorization: a student may only touch their own records. */
export function assertOwnStudent(sessionStudentId: string | null, resourceStudentId: string): void {
  if (!sessionStudentId || sessionStudentId !== resourceStudentId) throw new ForbiddenError("FORBIDDEN");
}

export interface DevicePolicy { maxDevices: number }
export function canRegisterDevice(activeDeviceIds: readonly string[], deviceId: string, policy: DevicePolicy): boolean {
  return activeDeviceIds.includes(deviceId) || activeDeviceIds.length < policy.maxDevices;
}
