import { describe, expect, it, vi } from "vitest";
import { isNetworkError, retry } from "../../scripts/lib/retry.mjs";

describe("bounded recovery", () => {
  it("retries recoverable failures with exponential backoff, then succeeds", async () => {
    const waits: number[] = [];
    let n = 0;
    const r = await retry(async () => { if (++n < 3) throw new Error("ECONNRESET"); return "ok"; }, { attempts: 4, baseMs: 1, maxMs: 8, onRetry: (_e, _a, w) => waits.push(w) });
    expect(r).toBe("ok");
    expect(n).toBe(3);
    expect(waits.length).toBe(2);
    expect(waits[1]!).toBeGreaterThanOrEqual(waits[0]! - 250);
  });
  it("never exceeds the attempt limit (no infinite loops)", async () => {
    const fn = vi.fn(async () => { throw new Error("ETIMEDOUT"); });
    await expect(retry(fn, { attempts: 3, baseMs: 1 })).rejects.toThrow("ETIMEDOUT");
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it("does not repeat a non-recoverable failure unchanged", async () => {
    const fn = vi.fn(async () => { throw new Error("AssertionError: expected 1 to be 2"); });
    await expect(retry(fn, { attempts: 5, baseMs: 1, isRecoverable: isNetworkError })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("classifies network errors", () => {
    expect(isNetworkError(new Error("fetch failed"))).toBe(true);
    expect(isNetworkError(new Error("HTTP 503"))).toBe(true);
    expect(isNetworkError(new Error("TypeError: x is undefined"))).toBe(false);
  });
});
