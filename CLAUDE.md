# RegaDRIVE — working rules

- **Project identity:** this repository is `rebar9988-max/RegaDRIVE` (target `www.regaplatform.com`, Worker `regadrive`). It is independent of Rega24 (`rebar9988-max/Rega`, `rega24.com`) and R&L (`rebar9988-max/rega-cargo`, `rlgo.net`). Never share code, Workers, D1/KV/R2, secrets, auth or pipelines with them. On any mixed identifier: stop and ask the owner.
- **Never without separate owner approval:** enabling payments/checkout/webhooks, binding or migrating a production D1, paid AI or infrastructure, DNS/domain changes, publishing unlicensed official exam content.
- **Preserve:** the official RegaDRIVE logo (`public/brand`, source `docs/brand`), the palette tokens in `src/styles/app.css`, Kurdish-first content with German as the second line, all four learner languages (ckb, kmr, ar, de — `src/app/i18n.ts`), and the fixed RTL layout: switching language changes only the words and their own text direction, never the position of the layout (owner rule, 2026-11-07).
- **Content:** original questions keep `questionCode: null` and stay `reviewStatus` ≠ `approved` until a qualified human review (`docs/CONTENT_REVIEW.md`).
- **Before merging:** `npm run lint && npm run typecheck && npm test && npm run check:migrations && npm run build && npm run check:worker && node scripts/preflight.mjs && npm run test:e2e`.
- Report only verified results.
