import { IT_QUESTIONS } from "../../src/content/italy/questions";
import { IT_SIGNS } from "../../src/content/italy/signs";
import { parseItQuestion, parseItSign } from "../../src/content/italy/schema";
import type { ItQuestion, ItSign } from "../../src/content/italy/types";
import type { D1Like } from "../dr/db";

/**
 * The Italian catalogue the server works with.
 *
 * Questions and signs can live in two places: compiled into this build, and stored in the content
 * database (table italy_content, content migration 0004). Stored content wins, so the owner can import
 * a catalogue and have it reviewed and published without a code change. A row that does not pass the
 * same validation as the bundled catalogue is ignored rather than served.
 */
export interface ItalyCatalogue {
  questions: ItQuestion[];
  signs: ItSign[];
  /** "stored" when the content database supplied it, "bundled" when this build did. */
  source: "stored" | "bundled";
  /** Stored rows that failed validation and were left out. */
  skipped: number;
}

export const bundledItalyCatalogue = (): ItalyCatalogue => ({ questions: IT_QUESTIONS, signs: IT_SIGNS, source: "bundled", skipped: 0 });

interface Row { id: string; kind: string; payload: string }

/**
 * Read the stored catalogue. Falls back to the bundled one when the table is missing, empty or
 * unreadable: a learner never sees a half-loaded catalogue, and nothing is published either way until
 * the publication gate passes.
 */
export async function loadItalyCatalogue(contentDb: D1Like | undefined): Promise<ItalyCatalogue> {
  if (!contentDb) return bundledItalyCatalogue();
  let rows: Row[];
  try {
    const res = await contentDb.prepare(
      "SELECT id, kind, payload FROM italy_content WHERE country = 'IT' AND kind IN ('question','sign') ORDER BY kind, id",
    ).all<Row>();
    rows = res.results;
  } catch { return bundledItalyCatalogue(); }
  if (rows.length === 0) return bundledItalyCatalogue();

  const signs: ItSign[] = [];
  const questionRows: unknown[] = [];
  let skipped = 0;
  for (const row of rows) {
    let payload: unknown;
    try { payload = JSON.parse(row.payload); } catch { skipped += 1; continue; }
    if (row.kind === "sign") {
      const parsed = parseItSign(payload);
      if (parsed.value) signs.push(parsed.value); else skipped += 1;
    } else {
      questionRows.push(payload);
    }
  }
  // Signs are parsed first, because a question may only point at a sign that exists.
  const signIds = new Set(signs.length > 0 ? signs.map((s) => s.id) : IT_SIGNS.map((s) => s.id));
  const questions: ItQuestion[] = [];
  for (const payload of questionRows) {
    const parsed = parseItQuestion(payload, signIds);
    if (parsed.value) questions.push(parsed.value); else skipped += 1;
  }
  if (questions.length === 0 && signs.length === 0) return { ...bundledItalyCatalogue(), skipped };
  return {
    questions: questions.length > 0 ? questions : IT_QUESTIONS,
    signs: signs.length > 0 ? signs : IT_SIGNS,
    source: "stored",
    skipped,
  };
}
