import { CONTENT_VERSION, QUESTIONS } from "./questions";
import { LESSONS } from "./lessons";
import { SIGNS } from "./signs";
import { VOCABULARY } from "./vocabulary";
import type { ContentKind, ContentRecord, Provenance, ReviewRecord } from "./pipeline";

/**
 * Provenance and review evidence for every content item.
 * Current truthful state: SOURCE_CHECK and LICENSE_CHECK passed automatically (enforced by
 * tests/unit/content-pipeline.test.ts); TRANSLATION_REVIEW and EDUCATIONAL_REVIEW have NOT been done by
 * qualified humans yet, so nothing is APPROVED and the production publication gate blocks all items.
 */
const CREATED_ON = "2026-11-06";
const AUTHOR = "RegaDRIVE content team (drafted with AI assistance, Claude Code)";

/** Legal / educational references per question. Verified by the educational reviewer before approval. */
const QUESTION_SOURCES: Record<string, string[]> = {
  "rd-g-001": ["StVO §3 Abs. 3 Nr. 1"],
  "rd-g-002": ["StVO §3 Abs. 3 Nr. 2"],
  "rd-g-003": ["StVO §8 Abs. 1"],
  "rd-g-004": ["StVO §8, Anlage 2 Zeichen 205"],
  "rd-g-005": ["StVO §8, Anlage 2 Zeichen 206"],
  "rd-g-006": ["StVO Anlage 3 Zeichen 306"],
  "rd-g-007": ["StVO §36 Abs. 1"],
  "rd-g-008": ["StVO §26 Abs. 1"],
  "rd-g-009": ["StVO §20 Abs. 4"],
  "rd-g-010": ["StVO §5 Abs. 4"],
  "rd-g-011": ["StVO §4 Abs. 1", "Fahrschul-Faustregel „halber Tacho“ (educational heuristic)"],
  "rd-g-012": ["Fahrschul-Faustformel Reaktionsweg (educational heuristic)"],
  "rd-g-013": ["Fahrschul-Faustformel Bremsweg (educational heuristic)"],
  "rd-g-014": ["StVG §24c"],
  "rd-g-015": ["StVG §24a", "StGB §316"],
  "rd-g-016": ["StVO §3 Abs. 1 (Fahrtüchtigkeit)", "educational: fatigue warning signs"],
  "rd-g-017": ["StVO §23 Abs. 1a"],
  "rd-g-018": ["StVO §34 Abs. 1", "StGB §323c"],
  "rd-g-019": ["StVO §15", "educational: recommended distances"],
  "rd-g-020": ["StVO §11 Abs. 2"],
  "rd-g-021": ["StVO §21a Abs. 1"],
  "rd-g-022": ["StVO §21 Abs. 1a"],
  "rd-g-023": ["StVO §5 Abs. 1, Abs. 3 Nr. 1"],
  "rd-g-024": ["StVO Anlage 2 Zeichen 274"],
  "rd-g-025": ["StVO Anlage 2 Zeichen 267"],
  "rd-g-026": ["StVO Anlage 2 Zeichen 283"],
  "rd-g-027": ["StVO Anlage 3 Zeichen 325.1"],
  "rd-z-001": ["StVZO §36 Abs. 2"],
  "rd-z-002": ["StVO §2 Abs. 3a"],
  "rd-z-003": ["Autobahn-Richtgeschwindigkeits-Verordnung"],
  "rd-z-004": ["StVO §18 Abs. 3"],
  "rd-z-005": ["StVO §18 Abs. 7"],
  "rd-z-006": ["StVO §18 Abs. 1"],
  "rd-z-007": ["educational: fuel-efficient driving"],
  "rd-z-008": ["StVO §30 Abs. 1"],
  "rd-z-009": ["educational: vehicle manufacturer tyre-pressure guidance"],
  "rd-z-010": ["educational: ABS vehicle technology"],
  "rd-z-011": ["educational: vehicle dynamics with roof load"],
  "rd-z-012": ["StVO §16 Abs. 2"],
};

const provenance = (sourceRefs: string[]): Provenance => ({ author: AUTHOR, aiAssisted: true, createdOn: CREATED_ON, sourceRefs });

const automated = (stage: "SOURCE_CHECK" | "LICENSE_CHECK"): ReviewRecord => ({
  stage, reviewer: "content-pipeline", role: "automated", date: CREATED_ON,
  evidenceRef: "tests/unit/content-pipeline.test.ts", outcome: "pass",
});

function record(id: string, kind: ContentKind, sourceRefs: string[], licenseClass: ContentRecord["licenseClass"] = "original_regadrive"): ContentRecord {
  return {
    id, kind,
    stage: "TRANSLATION_REVIEW",
    licenseClass,
    licenseId: null,
    contentVersion: CONTENT_VERSION,
    provenance: provenance(sourceRefs),
    reviews: [automated("SOURCE_CHECK"), automated("LICENSE_CHECK")],
    // Never validated by a human against the current rules yet.
    validatedAgainstRules: null,
  };
}

export const CONTENT_REGISTRY: ReadonlyMap<string, ContentRecord> = new Map([
  ...QUESTIONS.map((q) => [q.id, record(q.id, "question", QUESTION_SOURCES[q.id] ?? [])] as const),
  ...LESSONS.map((l) => [l.id, record(l.id, "lesson", [`topic:${l.topicId}`, "StVO"])] as const),
  ...SIGNS.map((s) => [s.id, record(s.id, "sign", [`StVO Zeichen ${s.stvoNumber}`], "public_regulation_reference")] as const),
  ...VOCABULARY.map((v) => [v.id, record(v.id, "vocabulary", ["StVO terminology"])] as const),
]);
