# /dr → Content Review & Approval (Verkehrszeichen release)

Covers the 40 signs and the 89 sign-quiz questions (Germany), and the Italian signs, the bundled Italian questions
and the staged 7,020-question Italian catalogue (Italy). The screen has one switch per country; the totals line shows
`total = Germany + Italy` (today 149 = 129 + 20), with the catalogue counted on its own, because it can never publish. Publication is still decided only by `publicationGate`
(`src/content/pipeline.ts`); this screen records the **human** decisions the gate asks for.

## Stages (in this order)
1. `TRANSLATION_REVIEW` — role `sorani_translator` (checks German + Sorani, Kurmanji, Arabic texts).
2. `EDUCATIONAL_REVIEW` — role `driving_instructor`, a **different person** than step 1 (checks the StVO reference, answers, SVG); stores the exam-rules version it was validated against.
3. `APPROVED` — role `content_owner` (Super Admin), only on top of 1 and 2.

Each decision stores: reviewer name, role (fixed by stage), review date, evidence reference, note, content fingerprint,
who recorded it (`owner:<masked e-mail>`) and when. Rows are never edited or deleted; a withdrawn decision gets
`revoked_at` + reason and stays in the history. Every record/withdrawal is also written to `dr_audit_log`.

## What the server refuses (HTTP 422, nothing saved — batches are all-or-nothing)
AI/automated/placeholder reviewer names, missing or short evidence, future or pre-release dates, missing
confirmation, wrong order, equal translation/educational reviewer, items whose automatic validation fails.
Recording needs the owner session, the `x-dr-request` header and a fresh step-up code.

## Automatic publication
`GET /api/content/approved` (public, ids + fingerprints only) merges the D1 rows into the bundled content record and runs
the real gate. An item is listed only if the gate passes **and** the stored fingerprint equals the shipped content
(any later edit silently unpublishes it) **and** the rules version matches. `/signs`, `/sign-quiz` and the home tile show
exactly those items; the client re-checks the fingerprint. Errors, a missing database or a missing table → nothing is shown.

## Owner steps (cannot be done by code)
1. Apply `migrations/0006_dr_content_reviews.sql` to `regadrive-db` (additive, idempotent; `docs/DR_ADMIN.md` explains how migrations are applied). Until then `/api/content/approved` answers `ok:false` and nothing is published.
2. Collect the signed review lists (`docs/review/sign-quiz/`), then enter them in `/dr → Content Review` — the named Sorani translator, then the named driving instructor, then your approval.

## Production check
`.github/workflows/live-content-check.yml` runs `scripts/live-content-check.mjs` from GitHub's network after every deployment
(and on demand): DNS/TLS diagnostics, `/api/health`, deployed commit, `/signs`, `/sign-quiz`, `/dr`, `/api/content/approved`.
"HTTP 000" means the checking machine got no HTTP answer at all (DNS, TCP, TLS or timeout) — the script says which layer.

## Germany and Italy, and the numbers (2026-11-28)
- Until this change the "all" list silently left out the 12 Italian questions, so it showed **137** items while the
  server counted **149** (40 + 89 German, 8 + 12 Italian). The list now belongs to one country at a time and always says
  "N shown of M"; `GET /api/dr/reviews` returns `counts.byCountry.{de,it}`, which add up to `counts.total`.
- Every unpublished item shows **why**, in Sorani with the gate's own code beside it (`src/pages/drReasons.ts`).
- Italian questions take one decision for several selected questions (`ids` + `questionHashes`); all or nothing, each
  still checked for order, a named human reviewer, evidence and the wording's fingerprint. Approving Italian wording is
  editorial and does not publish the question (since #108); the screen says so on every card.
- The staged catalogue is reachable from Italy → «کەتەلۆگی ڕەشنووس». Its decisions now go through the /dr request helper
  (the `x-dr-request` header and the sign-in code dialog); before, every catalogue and Italy-import write was refused with
  HTTP 403 by the server. Each row lists the reasons it is not published.
