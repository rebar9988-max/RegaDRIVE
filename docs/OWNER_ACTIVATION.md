# Owner-only activation steps

Each step below needs an explicit decision by the owner. None of them is done by automation.

## 1. Connect the domain www.regaplatform.com
1. In Cloudflare, confirm that `regaplatform.com` is a zone in the RegaDRIVE owner's account. Also confirm it serves no other application that would be replaced.
2. Create a Cloudflare API token limited to *Workers Scripts: Edit* on that account (not a Rega24/R&L token). Store it as the GitHub secret `CLOUDFLARE_API_TOKEN`, and the account ID as `CLOUDFLARE_ACCOUNT_ID`.
3. Add to `wrangler.jsonc`: `"routes": [{ "pattern": "www.regaplatform.com", "custom_domain": true }]`. Set the GitHub repository variable `REGAPLATFORM_DOMAIN_VERIFIED=true`.
4. Run *Actions → Deploy to Cloudflare (manual)* on `main` with the confirmation `DEPLOY-REGADRIVE`.
5. Verify `https://www.regaplatform.com/api/health` shows `database: "off"` and `payments: "off"`.
6. Rollback: `npx wrangler rollback` (or Cloudflare dashboard → Workers → regadrive → Deployments).

## 2. AI providers (free tiers only)
Each provider stays `NOT_CONFIGURED` until **all** of its values are set. Set secrets with `wrangler secret put` and vars in `wrangler.jsonc`:
| Provider | Secret | Model var | Free confirmation |
| --- | --- | --- | --- |
| Gemini | `GEMINI_API_KEY` | `AI_GEMINI_MODEL` | `AI_GEMINI_FREE_TIER_CONFIRMED=true` (project without billing) |
| Groq | `GROQ_API_KEY` | `AI_GROQ_MODEL` | `AI_GROQ_FREE_TIER_CONFIRMED=true` (free plan) |
| OpenRouter | `OPENROUTER_API_KEY` | `AI_OPENROUTER_MODEL` (must end in `:free`) | enforced in code |
| Workers AI | binding `AI` (present) | `AI_WORKERS_AI_MODEL` | `AI_WORKERS_AI_FREE_CONFIRMED=true` (Workers Free plan, daily allocation) |

Check the current model availability and free quotas on each provider's pricing page before you set a model. Status is visible at `/api/ai/status`. A provider shows `ACTIVE` only after a real successful call.

## 3. Production database (D1)
Prerequisites: a reviewed privacy policy, retention and deletion rules, and a working e-mail provider for verification.
1. `wrangler d1 create regadrive` (a new, separate database).
2. Add the `d1_databases` binding. Review `migrations/` and apply with `wrangler d1 migrations apply regadrive --remote`.
3. Set the secret `OWNER_DATABASE_ACTIVATION=I-APPROVE-LIVE-ACTIVATION` and the var `DATABASE_PRODUCTION_ENABLED=true`.
4. Update `scripts/preflight.mjs`, which currently fails on any D1 binding, in the same reviewed PR.

## 4. Payments (€20 lifetime)
Prerequisites: a working database (step 3), a chosen provider, sandbox testing, legal review (German consumer and withdrawal rights) and a security sign-off. On iOS and Android, also check the app-store digital-purchase rules.
Activation: implement the provider adapter, set `PAYMENT_WEBHOOK_SECRET`, `OWNER_PAYMENTS_ACTIVATION=I-APPROVE-LIVE-ACTIVATION`, `PAYMENTS_ENABLED=true`, and then `CHECKOUT_ENABLED` / `LIVE_PAYMENT_WEBHOOKS_ENABLED`. `PURCHASE_REQUIRED` only takes effect when payments **and** the database are active.
