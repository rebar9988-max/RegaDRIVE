import { describe, expect, it, vi } from "vitest";
import { afterLoad, AFTER_LOAD_DELAY_MS } from "../../src/lib/afterLoad";

function fakeWindow(withIdle: boolean) {
  const listeners: Record<string, () => void> = {};
  const timers: (() => void)[] = [];
  const idles: (() => void)[] = [];
  const w = {
    addEventListener: (t: string, fn: () => void) => { listeners[t] = fn; },
    removeEventListener: vi.fn(),
    setTimeout: (fn: () => void, ms: number) => { expect(ms).toBe(AFTER_LOAD_DELAY_MS); timers.push(fn); return timers.length; },
    clearTimeout: vi.fn(),
    requestIdleCallback: withIdle ? (fn: () => void) => { idles.push(fn); return idles.length; } : undefined,
    cancelIdleCallback: vi.fn(),
  };
  return { w: w as unknown as Window, listeners, timers, idles };
}

describe("background work waits for the first screen", () => {
  it("runs only after load, a pause and an idle moment", () => {
    const f = fakeWindow(true);
    const fn = vi.fn();
    afterLoad(fn, f.w, { readyState: "loading" });
    expect(f.timers).toHaveLength(0);
    f.listeners.load!();
    f.timers[0]!();
    expect(fn).not.toHaveBeenCalled();
    f.idles[0]!();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("starts the pause at once when the page has already loaded, and works without requestIdleCallback", () => {
    const f = fakeWindow(false);
    const fn = vi.fn();
    afterLoad(fn, f.w, { readyState: "complete" });
    f.timers[0]!();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("can be cancelled (component unmount)", () => {
    const f = fakeWindow(true);
    const fn = vi.fn();
    const cancel = afterLoad(fn, f.w, { readyState: "complete" });
    f.timers[0]!();
    cancel();
    f.idles[0]!();
    expect(fn).not.toHaveBeenCalled();
  });
});
