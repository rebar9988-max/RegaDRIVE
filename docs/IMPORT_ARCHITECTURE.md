# Import architecture for the licensed question bank

Status 2026-11-12: built and tested locally; **not active in production** and no licensed data exists yet.

## Flow

```
licensor data files ──► JSON / CSV in the RegaDRIVE format (docs/import/)
                              │
        /dr → Content Workbench (browser only: preview, licence checklist, media manifest)
                              │  owner sends the file
        POST /api/admin/import/commit  (owner token; needs activated database + import flag + CONTENT_DB)
                              │  server validates again against the licence register in the database
                    one atomic batch ──► questions (hidden drafts) · answer_options · question_versions
                                         question_translations (draft) · question_media · import_batches
                              │
        review: Sorani reviewer → driving instructor (text + media) → owner approval
                              │
        owner publishes  ──► database triggers check licence, rights, approval and media again
```

## Separate fields per question

| Field | Where |
| --- | --- |
| Official question number | `questions.question_code` (licensed only, unique, never changes) |
| Catalogue release | `questions.catalogue_version` + one row per release in `question_versions` |
| German question, explanation | `questions.prompt_de`, `explanation_de` |
| Sorani question, explanation | `questions.prompt_ckb`, `explanation_ckb` + `question_translations` with review status |
| Answers (German / Sorani / correct) | `answer_options.text_de`, `text_ckb`, `is_correct` |
| Error points, category, classes | `questions.points`, `category_type`, `license_classes` |
| Source, licence, country | `questions.source_type`, `license_id`, `country` |
| Media and its provenance | `question_media`, `media_assets`, `media_provenance`, `media_variants`, `scenario_sheets`, `scene_library` |

## Guarantees

- **Validation:** `src/lib/shared/importer.ts` (structure, texts, answer key, media, licence rights). Invalid rows
  stop the whole import.
- **Versioning:** changed German content or answer key = new version; the question goes offline until approved again.
- **Duplicates:** same file, same official number, same content — detected, never stored twice.
- **Rollback:** `POST /api/admin/import/rollback` removes what a batch created, restores what it changed, records
  who and why. Whole-database recovery additionally through Cloudflare D1 Time Travel.
- **Licence:** nothing licensed is imported without a verified licence in force; nothing is published without the
  needed rights; losing the licence hides the content at once (`docs/LICENSING.md`).
- **Separation:** official and original content are different records (`source_type`); Germany and Italy are
  separated by `country` on questions and licences.
- **No automatic publication, ever.**

## What is still off, and who turns it on

| Item | State | Needs |
| --- | --- | --- |
| Licence contract | not bought | owner |
| Content database binding (`CONTENT_DB`) and migrations 0001–0005 applied | not bound, not applied | owner approval (`docs/OWNER_ACTIVATION.md` step 3), then a reviewed PR that also updates `scripts/preflight.mjs` |
| `CONTENT_ADMIN_ENABLED`, `CONTENT_IMPORT_EXECUTION_ENABLED`, owner admin token | off | owner (step 5) |
| Media storage (R2 bucket) and upload route | not configured, route answers 503 | owner approval; check the free tier first |
| Serving stored questions to learners and showing official content | not built / off | after the licence; `OFFICIAL_QUESTION_BANK_ENABLED` + activation phrase |
| Converter from the licensor's delivery format | not built | the format is only known with the licence |
| Review and publish buttons in `/dr` (today: preview and status only) | not built | content database |
