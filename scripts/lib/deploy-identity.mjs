import assert from "node:assert/strict";

/** Fail closed: a retry must not publish a commit superseded on main. */
export function assertCurrentRelease(candidate, remoteMain) {
  assert.match(candidate ?? "", /^[a-f0-9]{40}$/, "deployment commit SHA is required");
  assert.match(remoteMain ?? "", /^[a-f0-9]{40}$/, "could not verify current main SHA");
  assert.equal(candidate, remoteMain, "STALE_DEPLOYMENT: start a new deployment from current main; do not rerun an older release");
}

/** Health alone cannot distinguish a healthy old UI from the intended release. */
export function assertLiveBuild(info, expectedBuildId) {
  assert.equal(info?.contentMode, "production", "live build must use production content");
  assert.ok(typeof expectedBuildId === "string" && expectedBuildId.length > 0, "expected build ID is required");
  assert.equal(info?.buildId, expectedBuildId, "WRONG_RELEASE: live build is not the artifact built by this deployment");
}
