# Verkehrszeichen-Quiz — review evidence package (2026-11-13)

Scope: 40 signs (`src/content/signs.ts`) and 89 quiz questions (`src/content/signQuiz.ts`), content version `2026.11-signquiz-1`.

## What was checked by machine (automated, NOT a human review)

| Check | Result |
|---|---|
| Sign number, Anlage and lfd. Nr. exist in the consolidated StVO text | 40/40 |
| German sign name found in the printed StVO title | 33/40 (7 are descriptive display names, listed in `signs.md`) |
| Every quiz item has a legal source and a valid sign reference | 89/89 |
| Single correct answer, 3 distinct options, answer position balanced (29/29/31) | 89/89 |
| Sorani/Kurmanji/Arabic script rules, digits preserved, no German letters in Kurmanji (`tests/unit/i18n.test.ts`, `content.test.ts`) | pass in CI |
| Signs drawn without gradients, shadows or blur; visual comparison with the StVO pictures | done by eye on a rendered sheet (`signs-sheet.svg`) |
| Corrections found and fixed | Zeichen 251 official name; source of Zeichen 220 question; Zeichen 209 number |

Automated checks cannot judge whether Sorani wording sounds natural or whether a drawing is acceptable to a driving instructor. That is what the human stages are for.

## Mandatory human signatures still missing (publicationGate, `docs/CONTENT_REVIEW.md`)

1. **TRANSLATION_REVIEW** — a named Sorani-speaking reviewer reads all texts in `questions.md` / `signs.md`.
2. **EDUCATIONAL_REVIEW** — a named driving instructor checks signs, drawings, questions and answers against the current StVO.
3. **APPROVED** — the content owner records the release decision after 1 and 2.

Nothing may be pre-filled or approved on a reviewer's behalf. `approvals.template.json` is the record to fill in. When it contains three real, dated, passed entries with evidence references, the registry records and `validatedAgainstRules` can be updated and the content deployed with the manual `deploy.yml` workflow.

## Files
- `signs.md`, `questions.md` — every item with its sources and review status (all PENDING)
- `signs-sheet.svg` — all 40 drawings on one sheet for reviewers
- `approvals.template.json` — empty approval record
