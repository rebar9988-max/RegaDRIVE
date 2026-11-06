import { describe, expect, it } from "vitest";
import { assertOwnStudent, canRegisterDevice, ForbiddenError, hashPassword, hashToken, newSessionToken, normalizeEmail, sessionCookie, verifyPassword } from "../../src/lib/shared/auth";

describe("auth primitives", () => {
  it("hashes with a random salt and verifies", async () => {
    const h1 = await hashPassword("correct horse battery");
    const h2 = await hashPassword("correct horse battery");
    expect(h1).not.toBe(h2);
    expect(h1.startsWith("pbkdf2-sha256$100000$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h1)).toBe(true);
    expect(await verifyPassword("wrong horse battery", h1)).toBe(false);
    expect(await verifyPassword("x", "malformed")).toBe(false);
    await expect(hashPassword("short")).rejects.toThrow();
  });
  it("normalizes e-mail and creates opaque tokens stored only as hashes", async () => {
    expect(normalizeEmail("  Student@Example.DE ")).toBe("student@example.de");
    expect(normalizeEmail("no-at-sign")).toBeNull();
    const t = newSessionToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(await hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(sessionCookie(t, 3600)).toContain("HttpOnly; Secure; SameSite=Lax");
  });
  it("enforces object-level authorization between students", () => {
    expect(() => assertOwnStudent("s1", "s1")).not.toThrow();
    expect(() => assertOwnStudent("s1", "s2")).toThrow(ForbiddenError);
    expect(() => assertOwnStudent(null, "s1")).toThrow(ForbiddenError);
  });
  it("applies configurable device limits", () => {
    expect(canRegisterDevice(["d1"], "d2", { maxDevices: 2 })).toBe(true);
    expect(canRegisterDevice(["d1", "d2"], "d3", { maxDevices: 2 })).toBe(false);
    expect(canRegisterDevice(["d1", "d2"], "d2", { maxDevices: 2 })).toBe(true);
  });
});
