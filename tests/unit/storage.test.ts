import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { kv } from "../../src/lib/storage";
import { emptyProgress, recordAnswer } from "../../src/lib/progress";

describe("IndexedDB progress storage", () => {
  it("persists and restores progress without loss", async () => {
    const p = recordAnswer(emptyProgress(), "s", "rd-g-001", true, Date.now());
    await kv.set("progress", p);
    kv._reset(); // simulate a reload / interrupted session
    expect(await kv.get("progress")).toEqual(p);
    await kv.del("progress");
    expect(await kv.get("progress")).toBeUndefined();
  });
});
