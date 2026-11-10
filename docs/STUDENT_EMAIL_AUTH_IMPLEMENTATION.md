# Student email authentication — implementation and release gate

Status: IN PROGRESS — NOT LIVE. Owner approved activation after successful safety checks on 2026-11-10.

## Existing behavior (confirmed)
- `worker/index.ts` returns 503 for `/api/auth/*` and `/api/me` while `DATABASE_PRODUCTION_ENABLED=false`; otherwise returns 501 NOT_IMPLEMENTED.
- Production D1 `regadrive-db` currently serves owner-only `dr_*` data. Student data must not be inserted into these tables.
- The PWA stores learning progress locally. Never delete or overwrite local progress on login.
- Payments, SMS, phone sign-in and licensed-content imports remain disabled.

## Implementation order
1. Inspect existing migrations, frontend account view, flag reader, preflight and test suite. Review GDPR privacy notice, deletion/retention policy and Resend domain limits.
2. Create separate student D1 database and reviewed forward-only migrations: students (unique normalized email), email_challenges (hashed OTP, expiration, attempts, consumed_at), sessions (hashed opaque tokens, revocation/expiry), password_reset_challenges, progress_sync_versions and audit_events with bounded retention. Add indexes and foreign keys.
3. Implement Worker endpoints: POST /api/auth/register, /api/auth/verify-email, /api/auth/resend-code, /api/auth/login, /api/auth/logout, /api/auth/forgot-password, /api/auth/reset-password, GET /api/me. Strict schemas and bounded request bodies; generic errors for enumeration resistance; origin/CSRF checks; account and IP rate limits enforced with shared durable state, not isolate memory.
4. Generate OTP via cryptographic RNG, hash before storage, expire in 5 min, consume once, cap verification attempts and resends. Use RegaDRIVE-only verified Resend sender; never log codes, passwords or secrets.
5. Use a Workers-compatible password KDF with vetted parameters. Rotate sessions on login, use Secure HttpOnly SameSite cookies, revoke on logout/reset, and avoid returning tokens to browser JavaScript.
6. Build accessible Sorani RTL / German LTR registration, verify, login and recovery screens. Preserve official logo, soft light palette, existing routes and offline experience.
7. Offer explicit opt-in migration of local learning progress with idempotent conflict handling, server-side ownership checks and rollback safety.
8. Add unit/integration/E2E tests for duplicate email, OTP replay/expiry, brute force, CSRF, session fixation, reset, account deletion, offline data preservation, language and accessibility.
9. Run lint, typecheck, migration check, tests, Worker dry run, preflight and E2E. Fix failures; never bypass gates.
10. Only after passing tests, privacy approval, database backup and verified email delivery: configure student D1 binding, deploy via existing manual guarded workflow, smoke test production registration/login and rollback if failed.

## Release criteria
- No student-auth route returns NOT_IMPLEMENTED.
- No student record created in the owner /dr tables.
- No credentials or OTP in plaintext logs/database.
- Full CI green; reviewed privacy/deletion policy; email sender operational.
- Production deployment and database activation must be separately verified. Merely setting DATABASE_PRODUCTION_ENABLED=true is insufficient.
