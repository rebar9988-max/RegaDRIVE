import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { referencesIllustration } from './lib/italy-image-review.mjs'

const [packagePath, databasePath, outputPath] = process.argv.slice(2)
if (!packagePath || !databasePath || !outputPath) {
  throw new Error('Usage: node scripts/export-italy-translation.mjs <source package> <private SQLite file> <new output folder>')
}

const { source, questions } = JSON.parse(readFileSync(join(packagePath, 'questions.it.json'), 'utf8'))
const database = new DatabaseSync(databasePath, { readOnly: true })
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const ids = new Set()
let rows
try {
  const stagedSource = database.prepare('SELECT payload FROM italy_staging_sources WHERE sha256 = ?').get(source.sha256)
  if (stagedSource?.payload !== JSON.stringify(source)) throw new Error('Staged source metadata differs from package')
  const staged = database.prepare("SELECT * FROM italy_staging_questions WHERE country = 'IT' AND source_sha256 = ?").all(source.sha256)
  if (staged.length !== questions.length) throw new Error('Staged row count differs from package')
  const byId = new Map(staged.map((row) => [row.source_id, row]))
  rows = questions.map((question) => {
    const { id, image } = question
    if (!/^\d+$/u.test(id) || ids.has(id)) throw new Error(`Invalid or duplicate ID: ${id}`)
    ids.add(id)
    const record = byId.get(id)
    const payload = JSON.stringify(question)
    if (record?.payload !== payload) throw new Error(`Staged question differs: ${id}`)
    if (image && image !== `images/it_${id}.jpg`) throw new Error(`Invalid image link: ${id}`)
    const bytes = image ? readFileSync(join(packagePath, image)) : null
    if (bytes ? !record.image || !bytes.equals(record.image) : record.image !== null) {
      throw new Error(`Staged image differs: ${id}`)
    }
    return {
      source_id: id,
      source_row_sha256: hash(payload),
      image_sha256: bytes ? hash(bytes) : null,
      needs_image_review: !image && referencesIllustration(question.question_it),
      source_record: question,
      translations: { ckb: null, kmrArab: null },
      translation_status: 'pending',
    }
  })
} finally {
  database.close()
}

mkdirSync(outputPath)
const write = (name, data) => writeFileSync(join(outputPath, name), data, { flag: 'wx' })
const batches = []
const batchSize = 60
for (let offset = 0; offset < rows.length; offset += batchSize) {
  const batch = rows.slice(offset, offset + batchSize)
  const file = `batch-${String(batches.length + 1).padStart(3, '0')}.jsonl`
  const data = batch.map((row) => JSON.stringify(row)).join('\n') + '\n'
  write(file, data)
  batches.push({ file, count: batch.length, sha256: hash(data) })
}
const manifest = {
  source,
  total_questions: rows.length,
  total_images: rows.filter((row) => row.image_sha256 !== null).length,
  needs_image_review: rows.filter((row) => row.needs_image_review).map((row) => row.source_id),
  batches,
}
write('manifest.json', JSON.stringify(manifest, null, 2) + '\n')
write('CLAUDE.md', `# Italian driving theory translation handoff

Work one batch at a time. Use the original Italian statement in source_record.question_it.
Produce separate UTF-8 JSONL output for each batch. For each input row, return source_id,
source_row_sha256, ckb, kmrArab, and review_notes. Preserve IDs and hashes exactly.
Use Kurdish Sorani in Arabic script for ckb and Duhok Badini in Arabic script for kmrArab.
Preserve negation, numbers, units and the exact meaning, including deliberately false
statements. Use the answer only as context. Do not rewrite a false statement to make it true.
Do not invent an explanation or infer missing text from an image. Leave an uncertain
translation null and describe the issue in review_notes. Return one row per input ID.

Image paths are relative to the original package folder beside this export. An image hash
confirms the file bytes and filename association from the package. Visual correspondence
with the original PDF still needs review. Flag missing or questionable illustrations.

All translations are drafts for human review. This export grants no publication rights.
Keep the original inputs and manifest intact. Do not upload this catalogue or its images
to a hosted service without authorization covering that transfer.
`)
console.log(`Exported ${rows.length} questions with ${manifest.total_images} image links into ${batches.length} batches.`)
