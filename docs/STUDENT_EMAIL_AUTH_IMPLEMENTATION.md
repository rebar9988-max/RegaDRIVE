# Student email authentication — implementation and release gate

Status: IMPLEMENTED (2026-11-11). Owner approved activation after successful safety checks (2026-11-10) and authorised
database creation, migration, merge and deployment on 2026-11-11. Live state must be confirmed by the deploy smoke test.

## As built (2026-11-11)
- Separate D1 database `regadrive-students` (id `4b6065a1-812c-44c3-8558-b50e66e18764`, created with location hint WEUR),
  binding `STUDENT_DB`, migrations in `migrations-students/` (applied: `0001_student_auth.sql`, recorded in `d1_migrations`).
  The owner database `regadrive-db` (binding `DB`) holds no student data; it is read only for the existing RegaDRIVE mail key.
  Note: the database was created through the Cloudflare API without the `eu` jurisdiction flag (location hint only).
- Activation: var `STUDENT_AUTH_ENABLED=true` (+ `STUDENT_MAIL_FROM`). Independent of `DATABASE_PRODUCTION_ENABLED`, which stays
  `false` (payments, imports and purchase gating are unaffected). The owner can switch accounts OFF in /dr (`student_accounts`);
  the emergency lock also stops them.
- API (`worker/students/handler.ts`): `POST /api/auth/{register,verify-email,resend-code,login,logout,forgot-password,reset-password}`,
  `GET /api/me`, `POST /api/me` (name/language), `GET|POST /api/me/progress` (opt-in, versioned backup), `GET /api/me/export`,
  `POST /api/me/delete` (password required, cascades).
- Security: PBKDF2-SHA256 (100k), codes SHA-256-hashed, 10-minute single-use codes with 5 tries, `__Host-rd_session`
  HttpOnly/Secure/SameSite=Lax cookie (hash stored, rotated on sign-in, revoked on logout/reset/deletion, 30-day lifetime),
  CSRF header `x-rd-request: 1` + JSON + same-origin check, durable D1 rate limits keyed by hashed IP/e-mail, anti-enumeration
  (identical answers for register/resend/forgot/login), 80 student e-mails/day cap (Resend free tier, €0).
- Retention: rate events 24 h, expired codes 24 h, expired sessions removed, security events 90 days (no IP/e-mail),
  unverified registrations 7 days.
- UI: `src/pages/Account.tsx` (ckb/kmr/ar/de, fixed RTL layout, accessible states). Local progress is never replaced;
  backup/restore use the loss-free `mergeProgress`.
- Tests: `tests/unit/students.test.ts`, `tests/unit/progress-merge.test.ts`, `tests/migrations.check.mjs` (student schema),
  E2E full flow with a loopback mail sink (`APP_ENV=e2e` only), live smoke check in `scripts/smoke.mjs`.

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
