// Prints the version id currently serving 100% (last known-good) from `wrangler deployments list --json` on stdin.
// Prints nothing for a first deployment (no rollback target exists).
let raw = "";
for await (const c of process.stdin) raw += c;
let list = [];
try { list = JSON.parse(raw.slice(raw.indexOf("["))); } catch { /* no deployments yet */ }
const latest = [...list].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
const full = latest?.versions?.find((v) => v.percentage === 100) ?? latest?.versions?.[0];
if (full?.version_id) process.stdout.write(full.version_id);
