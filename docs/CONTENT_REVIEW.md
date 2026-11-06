# Content review and licensing

## Workflow (enforced in code: `src/content/pipeline.ts`, `src/content/registry.ts`)
`DRAFT → SOURCE_CHECK → LICENSE_CHECK → TRANSLATION_REVIEW → EDUCATIONAL_REVIEW → APPROVED → PUBLISHED`

- Every question, lesson, sign and vocabulary entry has a registry record. The record holds a stable ID, provenance (author, date, **AI assistance disclosed**, source references), licence class, content version, review records with evidence references, and the exam-rule version it was validated against.
- **SOURCE_CHECK** and **LICENSE_CHECK** are automated. Their evidence is `tests/unit/content-pipeline.test.ts`.
- **TRANSLATION_REVIEW** (native Sorani reviewer), **EDUCATIONAL_REVIEW** (qualified driving instructor, who also checks the legal references) and **APPROVED** (content owner) require a named human and an evidence reference. The gate rejects automated sign-off for these stages.
- The publication gate blocks an item when a stage is missing, a failed review is still unresolved, sources are missing, an original question carries an official code, licensed content has no licence record, or the item has not been revalidated against the current exam-rule version.
- Production builds show **only** gate-approved items. `npm run build:preview` shows items still in review, with a visible banner; it is used for CI/E2E only, and preflight rejects preview builds for deployment.

## Current status (truthful)

- All 39 questions, 6 lessons, 14 sign explanations and 36 vocabulary entries are original RegaDRIVE texts (content version `2026.11-original-1`). They are written from public traffic rules (StVO) and are not copied from the official question catalogue.
- Status: all 95 items are at **TRANSLATION_REVIEW**. SOURCE_CHECK and LICENSE_CHECK have passed; **no human review has been done yet, so production publishes nothing.** Before you set `approved`, two reviews are needed: (1) a qualified German driving instructor checks the facts and German wording, and (2) a native Kurdish Sorani reviewer checks the translations and traffic terms.
- Official TÜV/DEKRA (amtlicher Fragenkatalog) questions may only be added with a licence. Use `sourceType: "licensed_official"`, a `content_licenses` record, the unchanged German wording and the real `questionCode`. The schema and tests reject official codes on original questions.
- Exam rules (`src/lib/shared/exam.ts`, version `klasse-b-ersterwerb-2026-11`): 20 Grundstoff + 10 Zusatzstoff questions, 110 points, at most 10 error points, and two wrong 5-point questions mean a fail. These were cross-checked on 2026-11-06 against TÜV NORD and bussgeldkatalog.de. The official time limit was **not** verified, so the simulation has no timer.
- Traffic-sign graphics are simplified RegaDRIVE illustrations of the official StVO signs.

## How to approve an item
1. The reviewer checks the item and its `sourceRefs`, then stores the signed review (PDF or issue link) as evidence.
2. In `src/content/registry.ts`, add `ReviewRecord`s for TRANSLATION_REVIEW, EDUCATIONAL_REVIEW and APPROVED with the reviewer, role, date and `evidenceRef`. Set `stage: "PUBLISHED"` and `validatedAgainstRules` to the current rules version.
3. Open a PR. CI shows the number of publishable items in `dist/build-info.json`.

## When exam rules change
Bump `version` in `src/lib/shared/exam.ts`. Every question then fails the gate until it has been re-reviewed and `validatedAgainstRules` is updated.
