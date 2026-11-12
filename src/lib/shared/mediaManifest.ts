/**
 * Media manifest: where every question image and video comes from, which traffic scenario it shows and who
 * confirmed it. Fail closed: a file is approved only with complete provenance, an approved scenario sheet and
 * a passed review by a named driving instructor of exactly this file (sha256). Pure and runtime-agnostic.
 */
import type { MediaKind } from "../../content/types";

export type MediaOrigin = "original_regadrive" | "licensed";

/** Written description of the traffic situation. Approved before anything is rendered. */
export interface ScenarioSheet {
  id: string;
  /** Question ids (or official numbers) this scenario belongs to. */
  questionRefs: string[];
  /** What is where, who moves, which sign or rule applies — in German, the language of the exam. */
  description: string;
  /** StVO sign numbers visible in the scene, e.g. "205". */
  signs: string[];
  /** Legal references the expected behaviour follows from, e.g. "StVO §8 Abs. 1". */
  legalRefs: string[];
  /** The behaviour the picture must lead to; must agree with the answer key of the questions. */
  expectedBehaviour: string;
  /** Driving instructor who approved the sheet before rendering. */
  approvedBy: string;
  approvedOn: string;
}

export interface MediaReview {
  reviewer: string;
  role: "driving_instructor" | "content_owner" | "automated";
  date: string;
  /** sha256 of the reviewed file: a re-render needs a new review. */
  sha256: string;
  outcome: "pass" | "fail";
  evidenceRef: string;
}

export interface MediaRecord {
  /** File name as referenced by the import file. */
  file: string;
  kind: MediaKind;
  sha256: string;
  origin: MediaOrigin;
  /** Required for licensed media: id of the registered licence. */
  licenseId?: string | null;
  /** Who made it (person or studio). */
  author: string;
  /** Production tool, e.g. "Blender 4.2". */
  tool: string;
  /** Path of the editable source (e.g. the .blend file) in the RegaDRIVE media archive. */
  sourceFile: string;
  /** Third-party assets inside the scene with their licence, e.g. "car model — CC0 — <source>". */
  thirdPartyAssets: string[];
  /** Any generative-AI involvement must be disclosed. It never replaces the instructor review. */
  aiGenerated: boolean;
  scenarioId: string;
  createdOn: string;
  reviews: MediaReview[];
}

export interface MediaManifest { scenarios: ScenarioSheet[]; media: MediaRecord[] }

export type MediaIssueKind =
  | "duplicate_file" | "duplicate_scenario" | "bad_hash" | "bad_date" | "unknown_origin"
  | "licensed_without_licence" | "unknown_licence" | "original_with_licence"
  | "missing_author" | "missing_tool" | "missing_source_file" | "third_party_asset_without_licence"
  | "unknown_scenario" | "scenario_incomplete" | "scenario_not_approved" | "scenario_without_question"
  | "file_not_attached" | "hash_mismatch" | "kind_mismatch"
  | "no_instructor_review" | "review_of_other_version" | "failed_review";

export interface MediaIssue { subject: string; kind: MediaIssueKind; detail?: string }

export interface ManifestContext {
  knownLicenses: ReadonlySet<string>;
  /** Files actually attached (from media.ts): file name -> sha256 + kind. When given, the manifest must match them. */
  attached?: ReadonlyMap<string, { sha256: string; kind: MediaKind }>;
}

