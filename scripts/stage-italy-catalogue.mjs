import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { referencesIllustration } from './lib/italy-image-review.mjs'

const [directory, databasePath] = process.argv.slice(2)
if (!directory || !databasePath) {
  throw new Error('Usage: node scripts/stage-italy-catalogue.mjs <package folder> <private SQLite file>')
}

const { source, questions } = JSON.parse(readFileSync(join(directory, 'questions.it.json'), 'utf8'))
const validation = JSON.parse(readFileSync(join(directory, 'validation.json'), 'utf8'))
const ids = new Set()
const imageFiles = new Set(readdirSync(join(directory, 'images')))
const pages = new Map()
const categories = new Set()
const imageHashes = new Set()
const possibleMissingImages = []
let imageCount = 0
let trueCount = 0

const rows = questions.map((question) => {
  const { id, image, source_page: page, source_group: group } = question
  const match = /^Quesito n° \d+ - (.+)$/u.exec(group)
  if (typeof id !== 'string' || !/^\d+$/u.test(id) || ids.has(id) ||
      question.country !== 'IT' || question.license_class !== 'B' ||
      typeof question.question_it !== 'string' || !question.question_it.trim() ||
      typeof question.correct_answer !== 'boolean' ||
      question.answer_original !== (question.correct_answer ? 'VERO' : 'FALSO') ||
      !Number.isInteger(page) || page < 1 || page > source.pages || !match ||
      question.review_status !== 'pending' || question.publish_status !== 'unpublished') {
    throw new Error(`Invalid staging record: ${id}`)
  }
  ids.add(id)
  categories.add(match[1])
  trueCount += Number(question.correct_answer)
  const totals = pages.get(page) ?? { questions: 0, images: 0 }
  totals.questions++
  pages.set(page, totals)
  let bytes = null
  if (image) {
    const filename = `it_${id}.jpg`
    if (image !== `images/${filename}` || !imageFiles.delete(filename)) {
      throw new Error(`Invalid image reference for ${id}`)
    }
    bytes = readFileSync(join(directory, 'images', filename))
    if (bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8 ||
        bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) {
      throw new Error(`Invalid JPEG markers for ${id}`)
    }
    imageCount++
    totals.images++
    imageHashes.add(createHash('sha256').update(bytes).digest('hex'))
  } else if (referencesIllustration(question.question_it)) {
    possibleMissingImages.push(id)
  }
  return { id, payload: JSON.stringify(question), bytes }
})

if (rows.length !== validation.summary.questions || imageCount !== validation.summary.with_images ||
    imageFiles.size || pages.size !== source.pages || validation.per_page.length !== source.pages ||
    validation.per_page.some(({ page, questions: count, images }) =>
      pages.get(page)?.questions !== count || pages.get(page)?.images !== images)) {
  throw new Error('The package differs from the extraction manifest')
}

const database = new DatabaseSync(databasePath)
const counts = { added: 0, replaced: 0, unchanged: 0, rejected: 0 }
try {
  database.exec(`
    CREATE TABLE IF NOT EXISTS italy_staging_sources (
      sha256 TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS italy_staging_questions (
      country TEXT NOT NULL CHECK (country = 'IT'),
      source_id TEXT NOT NULL,
      source_sha256 TEXT NOT NULL REFERENCES italy_staging_sources(sha256),
      payload TEXT NOT NULL,
      image BLOB,
      PRIMARY KEY (country, source_id)
    ) STRICT;
  `)
  const find = database.prepare("SELECT source_sha256, payload, image FROM italy_staging_questions WHERE country = 'IT' AND source_id = ?")
  const insert = database.prepare("INSERT INTO italy_staging_questions VALUES ('IT', ?, ?, ?, ?)")
  for (let offset = 0; offset < rows.length; offset += 500) {
    database.exec('BEGIN IMMEDIATE')
    try {
      database.prepare('INSERT OR IGNORE INTO italy_staging_sources VALUES (?, ?)')
        .run(source.sha256, JSON.stringify(source))
      for (const { id, payload, bytes } of rows.slice(offset, offset + 500)) {
        const existing = find.get(id)
        if (!existing) {
          insert.run(id, source.sha256, payload, bytes)
          counts.added++
        } else if (existing.source_sha256 === source.sha256 && existing.payload === payload &&
          (bytes === null ? existing.image === null : existing.image !== null && bytes.equals(existing.image))) {
          counts.unchanged++
        } else {
          throw new Error(`Staged record ${id} differs. Preserve the existing database and use a new staging file.`)
        }
      }
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }
  const staged = database.prepare(`
    SELECT count(*) AS questions, count(image) AS images
    FROM italy_staging_questions WHERE source_sha256 = ?
  `).get(source.sha256)
  if (staged.questions !== rows.length || staged.images !== imageCount) {
    throw new Error('Private staging counts differ from the package')
  }
  console.log(JSON.stringify({
    ...counts, ...staged, trueCount, falseCount: rows.length - trueCount,
    pages: pages.size, categories: [...categories].sort(), distinctImageHashes: imageHashes.size,
    possibleMissingImages,
  }, null, 2))
} finally {
  database.close()
}
