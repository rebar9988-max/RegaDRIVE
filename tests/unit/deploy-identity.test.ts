import { describe, expect, it } from "vitest";
import { assertCurrentRelease, assertLiveBuild } from "../../scripts/lib/deploy-identity.mjs";

const current = "5ebc294fa8b1e6631c08467a87419959dda657dd";
const superseded = "e5c568e47b38b601b205348380bf4b4defa6667a";

describe("release identity", () => {
  it("rejects the stale rerun that overwrote the redesign", () => {
    expect(() => assertCurrentRelease(superseded, current)).toThrow("STALE_DEPLOYMENT");
    expect(() => assertCurrentRelease(current, current)).not.toThrow();
  });
  it("fails closed if main or candidate cannot be verified", () => {
    for (const bad of [undefined, "", "main", current.slice(0, 7)]) {
      expect(() => assertCurrentRelease(current, bad)).toThrow();
      expect(() => assertCurrentRelease(bad, current)).toThrow();
    }
  });
  it("rejects a healthy production build from another release", () => {
    expect(() => assertLiveBuild({ contentMode: "production", buildId: "e5c568e-old" }, "5ebc294-new")).toThrow("WRONG_RELEASE");
    expect(() => assertLiveBuild({ contentMode: "production", buildId: "5ebc294-new" }, "5ebc294-new")).not.toThrow();
  });
  it("rejects preview, missing metadata and absent expected identity", () => {
    expect(() => assertLiveBuild({ contentMode: "preview", buildId: "new" }, "new")).toThrow();
    expect(() => assertLiveBuild(null, "new")).toThrow();
    expect(() => assertLiveBuild({ contentMode: "production", buildId: "new" }, undefined)).toThrow();
  });
});
