# Learner quality audit — 2026-11-07

Scope: diagnose and fix functional/accessibility weaknesses while preserving the existing design, four languages, fixed RTL layout, content gates, data storage and deployment path. Development-dependency advisories and educational content approval are explicitly excluded by the owner.

## Reproduced and fixed

| Problem | Reproduction | Correction |
| --- | --- | --- |
| Practice filter and URL disagree | Open `/practice?topic=speed`, click the general Practice sidebar link: the URL clears but the speed filter stays. Back/Forward also retain stale component state. | Page identity includes pathname and query; practice filters initialize from the current URL after each navigation. |
| Malformed lesson URL crashes the app | A client-side route to `/learn/%E0%A4%A` throws `URI malformed` and removes the main page. | Decode URL segments safely and show the existing missing-page state. |
| Anchor history grows unnecessarily | Clicking the same privacy anchor repeatedly pushes duplicate history entries; navigating to `/about` from its anchor leaves the hash behind. | Compare the full destination including hash; repeated anchors still scroll, without adding history entries. |
| Streak counts change incorrectly at DST | Europe/Berlin: Mar 30 2026 00:30 with Mar 28/29 activity returns 1; Oct 25 23:30 with Oct 24/25 activity returns 3. Both should be 2. | Step through local calendar days, not fixed 24-hour durations. No stored progress is rewritten. |
| Settings radio groups lack keyboard behavior | Arrow keys do not change the focused/checked language and every radio is a separate Tab stop. | Arrow keys, Home/End and roving Tab focus select the existing radio buttons; disabled options are excluded. |
| Enlarged mobile text extends outside cards | At 320px with 200% text, long language/tile/progress labels extend past their containers. | Scoped wrapping and minimum widths preserve readable text without hiding or shrinking it. |

## Evidence

- Before changes: 48 live route/language/viewport combinations at 320px and 1280px had no automated WCAG A/AA violations or normal-size horizontal overflow. Manual keyboard and enlarged-text checks found the gaps above.
- Focused routing/progress tests: 10 passed. DST checks run in a separate Europe/Berlin process.
- Full local pipeline: lint, typecheck, 629 unit tests, local migration check, preview build, 19 E2E tests, production build, Worker dry run and preflight passed.
- E2E additions exercise practice query navigation and browser history, invalid URL recovery, repeated anchors, keyboard radio selection, and 200% text in all four languages.
- Existing E2E continues to check bilingual learning, scoring, progress persistence, offline operation, equal layouts across languages and axe WCAG checks.
- Focused visual check: no overflowing elements at 320px/200% text in ckb/kmr/ar/de. Screenshots and reports are in ignored `test-results/audit-zoom-*.png`, `audit-focused-ui.json`, `weakness-audit.json` and `pipeline-report.json`.
- Initial development validation caught strict TypeScript index/test-environment typing issues; these were corrected before the full pipeline passed. No checks were disabled.
- No standalone formatter is configured; `git diff --check` passed.

## Preserved concurrent work

Integrated current main `12ea06c` (the MagicPath design update) without reverting its theme or official logo. The merge keeps both the updated logo source and the corrected query-aware page key. No API, data schema, content approval, authentication, paid service or production activation changes are included.

## External information still needed

The existing About page says its publisher identity/contact details and privacy notice are not verified. Repository inspection found no confirmed public operator name/address/contact to fill them. The owner has been asked for those details; they must not be guessed or copied from private account metadata. This is separate from the two explicitly excluded items.

Release evidence must be recorded after required CI, normal merge, official deployment and production verification; local success alone is not a deployment claim.
