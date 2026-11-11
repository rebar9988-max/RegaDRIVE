# Question bank roadmap — 1,600 validated Klasse B questions

Status date: 2026-11-11. This is a plan, not a status report of finished work. Numbers under "Today" are measured
from the repository; everything else is work still to do.

## 1. Today (measured)

| Item | State |
| --- | --- |
| Questions in the repository | 39 original RegaDRIVE practice questions (27 Grundstoff, 12 Zusatzstoff) |
| Human-approved questions | 0 — all are `reviewStatus: pending`; production shows "content in review" |
| Licensed official questions | 0 — no licence is registered |
| Question images / videos | 0 |
| Target | 1,600 valid, approved, published records (`CATALOG_TARGET`) |
| Missing | 1,561 |

Tools that already exist: import validation (JSON/CSV), media type and size checks, content-addressed media keys,
the fail-closed publication gate (`src/content/pipeline.ts`), the coverage report (`src/lib/shared/catalog.ts`),
the owner import workbench (`/admin/import`, preview builds only), database tables for questions, versions,
translations, media, licences and reviews (`migrations/0001`–`0003`).

Not active: the production content database (D1) is not bound, so the workbench validates locally and cannot store.
Binding it needs separate owner approval (`CLAUDE.md`).

## 2. Facts that shape the plan (checked 2026-11-11)

- **Exam rules** — FeV Anlage 7: 30 questions, 110 points, 10 permitted error points, failed when exceeded or when
  two weight-5 questions are wrong. TÜV NORD: 20 Grundstoff + 10 Zusatzstoff for Klasse B, up to three video
  questions per exam, each video may be watched up to five times. No official time limit (ADAC); usually 30–45 minutes.
- **Copyright** — the official question catalogue belongs to TÜV | DEKRA arge tp 21. Providers of learning media can
  obtain the complete catalogue (texts, images, videos) from arge tp 21 for a fee. Without that licence no official
  wording, number, image or video may be used.
- **Catalogue size** — REPORTED, not verified against the current release: a TÜV-Verband press release gives 1,197
  questions for Klasse B before its latest update. The catalogue changes twice a year. 1,600 is therefore the owner's
  target for the RegaDRIVE bank, not the size of the official Klasse B catalogue; confirm the real number with the
  licence.
- **Languages** — the official exam is offered in German and twelve foreign languages (including Standard Arabic).
  Kurdish Sorani is not among them, so Sorani in RegaDRIVE is always RegaDRIVE's own learning aid, shown above the
  German text the learner will meet in the exam.

## 3. Owner decisions needed first

1. **Content source.** A: licence the official catalogue from arge tp 21 (real exam questions, costs a fee, comes
   with official images and videos). B: write original RegaDRIVE questions only (no licence fee, but they are not the
   exam questions and each needs a driving-instructor review). C: both, kept apart by `sourceType`.
   This is a budget decision: the project rule is no paid service without owner approval.
2. **Reviewers.** Name one qualified driving instructor (educational review) and one native Sorani reviewer
   (translation review). Without named humans nothing can pass the gate.
3. **Production content database.** Approve binding D1 so imports, reviews and publication are stored and audited.
4. **Media production.** Approve the tool and budget for original 3D scenes (section 6).

Work that does not depend on these decisions is marked ▶ below and can start immediately.

## 4. Data contract for every question

Already enforced by the importer and the coverage report unless marked NEW.

- Unique id; official number only for licensed questions; catalogue version (`YYYY-MM-DD`) for licensed questions.
- Category (Grundstoff / Zusatzstoff), topic, licence classes, error points 2–5, optional difficulty 1–3.
- Answer type: choice with one, two or three correct answers, or number input.
- German text (required) and Sorani text (required before approval) for question, every answer and explanation.
- Media: kind, file, German alt text (Sorani before approval), poster for videos.
- Source type and licence id; provenance (author, AI assistance disclosed, legal references).
- Media manifest with scenario sheet, provenance and instructor review per file (`src/lib/shared/mediaManifest.ts`), checked in the workbench; storing it in the database is still to build.
- NEW: Kurmanji and Arabic for imported questions (today they fall back to German).

## 5. Workflow: import → review → publish

`DRAFT → SOURCE_CHECK → LICENSE_CHECK → TRANSLATION_REVIEW → EDUCATIONAL_REVIEW → APPROVED → PUBLISHED`

