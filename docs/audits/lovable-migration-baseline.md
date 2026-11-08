# Lovable migration baseline — 2026-11-08

Status: source access blocked; migration NOT implemented or deployed.
Baseline commit: `2bfd1b3f476ac5620a23fdda60615cfecce9ed6d`.

## Observed production baseline
Read-only GET checks: homepage HTTP 200; `/api/health` reports production mode, database off and payments off. `/build-info.json` identifies the baseline commit above and build `2bfd1b3-mw7etkhl`, with zero visible questions, lessons, signs and vocabulary. This is not evidence that stored production records are absent. No database queries or mutations were performed.

## Source blocker
The supplied preview hostname contains an en dash. Testing the conventional Lovable `preview--calm-roadwise-cockpit.lovable.app` hostname with the supplied receipt returned HTTP 401. Connected GitHub repository search for `calm-roadwise-cockpit` returned no matches. An authorized source repository or project export is required; screenshots cannot establish source behavior. No source equivalence is claimed.

## Architecture and protected boundaries
React 19 + Vite + TypeScript, custom router in `src/app/router.tsx`, shared state in `src/app/state.tsx`, IndexedDB persistence in `src/lib/storage.ts`. Content visibility is enforced by `src/content/access.ts` and `src/app/content.ts`. Four locales: ckb/ar RTL, kmr/de LTR. Service worker caches the shell and static assets and excludes API requests. Preserve shared grading, answer evaluation, auth, storage and progress modules, worker APIs, migrations, official SVG, translations and Cloudflare configuration.

`/dr` uses a separate lazy-loaded component outside the public Shell. Its D1 binding is configured independently of the disabled student database flag. Preserve its routes, CSS, authentication and worker operations. `/admin/import` is gated at build time. Deployment is manual, main-only, with CI, preflight, domain safety, exact build smoke verification and rollback in the existing workflow.

## Route inventory and provisional integration mapping
Lovable counterparts are unknown until source access is restored. No mapping is inferred.

| Production routes | Integration disposition |
| --- | --- |
| `/` | Adapt approved dashboard UI to existing progress state |
| `/learn`, `/learn/:id` | Adapt UI; preserve content visibility and lesson data |
| `/practice`, `/exam` | Adapt UI; reuse question access, answers and grading |
| `/progress` | Adapt UI; preserve persisted progress/results |
| `/signs`, `/vocabulary` | Adapt UI; preserve content and localization |
| `/services`, `/account`, `/access` | Adapt UI; preserve auth and backend contracts |
| `/settings`, `/about`, `/more`, unknown-route fallback | Adapt UI; preserve settings and navigation |
| `/dr`, `/dr/*` | Preserve protected legacy functionality, no redesign |
| `/admin/import` | Preserve existing gated workbench |

Reject Lovable mock accounts, simulated APIs, demo content and hardcoded results. Classify additional functionality only after reviewing the actual source.

## Acceptance limits
Local tests do not prove production database integrity or authenticated production behavior. Source access, real-content availability and authorized staging verification remain required before implementation acceptance, merge or deployment. No Lighthouse score or WCAG conformance claim is made.

## Measured local baseline
`npm ci` succeeded. The unchanged application passed `node scripts/pipeline.mjs`: ESLint, TypeScript, 19 test files / 623 tests, local SQLite migration constraints (36 tables), preview build, E2E including axe, language layouts and offline coverage, production build, Worker dry run and preflight. This is local baseline evidence, not migration acceptance or production auth verification. Machine report: `test-results/pipeline-report.json`; screenshots in `test-results/`.
