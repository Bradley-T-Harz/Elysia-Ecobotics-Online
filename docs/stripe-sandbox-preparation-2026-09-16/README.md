# Sandbox bindings and migration preparation — September 16, 2026

## Completed scope

Updated only `wrangler.billing.sandbox.jsonc` with the supplied non-secret sandbox URL and publishable key. Kept `BILLING_MODE=disabled` and all billing/confirmation gates false. Existing encrypted `SUPABASE_SERVICE_ROLE_KEY` is preserved and was verified by binding name only. Its value was neither requested nor retrieved/printed.

- Sandbox project: `kdtqyxlrkpmlpupzgmwv`.
- Worker: `elysia-first-party-billing-sandbox`.
- Deployed source: `2391a70654bf50f94942d72450ced4aa94fadff2`.
- Worker version: `31f96a20-91c6-458b-b707-34e9f1f618a0`.
- Deployment: `f3a856eb-2199-4c18-af22-e996a1af5deb`.
- URL: https://elysia-first-party-billing-sandbox.bradleytharz3407.workers.dev

Config-difference assertions, Wrangler type generation and Worker dry run passed. Post-deployment Cloudflare metadata verifies the new public bindings, retained encrypted binding and OFF gates. HTTP readiness reports public/server database bindings configured, all payment capabilities false and no provider projection yet (expected before schema replay). Production Worker metadata/config and the main checkout's production Supabase linkage are unchanged. No production Worker/Pages deployment was performed.

## Migration preparation only

Read-only sandbox inventory found PostgreSQL 17.6, no public/private application relations, no migration ledger, zero auth users/storage objects/buckets, and the expected hosted auth/storage helper functions.

All **74 existing migrations**, from `20260714010000` through `20260915070000`, are staged in a separate sandbox-only workdir with exact source hashes; seed loading is disabled. No migration was applied and no migration version was marked as applied. The final user instruction explicitly limited this stage to preparation. The previously qualified full local replay was not repeated for a two-binding config change.

Recreate/verify the isolated workspace reproducibly with `node scripts/prepareStripeSandboxReplay.mjs`. That script has no network/SQL execution path and does not inspect any secret. See [migration plan](sandbox-migration-plan.json) and [next execution procedure](REPLAY_PREPARATION.md).

## Safety and remaining program state

The former missing-sandbox/Pro-plan blocker is resolved by the user-provided isolated project. Actual migration application, protected test UI/runtime setup, Stripe sandbox keys/webhook configuration and provider acceptance remain future execution stages. Live activation is still blocked; all third-party money remains hard OFF. This update neither provisions Stripe objects nor enables payment processing.

Rollback reference immediately before this deployment: sandbox Worker version `76176a37-d524-4dbc-ab36-df8f282aaa13`, deployment `a4d02232-4f2b-430e-b498-63d03428462b`. It includes the owner-bound backend secret. Retain that binding; no database rollback is required because no schema writes occurred.

Private refs: online/main and online/stripe-first-party-2026-09-15 at Bradley-T-Harz/Elysia-Ecobotics-Online; legacy/stripe-first-party-2026-09-15 at Bradley-T-Harz/elysia-marketplace. The documentation checkpoint follows the deployed config without changing its runtime artifact.
