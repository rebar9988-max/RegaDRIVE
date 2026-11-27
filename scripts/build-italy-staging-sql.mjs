// Build the SQL that loads the private Italian catalogue into regadrive-content.italy_catalogue_staging.
//
//   node scripts/build-italy-staging-sql.mjs <package-folder> <translated-folder> <new-output-folder>
//
// <package-folder>     the supplied catalogue (translation-handoff-v2/ with manifest.json, images/)
// <translated-folder>  the draft translations (batch-NNN.merged.jsonl and batch-NNN.review.jsonl)
// <new-output-folder>  where the SQL is written; must not exist and must be outside this repository
//
// Every row is checked against the source package before any SQL is written: batch file hashes against
// the manifest, row ids and row hashes against the source batches, the answer key, and each linked JPEG
// byte for byte against its recorded SHA-256. Review statuses are taken from the review files and must
// all be 'pending' or 'needs_revision' unless a named human reviewer and a date are recorded. Inserts use
// ON CONFLICT DO NOTHING, so a rerun never overwrites or loses a staged row. Nothing is published.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const [pkgArg, trArg, outArg] = process.argv.slice(2);
if (!pkgArg || !trArg || !outArg) {
  console.error("Usage: node scripts/build-italy-staging-sql.mjs <package-folder> <translated-folder> <new-output-folder>");
  process.exit(2);
}
const pkg = resolve(pkgArg), tr = resolve(trArg), out = resolve(outArg);
const repo = resolve(".");
if (out === repo || out.startsWith(repo + sep)) throw new Error("Write the SQL outside the repository: the catalogue must never be committed.");
if (existsSync(out)) throw new Error(`Output folder already exists: ${out}`);

const handoff = existsSync(join(pkg, "translation-handoff-v2")) ? join(pkg, "translation-handoff-v2") : pkg;
const imagesRoot = existsSync(join(handoff, "manifest.json")) && handoff !== pkg ? pkg : resolve(handoff, "..");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const jsonl = (f) => readFileSync(f, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === "" ? "NULL" : String(Number(v)));

const manifest = JSON.parse(readFileSync(join(handoff, "manifest.json"), "utf8"));
mkdirSync(out, { recursive: true });
const seen = new Set();
let rows = 0, images = 0;
const imageHashes = new Map();

for (const entry of manifest.batches) {
  const name = entry.file.replace(/\.jsonl$/, "");
  const srcBuf = readFileSync(join(handoff, entry.file));
  if (sha(srcBuf) !== entry.sha256) throw new Error(`${entry.file}: differs from manifest`);
  const source = srcBuf.toString("utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  const merged = new Map(jsonl(join(tr, `${name}.merged.jsonl`)).map((r) => [r.source_id, r]));
  const review = new Map(jsonl(join(tr, `${name}.review.jsonl`)).map((r) => [r.source_id, r]));
  if (source.length !== entry.count || merged.size !== source.length || review.size !== source.length) throw new Error(`${name}: row counts differ`);

  const lines = [`-- ${name}: ${source.length} rows, staged as pending/unpublished`];
  for (const s of source) {
    const id = s.source_id, rec = s.source_record, m = merged.get(id), r = review.get(id);
    if (!m || !r) throw new Error(`${name}: ${id} missing from translations or review`);
    if (seen.has(id)) throw new Error(`duplicate source id ${id}`);
    seen.add(id);
    if (m.source_row_sha256 !== s.source_row_sha256 || r.source_row_sha256 !== s.source_row_sha256) throw new Error(`${id}: row hash differs`);
    if (m.source_record.question_it !== rec.question_it || m.source_record.correct_answer !== rec.correct_answer) throw new Error(`${id}: source wording or answer differs`);
    if ((rec.correct_answer === true) !== (rec.answer_original === "VERO")) throw new Error(`${id}: answer key inconsistent`);
    for (const k of ["ckb_status", "kmrArab_status"]) {
      if (!["pending", "needs_revision", "approved"].includes(r[k])) throw new Error(`${id}: invalid ${k}`);
      if (r[k] === "approved" && !(r.reviewer_name && r.review_date)) throw new Error(`${id}: approved without a named reviewer and date`);
    }
    if (rec.image) {
      if (!imageHashes.has(rec.image)) imageHashes.set(rec.image, sha(readFileSync(join(imagesRoot, rec.image))));
      if (imageHashes.get(rec.image) !== s.image_sha256) throw new Error(`${id}: image ${rec.image} differs from its hash`);
      images += 1;
    }
    const ckb = m.translations?.ckb ?? null, kmr = m.translations?.kmrArab ?? null;
    lines.push(
      "INSERT INTO italy_catalogue_staging (source_id, country, license_class, source_row_sha256, batch, question_it, correct_answer, answer_original, source_page, source_group, image, image_sha256, ckb, kmr_arab, translation_notes, ckb_status, kmr_arab_status, reviewer_name, review_date, review_notes) VALUES (" +
        [q(id), "'IT'", q(rec.license_class || "B"), q(s.source_row_sha256), q(name), q(rec.question_it), rec.correct_answer ? "1" : "0", q(rec.answer_original),
          n(rec.source_page), q(rec.source_group), q(rec.image || null), q(rec.image ? s.image_sha256 : null), q(ckb), q(kmr), q(m.review_notes ?? null),
          q(r.ckb_status), q(r.kmrArab_status), q(r.reviewer_name), q(r.review_date), q(r.notes)].join(", ") +
        ") ON CONFLICT(source_id) DO NOTHING;",
    );
    rows += 1;
  }
  writeFileSync(join(out, `${name}.sql`), lines.join("\n") + "\n");
}

if (rows !== manifest.total_questions || seen.size !== rows) throw new Error(`expected ${manifest.total_questions} rows, built ${rows}`);
writeFileSync(join(out, "verify.sql"),
  "SELECT COUNT(*) AS rows, COUNT(DISTINCT source_id) AS ids, SUM(ckb IS NOT NULL) AS ckb, SUM(kmr_arab IS NOT NULL) AS kmr_arab, " +
  "SUM(image IS NOT NULL) AS with_image, SUM(ckb_status = 'approved' OR kmr_arab_status = 'approved') AS approved, " +
  "SUM(publish_status <> 'unpublished') AS published FROM italy_catalogue_staging;\n");
console.log(JSON.stringify({ rows, batches: manifest.batches.length, rowsWithImage: images, distinctImages: imageHashes.size, out }));
