# Italian section (Patente B) — content layer

## What this is

The first real content for the Italian country option. Until now `IT` existed only in
`src/app/settings.ts` (per-country storage keys) and `src/lib/shared/license.ts`; every question,
lesson and sign in the repository was German (StVO).

Source of the material: the owner's own Patente B practice site
(`patenta-b-ismael-rasool.netlify.app`), authored by Ismael Hamadameen. The site advertises 7,020
questions, but its `index.html` contains **12 true/false questions and 8 sign illustrations** — that
is everything that existed to bring over. The 7,020 figure is the planned size of the syllabus and is
kept here only as `plannedCount` per chapter (`IT_PLANNED_TOTAL`), never as a count of questions that
exist.

## Files

| Path | Contents |
| --- | --- |
| `src/content/italy/types.ts` | `ItText`, `ItChapter`, `ItSign`, `ItQuestion` |
| `src/content/italy/chapters.ts` | the 16 syllabus chapters, five languages each |
| `src/content/italy/questions.ts` | the 12 true/false questions |
| `src/content/italy/signs.ts` | the 8 sign illustrations and their public URLs |
| `public/signs/it/*.svg` | the illustrations themselves (original artwork) |
| `tests/unit/italy.test.ts` | data consistency, review status, files on disk |

## Why a separate model

`src/content/types.ts` is built for the German catalogue: `Bilingual` requires German, questions are
multiple-choice with option ids, and `TrafficSign` requires an StVO number, Anlage and lfd. Nr. None
of that fits Italy, where the questions are true/false, the signs are not StVO signs and the source
language is Italian. The Italian model therefore lives beside it. Nothing in the German content, the
four learner languages or the fixed RTL layout is touched by this change.

## Languages

- `ckb` (Sorani) and `it` (Italian) are the authored source wording, taken from the owner's site.
- `kmrArab` is Kurmanji in Arabic script ("Badini"), also from the site. It is deliberately a field of
  its own: the app's `kmr` is Latin-script Kurmanji (`src/app/i18n.ts`) and must stay that way.
- `de`, `ar` and Latin-script `kmr` are drafted translations (AI-assisted) and are part of the same
  pending review. `tests/unit/i18n.test.ts` requires all four learner languages wherever `ckb` and
  `de` appear together, so none of them may be left out; `tests/unit/italy.test.ts` checks that every
  text actually carries them.

## Review status

Every question has `questionCode: null`, `sourceType: "original"` and `reviewStatus: "pending"`, per
the repository rule in `CLAUDE.md` and `docs/CONTENT_REVIEW.md`. Nothing here may be shown to learners
in production until a qualified Italian driving instructor and a native Sorani/Badini reviewer have
approved it. The reviews needed are the same two that the German content still awaits:
`TRANSLATION_REVIEW` and `EDUCATIONAL_REVIEW`.

## How an Italian item becomes visible to a learner

Nothing in this repository can publish itself. An item appears to a learner only when the server's
fail-closed gate passes, and that needs three recorded decisions by **named humans**, in this order,
entered by the signed-in owner at `/dr` → Content Review & Approval (filter: *پرسیار — ئیتاڵیا* and
*هێماکان — ئیتاڵیا*):

| # | Stage | Who must have done it | What is recorded |
| --- | --- | --- | --- |
| 1 | `TRANSLATION_REVIEW` | a native Sorani/Badini translator (not the instructor) | reviewer name, date, evidence reference |
| 2 | `EDUCATIONAL_REVIEW` | a qualified Italian driving instructor, a different person | reviewer name, date, evidence reference; the server stamps the Italian exam-rule version |
| 3 | `APPROVED` | the content owner | reviewer name, date, evidence reference, confirmation tick |

Rules the server enforces, so none of this can be shortcut:

- The order above. An approval without both earlier passes is rejected (`BOTH_REVIEWS_FIRST`).
- Stage 2 must not be the same person as stage 1 (`REVIEWERS_MUST_DIFFER`).
- A reviewer name that looks like a machine (Claude, GPT, bot, pipeline, "n/a", …) is refused
  (`REVIEWER_NAME_INVALID`). An AI cannot be a reviewer here, by design.
- An evidence reference of at least 8 characters is required, and the date may not be in the future.
- Each decision is bound to the **fingerprint** of the exact wording reviewed. Any later edit to that
  question or sign invalidates it and the item leaves production by itself.
- Italian decisions are stored in `dr_it_content_reviews` (migration `0007`), apart from the German
  `dr_content_reviews`, and are validated against the Italian exam rules, never the German ones.

### Owner steps, once

1. Apply the migrations to the production database so the Italian review table exists:
   `npx wrangler d1 migrations apply <regadrive D1> --remote`. Until this is applied, `/dr` → reviews
   returns an error and, fail-closed, nothing is published.
