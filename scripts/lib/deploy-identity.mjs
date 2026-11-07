import assert from "node:assert/strict";

/** Fail closed: a retry must not publish a commit superseded on main. */
export function assertCurrentRelease(candidate, remoteMain) {
  assert.match(candidate ?? "", /^[a-f0-9]{40}$/, "deployment commit SHA is required");
  assert.match(remoteMain ?? "", /^[a-f0-9]{40}$/, "could not verify current main SHA");
  assert.equal(candidate, remoteMain, "STALE_DEPLOYMENT: start a new deployment from current main; do not rerun an older release");
}

/** Health alone cannot distinguish a healthy old UI from the intended release. */
export function assertLiveBuild(info, expectedBuildId, expectedCommit) {
  assert.equal(info?.contentMode, "production", "live build must use production content");
  assert.ok(typeof expectedBuildId === "string" && expectedBuildId.length > 0, "expected build ID is required");
  assert.equal(info?.buildId, expectedBuildId, "WRONG_RELEASE: live build is not the artifact built by this deployment");
  if (expectedCommit !== undefined) assert.equal(info?.commit, expectedCommit, "WRONG_RELEASE: live build is not from the deployed commit");
}

const FULL_SHA = /^[a-f0-9]{40}$/;

/** Commit a live build-info.json was built from: the full `commit` field, else the short-SHA prefix of `buildId`. */
export function liveCommit(info) {
  if (typeof info?.commit === "string" && FULL_SHA.test(info.commit)) return info.commit;
  const m = /^([a-f0-9]{7,40})-[a-z0-9]+$/.exec(typeof info?.buildId === "string" ? info.buildId : "");
  return m ? m[1] : null;
}

/**
 * True only when production verifiably serves this exact commit, so the run must not publish the same code again.
 * Anything unverifiable (unreachable, preview, no identity) is "not live": deploying the current main is then safe.
 */
export function isAlreadyLive(info, candidate) {
  if (info?.contentMode !== "production" || !FULL_SHA.test(candidate ?? "")) return false;
  const live = liveCommit(info);
  if (!live) return false;
  return live.length === 40 ? live === candidate : candidate.startsWith(live);
}
