// Applies ./migrations-content to an in-memory SQLite database (D1 is SQLite) and checks the rules of the
// private Italian catalogue staging table (content migration 0005). Local only, no catalogue data.
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new DatabaseSync(":memory:");
for (const f of readdirSync("migrations-content").filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(`migrations-content/${f}`, "utf8"));

const h = "a".repeat(64);
const cols = "source_id,source_row_sha256,batch,question_it,correct_answer,answer_original,image,image_sha256,ckb,kmr_arab";
const row = (id, ans = 1, orig = "VERO") => `INSERT INTO italy_catalogue_staging (${cols}) VALUES ('${id}','${h}','batch-001','Il segnale raffigurato',${ans},'${orig}','images/it_${id}.jpg','${h}','نیشانە','نیشان')`;
const throws = (sql, msg) => assert.throws(() => db.exec(sql), undefined, msg);

db.exec(row("1"));
const r = db.prepare("SELECT ckb_status, kmr_arab_status, publish_status, country FROM italy_catalogue_staging WHERE source_id='1'").get();
assert.deepEqual({ ...r }, { ckb_status: "pending", kmr_arab_status: "pending", publish_status: "unpublished", country: "IT" }, "staged rows start pending and unpublished");
throws(row("1"), "a source id is staged once");
db.exec(row("1").replace(") VALUES", ") VALUES").concat(" ON CONFLICT(source_id) DO NOTHING"));
assert.equal(db.prepare("SELECT COUNT(*) AS c FROM italy_catalogue_staging").get().c, 1, "a rerun keeps the staged row");
throws(row("2", 1, "FALSO"), "answer key and original verdict must agree");
throws(`UPDATE italy_catalogue_staging SET publish_status='published' WHERE source_id='1'`, "staging can never publish");
throws(`UPDATE italy_catalogue_staging SET question_it='altro' WHERE source_id='1'`, "source wording is immutable");
throws(`UPDATE italy_catalogue_staging SET correct_answer=0, answer_original='FALSO' WHERE source_id='1'`, "answer key is immutable");
throws(`UPDATE italy_catalogue_staging SET ckb_status='approved' WHERE source_id='1'`, "approval needs a named reviewer and date");
throws(`UPDATE italy_catalogue_staging SET ckb_status='done' WHERE source_id='1'`, "status domain");
db.exec(`UPDATE italy_catalogue_staging SET ckb='نیشانەی نوێ', ckb_status='needs_revision' WHERE source_id='1'`); // drafts stay editable
db.exec(`UPDATE italy_catalogue_staging SET ckb_status='approved', reviewer_name='Reviewer Name', review_date='2026-12-01' WHERE source_id='1'`);
assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name='italy_content'").get(), "the learner-facing catalogue table is untouched");
// 0006: draft chapters come from the source category, are flagged when uncertain and stay in 1-16.
const cat = (id, group) => db.exec(`INSERT INTO italy_catalogue_staging (source_id,source_row_sha256,batch,question_it,correct_answer,answer_original,source_group) VALUES ('${id}','${h}','batch-002','Il segnale',1,'VERO','Quesito n° 1 - ${group}')`);
cat("10", "Segnali di pericolo"); cat("11", "Pannelli integrativi dei segnali"); cat("12", "Categoria sconosciuta");
db.exec(readFileSync("migrations-content/0006_italy_catalogue_chapter_draft.sql", "utf8").split(/\r?\n/).filter((l) => !l.startsWith("ALTER")).join("\n"));
const ch = (id) => ({ ...db.prepare("SELECT chapter_draft c, chapter_confidence k FROM italy_catalogue_staging WHERE source_id=?").get(id) });
assert.deepEqual(ch("10"), { c: 2, k: "category_match" });
assert.deepEqual(ch("11"), { c: 8, k: "needs_review" });
assert.deepEqual(ch("12"), { c: null, k: null }, "an unknown category is left unclassified, never guessed");
throws(`UPDATE italy_catalogue_staging SET chapter_draft=17 WHERE source_id='10'`, "chapter domain");
console.log("italy staging checks passed");
