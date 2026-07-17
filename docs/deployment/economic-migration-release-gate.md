# Economic migration release gate

This runbook covers the fourteen repository-declared `20260716...` forward
migrations. It is not authorization to apply them to a hosted project. The
captured `20260714010000` baseline must never execute against the existing live
project; the four `20260714...` versions are a completed historical checkpoint.

## Exact forward order

1. `20260716010000_badge_security_and_semantics_hardening.sql`
2. `20260716011000_notification_read_state_hardening.sql`
3. `20260716011500_economic_notification_authenticity.sql`
4. `20260716012000_marketplace_identifier_compatibility.sql`
5. `20260716020000_private_economic_core.sql`
6. `20260716021000_economic_test_provider_catalog.sql`
7. `20260716030000_sandbox_credit_ledger_and_metering.sql`
8. `20260716032000_economic_operator_separation_of_duties.sql`
9. `20260716034000_sandbox_credit_commerce_and_compensation.sql`
10. `20260716040000_job_post_economic_sidecar_and_publication_gate.sql`
11. `20260716050000_marketplace_commerce_licenses_and_seller_accounting.sql`
12. `20260716060000_organization_sponsorship_waiver_sidecars.sql`
13. `20260716070000_economic_projections_reporting_notifications_lifecycle.sql`
14. `20260716071000_economic_route_kill_switch_boundaries.sql`

Every file is transactional and must be applied in order with stop-on-error.
Do not mark a failed version applied. Do not edit an already hosted version;
repair it with a new forward migration.

## Pre-migration stop gate

All items are required before any hosted SQL write:

- Retain an encrypted, restorable database backup and record its restore test,
  point-in-time recovery window, project reference, and responsible operator.
- Obtain the catalog-only inventory described in
  `supabase-read-only-economic-preflight.md` through a dedicated read-only
  database role. Reconcile the migration ledger and every unexplained manual
  SQL difference. Do not infer hosted state from repository files.
- Confirm the existing `auth.users`, profiles, badges, notifications, saved
  add-ons, Marketplace install intents, Commune posts, Job Posts, sandbox
  tables, roles, functions, grants, policies, and Storage policies match the
  prerequisites used by the chain.
- Record row counts and table/index sizes for `user_notifications`,
  `user_saved_addons`, and `marketplace_install_intents`; check for rows that
  violate the new notification and Marketplace constraints.
- Run the complete active chain twice from zero with
  `npm run test:sandbox-database:disposable`. Require behavior fixtures, ACL/RLS
  assertions, zero invalid indexes, zero unvalidated constraints, and zero
  error-level `plpgsql_check` findings.
- Pass `npm run test:all`, the independent Functions typecheck, production
  build, billing Worker `wrangler deploy --dry-run --strict`, secret scan, and
  responsive route checks.
- Keep every billing Worker variable and every private economic feature flag
  false. Keep `BILLING_MODE=test`, `STRIPE_LIVE_ENABLED=false`, no live provider
  catalog, no route, no Cron Trigger, and no payout execution.
- Choose a low-traffic window, define a short lock timeout, establish one named
  database operator and one independent verifier, and stop if any prerequisite
  or lock estimate differs from the recorded inventory.

## Runtime and locking review

The chain contains no table/schema drop, truncation, table/column rename, or
type rewrite. It does contain operations that require deliberate scheduling:

- Badge hardening replaces one audit constraint and a trigger and creates the
  suppression table. It defines but does not invoke the Free Member backfill.
- Notification hardening updates every inconsistent notification row, validates
  a new check constraint, replaces a trigger, and rebuilds the unread index
  non-concurrently. Runtime scales with hosted notification rows; the updates
  take row locks and the DDL/index work can block concurrent writes.
- Notification authenticity replaces broad insert policies and adds a trigger.
  Verify ordinary non-economic Signal creation and economic forgery rejection
  immediately after the transaction.
