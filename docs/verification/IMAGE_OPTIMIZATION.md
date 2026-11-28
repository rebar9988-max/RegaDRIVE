# Image delivery audit — 2026-11-28

Local staging branch: `staging/image-delivery-audit`; base commit `561db8f0cfc45a682f2264322d598c0e885fcb32`.
No remote deployment, merge, account changes, production database writes, or image transformations performed.

## Architecture and decision

Vite/React assets are served by Workers Static Assets. Banners already use responsive WebP (1200/1668 widths), explicit dimensions and high fetch priority. Logo stays original. Italian signs are SVG; other UI icons use SVG components. Question media uses content-addressed R2 keys, publication checks, MIME validation and a five-minute HTTP cache. Existing media-unavailable fallback is unchanged. Service worker caches visited static signs/brand/icons, but deliberately does not persist protected `/media/` files. Do not enable offline storage for those files without verified offline rights and a withdrawal policy.

Read-only Cloudflare audit confirmed active `regaplatform.com`, Free Website zone plan, production Worker compatibility date 2026-11-01, ASSETS/R2/D1 bindings and no Images binding. Zone free status does not establish Images subscription or Workers billing status.

Official documentation checked:
- https://developers.cloudflare.com/images/pricing/ — Free Images allows 5,000 unique transformations/month; additional new transformations fail with 9422 rather than incur charges on Free. Paid plans have overage billing.
- https://developers.cloudflare.com/images/optimization/binding/ — Workers Images binding is supported; output operations count as transformations.

Images billing entitlement was not independently established. Consequently no binding, transformation endpoint, paid service, or external image proxy was introduced. Exact lossless output support must also be verified before adopting transformations for protected image categories. These local changes add no billable infrastructure or dependencies (€0 additional services); existing account consumption is not a claim about the total account bill.

## Safe changes

- Static brand, icons, flags and Italian signs receive one-hour HTTP freshness with `no-transform`. Stable filenames are not marked immutable. Updates may remain in an ordinary browser cache for up to an hour; service-worker caches continue to be build-versioned.
- Service-worker cache writes are attached to fetch-event lifetime through `waitUntil`. Storage failures are caught, so quota exhaustion does not prevent the original network response from rendering. Private API exclusion and question-media persistence policy remain unchanged.
- Three executable regression tests cover image cache lifetime, quota failure and protected-media exclusion.

## Fidelity and licensing

`image-integrity.json` records hashes and sizes for all 24 public images, byte-identical to base. Question data, associations, answers, exam rules, languages, layouts, FREE_FOREVER policy and database schemas are untouched. SVG signs retain every original byte. No quality score is inferred from existing WebP files: Q90 banner provenance and lossless encoding of any premium illustrations remain unverified. Re-encoding existing lossy files would not restore original fidelity.

Repository documentation identifies the eight Italian SVG illustrations as original artwork (`docs/ITALY_CONTENT.md`) and documents 3,919 extracted educational images as unlicensed/unpublished. Those extracted materials were neither processed nor published. No independent rights review of production R2 objects was performed.

## Controlled cache benchmark

Run `node scripts/benchmark-image-cache.mjs`. Chromium loads the unchanged 70,928-byte banner through three ordinary navigations with service workers blocked and an isolated context for each policy. Local HTTP server uses old versus staged cache headers. Results are in `image-cache-benchmark.jsonl`:

| Policy | Image requests | Image body bytes |
| --- | ---: | ---: |
| Before | 3 | 212,784 |
| After | 1 | 70,928 |

This is a 66.7% reduction across three visits, with zero image requests on the two warm visits. It is a controlled cache-policy benchmark, not a production network/LCP benchmark. Real servers may return 304 on revalidation, which would reduce the baseline body bytes. First-visit image size is unchanged. No measured production LCP, INP, CLS or Lighthouse improvement is claimed.

## Remaining gates

Cloudflare Images account entitlement/free-only enforcement; original banner encoding provenance; protected-media rights (including offline/derivatives); remote staging acceptance and real-device/production CWV measurements. No 100/100 certification is supported. Owner approval is required before deployment or merge.

## Actual validation

- TypeScript and ESLint: passed on final source.
- Unit tests: 52 files, 1,814 tests passed (includes three new cache tests); `unit.log`.
- Local migration/integration checks: passed, including Italy staging checks. Only disposable local databases used.
- Production build and Worker deployment dry run: passed. Preview build: passed.
- E2E: 31/31 passed against local Workers runtime (`e2e.log`), including mobile/tablet/desktop, RTL/LTR, accessibility, 200% text, broken-image fallback, PWA offline practice, and the independent free Italy journey.
- Local Worker HTTP response confirmed `Cache-Control: public, max-age=3600, no-transform` for the banner.
- Deploy-mode preflight refused this staging branch as designed (requires main). No deployment attempted.
- Browser tests use Chromium device emulation, not physical devices or Safari. Preview fixtures do not certify production question-image coverage or licensing.
- Final production rebuild and CI-mode preflight: passed after E2E; workspace dist restored to production mode.
