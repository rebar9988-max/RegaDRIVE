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

// ── 0002: licensed content import ────────────────────────────────────────
for (const t of ["content_reviews","question_translations","media_assets","question_media","question_versions","import_batches","import_errors"]) {
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t), `missing table ${t}`);
}
db.exec(`INSERT INTO content_licenses VALUES ('LIC-FIXTURE','Fixture Licensor','test only',${now},NULL,'fixture')`);
const insOff = (id, code, pub = "hidden") => `INSERT INTO questions (id,topic_id,question_code,points,category_type,license_classes,source_type,license_id,content_version,review_status,publication_status,prompt_ckb,prompt_de,explanation_ckb,explanation_de,catalogue_version,content_hash) VALUES ('${id}','speed','${code}',4,'Grundstoff','["B"]','licensed_official','LIC-FIXTURE','v','draft','${pub}','','Platzhalter','','','2026-01-01','h1')`;
throws(insOff("o0", "0.0.00-000", "published"), "imports can never insert published content");
db.exec(insOff("o1", "0.0.00-001"));
throws(`UPDATE questions SET prompt_de='geändert' WHERE id='o1'`, "licensed wording immutable");
throws(`UPDATE questions SET points=5 WHERE id='o1'`, "licensed points immutable");
db.exec(`UPDATE questions SET prompt_ckb='کوردی' WHERE id='o1'`); // translations remain editable
db.exec(`INSERT INTO answer_options VALUES ('o1','a',0,'','A',1)`);
throws(`UPDATE answer_options SET text_de='B' WHERE question_id='o1'`, "licensed options immutable");
throws(`UPDATE questions SET publication_status='published' WHERE id='o1'`, "no publication without approval");
throws(`INSERT INTO content_reviews VALUES ('r0','o1','question','EDUCATIONAL_REVIEW','bot','automated','pass','x',NULL,${now})`, "human stage cannot be automated");
db.exec(`INSERT INTO content_reviews VALUES ('r1','o1','question','APPROVED','Owner','content_owner','pass','evidence/1','other-hash',${now})`);
db.exec(`UPDATE questions SET stage='APPROVED' WHERE id='o1'`);
throws(`UPDATE questions SET publication_status='published' WHERE id='o1'`, "approval must match the exact content hash");
db.exec(`INSERT INTO content_reviews VALUES ('r2','o1','question','APPROVED','Owner','content_owner','pass','evidence/2','h1',${now})`);
db.exec(`UPDATE questions SET publication_status='published' WHERE id='o1'`); // allowed only now
throws(`INSERT INTO questions (id,topic_id,points,category_type,license_classes,source_type,content_version,review_status,prompt_ckb,prompt_de,explanation_ckb,explanation_de,answer_type) VALUES ('n1','speed',3,'Grundstoff','["B"]','original','v','draft','p','p','e','e','number')`, "number question needs numeric_answer");
db.exec(`INSERT INTO media_assets VALUES ('m1','image','media/${"a".repeat(64)}.webp','${"a".repeat(64)}','image/webp',1000,NULL,NULL,NULL,'LIC-FIXTURE','owner',${now})`);
throws(`INSERT INTO media_assets VALUES ('m2','image','media/${"b".repeat(64)}.svg','${"b".repeat(64)}','image/svg+xml',10,NULL,NULL,NULL,NULL,'owner',${now})`, "svg rejected");
throws(`INSERT INTO media_assets VALUES ('m3','image','media/${"a".repeat(64)}.webp','${"a".repeat(64)}','image/webp',1000,NULL,NULL,NULL,NULL,'owner',${now})`, "duplicate media rejected");
db.exec(`INSERT INTO question_media VALUES ('o1','m1','stimulus',0,'Bild',NULL)`);
throws(`DELETE FROM media_assets WHERE id='m1'`, "media in use cannot be deleted");
db.exec(`INSERT INTO import_batches (id,format,uploaded_by,status,rows_total,rows_invalid,created_at) VALUES ('b1','json','owner','validated',2,1,${now})`);
throws(`UPDATE import_batches SET status='committed' WHERE id='b1'`, "batch with invalid rows cannot be committed");
db.exec(`INSERT INTO question_versions VALUES ('o1',1,'h1','2026-01-01','{}','b1','owner',${now})`);
throws(`INSERT INTO question_versions VALUES ('o1',2,'h1','2026-01-01','{}','b1','owner',${now})`, "same content twice is a duplicate version");
db.exec(`INSERT INTO question_translations VALUES ('o1','prompt','ckb','کوردی','draft','t',${now})`);
throws(`INSERT INTO question_translations VALUES ('o1','prompt','fa','x','draft','t',${now})`, "only Sorani translations");
const ic = db.prepare("PRAGMA integrity_check").get();
assert.equal(Object.values(ic)[0], "ok");
assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);

