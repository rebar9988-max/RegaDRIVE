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

## Not done yet (next step)

This change adds the content only; it is not wired into the learner UI. What that needs:

1. **Country-aware content access** — `src/content/access.ts` and `src/app/content.ts` expose one
   bank (`CONTENT.questions`). It has to become a function of `settings.country`, and the consumers
   (`src/pages/Home.tsx`, `src/pages/Practice.tsx`, `src/lib/mockExam.ts`, `src/lib/search.ts`,
   `src/lib/progress.ts`) have to read the bank for the selected country.
2. **Second line per country** — `src/components/Bi.tsx` shows the German original under the
   learner's language. For Italy that line is the Italian wording (`t.it`). The `withGerman` setting
   becomes "show the source language"; the CSS class stays `de`, so no style changes.
3. **Badini in the language list** — the `kmrArab` field exists, but `Lang` in `src/app/i18n.ts` is
   still `ckb | kmr | ar | de`. Showing Badini to learners needs one more entry there (RTL), plus
   `isLang` and the settings migration.
4. **True/false rendering** — `src/components/QuestionCard.tsx` renders option lists. The Italian
   questions are a boolean; either generate two options (VERO / FALSO) at the boundary or add a
   true/false branch to the card.
5. **Sign images** — the Italian signs are served as files from `/signs/it`, not through the
   content-addressed `/media/<sha256>` path used by `MediaRef`. Decide whether to keep the simple file
   path or move them into the media pipeline.
6. **Registry and publication gate** — `src/content/registry.ts` records provenance and reviews per
   item. Italian items need their own entries (sources: Codice della Strada articles) before the
   production gate can ever pass them.
