import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeLocationPart, navigate } from "../../src/app/router";

describe("route navigation", () => {
  const scrollTo = vi.fn();
  const scrollIntoView = vi.fn();
  const pushState = vi.fn((_state: unknown, _title: string, next: string) => {
    vi.stubGlobal("location", new URL(next, "https://www.regaplatform.com"));
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal("location", new URL("https://www.regaplatform.com/about#privacy"));
    vi.stubGlobal("history", { pushState });
    vi.stubGlobal("window", { scrollTo, setTimeout });
    vi.stubGlobal("document", { getElementById: vi.fn(() => ({ scrollIntoView })) });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("removes an old anchor when navigating to the page itself", () => {
    navigate("/about");
    expect(location.hash).toBe("");
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("scrolls a repeated anchor without duplicating its history entry", () => {
    navigate("/about#privacy");
    vi.runAllTimers();
    expect(pushState).not.toHaveBeenCalled();
    expect(document.getElementById).toHaveBeenCalledWith("privacy");
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it("keeps a query in the destination URL", () => {
    navigate("/practice?topic=speed");
    expect(location.pathname).toBe("/practice");
    expect(location.search).toBe("?topic=speed");
    expect(location.hash).toBe("");
  });

  it("ignores malformed anchor encodings without throwing", () => {
    expect(() => { navigate("/about#%E0%A4%A"); vi.runAllTimers(); }).not.toThrow();
    expect(document.getElementById).not.toHaveBeenCalled();
  });

  it("decodes valid lesson IDs and safely rejects malformed escapes", () => {
    expect(decodeLocationPart("lesson%20one")).toBe("lesson one");
    expect(decodeLocationPart("%E0%A4%A")).toBeNull();
    expect(decodeLocationPart("%")).toBeNull();
  });
});