| Step | Who | Tool | Exit condition |
| --- | --- | --- | --- |
| 1. Prepare batch (50–100 questions) | content author | JSON/CSV template in `docs/import` | file complete |
| 2. Validate | owner | import workbench | 0 invalid rows, 0 blocking catalogue issues |
| 3. Store as hidden draft | owner | workbench → `/dr` API (to build) | batch id, content hash, version 1 |
| 4. Source + licence check | automatic | pipeline | legal reference present; licence id registered |
| 5. Sorani review | Sorani reviewer | `/dr` review screen (to build) | every text approved, reviewer named |
| 6. Educational + media review | driving instructor | `/dr` review screen (to build) | answer key, points, explanation and media confirmed |
| 7. Approve | owner | `/dr` | all reviews passed for the current content hash |
| 8. Publish | owner | `/dr` | database trigger allows it only with step 7 |

Rules that stay fixed: an import never publishes; any change to German text, answer key or media creates a new
version and needs approval again; the database, not AI, decides correctness; unpublish is always possible.

## 6. Original 3D images and videos

- **Tool:** Blender (free, open source) with one shared scene library made for RegaDRIVE: road segments, junctions,
  roundabout, motorway, signs built from the StVO sign definitions, traffic lights, cars, lorry, bus, tram, cyclist,
  pedestrians, children, mirrors and dashboard. Every asset is self-made or CC0 with the licence recorded.
- **Consistency:** one driver's-eye camera rig (fixed eye height, field of view, mirror positions), right-hand
  traffic, German road markings, one lighting set per condition (day, dusk, night, rain, fog, snow).
- **Scenario sheet first:** each picture starts from a written sheet — who is where, who moves, which sign applies,
  which answers follow. The instructor approves the sheet before rendering, and the render against the sheet after.
- **Output:** images 1600×900 WebP ≤ 2 MB; videos 6–12 s MP4 (H.264) + WebM, ≤ 25 MB, poster frame, no sound needed.
- **In the app (to build):** video view counter limited to five plays as in the exam, a still end frame while
  answering, zoom for images on phones, storage in R2 served under `/media/`.
- **Not allowed:** screenshots or redrawn copies of official or competitor pictures; AI-generated pictures without
  the instructor check; any picture that contradicts the answer key.

## 7. Phases

Durations are estimates and depend on reviewer availability.

| Phase | Content | Result | Depends on |
| --- | --- | --- | --- |
| 0 ▶ | Fix the topic map for 1,600 questions (quota per topic, Grundstoff / Zusatzstoff split, share with media) | PROPOSED in `src/lib/shared/catalogPlan.ts`; waits for owner confirmation | — |
| 1 ▶ | `/dr` content screens: batch list, question detail, review sign-off, publish/unpublish, coverage dashboard, audit log | owner workflow complete in a preview build | — |
| 2 | Bind the production content database, run the reviewed migrations, serve published questions from the Worker with an offline cache | stored, versioned content | decision 3 |
| 3 ▶ | Blender scene library, camera rig, 10 pilot scenarios (5 images, 5 videos) | approved pilot media | decision 4 |
| 4 | Pilot batch: the existing 39 questions plus 61 new ones through the whole workflow | first 100 published | decisions 1–2, phases 1–2 |
| 5 | Production batches of 100 until 1,600; each batch closes only when the coverage report shows 0 blocking issues | 1,600 valid records | phase 4 |
| 6 | Video player limit, image zoom, Kurmanji/Arabic for imported questions, exam builder using the official video quota | exam-like media behaviour | phases 3, 5 |
| 7 | Twice-yearly update: compare with the new catalogue release or legal changes, re-approve changed questions | maintained bank | ongoing |

## 8. Definition of done for "1,600"

All of these, shown by the coverage report on production data — not by a count of rows:

- `ready ≥ 1600`: valid, no open warning, approved by named reviewers, published.
- 0 duplicates (id, official number, content); 0 broken answer keys; 0 missing points.
- Every question has German and Sorani text and an explanation.
- Every referenced media file exists, has alt text, a licence or "original" record and a passed media review.
- Every licensed question has a licence id, official number and catalogue version.
- At least one full exam can be built from published questions (20 Grundstoff + 10 Zusatzstoff).
- Browser tests pass against the production content build.

Until then every report states the measured `ready` number and never "complete".
