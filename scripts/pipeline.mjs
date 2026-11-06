// RegaDRIVE autonomous verification pipeline with bounded recovery.
// DETECT → DIAGNOSE → (recoverable? bounded retry with backoff) → RETEST → VERIFY → CONTINUE
// - Every step has an explicit acceptance criterion (exit code 0 of a real check).
// - Only failures that look recoverable (network/registry/proxy) are retried; logic/test failures are not
//   re-run unchanged (no repeating a failed approach without a meaningful change).
// - Independent steps continue when one fails; dependent steps are marked BLOCKED, never skipped silently.
// - Progress is checkpointed to test-results/pipeline-report.json; `--resume` skips steps already PASSED for
//   the same source fingerprint. Nothing here deploys, migrates or bypasses a gate.
import { spawn, execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const REPORT = "test-results/pipeline-report.json";
const MAX_ATTEMPTS = 3;
const RECOVERABLE = /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|network|fetch failed|429 Too Many|503 Service|502 Bad Gateway|ERR_SOCKET|registry\.npmjs/i;

const STEPS = [
  { id: "lint", cmd: "npm run lint", accept: "ESLint reports 0 problems" },
  { id: "typecheck", cmd: "npm run typecheck", accept: "strict TypeScript compiles with 0 errors" },
  { id: "unit", cmd: "npm test", accept: "all Vitest unit/integration tests pass" },
  { id: "migrations", cmd: "npm run check:migrations", accept: "D1 migrations apply on local SQLite and all constraints hold" },
  { id: "build-preview", cmd: "npm run build:preview", accept: "preview build succeeds" },
  { id: "e2e", cmd: "npm run test:e2e", accept: "all E2E tests (incl. axe WCAG + offline) pass", needs: ["build-preview"] },
  { id: "build", cmd: "npm run build", accept: "production build succeeds", needs: ["e2e"] },
  { id: "worker", cmd: "npm run check:worker", accept: "Worker bundles (dry run, no upload)", needs: ["build"] },
  { id: "preflight", cmd: "node scripts/preflight.mjs --stage=ci", accept: "all safety gates pass; deploy blockers listed", needs: ["build"] },
];

function fingerprint() {
  try { return createHash("sha256").update(execSync("git rev-parse HEAD").toString() + execSync("git diff HEAD").toString() + execSync("git status --porcelain").toString()).digest("hex").slice(0, 16); }
  catch { return "unknown"; }
}

function run(cmd) {
  return new Promise((resolve) => {
    const t = Date.now();
    const p = spawn(cmd, { shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => { out += d; process.stdout.write(d); });
    p.stderr.on("data", (d) => { out += d; process.stderr.write(d); });
    p.on("close", (code) => resolve({ code, out, ms: Date.now() - t }));
  });
}

const resume = process.argv.includes("--resume");
const fp = fingerprint();
const prev = resume && existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, "utf8")) : null;
const report = { fingerprint: fp, startedAt: new Date().toISOString(), steps: {} };
mkdirSync("test-results", { recursive: true });
const save = () => writeFileSync(REPORT, JSON.stringify(report, null, 2));

for (const step of STEPS) {
  const blockedBy = (step.needs ?? []).filter((d) => report.steps[d]?.status !== "PASS");
  if (blockedBy.length) {
    report.steps[step.id] = { status: "BLOCKED", accept: step.accept, reason: `depends on ${blockedBy.join(", ")}` };
    save();
    continue;
  }
  if (prev?.fingerprint === fp && prev.steps?.[step.id]?.status === "PASS") {
    report.steps[step.id] = { ...prev.steps[step.id], resumed: true };
    console.log(`\n▶ ${step.id}: PASS (checkpoint, unchanged source)`);
    continue;
  }
  console.log(`\n▶ ${step.id} — acceptance: ${step.accept}`);
  const rec = { status: "FAIL", accept: step.accept, attempts: 0, ms: 0, retries: [] };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    rec.attempts = attempt;
    const r = await run(step.cmd);
    rec.ms += r.ms;
    if (r.code === 0) { rec.status = "PASS"; break; }
    const recoverable = RECOVERABLE.test(r.out);
    rec.diagnosis = recoverable ? "recoverable (network/registry)" : "non-recoverable: code or test failure — needs a fix, not a re-run";
    rec.tail = r.out.split("\n").slice(-15).join("\n");
    if (!recoverable || attempt === MAX_ATTEMPTS) break;
    const wait = 2000 * 2 ** (attempt - 1);
    rec.retries.push({ attempt, waitMs: wait });
    console.log(`↻ ${step.id}: recoverable failure, retry ${attempt}/${MAX_ATTEMPTS - 1} in ${wait}ms`);
    await new Promise((res) => setTimeout(res, wait));
  }
  report.steps[step.id] = rec;
  save();
}

report.finishedAt = new Date().toISOString();
const summary = Object.entries(report.steps).map(([id, s]) => `${s.status.padEnd(7)} ${id}${s.attempts > 1 ? ` (${s.attempts} attempts)` : ""}${s.ms ? ` ${(s.ms / 1000).toFixed(1)}s` : ""}${s.reason ? ` — ${s.reason}` : ""}${s.status === "FAIL" ? ` — ${s.diagnosis}` : ""}`);
report.passed = Object.values(report.steps).every((s) => s.status === "PASS");
save();
console.log(`\n═══ PIPELINE ${report.passed ? "PASSED" : "NOT PASSED"} ═══\n${summary.join("\n")}\nreport: ${REPORT}`);
process.exit(report.passed ? 0 : 1);