2. Line up the two reviewers (translator, Italian driving instructor) and keep their evidence
   (a signed PDF, a shared document, an e-mail — anything referenceable).
3. In `/dr`, select the items and record stage 1, then stage 2, then stage 3.

### The items awaiting review

Signs (8): `it-autostrada`, `it-pericolo`, `it-divieto`, `it-obbligo`, `it-precedenza`, `it-stop`, `it-semaforo`, `it-parcheggio`

Questions (12):

| id | chapter | answer key |
| --- | --- | --- |
| `it-b-001` | 1 | VERO |
| `it-b-002` | 1 | FALSO |
| `it-b-003` | 2 | VERO |
| `it-b-004` | 3 | VERO |
| `it-b-005` | 4 | FALSO |
| `it-b-006` | 5 | VERO |
| `it-b-007` | 7 | VERO |
| `it-b-008` | 9 | VERO |
| `it-b-009` | 11 | VERO |
| `it-b-010` | 13 | FALSO |
| `it-b-011` | 15 | VERO |
| `it-b-012` | 16 | VERO |

## Importing a catalogue (owner)

The Italian section serves whatever the owner imports, without a new build. The order is always the
same: **set up → import → review → published automatically.**

1. **Once:** `/dr` → Content → *Italy · setup and import* → **Create the Italian review table**. This is
   migration `0007` applied through the panel (additive DDL: it creates, never drops) and needs a fresh
   sign-in code. Until it exists, `/api/content/approved` reports `ready.it: false` and nothing Italian
   can be published — the German bank is unaffected.
2. **Import:** paste an array of questions and signs into the same panel. *Check only* validates and
   stores nothing; *Store* writes to `italy_content` in the content database. Both need
   `CONTENT_ADMIN_ENABLED` and `CONTENT_IMPORT_EXECUTION_ENABLED`; a real write also needs a fresh code.
   Up to 500 items per request.
3. **Review:** imported items appear in `/dr` → Content Review beside the bundled ones, and go through
   the same three stages (translation → educational → owner).
4. **Published:** `/api/content/italy` serves exactly the items whose own fingerprint passed all three
   stages, and the app reads that endpoint. Nothing else has to happen.

### What an item must contain

```json
{
  "id": "it-b-013",
  "chapter": 1,
  "answer": true,
  "sourceRefs": ["CdS art. 3"],
  "prompt":      { "it": "…", "ckb": "…", "kmrArab": "…" },
  "explanation": { "it": "VERO: …", "ckb": "…", "kmrArab": "…" },
  "signId": "it-autostrada"
}
```

A sign is `{ "id", "file": "<name>.svg", "group", "name": {…}, "sourceRefs": […] }`.

Rules the import enforces, item by item, rejecting what fails and storing the rest:

- `id` 3–64 characters of `a-z`, `0-9`, `-`, and never twice in one batch.
- `chapter` an integer 1–16; `answer` a boolean (VERO / FALSO).
- `prompt` and `explanation` in all three languages, **Italian in Latin script, Sorani and Badini in
  Arabic script**; optional `kmr`, `de`, `ar` are script-checked too, and Arabic may not contain
  Sorani-only letters.
- The Italian explanation must **begin with VERO or FALSO, matching the answer key**.
- At least one legal reference in `sourceRefs`; review cannot pass an item without one.
- `questionCode` absent or null, `sourceType` original, `reviewStatus` never `approved`: an import can
  never arrive pre-approved.
- `signId` must resolve, to a stored sign or one imported in the same batch.
- A sign's `file` must be a plain `<name>.svg` — no path and no URL.

### Changing an item later

Re-importing the same id with the same wording changes nothing, so its review survives. Re-importing
it with different wording stores the new version and **withdraws it from learners**, because the
approval was bound to the fingerprint of the wording that was reviewed. The panel lists those ids.

## State of the section

| Part | State |
| --- | --- |
| 16 chapters | in the app, five languages each |
| 12 true/false questions | in the app, **pending review** — not visible to learners in production |
| 8 sign illustrations | in the app, **pending review** — not visible to learners in production |
| Practice per chapter | works; shows the answer key, the explanation and the sign; records progress under Italy's own key |
| Mock exam | real rules wired in (30 statements, 20 minutes, max 3 errors; `src/lib/shared/examIt.ts`). It refuses to start until 30 **approved** questions exist, because a shorter paper would not be this exam |
| Languages | Sorani and Badini right to left, Italian source line left to right, Kurmanji/German/Arabic drafts |
| Cost | free: a purchase can only be required with payments and a production database and the flag, and payments are off (`src/lib/shared/flags.ts`) |
| 7,020 | the planned size of the syllabus (`IT_PLANNED_TOTAL`), never a count of questions that exist |

## Still open

