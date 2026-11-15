# RigDesk error and performance review

Reviewed 15 November 2026. This review addresses the intermittent “Something went wrong” screen and slow entry-page loading. No production database, pricing policy or existing account records were changed.

## Findings and fixes

| Finding | Resolution |
| --- | --- |
| Eight isolated renders failed with old cached bookings, auctions or fleet values: null, an object or a string where a list was expected. | Validate storage shapes before rendering and retain valid entries. Invalid input is ignored during reads; the recovery reader does not delete the original cache. |
| Malformed cached sessions and nested workforce offers could reach list rendering. | Validate session identity/role, workforce board records, hire records, offer history and voucher display fields. Recover malformed workforce boards in memory. Subsequent intentional edits still save normally. |
| The entry page downloaded maps, the account SDK and workspace code before needing them. | Load authenticated workspace, notifications, operations, map engine and work records on demand with local loading fallbacks. |
| Account refresh waited for independent requests one after another. | After authentication, request profile, permissions, inventory, bookings, auctions and bids concurrently. Account access checks remain server enforced. |
| Fuel/workforce/discovery/account requests could wait indefinitely for response headers. | Add a 12-second abort deadline with retryable error copy; allow 60 seconds for account document uploads. Google map script loading also has a deadline. |
| Background dashboard polling ran in hidden/offline tabs. | Skip periodic refresh while hidden/offline; retain focus/online refresh. |
| Error recovery gave little help. | Add retry, reload and account-access controls; navigation resets caught render errors without clearing saved records. |
| Archived HTML prototypes entered the development dependency scan. | Limit Vite dependency entry scanning to the active app; exclude archives and generated output from watch paths. |
| Fonts blocked stylesheet loading; static caching was unspecified. | Load fonts without blocking initial stylesheet rendering. Cache hashed JS/CSS immutably and revalidate SPA HTML. |
| Social metadata still contained a template description. | Replace it with the actual RigDesk project description. |

## Measurements

Compiled JavaScript referenced by the initial HTML, including module preloads:

| Metric | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Uncompressed bytes | 1,129,330 | 705,129 | 37.6% |
| Gzip bytes | 304,696 | 187,552 | 38.4% |

The account SDK and Leaflet map engine are absent from entry preloads. Users opening those features still download the corresponding chunks. This does not establish a measured improvement to LCP, interaction latency or real mobile loading time.

## Verification

- `npm run typecheck`: passed.
- `npm test`: 100 passed; no failures or skips. Includes regression cases for malformed caches, preserving valid records, workforce board recovery and request deadlines/parent cancellation.
- `npm run build`: passed. The main chunk remains approximately 519 KB and still produces Vite's 500 KB advisory.
- `npm run audit:render`: 182 passed. Covers guest, customer and owner routes in English/Hindi/Kannada and light/dark modes, booking modal renders, old cache/session failures and the three pitch slides.
- `npm run audit:bundle`: passed; records initial JS sizes and fails if the account SDK or map engine becomes an entry preload again.

The render audit uses isolated React server rendering with browser-storage fixtures and a Leaflet stub. It does not execute browser effects or authenticated data requests. The computer/browser runtime failed to initialize in this environment. Actual mobile/desktop visual layout, all button clicks, GPS/tiles, native printing and a complete live two-account booking/hiring flow therefore remain manual acceptance checks. HTTP deployment checks are recorded in [deployment history](deployment.md).

## Remaining priorities

1. **Live workforce board setup:** the additive `20261115001900_workforce_job_board.sql` update is still pending authenticated database administration. Demos cannot establish that real posting/applications/awards work. Follow [the workforce guide](workforce-job-board.md); do not reset the database or seed fictional live records.
2. **Measure actual devices:** run the customer/owner journeys on a phone and desktop, including theme/language changes, booking, bidding, worker requests, vouchers, print and bond verification. Record actual loading and interaction metrics under throttled mobile networking.
3. **Reduce image delivery:** the tractor photograph is about 2.78 MB and the hero about 1 MB. Create responsive WebP/AVIF versions while preserving each machine's actual photograph. No photo was replaced or re-encoded in this change.
4. **Further split the main app:** route-specific demo booking/calculator code remains in the main chunk. Extract it incrementally with behavioral checks; do not suppress the existing size advisory.
5. **Scale data reads:** introduce server-side pagination/filtering and revisit broad periodic refresh when real inventory/bid volume grows. Current parallel reads reduce sequential waiting without proving scalability.
6. **External services:** Google Places, real payment collection/payouts, SMTP/recovery delivery, recorded calls and pump discounts still require actual provider configuration, agreements and end-to-end tests. Their absence must not be presented as a completed real integration.
7. **Validation scope:** this pass reproduced eight specific failures; it cannot prove that every possible account state, browser or external failure is error-free. Existing record access/RLS and financial tests pass in isolated fixtures; production concurrent workflows remain separate acceptance work.

The source changes are reversible. No malformed-cache recovery routine silently deletes stored history, and no database reset or financial transfer is part of this release.
