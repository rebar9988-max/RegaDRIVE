import { describe, expect, it } from "vitest";
import { authenticateOwner } from "../worker/lib/adminAuth";

const ownerToken = "a".repeat(64);
async function hash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function request(token?: string, email?: string): Request {
  const headers = new Headers();
  if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
  if (email !== undefined) headers.set("cf-access-authenticated-user-email", email);
  return new Request("https://www.regaplatform.com/api/admin/import/validate", { headers });
}
describe("owner-only admin authentication security regression", () => {
  it("fails closed without a configured hash", async () => {
    expect((await authenticateOwner(request(ownerToken), {})).ok).toBe(false);
  });
  it("rejects malformed configured hashes", async () => {
    expect((await authenticateOwner(request(ownerToken), { ADMIN_OWNER_TOKEN_SHA256: "invalid" })).ok).toBe(false);
  });
  it("rejects missing and weak bearer credentials", async () => {
    const env = { ADMIN_OWNER_TOKEN_SHA256: await hash(ownerToken) };
    expect((await authenticateOwner(request(), env)).ok).toBe(false);
    expect((await authenticateOwner(request("short"), env)).ok).toBe(false);
  });
  it("rejects a valid-length but incorrect credential", async () => {
    expect((await authenticateOwner(request("b".repeat(64)), { ADMIN_OWNER_TOKEN_SHA256: await hash(ownerToken) })).ok).toBe(false);
  });
  it("accepts the owner credential only when its hash matches", async () => {
    expect((await authenticateOwner(request(ownerToken), { ADMIN_OWNER_TOKEN_SHA256: await hash(ownerToken) })).ok).toBe(true);
  });
  it("requires the configured Access email as an additional condition", async () => {
    const env = { ADMIN_OWNER_TOKEN_SHA256: await hash(ownerToken), ADMIN_ACCESS_EMAIL: "owner@example.com" };
    expect((await authenticateOwner(request(ownerToken), env)).ok).toBe(false);
    expect((await authenticateOwner(request(ownerToken), "attacker@example.com"), env)).ok).toBe(false);
    expect((await authenticateOwner(request(ownerToken), "OWNER@example.com"), env)).ok).toBe(true);
  });
});
