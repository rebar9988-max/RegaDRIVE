# Licensing of official exam content

Status 2026-11-12: **no licence has been bought.** The owner intends to license the official Klasse B catalogue
from TÜV | DEKRA arge tp 21. Until a signed contract is on record and verified, RegaDRIVE imports and publishes no
official question, answer, image or video. Nothing in this repository is official exam content.

## What the contract must answer (ask the licensor in writing)

RegaDRIVE assumes none of these. Each one is a separate switch in the licence record and is **off** by default.

| Right | Needed for | Switch |
| --- | --- | --- |
| Official German question and answer texts | importing the bank at all | `questionText` |
| Use in an online app / website | publishing to learners | `online` |
| Adding our own Sorani translation to the licensed texts | the bilingual question card | `translation` |
| Showing our own 3D images and videos with licensed questions (instead of or next to the official media) | the original media plan | `ownMedia` |
| Official images and videos | showing the official media | `officialMedia` |
| Keeping content in the device cache | offline learning | `offline` |

Also confirm: which licence classes and catalogue releases are covered, how updates (twice a year) are delivered,
the term and termination, the number of users or installations, the required copyright notice, the delivery format
of the data files, and whether Kurmanji or Arabic translations of our own are allowed.

If the contract does **not** grant `translation`, licensed questions can only be shown in German. If it does not
grant `ownMedia`, our own media may be used only with our own original questions.

## How the rules are enforced

1. **Licence register** (`src/lib/shared/license.ts`, template `docs/import/license-register.template.json`). A
   licence is usable only with status `verified`, the owner's name, the verification date and the contract reference,
   inside its term, for the named country, catalogue releases and classes.
2. **Import** (`src/lib/shared/importer.ts`). With a register, a licensed row is rejected unless its licence allows the
   import; Sorani text on a licensed row needs `translation`.
3. **Database** (`migrations/0005_license_rights_media_provenance.sql`). The same rules as triggers: licensed
   questions are published only under a verified licence in force with the needed rights; a Sorani translation is
   approved only with `translation`; media is attached to licensed questions only with `officialMedia` / `ownMedia`;
   when a licence is suspended, expired or revoked, everything under it is hidden at once and nothing is republished
   automatically.
4. **Flags** (`src/lib/shared/flags.ts`). Official content is shown only with `OFFICIAL_QUESTION_BANK_ENABLED=true`
   and the owner activation phrase; both are off and preflight blocks a deploy that turns them on.
5. **Separation.** Official content (`sourceType: licensed_official`, official number, licence id, catalogue release)
   and RegaDRIVE's own content (`sourceType: original`, never an official number) are different records, never merged.
   Official content is never bundled into the static app; it is served only from the activated server path.
   Germany and Italy are separate: every question and every licence carries a country and they must match.

## Steps after the contract is signed

1. Fill in the licence register from the contract; the owner sets `verified`, name and date.
2. Approve binding the content database and apply the reviewed migrations (`docs/OWNER_ACTIVATION.md`, step 3 and 5).
3. Import the delivered data files as hidden drafts; fix every reported row.
4. Sorani translation and review (only with `translation`), media review, owner approval, publication.
