// Never republish the code production already serves.
// Usage: node scripts/check-not-already-live.mjs https://www.regaplatform.com
// Writes deploy=true|false (and live=<commit>) to $GITHUB_OUTPUT. Unverifiable live identity → deploy=true.
import { appendFileSync } from "node:fs";
import { isAlreadyLive, liveCommit } from "./lib/deploy-identity.mjs";

const target = (process.argv[2] ?? "https://www.regaplatform.com").replace(/\/$/, "");
const candidate = process.env.GITHUB_SHA;
let info = null;
try {
  const r = await fetch(`${target}/build-info.json?t=${Date.now()}`, { cache: "no-store", headers: { "cache-control": "no-cache" }, signal: AbortSignal.timeout(15000) });
  if (r.ok) info = await r.json();
} catch { /* unreachable: identity unknown */ }

const live = liveCommit(info) ?? "unknown";
const already = isAlreadyLive(info, candidate);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${already ? "false" : "true"}\nlive=${live}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, already
    ? `### ALREADY_LIVE\n${target} already serves \`${candidate}\` (build \`${info?.buildId}\`). Nothing was deployed.\n`
    : `### Release check\nLive: \`${live}\` → candidate \`${candidate}\` (newest main).\n`);
}
console.log(already
  ? `::notice::ALREADY_LIVE: ${target} already serves ${candidate} (build ${info?.buildId}); not publishing the same code again.`
  : `Live commit: ${live}; candidate: ${candidate}. Deployment allowed.`);
