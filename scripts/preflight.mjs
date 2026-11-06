// Read-only production preflight for RegaDRIVE. Exits 1 if any safety gate fails. Changes nothing.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); else console.log(`PASS ${msg}`); };
const cfg = JSON.parse(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));
const v = cfg.vars ?? {};

// 1. Project identity / isolation
const remote = (() => { try { return execSync("git remote get-url origin").toString().trim(); } catch { return process.env.GITHUB_REPOSITORY ?? ""; } })();
ok(/rebar9988-max\/regadrive(\.git)?$/i.test(remote) || /^rebar9988-max\/regadrive$/i.test(process.env.GITHUB_REPOSITORY ?? ""), "repository is rebar9988-max/RegaDRIVE");
ok(cfg.name === "regadrive", "worker name is the isolated 'regadrive'");
const raw = JSON.stringify(cfg).toLowerCase(); // parsed config only (comments excluded)
for (const foreign of ["rega24", "rega-platform", "rega-cargo", "rlgo", "rega-ai-python"]) ok(!raw.includes(foreign), `no Rega24/R&L identifier '${foreign}' in config`);
// 2. Payments and database OFF
for (const k of ["PAYMENTS_ENABLED", "CHECKOUT_ENABLED", "LIVE_PAYMENT_WEBHOOKS_ENABLED", "PURCHASE_REQUIRED", "DATABASE_PRODUCTION_ENABLED"]) ok(v[k] === "false", `${k}=false`);
ok(!("OWNER_PAYMENTS_ACTIVATION" in v) && !("OWNER_DATABASE_ACTIVATION" in v), "no owner activation present in config");
ok(!cfg.d1_databases || cfg.d1_databases.length === 0, "no D1 binding (production DB off)");
ok(!cfg.r2_buckets && !cfg.kv_namespaces && !cfg.durable_objects, "no billable storage bindings");
// 3. AI free-only
ok(v.AI_FREE_ONLY === "true" && v.AI_PAID_FALLBACK_ENABLED === "false" && v.AI_DAILY_COST_LIMIT_EUR === "0", "AI free-only, no paid fallback, €0 limit");
// 4. Build present
ok(existsSync("dist/index.html") && existsSync("dist/brand/regadrive-logo.webp"), "production build with official logo present");
// 5. Routing: custom domain only when explicitly verified by the owner
const routes = cfg.routes ?? [];
ok(routes.every((r) => /(^|\.)regaplatform\.com/.test(typeof r === "string" ? r : r.pattern)), "routes (if any) target only regaplatform.com");
if (routes.length && process.env.REGAPLATFORM_DOMAIN_VERIFIED !== "true") fail.push("custom domain route present but REGAPLATFORM_DOMAIN_VERIFIED is not 'true'");

if (fail.length) { console.error(`\nPREFLIGHT FAILED:\n- ${fail.join("\n- ")}`); process.exit(1); }
console.log("\nPREFLIGHT PASSED");
