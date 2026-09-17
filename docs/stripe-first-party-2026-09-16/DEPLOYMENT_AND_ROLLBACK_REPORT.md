# Deployment and rollback — verified September 16 candidate

## Deployed source and artifacts

- Source commit: `ba75044d82aa676026cba37f828f7b559729ef77` (clean main, private online/main aligned before upload).
- Production Pages: `57f69a36-caad-4959-8dfb-30aec839ec74` — https://57f69a36.elysia-ecobotics-online.pages.dev
- Full artifact SHA-256: `e9f2ef6b577f87289f8e3dd2b1c00a629145dfb823a3f16a73238f358874d34d` (229 files).
- Production Worker `elysia-first-party-billing`: version `a043d182-a69e-451e-98a1-ae03b972ccd2`; deployment `3940a21e-f650-4521-91b4-e3d5eeff3e86`.
- Sandbox Worker `elysia-first-party-billing-sandbox`: version `98597868-29fe-4f4a-9665-32d272bd33c7`; deployment `8c5f2541-3a18-42d8-b01c-5bff97317142`.
- Both Workers: mode disabled, all payment/confirmation flags false, separate native rate-limit namespaces, no secret bindings. Sandbox has no production database bindings. No Stripe payment was initiated.

## Qualification and production evidence

18-program first-party suite; UI/function type checks; focused readiness browser test; production build verification; bundle budget/security; Worker dry run; five disabled-public-route browser cases issuing zero payment API requests. Post-deployment: ten desktop/mobile route cases, seven API states, Creator Studio via Build menu, exact compiled entry asset, and native 429 at the 62nd empty request against the proven disabled Checkout endpoint. Empty requests returned only 503/429. The initial Creator Studio browser assertion looked for a closed-menu link; corrected verification opens the existing Build menu and passed without application changes.

Names-only API inventory proves both native limiter bindings deployed. All five first-party database lanes OFF; provider review passed; third-party status hard_off. Five forbidden money endpoints return 404. Runtime presence fields correctly report missing Stripe/server secrets; isolated sandbox reports no economic database configured.

## Migrations and history

**No new migration applied in this session.** Current production has 74 migrations, head `20260915070000`. The previously applied activation IDs remain `20260915010000`, `20260915020000`, `20260915030000`, `20260915040000`, `20260915050000`, `20260915060000`, `20260915070000`. Read-only verification confirms zero orders/payments/events/customers/catalog/subscriptions, financial flags OFF, old legal hash `fc6817302997a85bb823daa0ce6f2b46` and consent-bundle hash `d1384cf2069e7e8418bce47535f3c033`. Free credit display/enforcement remains ON.

Supabase rejected an idempotent schema-only sandbox branch request because branching requires Pro. No branch ID or sandbox migration execution exists. No production data was copied and no paid plan upgrade performed. Provider sandbox acceptance and live activation remain blocked.

## Checkpoints and private refs

Fresh starting source `28833c52e0fe0aaeb15a8e64806fd2bdda883fc5` includes all Sept15 application/migration work. This session adds:

- `cca36f2a030e3d336d6069142181ef1939b7a50f` — recurring payment evidence, safe readiness and separate provisioning credentials.
- `ba75044d82aa676026cba37f828f7b559729ef77` — restricted preflight, native edge limits, pinned API version, exact human runbook and qualified candidate.
- Final documentation/evidence checkpoint follows the deployed source without changing executable code; resolve via the private refs and canonical financial packet's FINAL_STATUS.json.

Pushed refs: `online/main`, `online/stripe-first-party-2026-09-15` at `Bradley-T-Harz/Elysia-Ecobotics-Online`; `legacy/stripe-first-party-2026-09-15` at `Bradley-T-Harz/elysia-marketplace`. Both repositories verified PRIVATE. Legacy main remains `c04260585e237e213d10e0220d964a09e4f0bbcf`. No tag/release/visibility changes.

## Rollback

Pre-change Pages `66d46ab1-64c9-4956-9ecf-df075178a89f`, production Worker `9a130f76-dab4-46df-a348-2f564ed649d4`, sandbox Worker `ed3ad36e-35e9-42c3-96af-63d4626e8bd1` are retained recovery references. Keep acquisition OFF; revert compatible Pages/Worker versions if needed. No schema rollback is needed for this session. Never drop ledger/audit rows, rewrite consent history or restore over financial activity. After future activation, retain webhook/retry/Portal/refund processing during acquisition pauses. Prior scoped recovery archives and qualified database replay evidence remain valid; no new full restore drill is claimed.

Post-HTTP verification database snapshot exactly matches pre-deployment counts, flags, migration IDs and historical hashes. The limiter probe created no financial records.
