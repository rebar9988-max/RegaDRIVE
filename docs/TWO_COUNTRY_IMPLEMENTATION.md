# RegaDRIVE — Germany + Italy implementation plan

Status: implementation planned; no production changes.

## Objective
One existing RegaDRIVE app, two selectable driving-theory countries (DE Klasse B, IT Patente B), independent content/exam policies/progress, with first-launch country choice and later switching.

## Mandatory preservation
Keep React/Vite/TypeScript, Cloudflare Worker, PWA, existing Germany content, offline IndexedDB, /dr, fail-closed publication, official branding, soft-green light UI, and existing tests. No paid services, destructive migration, unauthorized copyrighted exam content, or production deployment.

## Execution order
1. Audit app entry, routes, locale, content, storage, exam engine, worker, /dr and tests.
2. Implement accessible first-launch DE/IT country cards with flags and Sorani labels; persist explicit selection, never geolocate.
3. Add typed CountryId ('DE'|'IT') and country-scoped content lookups and exam policy configuration.
4. Migrate existing German progress non-destructively into DE namespace; isolate IT progress.
5. Introduce IT content infrastructure with no unreviewed or unlicensed questions published.
6. Extend /dr country filters and review workflows without a second admin system.
7. Test initial selection, persistence, switching, country isolation, RTL/LTR, offline, migration, accessibility and regressions.
8. Run npm run lint, npm run typecheck, npm test, npm run check:migrations, npm run build, npm run check:worker, npm run test:e2e, node scripts/pipeline.mjs. Do not bypass failures.
9. Open PR with evidence; do not deploy.

## Acceptance
Existing DE users retain data; IT content never appears in DE and vice versa; offline country preference works; no official content is represented as licensed without verification; all mandatory gates pass.

## Blocking conditions
Copyright/license rights, official examination rule verification, secrets, destructive migrations or production deployment require explicit approval. Continue other safe work independently.