// ── migrations-students: separate student D1 (regadrive-students), applied to its own database ──
const sdb = new DatabaseSync(":memory:");
const studentFiles = readdirSync("migrations-students").filter((f) => f.endsWith(".sql")).sort();
assert.ok(studentFiles.length > 0, "student migrations present");
for (const f of studentFiles) {
  const sql = readFileSync(`migrations-students/${f}`, "utf8");
  assert.ok(!/\bdr_|DROP\s+TABLE|DELETE\s+FROM/i.test(sql), `${f}: forward-only, never touches /dr tables`);
  sdb.exec(sql);
}
sdb.exec("PRAGMA foreign_keys = ON");
const stables = sdb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
for (const t of ["students", "email_challenges", "student_sessions", "student_progress", "student_auth_events", "student_rate_events"]) assert.ok(stables.includes(t), `missing student table ${t}`);
for (const t of stables) assert.ok(!t.startsWith("dr_"), "no /dr table in the student database");
const sthrows = (sql, msg) => assert.throws(() => sdb.exec(sql), undefined, msg);
const H = "pbkdf2-sha256$100000$s$h";
const h64 = "a".repeat(64);
sdb.exec(`INSERT INTO students (id,email_normalized,password_hash,created_at,updated_at) VALUES ('s1','a@example.de','${H}',${now},${now})`);
sthrows(`INSERT INTO students (id,email_normalized,password_hash,created_at,updated_at) VALUES ('s2','a@example.de','${H}',${now},${now})`, "unique e-mail");
sthrows(`INSERT INTO students (id,email_normalized,password_hash,created_at,updated_at) VALUES ('s2','B@example.de','${H}',${now},${now})`, "e-mail stored normalized");
sthrows(`INSERT INTO students (id,email_normalized,password_hash,created_at,updated_at) VALUES ('s2','b@example.de','plaintext',${now},${now})`, "only PBKDF2 hashes");
sthrows(`INSERT INTO students (id,email_normalized,password_hash,lang,created_at,updated_at) VALUES ('s2','b@example.de','${H}','fr',${now},${now})`, "language domain");
sthrows(`INSERT INTO email_challenges (id,student_id,purpose,code_hash,expires_at,created_at) VALUES ('c1','s1','verify_email','123456',${now + 1},${now})`, "codes stored hashed");
sthrows(`INSERT INTO email_challenges (id,student_id,purpose,code_hash,expires_at,created_at) VALUES ('c1','s1','sms','${h64}',${now + 1},${now})`, "no SMS purpose");
sthrows(`INSERT INTO email_challenges (id,student_id,purpose,code_hash,expires_at,created_at) VALUES ('c1','nope','verify_email','${h64}',${now + 1},${now})`, "challenge FK");
sdb.exec(`INSERT INTO email_challenges (id,student_id,purpose,code_hash,expires_at,created_at) VALUES ('c1','s1','verify_email','${h64}',${now + 1},${now})`);
sthrows(`UPDATE email_challenges SET attempts = 6 WHERE id='c1'`, "attempt cap");
sthrows(`INSERT INTO student_sessions (id,student_id,token_hash,created_at,last_seen_at,expires_at) VALUES ('x','s1','tok',${now},${now},${now + 1})`, "tokens stored hashed");
sdb.exec(`INSERT INTO student_sessions (id,student_id,token_hash,created_at,last_seen_at,expires_at) VALUES ('x','s1','${h64}',${now},${now},${now + 1})`);
sthrows(`INSERT INTO student_progress VALUES ('s1','not json',1,${now})`, "progress must be JSON");
sdb.exec(`INSERT INTO student_progress VALUES ('s1','{"version":1}',1,${now})`);
sdb.exec(`INSERT INTO student_auth_events (student_id,event_type,created_at) VALUES ('s1','login',${now})`);
sdb.exec(`DELETE FROM students WHERE id='s1'`);
for (const t of ["email_challenges", "student_sessions", "student_progress"]) assert.equal(sdb.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n, 0, `${t} cascades on account deletion`);
assert.equal(sdb.prepare("SELECT student_id FROM student_auth_events").get().student_id, null, "events keep no reference after deletion");
assert.equal(Object.values(sdb.prepare("PRAGMA integrity_check").get())[0], "ok");

console.log(`migrations OK: ${tables.length} tables, constraints verified; student database: ${stables.length} tables, constraints verified`);
