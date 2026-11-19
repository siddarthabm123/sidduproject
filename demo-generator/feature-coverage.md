# Frontend and recording coverage

The generator inventories the active root application and nested TSX files, excluding archived source copies, dependencies and generated outputs. Its JSON inventory records literal React routes. The two role-specific workforce paths are also resolved by `workforce/routes.ts`; fuel routes are dispatched from `App.tsx`. Generic UI primitives are not separate business capabilities.

| Area inspected | Main source | Film / broader browser inspection |
| --- | --- | --- |
| Landing, role selection, sign-in/recovery | `App.tsx`, recovery pages | Film: landing/customer overview. Inspection: entry, demo and sign-in. No real registration submitted. |
| Language, themes and account preferences | `App.tsx`, `localization.tsx`, catalogs/preferences | Inspect account screens; film uses English/light consistently for legibility. User-entered names are not automatically translated. |
| Customer equipment discovery, photos, saved/compared options | `App.tsx`, `EquipmentPhoto.tsx`, `EquipmentComparison.tsx`, `EquipmentShortlist.tsx` | Film: equipment cards and booking detail. Browser routes include customer machinery. |
| Date/quantity estimates and multi-owner allocation | Demo modals in `App.tsx`, `RealWorkspace.tsx`, `upgrades/tools.ts` | Film: quote/allocation controls. Does not claim fictional availability as live inventory. |
| Reverse auctions and ranking controls | `App.tsx`, `RealWorkspace.tsx` | Film: bid review and quality sorting. No real auction award submitted. |
| Site maps / equipment radar | `App.tsx`, `EquipmentMap.tsx` | Map routes inspected; fuel map and hiring location illustrated. Stored pins are not live telemetry. |
| Booking reserves, wallet/cancellation, milestones | `App.tsx`, `RealWorkspace.tsx`, payment backend | Film: estimate and booking records. Funding/payout services remain disabled/provider-dependent. |
| Digital bonds and public verification | `bond-pdf.ts`, `bond-signature.ts`, `VerifyBondPage` in `App.tsx` | Film: actual booking bond panel and the explicitly fictional pitch bond preview. A QR alone does not establish legal enforceability or payment. |
| Daily work entries and recorded calling requests | `JobSheet.tsx`, call panel in `App.tsx` | Inspected in source. Not all controls fit the short film. Recorded phone calls require provider integration. |
| Fleet, jobs, operations reports and CSV/cost planner | `App.tsx`, `OwnerOperations.tsx` | Fleet/jobs inspected; operations/cost planner filmed. No live telematics or profit prediction implied. |
| Suppliers and optional external business lookup | `SupplierDirectory.tsx`, `api/discover-providers.ts` | Both role routes inspected. External listings are not verified RigDesk inventory; Places needs credentials. |
| Fuel map, filters, vouchers and sample bills | `FuelHubPage.tsx`, `FuelBunkMap.tsx`, `fuel/DemoFuelBills.tsx` | Film: fuel map and vouchers/bills. Real discounts need station agreements. |
| Workers, identity/license review, managed profiles | `WorkforcePage.tsx`, `WorkerProfilePage.tsx` | Film: worker directory and hire modal; registration route inspected. No actual identity documents uploaded. |
| Workforce job posts, managed crew applications and offers | `WorkforceJobBoard.tsx`, `WorkerHireCard.tsx` | Film: owner hiring agreements/negotiation. The latest real job-board SQL setup remains pending. |
| Notifications, admin review and connection/error recovery | `NotificationInbox.tsx`, `AdminWorkspace.tsx`, error boundary | Source inspection; do not impersonate an administrator or submit real review actions. |
| Pitch presentation, readiness/privacy/terms | `PitchHighlights.tsx`, `LaunchReadiness.tsx`, public information | All three pitch anchors inspected; bond slide filmed. Public information routes checked. |
| Optional AI recommendations | `api/recommend-vehicles.ts` | Backend candidate ranking with optional Gemini reasons; no active frontend call found. No trained fair-price, demand or fuel model is represented as built. |

The judge video is a reproducible **prototype demonstration**, not a claim that production providers, partner contracts, legal approvals or measurable savings have been validated. Private admin operations, genuine payment transactions, real employment and real fuel redemption require separate controlled acceptance testing.
