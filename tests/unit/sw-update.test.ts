import { describe, expect, it, vi } from "vitest";
import { keepCurrent, UPDATE_CHECK_MS, type UpdateDeps } from "../../src/lib/swUpdate";

function harness(controlled: boolean) {
  const handlers: Record<string, () => void> = {};
  const doc = { visibilityState: "visible" as DocumentVisibilityState, addEventListener: (t: string, fn: () => void) => { handlers[t] = fn; } };
  const sw = { controller: controlled ? ({} as ServiceWorker) : null, addEventListener: (t: string, fn: () => void) => { handlers[t] = fn; } };
  const reload = vi.fn();
  const every = vi.fn();
  const reg = { update: vi.fn(() => Promise.resolve(undefined as unknown as ServiceWorkerRegistration)) };
  keepCurrent(reg, { sw, doc, reload, every } as unknown as UpdateDeps);
  const show = (v: DocumentVisibilityState) => { doc.visibilityState = v; handlers.visibilitychange!(); };
  return { handlers, reload, every, reg, show, doc };
}

describe("newest release only", () => {
  it("checks for a new release when shown again and every hour", () => {
    const h = harness(true);
    expect(h.every).toHaveBeenCalledWith(expect.any(Function), UPDATE_CHECK_MS);
    h.show("hidden"); expect(h.reg.update).not.toHaveBeenCalled();
    h.show("visible"); expect(h.reg.update).toHaveBeenCalledTimes(1);
  });

  it("never reloads in front of the learner: waits until the page is hidden", () => {
    const h = harness(true);
    h.handlers.controllerchange!();
    expect(h.reload).not.toHaveBeenCalled();
    h.show("hidden");
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it("reloads at once when the new release takes over a hidden page", () => {
    const h = harness(true);
    h.doc.visibilityState = "hidden";
    h.handlers.controllerchange!();
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload on the very first install (nothing old to replace)", () => {
    const h = harness(false);
    h.handlers.controllerchange!();
    h.show("hidden");
    expect(h.reload).not.toHaveBeenCalled();
  });
});
