import { describe, expect, it } from "vitest";
import { RateLimiter } from "../../worker/lib/rateLimit";

describe("bounded rate limiter", () => {
  it("does not reset blocked clients under identity churn", () => {
    const limiter = new RateLimiter(1, 60_000);
    expect(limiter.allow("blocked", 0)).toBe(true);
    expect(limiter.allow("blocked", 1)).toBe(false);
    for (let i = 0; i < 9_999; i++) expect(limiter.allow(String(i), 1)).toBe(true);
    expect(limiter.allow("overflow", 2)).toBe(false);
    expect(limiter.allow("blocked", 2)).toBe(false);
    expect(limiter.allow("overflow", 60_001)).toBe(true);
  });
  it("allows existing clients their remaining budget at capacity", () => {
    const limiter = new RateLimiter(2, 100);
    for (let i = 0; i < 10_000; i++) limiter.allow(String(i), 0);
    expect(limiter.allow("0", 1)).toBe(true);
    expect(limiter.allow("0", 2)).toBe(false);
    expect(limiter.allow("0", 100)).toBe(true);
  });
});
