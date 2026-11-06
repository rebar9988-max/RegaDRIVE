# Content review and licensing

- All 39 questions, 6 lessons, 14 sign explanations and 36 vocabulary entries are original RegaDRIVE texts (content version `2026.11-original-1`). They are written from public traffic rules (StVO) and are not copied from the official question catalogue.
- Status: `reviewStatus: "pending"`. Before you set `approved`, two reviews are needed: (1) a qualified German driving instructor checks the facts and German wording, and (2) a native Kurdish Sorani reviewer checks the translations and traffic terms.
- Official TÜV/DEKRA (amtlicher Fragenkatalog) questions may only be added with a licence. Use `sourceType: "licensed_official"`, a `content_licenses` record, the unchanged German wording and the real `questionCode`. The schema and tests reject official codes on original questions.
- Exam rules (`src/lib/shared/exam.ts`, version `klasse-b-ersterwerb-2026-11`): 20 Grundstoff + 10 Zusatzstoff questions, 110 points, at most 10 error points, and two wrong 5-point questions mean a fail. These were cross-checked on 2026-11-06 against TÜV NORD and bussgeldkatalog.de. The official time limit was **not** verified, so the simulation has no timer.
- Traffic-sign graphics are simplified RegaDRIVE illustrations of the official StVO signs.
