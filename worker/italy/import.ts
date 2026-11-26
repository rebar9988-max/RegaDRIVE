import { parseItQuestion, parseItSign, type Issue } from "../../src/content/italy/schema";
import type { D1Like } from "../dr/db";
import { loadItalyCatalogue } from "./catalogue";

/**
 * Owner import of Italian content into the content database.
 *
 * Storing is not publishing: every stored item still has to pass the human review stages in /dr before
 * a learner sees it, and editing an item invalidates the approval bound to its previous wording. The
 * import validates each item on its own and reports exactly what was rejected and why; nothing is
 * invented and nothing partially valid is stored.
 */
export const IT_IMPORT_MAX_ITEMS = 500;

export interface ImportResult {
  dryRun: boolean;
  received: number;
  stored: number;
  unchanged: number;
  rejected: { index: number; id: string; issues: Issue[] }[];
  /** Ids whose wording changed, so any approval recorded for the old wording no longer counts. */
  changed: string[];
}

interface Candidate { id: string; kind: "question" | "sign"; chapter: number | null; payload: string }

export function parseItalyImport(body: unknown): { items: unknown[]; dryRun: boolean } | string {
  if (typeof body !== "object" || body === null) return "BAD_REQUEST";
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.items)) return "BAD_REQUEST";
  if (b.items.length === 0) return "NO_ITEMS";
  if (b.items.length > IT_IMPORT_MAX_ITEMS) return "TOO_MANY_ITEMS";
  return { items: b.items, dryRun: b.dryRun === true };
}

/** Validate a batch against the catalogue's sign ids, without touching the database. */
export async function validateItalyImport(contentDb: D1Like, items: unknown[]): Promise<{ accepted: Candidate[]; rejected: ImportResult["rejected"] }> {
  const catalogue = await loadItalyCatalogue(contentDb);
  const signIds = new Set(catalogue.signs.map((s) => s.id));
  const accepted: Candidate[] = [];
  const rejected: ImportResult["rejected"] = [];
  const seen = new Set<string>();

  // Signs first in the same batch, so a question may point at a sign imported alongside it.
  const order = [...items.entries()].sort((a, b) => kindOf(a[1]) === kindOf(b[1]) ? 0 : kindOf(a[1]) === "sign" ? -1 : 1);
  for (const [index, raw] of order) {
    const kind = kindOf(raw);
    const id = typeof raw === "object" && raw !== null ? String((raw as Record<string, unknown>).id ?? "") : "";
    if (seen.has(id) && id) { rejected.push({ index, id, issues: [{ field: "id", problem: "repeated in this import" }] }); continue; }
    if (kind === "sign") {
      const parsed = parseItSign(raw);
      if (!parsed.value) { rejected.push({ index, id, issues: parsed.issues }); continue; }
      signIds.add(parsed.value.id);
      seen.add(parsed.value.id);
      accepted.push({ id: parsed.value.id, kind: "sign", chapter: null, payload: JSON.stringify(parsed.value) });
    } else {
      const parsed = parseItQuestion(raw, signIds);
      if (!parsed.value) { rejected.push({ index, id, issues: parsed.issues }); continue; }
      seen.add(parsed.value.id);
      accepted.push({ id: parsed.value.id, kind: "question", chapter: parsed.value.chapter, payload: JSON.stringify(parsed.value) });
    }
  }
  return { accepted, rejected };
}

const kindOf = (raw: unknown): "question" | "sign" => {
  if (typeof raw !== "object" || raw === null) return "question";
  const r = raw as Record<string, unknown>;
  if (r.kind === "sign" || typeof r.file === "string") return "sign";
  return "question";
};

/** Store a validated batch. Upserts by id; an unchanged payload is left alone so its review survives. */
export async function runItalyImport(contentDb: D1Like, items: unknown[], dryRun: boolean, sourceRef: string): Promise<ImportResult> {
  const { accepted, rejected } = await validateItalyImport(contentDb, items);
  const result: ImportResult = { dryRun, received: items.length, stored: 0, unchanged: 0, rejected, changed: [] };
  for (const item of accepted) {
    const before = await contentDb.prepare("SELECT payload FROM italy_content WHERE id = ?").bind(item.id).first<{ payload: string }>();
    if (before?.payload === item.payload) { result.unchanged += 1; continue; }
    if (before) result.changed.push(item.id);
    if (!dryRun) {
      await contentDb.prepare(
        `INSERT INTO italy_content (id, country, kind, chapter, payload, source_ref) VALUES (?, 'IT', ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, chapter = excluded.chapter, payload = excluded.payload, source_ref = excluded.source_ref`,
      ).bind(item.id, item.kind, item.chapter, item.payload, sourceRef).run();
    }
    result.stored += 1;
  }
  return result;
}
