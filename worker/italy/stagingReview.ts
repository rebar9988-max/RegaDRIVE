import type { D1Like } from "../dr/db";
import { checkRow, rowBlockers, summarise, type BlockerInput, type RowBlocker, type RowChecks } from "./stagingChecks";

/**
 * Owner review of the staged Italian catalogue (content table italy_catalogue_staging, content
 * migrations 0005-0006). Reviewers read each question in Italian, Sorani and Badini beside its image
 * reference, and record a decision per language. A decision changes only the draft translation's review
 * status: the table can never publish (publish_status is fixed to 'unpublished'), so nothing here reaches
 * a learner. Approval needs a named human reviewer, a date and evidence, checked by checkReviewMetadata.
 */
export const STAGING_PAGE_MAX = 100;
export type StagingLanguage = "ckb" | "kmrArab";
export type StagingStatus = "pending" | "needs_revision" | "approved";
const STATUSES: readonly StagingStatus[] = ["pending", "needs_revision", "approved"];

/** Filter on the automatic checks: rows with an error, rows with only warnings, or rows with neither. */
export type StagingChecksFilter = "errors" | "warnings" | "clean";
const CHECK_FILTERS: readonly StagingChecksFilter[] = ["errors", "warnings", "clean"];
/**
 * `queue=ready`: the final-approval queue — rows with no automatic-check error, no revision request, and at
 * least one language still pending; ordered by draft chapter so the owner can work chapter by chapter.
 * Being in the queue is not an approval: each decision still needs a named reviewer.
 */
export type StagingQueue = "ready";
export interface StagingQuery { offset: number; limit: number; chapter: number | null; status: StagingStatus | null; search: string; checks: StagingChecksFilter | null; queue: StagingQueue | null }

export function parseStagingQuery(params: URLSearchParams): StagingQuery {
  const int = (key: string, fallback: number) => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") return fallback; // Number(null) is 0, not "absent"
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
  };
  const chapter = int("chapter", 0);
  const status = params.get("status");
  return {
    offset: int("offset", 0),
    limit: Math.min(STAGING_PAGE_MAX, Math.max(1, int("limit", 25))),
    chapter: chapter >= 1 && chapter <= 16 ? chapter : null,
    status: STATUSES.includes(status as StagingStatus) ? (status as StagingStatus) : null,
    search: (params.get("q") ?? "").trim().slice(0, 64),
    checks: CHECK_FILTERS.includes(params.get("checks") as StagingChecksFilter) ? (params.get("checks") as StagingChecksFilter) : null,
    queue: params.get("queue") === "ready" ? "ready" : null,
  };
}

export interface StagingRow {
  source_id: string; batch: string; question_it: string; correct_answer: number; answer_original: string;
  source_page: number | null; source_group: string | null; image: string | null; image_sha256: string | null;
  ckb: string | null; kmr_arab: string | null; translation_notes: string | null;
  ckb_status: StagingStatus; kmr_arab_status: StagingStatus; reviewer_name: string | null; review_date: string | null;
  review_notes: string | null; chapter_draft: number | null; chapter_confidence: string | null;
}

const ROW_COLUMNS = `source_id, batch, question_it, correct_answer, answer_original, source_page, source_group, image, image_sha256,
            ckb, kmr_arab, translation_notes, ckb_status, kmr_arab_status, reviewer_name, review_date, review_notes,
            chapter_draft, chapter_confidence`;

export interface ListedStagingRow extends StagingRow { checks: RowChecks; blockers: RowBlocker[] }

function matchesChecks(checks: RowChecks, filter: StagingChecksFilter): boolean {
  if (filter === "errors") return checks.errors > 0;
  if (filter === "warnings") return checks.errors === 0 && checks.warnings > 0;
  return checks.errors === 0 && checks.warnings === 0;
}

