// Applies ./migrations to an in-memory SQLite database (D1 is SQLite) and checks integrity rules.
// Local only — never connects to Cloudflare.
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new DatabaseSync(":memory:");
for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(`migrations/${f}`, "utf8"));
db.exec("PRAGMA foreign_keys = ON");

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
const required = ["users","student_profiles","email_verifications","sessions","authorized_devices","purchase_orders","payment_events","student_entitlements","lessons","topics","traffic_signs","questions","answer_options","vocabulary","learning_progress","practice_sessions","mock_exam_results","bookmarks","content_licenses","security_audit_logs","owner_settings"];
for (const t of required) assert.ok(tables.includes(t), `missing table ${t}`);

const throws = (sql, msg) => assert.throws(() => db.exec(sql), undefined, msg);
const now = Date.now();
db.exec(`INSERT INTO users VALUES ('u1','a@example.de',NULL,'h','active',${now},${now}), ('u2','b@example.de',NULL,'h','active',${now},${now})`);
throws(`INSERT INTO users VALUES ('u3','A@EXAMPLE.DE',NULL,'h','active',${now},${now})`, "email unique case-insensitive");
throws(`INSERT INTO sessions VALUES ('s','nope',NULL,'t',${now},${now + 1},NULL)`, "session FK");
throws(`INSERT INTO sessions VALUES ('s','u1',NULL,'t',${now},${now - 1},NULL)`, "session expiry check");
db.exec(`INSERT INTO topics VALUES ('speed','خێرایی','Geschwindigkeit','Grundstoff')`);
throws(`INSERT INTO questions (id,topic_id,question_code,points,category_type,license_classes,source_type,content_version,review_status,prompt_ckb,prompt_de,explanation_ckb,explanation_de) VALUES ('q1','speed','1.1.01-001',4,'Grundstoff','["B"]','original','v','pending','p','p','e','e')`, "original questions cannot carry official codes");
throws(`INSERT INTO questions (id,topic_id,points,category_type,license_classes,source_type,content_version,review_status,prompt_ckb,prompt_de,explanation_ckb,explanation_de) VALUES ('q1','speed',4,'Grundstoff','["B"]','licensed_official','v','pending','p','p','e','e')`, "licensed questions need a licence");
db.exec(`INSERT INTO questions (id,topic_id,points,category_type,license_classes,source_type,content_version,review_status,prompt_ckb,prompt_de,explanation_ckb,explanation_de) VALUES ('q1','speed',4,'Grundstoff','["B"]','original','v','pending','p','p','e','e')`);
throws(`UPDATE questions SET points = 6 WHERE id='q1'`, "points domain");
db.exec(`INSERT INTO practice_sessions VALUES ('ps','u1',${now},NULL)`);
db.exec(`INSERT INTO practice_answers VALUES ('ps','q1',1,${now})`);
throws(`INSERT INTO practice_answers VALUES ('ps','q1',0,${now})`, "no duplicate scoring per session");
throws(`INSERT INTO learning_progress VALUES ('u1','q1',1,2,0,NULL)`, "correct_count <= attempts");
throws(`INSERT INTO purchase_orders VALUES ('o1','u1','mock',NULL,2000,'USD','PAYMENT_PENDING',${now},${now})`, "EUR only");
db.exec(`INSERT INTO purchase_orders VALUES ('o1','u1','mock','ref1',2000,'EUR','PAYMENT_PENDING',${now},${now})`);
throws(`INSERT INTO student_entitlements VALUES ('u1','LIFETIME',NULL,${now})`, "entitlement state domain");
throws(`DELETE FROM users WHERE id='u1'`, "orders keep users (RESTRICT)");
db.exec(`DELETE FROM users WHERE id='u2'`);
const ic = db.prepare("PRAGMA integrity_check").get();
assert.equal(Object.values(ic)[0], "ok");
assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
console.log(`migrations OK: ${tables.length} tables, constraints verified`);
