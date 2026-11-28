import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const source = readFileSync("public/sw.js", "utf8");
function harness(path: string, rejectWrite = false) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const put = vi.fn(() => rejectWrite ? Promise.reject(new Error("quota")) : Promise.resolve());
  const fetch = vi.fn(async () => new Response("original image bytes"));
  runInNewContext(source, {
    self: { location: { origin: "https://example.test" }, addEventListener: (name: string, fn: (event: unknown) => void) => { handlers[name] = fn; } },
    caches: { match: async () => undefined, open: async () => ({ put }) },
    fetch, URL, Response,
  });
  const pending: Promise<unknown>[] = [];
  let response: Promise<Response> | undefined;
  handlers.fetch!({ request: new Request(`https://example.test${path}`), waitUntil: (p: Promise<unknown>) => pending.push(p), respondWith: (p: Promise<Response>) => { response = p; } });
  return { pending, put, response };
}
it("keeps original sign cache writes alive until persisted", async () => {
  const h = harness("/signs/it/stop.svg");
  expect(await (await h.response)?.text()).toBe("original image bytes");
  expect(h.pending).toHaveLength(1);
  await Promise.all(h.pending);
  expect(h.put).toHaveBeenCalledOnce();
});
it("still serves images when offline storage quota is exhausted", async () => {
  const h = harness("/brand/regadrive-banner.webp", true);
  expect(await (await h.response)?.text()).toBe("original image bytes");
  await expect(Promise.all(h.pending)).resolves.toBeDefined();
});
it("does not persist protected question media", async () => {
  const h = harness(`/media/${"a".repeat(64)}.png`);
  await h.response;
  expect(h.pending).toHaveLength(0);
  expect(h.put).not.toHaveBeenCalled();
});
