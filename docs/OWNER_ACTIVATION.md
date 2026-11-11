# Owner-only activation steps

Each step below needs an explicit decision by the owner. None of them is done by automation.

## 1. Connect the domain www.regaplatform.com
1. In Cloudflare, confirm that `regaplatform.com` is a zone in the RegaDRIVE owner's account. Also confirm it serves no other application that would be replaced.
2. Create a Cloudflare API token limited to *Workers Scripts: Edit* on that account (not a Rega24/R&L token). Store it as the GitHub secret `CLOUDFLARE_API_TOKEN`, and the account ID as `CLOUDFLARE_ACCOUNT_ID`.
3. Add to `wrangler.jsonc`: `"routes": [{ "pattern": "www.regaplatform.com", "custom_domain": true }]`. (Done in the repository. Cloudflare only attaches the domain if the zone `regaplatform.com` is in the token's account.)
4. Content approval is required before the first deploy. The production build publishes only content that passed human review (see `docs/CONTENT_REVIEW.md`), and preflight blocks deployment with fewer than 30 approved questions.
5. Run *Actions → Deploy to Cloudflare (manual)* on `main` with the confirmation `DEPLOY-REGADRIVE`. The workflow:
   - runs the full CI on the exact commit, then `preflight --stage=deploy` with every gate fatal;
   - runs `scripts/domain-check.mjs`, which refuses to overwrite a site that is not RegaDRIVE;
   - records the last known-good version and deploys;
   - runs `scripts/smoke.mjs` against the live domain;
   - if the smoke test fails, rolls back automatically to the last known-good version and smoke-tests the rollback.
6. Manual rollback: `npx wrangler deployments list` → `npx wrangler rollback <version-id> -m "reason"`. On the very first deploy no previous version exists; to undo it, remove the custom domain in the Cloudflare dashboard.

## 2. AI providers (free tiers only, fail closed)
A provider can run only when **all** of these hold. The cost guard checks them before **every** request:
- Global: `AI_ENABLED=true`, `AI_FREE_ONLY=true`, `AI_PAID_FALLBACK_ENABLED=false`, `AI_DAILY_COST_LIMIT_EUR=0`, `AI_DOMAIN_SCOPE=regadrive`. Any other value disables **all** providers.
- A RegaDRIVE-only secret (`wrangler secret put`): `REGADRIVE_GEMINI_API_KEY`, `REGADRIVE_GROQ_API_KEY` or `REGADRIVE_OPENROUTER_API_KEY`. Never reuse a Rega24 or R&L key. Workers AI uses the `AI` binding.
- A model var: `AI_GEMINI_MODEL`, `AI_GROQ_MODEL`, `AI_OPENROUTER_MODEL` (must end in `:free`) or `AI_WORKERS_AI_MODEL`.
- A free-tier verification under 30 days old: `AI_<PROVIDER>_VERIFIED_ON=YYYY-MM-DD`. Set it **only** from the output of a passing run of
  `node scripts/ai-verify.mjs [--confirm-gemini-no-billing] [--confirm-groq-free-plan] [--confirm-workers-free-plan]`.
  The script checks that the model exists, that the price is zero (OpenRouter), that a real minimal test call works, and that rate-limit headers are returned (Groq). Billing state that no API exposes needs your explicit confirmation flag.

Daily request caps are set below each provider's free limits (`worker/ai/gateway.ts` → `FREE_TIER_POLICY`). They can be lowered with `AI_DAILY_REQUESTS_PER_PROVIDER` but never raised.
`/api/ai/status` reports ACTIVE, RATE_LIMITED, NOT_CONFIGURED, UNAVAILABLE or DISABLED for each provider. A provider is ACTIVE only after a real successful call.

## 3. Production database (D1)
Note (2026-11-11): student e-mail accounts use their own database `regadrive-students` (binding `STUDENT_DB`, switch `STUDENT_AUTH_ENABLED`), see `docs/STUDENT_EMAIL_AUTH_IMPLEMENTATION.md`. The steps below remain the gate for the content/payments production database.
Note (2026-11-07): `regadrive-db` is already bound as `DB` for the `/dr` owner control center only (`docs/DR_ADMIN.md`). The steps below are still required before any **student** data is stored.
Prerequisites: a reviewed privacy policy, retention and deletion rules, and a working e-mail provider for verification.
1. `wrangler d1 create regadrive` (a new, separate database).
2. Add the `d1_databases` binding. Review `migrations/` and apply with `wrangler d1 migrations apply regadrive --remote`.
3. Set the secret `OWNER_DATABASE_ACTIVATION=I-APPROVE-LIVE-ACTIVATION` and the var `DATABASE_PRODUCTION_ENABLED=true`.
4. Update `scripts/preflight.mjs`, which currently fails on any D1 binding, in the same reviewed PR.

## 4. Payments (€20 lifetime)
Prerequisites: a working database (step 3), a chosen provider, sandbox testing, legal review (German consumer and withdrawal rights) and a security sign-off. On iOS and Android, also check the app-store digital-purchase rules.
Activation: implement the provider adapter, set `PAYMENT_WEBHOOK_SECRET`, `OWNER_PAYMENTS_ACTIVATION=I-APPROVE-LIVE-ACTIVATION`, `PAYMENTS_ENABLED=true`, and then `CHECKOUT_ENABLED` / `LIVE_PAYMENT_WEBHOOKS_ENABLED`. `PURCHASE_REQUIRED` only takes effect when payments **and** the database are active.

## 5. Official question bank (licensed content). All of this is OFF.
Flags (all `false` and enforced in `src/lib/shared/flags.ts`): `OFFICIAL_QUESTION_BANK_ENABLED`, `CONTENT_ADMIN_ENABLED`, `CONTENT_IMPORT_EXECUTION_ENABLED`, `PUBLIC_OFFICIAL_MOCK_EXAMS_ENABLED`, `CONTENT_AUTO_SYNC_ENABLED` (never honoured) and `SUBSCRIPTIONS_ENABLED` (never honoured).
1. Obtain a written licence for the official catalogue, images and videos. Register it as a `content_licenses` record.
2. Prepare files from `docs/import/` and preview them locally in a `VITE_ADMIN_UI=true` build at `/admin/import`.
3. Admin API (dry run): `wrangler secret put ADMIN_OWNER_TOKEN_SHA256`, using the SHA-256 hex of a random token of at least 32 characters. Optionally set `ADMIN_ACCESS_EMAIL` behind a Cloudflare Access application. Then set `CONTENT_ADMIN_ENABLED=true`.
4. Import execution needs step 3 of this document (production D1, owner activation) plus `CONTENT_IMPORT_EXECUTION_ENABLED=true`. Media storage needs a RegaDRIVE-only R2 bucket; check the free-tier limits first.
5. Showing official content needs `OWNER_OFFICIAL_CONTENT_ACTIVATION=I-APPROVE-LIVE-ACTIVATION` and `OFFICIAL_QUESTION_BANK_ENABLED=true`. Public official mock exams additionally need `PUBLIC_OFFICIAL_MOCK_EXAMS_ENABLED=true`. Every item still needs an owner APPROVED review; the database enforces this.
6. Update `scripts/preflight.mjs`, which currently fails while any of these flags is true, in the same reviewed PR.
