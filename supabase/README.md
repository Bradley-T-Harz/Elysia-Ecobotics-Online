# Supabase schema and migration management

`supabase/migrations` is the only active ordered chain. It intentionally contains:

1. `20260714010000_remote_public_schema_baseline.sql`
2. `20260714015000_commune_reaction_counts_security_invoker.sql`
3. `20260714020000_repository_showcase_structured_metadata_repair.sql`
4. `20260714030000_sandbox_proxy_access_and_reservation.sql`
5. `20260716010000_badge_security_and_semantics_hardening.sql`
6. `20260716011000_notification_read_state_hardening.sql`
7. `20260716011500_economic_notification_authenticity.sql`
8. `20260716012000_marketplace_identifier_compatibility.sql`
9. `20260716020000_private_economic_core.sql`
10. `20260716021000_economic_test_provider_catalog.sql`
11. `20260716030000_sandbox_credit_ledger_and_metering.sql`
12. `20260716032000_economic_operator_separation_of_duties.sql`
13. `20260716034000_sandbox_credit_commerce_and_compensation.sql`
14. `20260716040000_job_post_economic_sidecar_and_publication_gate.sql`
15. `20260716050000_marketplace_commerce_licenses_and_seller_accounting.sql`
16. `20260716060000_organization_sponsorship_waiver_sidecars.sql`
17. `20260716070000_economic_projections_reporting_notifications_lifecycle.sql`
18. `20260716071000_economic_route_kill_switch_boundaries.sql`

The baseline is a schema-only capture of production before the three repairs. It
may be executed against a fresh disposable Supabase Postgres database for tests,
but it must never be executed against the existing production project. Its
version was marked applied in migration history on 2026-07-14 without executing
the baseline SQL; the three repair migrations were then applied and verified one
at a time. Those first four versions are aligned locally/remotely. Do not replay
or edit that completed historical sequence.

The fourteen `20260716...` files are additive repository migrations for the
test-mode economic subsystem. Their presence does not prove that they have been
applied to any hosted project. Live state must be inventoried read-only and
reconciled with migration history before a reviewed forward application. Never
mark them applied, replay them, or run them against a hosted database merely to
make migration history appear aligned.

The invalidly versioned historical files are preserved byte-for-byte under
`supabase/legacy-migrations`; they are documentation, not an executable chain.
See its `MANIFEST.md` and `docs/deployment/supabase-migration-drift-notes.md`.

`schema.sql` and `policies.sql` are explicitly pre-economic reference snapshots
captured after the 2026-07-14 repair checkpoint. They intentionally end with
`20260714030000_sandbox_proxy_access_and_reservation.sql` and do not contain the
`20260716...` forward economic state. They are neither synchronized current
schema declarations nor proof of hosted state. `seed.sql` is optional
development data and is never part of the production repair sequence.

For a fresh disposable non-production database, apply all active migrations in
filename order, then optionally apply `seed.sql`. The repository test harness
does this in an ephemeral local Postgres container and exercises payment event
ordering, function ACLs, transaction-scoped refunds/receipts, catalog integrity,
`plpgsql_check` when the image provides it, and the economic operator
projections. It prefers a usable rootless Podman runtime and falls back to a
user-scoped Docker runtime; `ELYSIA_CONTAINER_RUNTIME` can select either one:

```bash
ELYSIA_CONTAINER_RUNTIME=podman npm run test:sandbox-database:disposable
```

See `docs/deployment/economic-migration-release-gate.md` for the migration
order, lock-risk notes, pre/post checks, compensating strategy, and kill-switch
requirements. The economic sequence is not a general-purpose reversible
migration. Hosted rollback means disabling acquisition first, preserving
financial evidence, and applying a reviewed forward correction.

Configure `VITE_SUPABASE_URL` and the publishable/anon key only in the intended
frontend environment.

All economic flags default off. `live_stripe` and provider payout execution
(`marketplace_payouts`) are deliberately unactivatable in this release.
`marketplace_payout_preparation` creates internal test accounting records only;
it does not execute or promise a provider transfer. Organization-service and
sponsorship acquisition have independent fail-closed switches:
`organization_billing` and `sponsorship_checkout`. Sponsorship checkout also
requires the ethical `sponsorship_review_workflow` and verified webhook flag.
The authenticated organization projection exposes prices and canonical consent
versions only to each record's current authorized signer; it never exposes an
order ID, provider reference, private reason, or contact field.

Account-linked checkout additionally requires a recoverable Auth row and uses
one private canonical provider Customer attached to the internal order before a
hosted Session is created. Verified payment events derive final order state
from already-persisted payments, refunds, and disputes so a late success cannot
temporarily revive fulfillment. Marketplace, Job Post, organization-service,
and sponsorship eligibility races use private durable holds; their automatic
resolution requires complete verified refund coverage and never changes
community identity or authority.

The economic legal manifest is content-addressed with SHA-256. Run
`npm run test:economic-legal-integrity` and verify hosted active document and
consent-bundle hashes before any test activation. Stripe balance-transaction
fee/net reconciliation is not implemented; exports must keep those fields null
and report `settlement_details_pending`. This is a live blocker, not an amount
to estimate.

Never expose a Supabase service role key in this frontend project.

RLS is mandatory because the frontend talks to Supabase with the public anon key. Public users should see only approved add-ons. Developers should see their own drafts. Admin review should be limited to manually approved admin identities.


## Historical saved-add-on bootstrap

The former bootstrap files are retained for historical context:

- `supabase/legacy-migrations/2026_06_02_saved_addons_permissions.sql`
- `supabase/legacy-migrations/2026_06_02_profile_bootstrap_for_saved_addons.sql`

Do not execute those archived files against production. Their current effects
are represented by the baseline. Any future correction must be a new, uniquely
timestamped additive migration. The historical bootstrap did not grant
admin/developer status and did not receive local Elysia passwords, files,
memory, request traces, dependency inventory, or local paths.
