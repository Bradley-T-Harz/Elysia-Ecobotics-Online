# Exact human handoff

No engineering step below requires Bradley to edit application code, SQL, Products or Prices. Codex resumes provisioning, acceptance and controlled activation after secure configuration exists.

1. In the approved Stripe account, use a dedicated **sandbox**, confirm the account ID and create the required restricted/server credential. Save it to Bitwarden immediately, then enter it directly in the sandbox runtime as STRIPE_SECRET_KEY_TEST. Do not send it to Codex.
2. At `https://elysia-first-party-billing-sandbox.bradleytharz3407.workers.dev/api/billing/webhook`, register the event list in STRIPE_WEBHOOK_EVENT_MATRIX.md using API version `2025-02-24.acacia`, account events only. Save the signing secret to Bitwarden, then enter STRIPE_WEBHOOK_SECRET_TEST in that runtime. A secure isolated Supabase economic database and its service-role binding are required; production cannot host sandbox payment rows.
3. After actual sandbox acceptance passes, verify the live business/account identity, payout destination, receipt sender/support contact/statement descriptor and any outstanding account requirements in Stripe. Record redacted outcomes only. Do not change bank details unless that is your intended business decision.
4. Have the owner/accounting adviser record the lane-specific tax treatment and registration/collection decision. No tax conclusion was supplied by this program. Lanes requiring tax collection remain OFF until that collection behavior is implemented and qualified.
5. Save live server and endpoint signing credentials in Bitwarden before secure entry into elysia-first-party-billing. Live endpoint: `https://elysiaecobotics.com/api/billing/webhook`. The same event list and pinned version apply. Record account ID and presence only. Do not enable Connect.

Codex then provisions catalog/Portal idempotently, validates receipt/cancellation configuration, records evidence, executes the qualified rollout and verifies it. No artificial live payment is authorized or necessary for preflight. First genuine payments are monitored as described in the master plan.

Current smallest immediate handoff: provide a secure sandbox execution/runtime context with the test credential and signing secret; share only its non-secret account/runtime references. The absent configuration blocks real Stripe acceptance, so live activation is not yet a final secret-entry-only task.

## Prepared destination and present blocker

The test Worker now exists as `elysia-first-party-billing-sandbox`. It remains disabled, with no database binding and no secrets. Bradley can enter the saved test API and endpoint secrets directly there. It will reject delivery until Codex completes the isolated database/runtime configuration and verifies the edge controls. Do not copy production Supabase credentials. A separate test database credential must be entered through the same secure handoff after that database is provisioned. Codex handles database replay, product/price/Portal creation, test execution, evidence and gate changes; no hand-created Products or Prices are requested.
