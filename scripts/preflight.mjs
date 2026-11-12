// Read-only production preflight for RegaDRIVE. Changes nothing.
//   --stage=ci      safety gates are fatal; deployment prerequisites are reported as blockers (non-fatal)
//   --stage=deploy  every gate is fatal (used by .github/workflows/deploy.yml before `wrangler deploy`)
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { KLASSE_B } from "./lib/rules.mjs";

const stage = (process.argv.find((a) => a.startsWith("--stage=")) ?? "--stage=deploy").split("=")[1];
const fatal = [];
const blockers = [];
const pass = (msg) => console.log(`PASS ${msg}`);
const gate = (cond, msg) => (cond ? pass(msg) : fatal.push(msg));
const deployGate = (cond, msg) => (cond ? pass(msg) : (stage === "deploy" ? fatal : blockers).push(msg));

const cfg = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));
const v = cfg.vars ?? {};

// 1. Repository identity and isolation (Rega24 / R&L never mixed)
const remote = (() => { try { return execSync("git remote get-url origin").toString().trim(); } catch { return ""; } })();
gate(/rebar9988-max\/regadrive(\.git)?$/i.test(remote) || /^rebar9988-max\/regadrive$/i.test(process.env.GITHUB_REPOSITORY ?? ""), "repository is rebar9988-max/RegaDRIVE");
gate(cfg.name === "regadrive", "worker name is the isolated 'regadrive'");
const parsed = JSON.stringify(cfg).toLowerCase(); // parsed config only (comments excluded)
for (const foreign of ["rega24", "rega-platform", "rega-cargo", "rlgo", "rega-ai-python"]) gate(!parsed.includes(foreign), `no Rega24/R&L identifier '${foreign}' in config`);
if (stage === "deploy") {
  const branch = process.env.GITHUB_REF_NAME ?? (() => { try { return execSync("git rev-parse --abbrev-ref HEAD").toString().trim(); } catch { return ""; } })();
  gate(branch === "main", `deploying from production branch main (got '${branch}')`);
}

// 2. Payments and production database OFF
for (const k of ["PAYMENTS_ENABLED", "CHECKOUT_ENABLED", "LIVE_PAYMENT_WEBHOOKS_ENABLED", "PURCHASE_REQUIRED", "DATABASE_PRODUCTION_ENABLED",
  "OFFICIAL_QUESTION_BANK_ENABLED", "CONTENT_ADMIN_ENABLED", "CONTENT_IMPORT_EXECUTION_ENABLED", "PUBLIC_OFFICIAL_MOCK_EXAMS_ENABLED", "CONTENT_AUTO_SYNC_ENABLED", "SUBSCRIPTIONS_ENABLED"]) gate(v[k] === "false", `${k}=false`);
gate(!Object.keys(v).some((k) => k.startsWith("OWNER_")), "no owner activation present in config");
// Allowed D1 bindings: the owner-approved (2026-11-07) /dr database, and the owner-approved (2026-11-11) separate
// student-accounts database. They must stay two different databases with their own migration folders.
const d1 = cfg.d1_databases ?? [];
const DR_DB = { binding: "DB", database_name: "regadrive-db", database_id: "bd9f0f57-3b67-49ab-9597-f8ce9b305c88", migrations_dir: "migrations" };
const STUDENT_DB = { binding: "STUDENT_DB", database_name: "regadrive-students", database_id: "4b6065a1-812c-44c3-8558-b50e66e18764", migrations_dir: "migrations-students" };
const same = (a, b) => Object.keys(b).every((k) => a[k] === b[k]);
gate(d1.every((d) => same(d, DR_DB) || same(d, STUDENT_DB)) && d1.length <= 2 && new Set(d1.map((d) => d.database_id)).size === d1.length, "D1: only regadrive-db (/dr) and the separate regadrive-students database");
const studentAuthOn = v.STUDENT_AUTH_ENABLED === "true";
gate(!studentAuthOn || d1.some((d) => same(d, STUDENT_DB)), "student accounts enabled only with the separate student database bound");
gate(v.STUDENT_AUTH_ENABLED === undefined || ["true", "false"].includes(v.STUDENT_AUTH_ENABLED), "STUDENT_AUTH_ENABLED is true or false");
gate(!studentAuthOn || /^RegaDRIVE <[^@\s]+@regaplatform\.com>$/.test(v.STUDENT_MAIL_FROM ?? ""), "student e-mail sender is on the verified regaplatform.com domain");
gate(v.APP_ENV === "production" && v.MAIL_API_URL === undefined, "APP_ENV=production and no test mail sink in config (mail goes only to Resend)");
gate(existsSync("migrations-students") && !readdirSync("migrations-students").some((f) => readFileSync(`migrations-students/${f}`, "utf8").includes("dr_")), "student migrations never touch /dr tables");
gate(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.DR_OWNER_EMAIL ?? "") && v.DR_OWNER_EMAIL === "regaplatform1@gmail.com", "/dr sign-in codes go only to the owner-chosen address");
gate(!cfg.r2_buckets && !cfg.kv_namespaces && !cfg.durable_objects && !cfg.queues, "no billable storage bindings");

