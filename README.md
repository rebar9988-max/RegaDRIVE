# RegaDRIVE

RegaDRIVE is a modern Kurdish Sorani and German driving-theory learning app for Germany (Klasse B). It has lessons, traffic signs, practice questions, mock exams and progress tracking.

> Independent educational platform. Not affiliated with TÜV, DEKRA, any driving school or licensing authority. All questions are **original practice questions** (`sourceType: "original"`, no official question code) and are marked *pending expert review*.

## Stack
- **Web app:** React 19 + TypeScript (strict) + Vite, installable PWA, offline-first (IndexedDB + versioned service worker).
- **Runtime:** one isolated Cloudflare Worker (`regadrive`) serving static assets and a small fail-closed API (`worker/`).
- **Database:** Cloudflare D1 schema in `migrations/`, **tested locally only**. There is no D1 binding, so the production database is OFF.
- **AI:** free-only gateway (`worker/ai/gateway.ts`) for Gemini, Groq, OpenRouter (`:free` models only) and Workers AI. No paid fallback. It is restricted to explaining reviewed RegaDRIVE content.

## Commands
| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run lint` / `npm run typecheck` | ESLint / strict TypeScript |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run check:migrations` | Applies migrations to in-memory SQLite and verifies constraints |
| `npm run build` | Production build to `dist/` |
| `npm run check:worker` | Wrangler dry-run bundle (no upload) |
| `npm run test:e2e` | Playwright E2E + axe WCAG checks + offline test against local `wrangler dev` |
| `node scripts/preflight.mjs` | Read-only production safety gates |

## Safety flags (all enforced server-side, fail closed)
`PAYMENTS_ENABLED`, `CHECKOUT_ENABLED`, `LIVE_PAYMENT_WEBHOOKS_ENABLED`, `PURCHASE_REQUIRED`, `DATABASE_PRODUCTION_ENABLED` and `LICENSE_ENFORCEMENT_ENABLED` are all `false`. Payments and the database can only turn on with a separate owner activation (see `docs/OWNER_ACTIVATION.md`). Even then, setting a raw flag alone does nothing.

## Deployment
`.github/workflows/deploy.yml` is **manual only** (`workflow_dispatch`, typed confirmation, `main` only). It runs every check plus `scripts/preflight.mjs` before `wrangler deploy`. It needs RegaDRIVE-only `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets. No custom-domain route is configured until the owner verifies `www.regaplatform.com`.

## Copyright
CKB: ئەم ناوەڕۆکە مافی پارێزراوی RegaDRIVE ـە. کۆپیکردنەوە و بڵاوکردنەوەی بێ مۆڵەت ڕێگەپێدراو نییە.
DE: Diese Inhalte sind urheberrechtlich geschützt. Das unerlaubte Kopieren und Weiterverbreiten ist untersagt.
