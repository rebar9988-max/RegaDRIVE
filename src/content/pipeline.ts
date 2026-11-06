/**
 * Educational content verification pipeline.
 * DRAFT → SOURCE_CHECK → LICENSE_CHECK → TRANSLATION_REVIEW → EDUCATIONAL_REVIEW → APPROVED → PUBLISHED
 * An item is publishable only with complete provenance, a valid licence classification, recorded human
 * approvals for translation and educational review, and validation against the current exam rules.
 */
import { KLASSE_B_RULES_2026 } from "../lib/shared/exam";
import type { Question } from "./types";

export const STAGES = ["DRAFT", "SOURCE_CHECK", "LICENSE_CHECK", "TRANSLATION_REVIEW", "EDUCATIONAL_REVIEW", "APPROVED", "PUBLISHED"] as const;
export type ContentStage = (typeof STAGES)[number];
export type ContentKind = "question" | "lesson" | "sign" | "vocabulary";
export type LicenseClass = "original_regadrive" | "licensed_official" | "public_regulation_reference";

export interface Provenance {
  /** Who produced the text. AI assistance must be disclosed; AI output is never authoritative on its own. */
  author: string;
  aiAssisted: boolean;
  createdOn: string;
  /** Legal or educational references the content is based on. */
  sourceRefs: string[];
}

export interface ReviewRecord {
  stage: Exclude<ContentStage, "DRAFT" | "PUBLISHED">;
  /** "automated" only for SOURCE_CHECK / LICENSE_CHECK; human reviews need a named, qualified reviewer. */
  reviewer: string;
  role: "automated" | "driving_instructor" | "sorani_translator" | "content_owner";
  date: string;
  evidenceRef: string;
  outcome: "pass" | "fail";
}

export interface ContentRecord {
  id: string;
  kind: ContentKind;
  stage: ContentStage;
  licenseClass: LicenseClass;
  licenseId: string | null;
  contentVersion: string;
  provenance: Provenance;
  reviews: ReviewRecord[];
  /** Exam-rule version the item was last validated against (questions only). */
  validatedAgainstRules: string | null;
}

const HUMAN_STAGES: ReviewRecord["stage"][] = ["TRANSLATION_REVIEW", "EDUCATIONAL_REVIEW", "APPROVED"];
const AUTOMATABLE: ReviewRecord["stage"][] = ["SOURCE_CHECK", "LICENSE_CHECK"];

export interface GateResult { publishable: boolean; reasons: string[] }

/** Fail-closed publication gate. Every reason listed blocks publication. */
export function publicationGate(rec: ContentRecord | undefined, question?: Question, rulesVersion = KLASSE_B_RULES_2026.version): GateResult {
  const reasons: string[] = [];
  if (!rec) return { publishable: false, reasons: ["no content record"] };
  if (rec.stage !== "PUBLISHED" && rec.stage !== "APPROVED") reasons.push(`stage ${rec.stage} is before APPROVED`);
  if (!rec.provenance.author || !rec.provenance.createdOn) reasons.push("incomplete provenance");
  if (rec.provenance.sourceRefs.length === 0) reasons.push("no source references");
  if (rec.licenseClass === "licensed_official" && !rec.licenseId) reasons.push("licensed content without licence record");
  for (const stage of [...AUTOMATABLE, ...HUMAN_STAGES]) {
    const r = rec.reviews.find((x) => x.stage === stage && x.outcome === "pass");
    if (!r) { reasons.push(`missing passed ${stage}`); continue; }
    if (HUMAN_STAGES.includes(stage) && (r.role === "automated" || !r.reviewer.trim())) reasons.push(`${stage} needs a named human reviewer`);
    if (!r.evidenceRef.trim()) reasons.push(`${stage} has no evidence reference`);
  }
  if (rec.reviews.some((r) => r.outcome === "fail" && !rec.reviews.some((p) => p.stage === r.stage && p.outcome === "pass" && p.date >= r.date))) {
    reasons.push("an unresolved failed review exists");
  }
  if (rec.kind === "question") {
    if (rec.validatedAgainstRules !== rulesVersion) reasons.push(`not revalidated against exam rules ${rulesVersion}`);
    if (question) {
      if (question.sourceType === "original" && question.questionCode !== null) reasons.push("original question carries an official code");
      if (question.sourceType === "licensed_official" && (!question.questionCode || !rec.licenseId)) reasons.push("official question without code or licence");
      if (question.sourceType === "original" && rec.licenseClass !== "original_regadrive") reasons.push("licence class does not match source type");
      if (question.correct.length === 0 || !question.correct.every((c) => question.options.some((o) => o.id === c))) reasons.push("answer mapping invalid");
    }
  }
  return { publishable: reasons.length === 0, reasons };
}

/** Index of the stage, for progress display and monotonic checks. */
export const stageIndex = (s: ContentStage) => STAGES.indexOf(s);