// 3. AI cannot incur charges
gate(v.AI_FREE_ONLY === "true" && v.AI_PAID_FALLBACK_ENABLED === "false" && v.AI_DAILY_COST_LIMIT_EUR === "0" && v.AI_DOMAIN_SCOPE === "regadrive", "AI free-only, no paid fallback, €0 limit, regadrive scope");
gate(Object.keys(v).every((k) => !/API_KEY|TOKEN|SECRET/.test(k)), "no API keys or secrets in plain config vars");
gate(!v.AI_OPENROUTER_MODEL || v.AI_OPENROUTER_MODEL.endsWith(":free"), "OpenRouter model (if set) is a :free model");

// 4. Build integrity and content licensing gate
const info = existsSync("dist/build-info.json") ? JSON.parse(readFileSync("dist/build-info.json", "utf8")) : null;
gate(info !== null && existsSync("dist/index.html") && existsSync("dist/brand/regadrive-logo.webp"), "production build with official logo present");
gate(info?.contentMode === "production", "build is a production content build (no unapproved preview content)");
gate(v.CONTENT_MODE === "production", "Worker CONTENT_MODE=production");
// Owner instruction 2026-11-12: the import / licence / media preview is part of the /dr owner workbench. It must
// stay out of the student bundle and the public /admin/import route must not be built into production; it may
// exist only in the chunk that /dr loads after the owner signed in.
const assets = existsSync("dist/assets") ? readdirSync("dist/assets") : [];
const holdsWorkbench = (f) => /\.js$/.test(f) && /dr-content/.test(readFileSync(`dist/assets/${f}`, "utf8"));
gate(info?.adminUi === false && !assets.some((f) => f.startsWith("AdminImport")), "public /admin/import route is not built into production");
gate(!assets.filter((f) => /^index-/.test(f)).some(holdsWorkbench), "owner content workbench is not in the student bundle");
gate(assets.filter(holdsWorkbench).every((f) => /^DrContent-/.test(f)), "owner content workbench exists only in the /dr workbench chunk");
gate(info?.rulesVersion === KLASSE_B, `build uses current exam rules ${KLASSE_B}`);
// Owner decision (2026-11-06): the public app may go live while content is still in review. The production
// build shows approved items only (currently none) with "under review" states; this is reported, not blocking.
pass(`approved content visible in production: questions ${info?.visible?.questions ?? 0}, lessons ${info?.visible?.lessons ?? 0} (review states shown for the rest)`);

// 5. Routing / domain
const routes = cfg.routes ?? [];
gate(routes.every((r) => /(^|\.)regaplatform\.com/.test(typeof r === "string" ? r : r.pattern)), "routes (if any) target only regaplatform.com");
deployGate(routes.some((r) => (typeof r === "string" ? r : r.pattern) === "www.regaplatform.com" && r.custom_domain === true), "custom domain www.regaplatform.com configured (Cloudflare enforces zone ownership on attach)");
// The live-domain safety check (never overwrite an unrelated site) runs in deploy.yml via scripts/domain-check.mjs.

// 6. Rollback capability
gate(existsSync("scripts/last-known-good.mjs") && readFileSync(".github/workflows/deploy.yml", "utf8").includes("wrangler rollback"), "rollback procedure present in deploy workflow");

if (blockers.length) console.log(`\nDEPLOY BLOCKERS (non-fatal at stage=${stage}):\n- ${blockers.join("\n- ")}`);
if (fatal.length) { console.error(`\nPREFLIGHT FAILED (stage=${stage}):\n- ${fatal.join("\n- ")}`); process.exit(1); }
console.log(`\nPREFLIGHT PASSED (stage=${stage})${blockers.length ? ` — ${blockers.length} deploy blocker(s) remain` : ""}`);
