# Remaining prerequisites after sandbox database replay

The database task is complete. **Do not begin Stripe provider acceptance in this execution.** All first-party payment gates remain OFF and third-party money remains hard-OFF.

This update supersedes the missing-Supabase-project/Pro-plan and unbound-sandbox-backend statements in the September 16 activation runbook. The isolated project exists, its backend secret is securely bound, and all 74 canonical migrations are now applied and verified. No Supabase upgrade, new database, backend-secret re-entry, migration execution or production-data copy is needed from Bradley.

## Work remaining before a future acceptance run

1. Establish the separately deployed, protected sandbox UI/return origin and Cloudflare Access policy. `BILLING_PUBLIC_ORIGIN` still contains `https://sandbox-not-yet-configured.invalid`; route protection is not qualified. Codex can perform the engineering/configuration when this next stage is resumed. Exempt only the signed webhook path from interactive Access.
2. Bradley creates the dedicated Stripe sandbox restricted credentials and matching account-event webhook endpoint using the existing exact permission/event/API-version contract. Save each permanent credential in Bitwarden **before continuing**, then enter it directly into its secure destination. Never paste it into Codex, Git, a file, shell history or logs.
   - Runtime Worker `elysia-first-party-billing-sandbox`: `STRIPE_SECRET_KEY_TEST`, `STRIPE_WEBHOOK_SECRET_TEST`.
   - `SUPABASE_SERVICE_ROLE_KEY` is already present; do not re-enter it.
   - Temporary setup process only: `STRIPE_PROVISIONING_KEY_TEST`, injected through an approved secure execution context. Do not bind it as a Worker runtime secret. Revoke after setup/qualification.
   - Non-secret reference: exact sandbox `STRIPE_ACCOUNT_ID`.
3. Codex provisions the canonical mode-specific Products/Prices and Customer Portal idempotently, records provider references in the sandbox only, qualifies protection/configuration, and executes the provider acceptance program after the user resumes that stage. No hand-created catalog objects or manual SQL/deployment steps are needed from Bradley.
4. Live credentials, business/payout/receipt verification, lane-specific tax/legal decisions, complete acceptance and production preflight remain separate later requirements. No first-party public lane can open until every applicable gate passes. No third-party lane can open.

## Existing exact contract

The full human runbook is preserved in the financial evidence folder at `Stripe_First_Party_Activation_2026-09-16/STRIPE_DASHBOARD_HUMAN_RUNBOOK.md`; use this update for current completion status and that runbook for the permission matrix, secret destinations, event list, payment methods, Portal policy and provisioning/preflight commands. Source contract remains `functions/api/billing/_shared/stripeContract.ts`.

- Sandbox webhook: `https://elysia-first-party-billing-sandbox.bradleytharz3407.workers.dev/api/billing/webhook`.
- Pinned request and webhook API version: `2025-02-24.acacia`.
- Account snapshot events only; no connected-account event subscription or wildcard.
- Keep `BILLING_MODE=disabled`, `BILLING_ENABLED=false` and every lane flag OFF while credentials are entered. No configuration/presence check alone constitutes provider acceptance.

No provider objects, provider requests, payment attempts, acceptance fixtures, test-mode activation or live activation were performed during this replay.
