# Owner content import (licensed questions, images, videos)

RegaDRIVE contains **no official exam content**. The owner imports licensed content personally. Import is **preview-only** until the owner activates the production database. Imported items are always `draft` / `hidden`, and nothing is ever published automatically.

## Steps
1. **Register the licence:** a `content_licenses` record with licensor, scope, validity and evidence reference. Rows that reference an unknown licence are rejected.
2. **Prepare files:** fill in `questions.template.json` or `questions.template.csv`. Every `[[…]]` placeholder must be replaced.
3. **Preview:** in a build with `VITE_ADMIN_UI=true`, open `/admin/import`. The check runs entirely in your browser; no upload happens. Select the question file and the image/video files. The preview shows `new`, `update`, `duplicate` or `invalid` per row, with field-level errors and warnings. You can edit the Sorani text there and export the corrected JSON.
4. **Server-side validation (optional):** `POST /api/admin/import/validate` with `Authorization: Bearer <owner token>`. This requires `CONTENT_ADMIN_ENABLED=true` and the secret `ADMIN_OWNER_TOKEN_SHA256`. It is a dry run and every call is audit-logged.
5. **Commit:** `POST /api/admin/import/commit` stays **disabled** until a production D1 database is activated by the owner and `CONTENT_IMPORT_EXECUTION_ENABLED=true`.
6. **Review and publish:** every item goes through TRANSLATION_REVIEW → EDUCATIONAL_REVIEW → owner APPROVED (`docs/CONTENT_REVIEW.md`). The database refuses publication without an owner APPROVED review of the exact content hash.

## Field reference
| Field (JSON / CSV) | Rule |
| --- | --- |
| `questionCode` / `question_code` | Required for `licensed_official`, in the official format. Must be empty for `original`. Unique per file. |
| `catalogueVersion` / `catalogue_version` | `YYYY-MM-DD` release of the licensed catalogue (required for licensed content). |
| `sourceType` / `source_type` | `licensed_official` or `original`. |
| `licenseId` / `license_id` | Required for licensed content and must be registered. |
| `categoryType` / `category` | `Grundstoff` or `Zusatzstoff`. |
| `points` | 2, 3, 4 or 5. |
| `licenseClasses` / `license_classes` | e.g. `B` (CSV: separate several with `;`). |
| `topicId` / `topic_id` | One of: priority, speed, distance, signs, people, behaviour, emergency, vehicle, motorway, environment. |
| `answerType` / `answer_type` | `choice` (2–5 options a–e, one or more correct) or `number` (`numericAnswer`, no options). |
| `prompt.de` / `prompt_de` | **German original wording, unchanged.** Required. No HTML. |
| `*.ckb` / `*_ckb` | Sorani translation in Arabic script. Optional at import, required before approval. |
| `options[].de` / `option_a_de` … | German option text. |
| `correct` | Option ids, e.g. `a` or `a;c`. |
| `explanation` | Educational explanation (required before approval). |
| `media` / `media_*` | `image` or `video`. `file` must be one of the selected files; a German description is required; videos should have a poster image. |

## Media rules
- Allowed types: PNG, JPEG and WebP up to 2 MB; MP4 and WebM up to 25 MB. The type is detected from the file content, not the extension.
- SVG, GIF, HTML and other formats are rejected.
- Files are stored content-addressed as `media/<sha256>.<ext>`, so identical files are detected as duplicates.

## Duplicates and versions
- The same code with the same content is a `duplicate` and is skipped.
- The same code with changed German content, answers or media is an `update`. It creates a new version, which needs approval again.
- Licensed German wording can never be edited in place; the database blocks it.
- The same content under a different code produces a warning.

## Catalogue coverage (target: 1,600 questions)

`src/lib/shared/catalog.ts` (`catalogReport`) counts what really exists. The owner workbench shows it after every
validation. The target of 1,600 is a planning number of the owner, not a statement about the official catalogue.

- **valid** – records without a blocking issue (duplicate id / official number / content, broken answer key, missing
  points or German text, referenced media file not attached, official content without licence, number or catalogue version).
- **ready** – valid, no open warning (Sorani text, explanation, media alt text, video poster), `reviewStatus: approved`
  and published. Only these may be shown to learners in production.
- **missing** – `target − valid`. The bank is **complete only when `ready ≥ target`**; never report it as complete before.

Optional field `difficulty` (JSON) / column `difficulty` (CSV): editorial rating 1 (easy) – 3 (hard). Leave it empty
when a question was not rated; it is never guessed.

## Media rules (images and short videos)

- Only original RegaDRIVE media or media with a documented licence. No screenshots or illustrations from other apps,
  books or the official catalogue without a licence record.
- One consistent driver's-eye camera per scenario series, same proportions, 16:9, mirrors and road markings readable on
  a phone. Images: WebP/JPEG/PNG ≤ 2 MB. Videos: MP4/WebM ≤ 25 MB, with a poster image; they never autoplay.
- Every file is linked to its question in the import file and needs German alt text (Sorani before approval).
- A qualified reviewer must confirm that the picture shows exactly the traffic situation of the question and does not
  contradict the answer key (EDUCATIONAL_REVIEW in `docs/CONTENT_REVIEW.md`). Generated images are never trusted unchecked.

## Media manifest and scenario sheets

`docs/import/media-manifest.template.json` — attach the filled file in the workbench next to the media files
(`src/lib/shared/mediaManifest.ts`). A media file counts as approved only when all of this holds:

- a **scenario sheet** exists (situation, visible signs, legal reference, expected behaviour, linked question) and a
  named driving instructor approved it before rendering;
- **provenance** is complete: `original_regadrive` with author, tool and the editable source file, every bundled
  third-party asset with its licence — or `licensed` with a registered licence id; any other origin is rejected;
- generative-AI involvement is disclosed (`aiGenerated`) and never replaces the review;
- the manifest describes **exactly the attached file** (sha256, kind);
- a named driving instructor passed a review of **this sha256**. A re-render needs a new review.

Questions whose media is not approved are reported as `media_not_approved` and are never ready for learners.

## Plan per topic

`src/lib/shared/catalogPlan.ts` holds a quota per topic adding up to 1,600 (1,000 Grundstoff, 600 Zusatzstoff) and
the planned number of questions with media. Status: **proposed** — the owner confirms or changes it. The workbench
shows valid / quota, ready and missing per topic; a quota is never counted as content.