- Marketplace compatibility adds columns and foreign keys, validates two
  constraints, rewrites incomplete install-intent compatibility fields, creates
  two non-concurrent indexes, replaces triggers, and replaces owner policies.
  Runtime scales with saved add-ons/install intents; foreign-key creation and
  validation inspect existing tables and can block writes.
- The private economic core and later economic migrations primarily create new
  private tables, indexes, functions, triggers, and policies. Their initial
  indexes operate on new empty tables. Later triggers touch existing sandbox,
  Job Post, Marketplace, refund, dispute, and notification paths, so each
  boundary still requires an immediate regression proof.
- The final route-boundary migration intentionally drops one just-created old
  `request_economic_account_action` signature and replaces it with a
  service-role-only actor-explicit signature. This is an internal forward-chain
  correction, not permission to drop an unknown hosted overload.

The exact hosted runtime cannot be predicted from the repository. Record actual
row counts, locks, statement duration, WAL growth, and any long-running
transactions during the approved maintenance window. A timeout or unexpected
dependency closes the gate; it is not a reason to raise limits blindly.

## Irreversibility and compensating strategy

This sequence is additive but not mechanically reversible. It normalizes
notification and Marketplace compatibility data, replaces policies and
function bodies, and creates immutable economic history contracts. Do not claim
that dropping the new objects restores the prior state.

If a defect appears:

1. Disable the narrowest billing Worker acquisition variable and corresponding
   database feature flag. If the affected boundary is uncertain, disable
   `BILLING_ENABLED` and webhook fulfillment while preserving receipt of
   provider evidence through the approved incident path.
2. Preserve orders, payments, refunds, disputes, credits, licenses, holds,
   consents, audits, and provider-event idempotency records. Never delete or
   rewrite financial evidence to simulate rollback.
3. Keep Free Member, Commons identity, roles, badges, review, moderation, free
   Marketplace paths, and local Elysia behavior independent and available where
   safe.
4. Restore from backup only for a database-wide disaster under the separate
   recovery runbook. For a schema defect, prepare a small reviewed forward
   correction from the captured inventory and test it twice from zero.
5. Do not replay the baseline, re-run a partially recorded version, or repair
   migration history merely to make filenames align.

## Post-migration verification before any test activation

- Confirm all fourteen versions are recorded once and in order, with no
  unexpected remote-only or local-only version.
- Re-run the read-only inventory and compare object hashes, owners, security
  modes, empty search paths, grants, RLS, policies, indexes, constraints, and
  feature defaults with the reviewed candidate.
- Confirm no browser or `PUBLIC` role can read private economic tables or call
  service/operator mutation functions. Confirm community roles confer no
  economic capability and economic operators confer no governance authority.
- Re-run the actor matrix and behavior fixtures for badge suppression and Free
  Member semantics, notification authenticity, webhook ordering/idempotency,
  refunds/disputes, sandbox conservation/concurrency, Job Post review
  separation, Marketplace license/install separation, and all settlement holds.
- Confirm `profiles` and `user_roles` contain no financial state and public/self
  projections contain no provider identifiers, private reasons, balances, or
  other users' records.
- Confirm every database and edge flag remains false, and confirm the existing
  free/local/community paths still work with the billing Worker absent.
- Verify active legal document and consent-bundle hashes without printing
  private consent rows. Verify accounting export keeps unknown processor fee
  and net values null with `settlement_details_pending`.
- Retain confidential migration timing, catalog comparison, tests, verifier
  sign-off, and rollback/incident ownership as release evidence.

## Kill switches

Edge acquisition and database authorization are independent gates. Disable both
for the affected feature; neither substitutes for the other. The route-free
checked-in Wrangler example is intentionally inert. `BILLING_ENABLED=false`
stops paid acquisition but must not remove reviewed free Marketplace offers or
free-license acceptance when their separate commerce boundary is enabled.

Never use a failed payment, chargeback, waiver, restriction, or payout state as
a Commons ban, badge revocation, role change, review decision, publication
decision, or sandbox safety-tier change. Live Stripe, real payouts, production
deployment, and hosted migration require separate explicit authorization.
