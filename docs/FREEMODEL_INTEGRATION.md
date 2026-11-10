# FreeModel adapter — gated integration (NOT LIVE)

The adapter is present in `worker/ai/gateway.ts` but deliberately excluded from `AI_PROVIDER_ORDER`. No production secrets or keys have been committed. Existing providers and user flows remain unchanged.

## Before activation
1. Independently verify FreeModel's current terms, privacy/data retention, exact model ID, API base URL, monthly token accounting, and zero-billing/zero-overage behavior. The dashboard screenshot alone is not sufficient proof. Do not add funds or payment methods.
2. Use only a dedicated RegaDRIVE Cloudflare Worker secret named `REGADRIVE_FREEMODEL_API_KEY`; never use `VITE_*` or commit the key.
3. Verify a tiny request with the chosen model using a separate owner-run process; no automated live call is made by this PR.
4. Only after verification, set Worker vars `AI_FREEMODEL_MODEL`, `AI_FREEMODEL_VERIFIED_ON` (YYYY-MM-DD), and `AI_FREEMODEL_ZERO_COST_CONFIRMED=true`. Explicitly append `freemodel` to `AI_PROVIDER_ORDER` if authorized.
5. Confirm actual budget protection: the existing isolate-local counter is **not** a durable distributed monthly token cap. Implement an atomic quota guard and test it before enabling for learners. Set a hard upstream spending cap if supported. Keep the provider disabled if zero-charge cannot be guaranteed.

This PR does not activate the provider, deploy, or modify the Rega24 project.