export interface ManifestResult {
  issues: MediaIssue[];
  /** Files with no issue at all: provenance complete, scenario approved, this exact file passed the instructor review. */
  approvedFiles: string[];
  summary: { scenarios: number; media: number; approved: number; original: number; licensed: number; aiGenerated: number };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HASH = /^[0-9a-f]{64}$/;
const filled = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
/** "<what> — <licence> — <source>": every bundled third-party asset names its licence. */
const ASSET = /^.{2,}\s[—-]\s.{2,}\s[—-]\s.{2,}$/;

export function parseMediaManifest(text: string): MediaManifest {
  const data = JSON.parse(text) as Partial<MediaManifest>;
  if (!data || typeof data !== "object" || !Array.isArray(data.scenarios) || !Array.isArray(data.media)) throw new Error('media manifest: expected { "scenarios": [...], "media": [...] }');
  return { scenarios: data.scenarios, media: data.media };
}

export function validateMediaManifest(m: MediaManifest, ctx: ManifestContext): ManifestResult {
  const issues: MediaIssue[] = [];
  const add = (subject: string, kind: MediaIssueKind, detail?: string) => issues.push({ subject, kind, detail });

  const scenarios = new Map<string, ScenarioSheet>();
  const scenarioOk = new Set<string>();
  for (const s of m.scenarios) {
    const id = filled(s?.id) ? s.id : "(scenario without id)";
    if (scenarios.has(id)) { add(id, "duplicate_scenario"); continue; }
    scenarios.set(id, s);
    const before = issues.length;
    if (!filled(s.description) || !filled(s.expectedBehaviour) || !Array.isArray(s.legalRefs) || s.legalRefs.filter(filled).length === 0 || !Array.isArray(s.signs)) add(id, "scenario_incomplete", "description, expected behaviour and at least one legal reference are required");
    if (!Array.isArray(s.questionRefs) || s.questionRefs.filter(filled).length === 0) add(id, "scenario_without_question");
    if (!filled(s.approvedBy) || !DATE.test(s.approvedOn ?? "")) add(id, "scenario_not_approved", "a named driving instructor approves the sheet before rendering");
    if (issues.length === before) scenarioOk.add(id);
  }

  const seen = new Set<string>();
  const approvedFiles: string[] = [];
  for (const r of m.media) {
    const file = filled(r?.file) ? r.file : "(media without file name)";
    const before = issues.length;
    if (seen.has(file)) add(file, "duplicate_file"); else seen.add(file);
    if (!HASH.test(r.sha256 ?? "")) add(file, "bad_hash");
    if (!DATE.test(r.createdOn ?? "")) add(file, "bad_date");

    if (r.origin === "licensed") {
      if (!filled(r.licenseId)) add(file, "licensed_without_licence");
      else if (!ctx.knownLicenses.has(r.licenseId)) add(file, "unknown_licence", r.licenseId);
    } else if (r.origin === "original_regadrive") {
      if (filled(r.licenseId)) add(file, "original_with_licence", "original media carries no licence id");
      if (!filled(r.tool)) add(file, "missing_tool");
      if (!filled(r.sourceFile)) add(file, "missing_source_file", "the editable source proves the work is original");
    } else add(file, "unknown_origin", "must be original_regadrive or licensed");
    if (!filled(r.author)) add(file, "missing_author");
    for (const a of Array.isArray(r.thirdPartyAssets) ? r.thirdPartyAssets : []) if (!filled(a) || !ASSET.test(a)) add(file, "third_party_asset_without_licence", String(a));
    if (!Array.isArray(r.thirdPartyAssets)) add(file, "third_party_asset_without_licence", "list the bundled assets (empty list when there are none)");

    if (!scenarios.has(r.scenarioId)) add(file, "unknown_scenario", r.scenarioId);
    else if (!scenarioOk.has(r.scenarioId)) add(file, "scenario_not_approved", r.scenarioId);

    const att = ctx.attached?.get(file);
    if (ctx.attached) {
      if (!att) add(file, "file_not_attached");
      else {
        if (att.sha256 !== r.sha256) add(file, "hash_mismatch", "the attached file is not the file described here");
        if (att.kind !== r.kind) add(file, "kind_mismatch");
      }
    }

    const reviews = Array.isArray(r.reviews) ? r.reviews : [];
    const human = reviews.filter((v) => v.role === "driving_instructor" && filled(v.reviewer) && filled(v.evidenceRef) && DATE.test(v.date ?? ""));
    const current = human.filter((v) => v.sha256 === r.sha256);
    if (current.some((v) => v.outcome === "fail" && !current.some((p) => p.outcome === "pass" && p.date >= v.date))) add(file, "failed_review");
    else if (!current.some((v) => v.outcome === "pass")) add(file, human.length ? "review_of_other_version" : "no_instructor_review", human.length ? "the file changed after the review" : undefined);

    if (issues.length === before) approvedFiles.push(file);
  }

  return {
    issues, approvedFiles,
    summary: {
      scenarios: m.scenarios.length, media: m.media.length, approved: approvedFiles.length,
      original: m.media.filter((r) => r.origin === "original_regadrive").length,
      licensed: m.media.filter((r) => r.origin === "licensed").length,
      aiGenerated: m.media.filter((r) => r.aiGenerated === true).length,
    },
  };
}
