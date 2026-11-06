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
gate(!cfg.d1_databases || cfg.d1_databases.length === 0, "no D1 binding (production DB off)");
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
gate(info?.adminUi === false && !(existsSync("dist/assets") && readdirSync("dist/assets").some((f) => f.startsWith("AdminImport"))), "owner import UI is not in the production bundle");
gate(info?.rulesVersion === KLASSE_B, `build uses current exam rules ${KLASSE_B}`);
deployGate((info?.visible?.questions ?? 0) >= 30 && (info?.visible?.lessons ?? 0) >= 1,
  `approved content available (visible questions ${info?.visible?.questions ?? 0}/30 min, lessons ${info?.visible?.lessons ?? 0}) — needs human TRANSLATION_REVIEW + EDUCATIONAL_REVIEW`);

// 5. Routing / domain
const routes = cfg.routes ?? [];
gate(routes.every((r) => /(^|\.)regaplatform\.com/.test(typeof r === "string" ? r : r.pattern)), "routes (if any) target only regaplatform.com");
deployGate(routes.length > 0, "custom domain route for www.regaplatform.com configured");
deployGate(process.env.REGAPLATFORM_DOMAIN_VERIFIED === "true", "owner verified domain ownership (REGAPLATFORM_DOMAIN_VERIFIED=true)");

// 6. Rollback capability
gate(existsSync("scripts/last-known-good.mjs") && readFileSync(".github/workflows/deploy.yml", "utf8").includes("wrangler rollback"), "rollback procedure present in deploy workflow");

if (blockers.length) console.log(`\nDEPLOY BLOCKERS (non-fatal at stage=${stage}):\n- ${blockers.join("\n- ")}`);
if (fatal.length) { console.error(`\nPREFLIGHT FAILED (stage=${stage}):\n- ${fatal.join("\n- ")}`); process.exit(1); }
console.log(`\nPREFLIGHT PASSED (stage=${stage})${blockers.length ? ` — ${blockers.length} deploy blocker(s) remain` : ""}`);
