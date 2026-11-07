import { describe, expect, it } from "vitest";
import { assertCurrentRelease, assertLiveBuild, isAlreadyLive, liveCommit } from "../../scripts/lib/deploy-identity.mjs";

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

describe("no republishing of the live release", () => {
  const live = { contentMode: "production", buildId: "032600a-mw6abc12", commit: "032600a5ecb6cf5ad77242e8bfce4882c0c70c60" };
  it("skips a run whose commit production already serves (full commit or short build prefix)", () => {
    expect(isAlreadyLive(live, live.commit)).toBe(true);
    expect(isAlreadyLive({ contentMode: "production", buildId: "032600a-mw6abc12" }, live.commit)).toBe(true);
    expect(liveCommit({ contentMode: "production", buildId: "e5c568e-mw5o20wc" })).toBe("e5c568e");
  });
  it("deploys a newer main over an older live build", () => {
    expect(isAlreadyLive({ contentMode: "production", buildId: "e5c568e-mw5o20wc" }, current)).toBe(false);
    expect(isAlreadyLive({ ...live, commit: superseded }, current)).toBe(false);
  });
  it("treats unverifiable identity as not live (deploying current main is safe)", () => {
    for (const info of [null, undefined, {}, { contentMode: "preview", buildId: "032600a-x", commit: live.commit }, { contentMode: "production", buildId: "nohex" }]) {
      expect(isAlreadyLive(info, live.commit)).toBe(false);
    }
    expect(isAlreadyLive(live, "032600a")).toBe(false);
  });
  it("verifies the deployed commit after upload", () => {
    expect(() => assertLiveBuild(live, live.buildId, live.commit)).not.toThrow();
    expect(() => assertLiveBuild(live, live.buildId, current)).toThrow("WRONG_RELEASE");
  });
});
