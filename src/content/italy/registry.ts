import { publicationGate, type ContentRecord, type GateResult, type ReviewRecord } from "../pipeline.ts";
import { PATENTE_B_RULES_IT } from "../../lib/shared/examIt.ts";
import { IT_QUESTIONS, IT_CONTENT_VERSION } from "./questions.ts";
import { IT_SIGNS } from "./signs.ts";
import type { ItQuestion } from "./types.ts";

/**
 * Provenance and review evidence for the Italian items, in the same shape the German content uses
 * (src/content/registry.ts) so that /dr and the publication gate need no second mechanism.
 *
 * Truthful state: SOURCE_CHECK and LICENSE_CHECK pass automatically (enforced by tests);
 * TRANSLATION_REVIEW and EDUCATIONAL_REVIEW have NOT been done by qualified humans, so nothing is
 * APPROVED and the gate below blocks every Italian item in production.
 */
const CREATED_ON = "2026-11-21";
const AUTHOR = "RegaDRIVE content team, from the owner's Patente B material (drafted with AI assistance, Claude Code)";

/** The exam-rule release Italian questions have to be validated against before they may be published. */
export const IT_RULES_VERSION = PATENTE_B_RULES_IT.version;

/** Legal references per question, checked by the educational reviewer before approval. CdS = Codice della Strada. */
const IT_QUESTION_SOURCES: Record<string, string[]> = {
  "it-b-001": ["CdS art. 2 (classificazione delle strade)"],
  "it-b-002": ["CdS art. 3, art. 176 (corsia di emergenza)"],
  "it-b-003": ["CdS art. 39, Reg. art. 80 (segnali di pericolo)"],
  "it-b-004": ["CdS art. 142, Reg. art. 116 (limite massimo di velocità)"],
  "it-b-005": ["CdS art. 122, Reg. art. 122 (direzione obbligatoria)"],
  "it-b-006": ["CdS art. 145, Reg. art. 106 (dare precedenza)"],
  "it-b-007": ["CdS art. 41 (luce gialla fissa)"],
  "it-b-008": ["CdS art. 142 comma 1 (limiti nei centri abitati)"],
  "it-b-009": ["CdS art. 145, Reg. art. 107 (segnale di arresto)"],
  "it-b-010": ["CdS art. 158 (divieto di fermata e sosta)"],
  "it-b-011": ["CdS art. 117 (limitazioni per i neopatentati)"],
  "it-b-012": ["CdS art. 189 (comportamento in caso di incidente)"],
  "it-b-013": ["CdS art. 40"],
  "it-b-014": ["CdS art. 39"],
  "it-b-015": ["CdS art. 149"],
  "it-b-016": ["CdS art. 148"],
  "it-b-017": ["CdS art. 153"],
};

const NEW_QUESTIONS = new Set(["it-b-013", "it-b-014", "it-b-015", "it-b-016", "it-b-017"]);

const automated = (stage: "SOURCE_CHECK" | "LICENSE_CHECK"): ReviewRecord => ({
  stage, reviewer: "content-pipeline", role: "automated", date: CREATED_ON,
  evidenceRef: "tests/unit/italy.test.ts", outcome: "pass",
});

function record(id: string, kind: ContentRecord["kind"], sourceRefs: string[]): ContentRecord {
  return {
    id, kind,
    stage: "TRANSLATION_REVIEW",
    licenseClass: "original_regadrive",
    licenseId: null,
    contentVersion: IT_CONTENT_VERSION,
    provenance: {
      author: NEW_QUESTIONS.has(id) ? "RegaDRIVE content team (drafted with AI assistance, Codex)" : AUTHOR,
      aiAssisted: true,
      createdOn: NEW_QUESTIONS.has(id) ? "2026-11-22" : CREATED_ON,
      sourceRefs,
    },
    reviews: [automated("SOURCE_CHECK"), automated("LICENSE_CHECK")],
    // Never validated by a human against the Italian exam rules yet.
    validatedAgainstRules: null,
  };
}

export const IT_CONTENT_REGISTRY: ReadonlyMap<string, ContentRecord> = new Map([
  ...IT_QUESTIONS.map((q) => [q.id, record(q.id, "question", IT_QUESTION_SOURCES[q.id] ?? [])] as const),
  ...IT_SIGNS.map((s) => [s.id, record(s.id, "sign", ["RegaDRIVE original illustration", "CdS Titolo II (segnaletica)"])] as const),
]);

/**
 * Fail-closed publication gate for an Italian item: the shared record checks of the pipeline, against
 * the Italian exam rules, plus the Italian question invariants. The German gate is left untouched
 * because it inspects German option-id answers, which Italian true/false questions do not have.
 */
export function itPublicationGate(id: string, question?: ItQuestion): GateResult {
  const rec = IT_CONTENT_REGISTRY.get(id);
  const base = publicationGate(rec, undefined, IT_RULES_VERSION);
  const reasons = [...base.reasons];
  if (question) {
    if (question.sourceType !== "original") reasons.push("Italian content must be original");
    if (question.questionCode !== null) reasons.push("original question carries an official code");
    if (question.reviewStatus !== "approved") reasons.push(`review status ${question.reviewStatus} is not approved`);
    if (question.publicationStatus !== "published") reasons.push("question is hidden");
  }
  return { publishable: reasons.length === 0, reasons };
}
