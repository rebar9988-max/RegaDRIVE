# /dr — RegaDRIVE SUPER ADMIN control center

Owner decisions (2026-11-07): sign-in codes go **only** to `regaplatform1@gmail.com`; the production D1 `regadrive-db`
is used for the panel. Payments stay LOCKED until the owner decides.

## Sign-in
1. Open `https://www.regaplatform.com/dr` and tap **ناردنی کۆدی چوونەژوورەوە**.
2. A 6-digit code is e-mailed to the owner address (`DR_OWNER_EMAIL` in `wrangler.jsonc`, enforced by preflight).
3. The code is valid 5 minutes, max 5 tries; requests are rate-limited per IP and globally.
4. Session: random 256-bit token in a `__Host-` cookie (HttpOnly, Secure, SameSite=Strict); 30 min idle / 8 h maximum.
5. Critical changes (emergency lock, revoking sessions, restoring a backup) need a fresh code (step-up, 10 min).

## Controls (server-enforced, `worker/dr/features.ts`)
- **ON / OFF / LOCKED** per feature, stored in `dr_feature_states` and applied by the Worker to `/api/flags` and the AI gateway.
- Overrides can only **restrict** the deploy configuration. Payments, checkout, webhooks, licences, student accounts and
  official content are always LOCKED in the panel; they need `docs/OWNER_ACTIVATION.md`.
- **Emergency lock** pauses every public feature at once.
- **Backups:** a restore point of the controls is written before every critical change; restore from *Database*.
  The whole database can also be restored with Cloudflare D1 Time Travel.
- **Audit log:** every request decision (allowed / denied / failed) with time and IP in `dr_audit_log`.

## Mail
Resend, sender `security@regaplatform.com` (verified domain). Key: Worker secret `REGADRIVE_RESEND_API_KEY`, or
`dr_config.resend_api_key` in `regadrive-db`. The key is RegaDRIVE-only and restricted to sending from `regaplatform.com`.

## Database
`migrations/0003_dr_admin.sql` (idempotent) is applied to `regadrive-db`. It creates only `dr_*` tables.