1. **The two human reviews** (above). Until they are recorded, production shows 0 Italian questions and
   0 Italian signs — by design, not by fault.
2. **More questions.** 12 exist. The mock exam needs 30 approved ones; the syllabus plans 7,020.
3. **Italian lessons and vocabulary.** The Italian section has none; those screens are not linked under
   Italy rather than showing German ones.
4. **Latin-script Kurmanji, German and Arabic** wording for the Italian items is drafted, not reviewed;
   it is part of the same `TRANSLATION_REVIEW`.
5. **Exam results are not stored.** An Italian mock exam is scored in the browser; nothing is written to
   `mock_exam_results`, which is the German schema.

## Database inventory (2026-11-23)

The owner requested a visible home in the database for Italy. Content migration `0004_italy_inventory.sql` stores the existing 12 questions, 8 signs and 16 chapters in `regadrive-content.italy_content`, with `country=IT`, complete multilingual JSON and source references. It is an inventory of the imported original material, not a new approval or a replacement for the learner publication gate. The owner workbench reads counts and question rows from D1 through the authenticated `/api/dr/content/status` endpoint. Re-running the seed preserves existing rows. Later editorial changes must be imported explicitly; these stored snapshots do not silently follow source-file edits.

## Staged catalogue: automatic checks and publication blockers (2026-11-28)

The 7,020 supplied questions live in `regadrive-content.italy_catalogue_staging` (content migrations
0005–0006), with draft Sorani (`ckb`) and Duhok Badini (`kmr_arab`) translations. Production audit on
2026-11-28 (read-only): 7,020 rows in 117 batches, every row has both translations, 3,919 rows reference an
image, 1,082 draft chapters are marked `needs_review`, **0 approved, 0 published**.

`/dr` → *بەڕێوەبردنی ناوەڕۆک* → *ئیتاڵیا · پێداچوونەوەی کەتەلۆگ* now shows, per row and for the whole
catalogue, the automatic checks (`worker/italy/stagingChecks.ts`, computed on read from the stored text, no
schema change) and the reasons nothing is published (`GET /api/dr/italy/catalogue/summary`, owner session,
read-only).

Automatic checks — machine checks are never a review:

| Code | Severity | Meaning |
| --- | --- | --- |
| `MISSING` | error | no translation |
| `NOT_ARABIC_SCRIPT` | error | the Kurdish text is not in Arabic script |
| `NUMBERS_DIFFER` | error | the numbers differ from the Italian (Kurdish digits and «٫» are normalised) |
| `SORANI_LETTER_IN_BADINI` | error | Sorani «ڵ» in Badini |
| `LATIN_KURMANJI_IN_BADINI` | error | Hawar letters (ş, ç, ê, î, û) in Badini |
| `SORANI_FORM_IN_BADINI` / `BADINI_FORM_IN_SORANI` | warning | grammar of the other dialect |
| `UNKNOWN_LATIN_WORD` | warning | a Latin word the Italian does not contain |
| `NEGATION_NOT_FOUND` | warning | the Italian has a negation the heuristic cannot find (often a false alarm: «ڕوونادات») |

On the delivered translations: 0 errors, 18 rows with warnings, 7,002 clean. A row with an error cannot be
approved in the panel until its text is fixed.

Publication blockers. Per row: Sorani not approved, Badini not approved, needs revision, check error, check
warning, draft chapter unconfirmed, image rights unverified. For **every** row (the staging table has no place
for them yet): text rights unverified, no explanation, no legal reference, not yet in the three-stage review
pipeline (`italy_content` + `TRANSLATION_REVIEW` → `EDUCATIONAL_REVIEW` → `APPROVED`), images not hosted.
None of these can be cleared by software; `publishable` is always 0 while they remain.

Owner approval, made quicker without lowering the bar: the reviewer name and evidence reference are
remembered on the device (every decision still sends them and the server still checks them, including the
machine-name refusal), a filter shows rows whose checks are clean, and *پەسەندکردنی هەردوو زمان* records the
Sorani and the Badini decision for the selected rows in one action — two recorded decisions, each with the
named reviewer. The panel is RTL (Italian cells are LTR islands) and becomes one card per question on a phone.

Images: the 3,919 extracted images are **not** uploaded anywhere. Their rights are unverified, and publishing
unlicensed official exam content needs the owner's separate approval (`CLAUDE.md`).

Final-approval queue (2026-11-28): *ڕیزی پەسەندکردنی کۆتایی* at the top of the panel lists the questions that
are ready for a human decision — no automatic-check error, no revision request, at least one language still
pending — with one button per draft chapter (`GET /api/dr/italy/catalogue?queue=ready&chapter=N`, ordered by
chapter, up to 100 per page). On the delivered catalogue that is all 7,020 questions (18 of them carry a
warning to look at). Being in the queue is not an approval; every decision still needs a named reviewer.