export async function listStaging(db: D1Like, q: StagingQuery) {
  const where: string[] = ["country = 'IT'"];
  const binds: unknown[] = [];
  if (q.chapter) { where.push("chapter_draft = ?"); binds.push(q.chapter); }
  if (q.status) { where.push("(ckb_status = ? OR kmr_arab_status = ?)"); binds.push(q.status, q.status); }
  if (q.queue === "ready") where.push("(ckb_status = 'pending' OR kmr_arab_status = 'pending') AND ckb_status <> 'needs_revision' AND kmr_arab_status <> 'needs_revision'");
  if (q.search) {
    if (/^\d+$/.test(q.search)) { where.push("source_id = ?"); binds.push(q.search); }
    else { where.push("question_it LIKE ?"); binds.push(`%${q.search.replace(/[%_]/g, "")}%`); }
  }
  const clause = where.join(" AND ");
  const order = q.queue === "ready" ? "chapter_draft, batch, source_id" : "batch, source_id";
  let total: number;
  let results: StagingRow[];
  if (q.checks || q.queue) {
    // The checks are computed from the text, so this filter reads the matching rows' text and pages in
    // memory: at most 7,020 short rows, and only when the owner asks for it.
    const all = await db.prepare(
      `SELECT source_id, question_it, ckb, kmr_arab FROM italy_catalogue_staging WHERE ${clause} ORDER BY ${order}`,
    ).bind(...binds).all<{ source_id: string; question_it: string; ckb: string | null; kmr_arab: string | null }>();
    const ids = all.results.filter((r) => {
      const checks = checkRow(r);
      if (q.queue === "ready" && checks.errors > 0) return false;
      return q.checks ? matchesChecks(checks, q.checks) : true;
    }).map((r) => r.source_id);
    total = ids.length;
    const page = ids.slice(q.offset, q.offset + q.limit);
    results = page.length === 0 ? [] : (await db.prepare(
      `SELECT ${ROW_COLUMNS} FROM italy_catalogue_staging WHERE country = 'IT' AND source_id IN (${page.map(() => "?").join(",")}) ORDER BY ${order}`,
    ).bind(...page).all<StagingRow>()).results;
  } else {
    total = (await db.prepare(`SELECT COUNT(*) AS total FROM italy_catalogue_staging WHERE ${clause}`).bind(...binds).first<{ total: number }>())?.total ?? 0;
    results = (await db.prepare(
      `SELECT ${ROW_COLUMNS} FROM italy_catalogue_staging WHERE ${clause} ORDER BY batch, source_id LIMIT ? OFFSET ?`,
    ).bind(...binds, q.limit, q.offset).all<StagingRow>()).results;
  }
  const counts = await db.prepare(
    `SELECT COUNT(*) AS total,
            SUM(ckb_status = 'approved') AS ckbApproved, SUM(kmr_arab_status = 'approved') AS kmrArabApproved,
            SUM(ckb_status = 'needs_revision' OR kmr_arab_status = 'needs_revision') AS needsRevision,
            SUM(ckb_status = 'pending' OR kmr_arab_status = 'pending') AS pending,
            SUM(chapter_confidence = 'needs_review') AS chapterNeedsReview
     FROM italy_catalogue_staging WHERE country = 'IT'`,
  ).first<Record<string, number>>();
  const rows: ListedStagingRow[] = results.map((r) => { const checks = checkRow(r); return { ...r, checks, blockers: rowBlockers(r, checks) }; });
  return { total, rows, counts: counts ?? {} };
}

/** Automatic checks and publication blockers over the whole staged catalogue (read-only). */
export async function summariseStaging(db: D1Like) {
  const { results } = await db.prepare(
    `SELECT question_it, ckb, kmr_arab, image, ckb_status, kmr_arab_status, chapter_confidence, chapter_draft
     FROM italy_catalogue_staging WHERE country = 'IT'`,
  ).all<BlockerInput>();
  return summarise(results);
}

export interface StagingDecision {
  sourceId: string; language: StagingLanguage; status: StagingStatus;
  reviewerName: string; reviewedOn: string; evidenceRef: string; note: string;
}

export function parseStagingDecision(body: unknown): StagingDecision | string {
  if (typeof body !== "object" || body === null) return "BAD_REQUEST";
  const b = body as Record<string, unknown>;
  const read = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const sourceId = read("sourceId");
  if (!/^\d{1,16}$/.test(sourceId)) return "UNKNOWN_ITEM";
  const language = read("language");
  if (language !== "ckb" && language !== "kmrArab") return "BAD_LANGUAGE";
  const status = read("status");
  if (!STATUSES.includes(status as StagingStatus)) return "BAD_STATUS";
  return { sourceId, language, status: status as StagingStatus, reviewerName: read("reviewerName"), reviewedOn: read("reviewedOn"), evidenceRef: read("evidenceRef"), note: read("note") };
}

/**
 * A decision for several selected questions at once (one language, one status, one reviewer). Accepts
 * `sourceIds` (1..STAGING_PAGE_MAX distinct ids) or a single `sourceId`. Every id gets its own recorded
 * decision with the same reviewer, date and evidence; nothing is approved that was not selected.
 */
export function parseStagingDecisions(body: unknown): StagingDecision[] | string {
  if (typeof body !== "object" || body === null) return "BAD_REQUEST";
  const b = body as Record<string, unknown>;
  if (b.sourceIds === undefined) { const one = parseStagingDecision(body); return typeof one === "string" ? one : [one]; }
  if (!Array.isArray(b.sourceIds) || b.sourceIds.length === 0) return "NO_ITEMS";
  if (b.sourceIds.length > STAGING_PAGE_MAX) return "TOO_MANY_ITEMS";
  const ids = [...new Set(b.sourceIds.map((v) => (typeof v === "string" ? v.trim() : "")))];
  if (ids.length !== b.sourceIds.length) return "REPEATED_ITEM";
  const out: StagingDecision[] = [];
  for (const id of ids) {
    const one = parseStagingDecision({ ...b, sourceId: id });
    if (typeof one === "string") return one;
    out.push(one);
  }
  return out;
}

/** Record one language decision. Returns false when the question is not staged. */
export async function recordStagingDecision(db: D1Like, d: StagingDecision, actor: string): Promise<boolean> {
  const column = d.language === "ckb" ? "ckb_status" : "kmr_arab_status";
  const note = `[${d.reviewedOn}] ${d.language}=${d.status} by ${d.reviewerName} (evidence: ${d.evidenceRef}; recorded by ${actor})${d.note ? ` — ${d.note}` : ""}`;
  const res = await db.prepare(
    `UPDATE italy_catalogue_staging
     SET ${column} = ?, reviewer_name = ?, review_date = ?,
         review_notes = CASE WHEN review_notes IS NULL OR review_notes = '' THEN ? ELSE review_notes || char(10) || ? END
     WHERE source_id = ? AND country = 'IT'`,
  ).bind(d.status, d.reviewerName, d.reviewedOn, note, note, d.sourceId).run();
  return ((res as { meta?: { changes?: number } }).meta?.changes ?? 0) > 0;
}
