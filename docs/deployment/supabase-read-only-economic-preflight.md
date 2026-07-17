# Supabase read-only economic preflight

Economic migrations must not be reviewed or applied against the hosted project until the hosted schema is compared with the repository. The repository contains a captured baseline and forward repairs, while historical SQL was also applied manually. A migration filename is not evidence that the corresponding SQL is live.

## Safety boundary

The inventory helper is read-only. It opens `BEGIN TRANSACTION READ ONLY`, applies short statement and lock timeouts, emits metadata as JSON, and rolls back. It does not inspect table rows, Auth user records, badge evidence, payment data, secrets, function bodies, or storage objects. Function definitions are represented by SHA-256 hashes so drift can be detected without printing embedded literals.

Use a dedicated database role with only catalog visibility and the minimum metadata access needed. Do not use a service-role API key: this tool requires a PostgreSQL connection string belonging to a read-only database role.

Inventory output still reveals internal object names, policies, grants, and architecture. Treat it as confidential operational data. Store it outside the repository, restrict it to mode `0600`, redact database/project identifiers before sharing, and never attach it to a public issue.

## Inspect the SQL without connecting

```bash
node scripts/supabaseReadOnlyInventory.mjs --print-sql
```

## Authorized execution

Only after an authorized operator supplies a read-only role:

```bash
SUPABASE_READONLY_DATABASE_URL='postgresql://READ_ONLY_ROLE:REDACTED@HOST:5432/postgres?sslmode=require' \
  node scripts/supabaseReadOnlyInventory.mjs --execute --output /secure/private/elysia-supabase-inventory.json
```

The URL is passed to `psql` through its environment, not a command argument, and is never logged. The output path is created exclusively; an existing file is not overwritten.

## Required comparison

Compare the resulting inventory with, in order:

1. `supabase/migrations/20260714010000_remote_public_schema_baseline.sql` as a historical capture only.
2. Every later file in `supabase/migrations/` in lexical order.
3. `supabase/schema.sql` and `supabase/policies.sql` as explicitly pre-economic
   2026-07-14 reference snapshots. They end at
   `20260714030000_sandbox_proxy_access_and_reservation.sql`, intentionally omit
   every `20260716...` economic migration, and are neither synchronized current
   state nor live proof.
4. Application queries and RPC names.
5. `docs/deployment/supabase-migration-drift-notes.md`.

Explicitly verify before economic activation:

- Badge mutation function owners, security mode, search path, and EXECUTE ACLs.
- Free Member function body and currently awarded rows.
- Notification columns, policies, grants, and read-state indexes.
- Marketplace saved-add-on and install-intent identifiers.
- Sandbox reservation/finalizer function definitions and ACLs.
- All economic table RLS state, policies, functions, grants, and feature defaults.
- `private.economic_account_is_recoverable`, `public.attach_economic_checkout_billing_customer`, provider-customer uniqueness, and service-role-only execution; verify the hosted `auth.users` shape supports the confirmed/non-anonymous/non-deleted/non-banned checks.
- Durable payment/refund/dispute ordering and the Marketplace, Job Post, organization-service, and sponsorship hold tables, triggers, append-only event protections, owner-safe warnings, operator queues, and full-refund-only resolution behavior.
- Active economic legal-document and consent-bundle versions and SHA-256 values against `src/pages/Legal/economicLegalContentManifest.ts`; do not print private consent rows.
- Accounting export behavior for unknown Stripe settlement details: processor fee and net must remain null with `settlement_details_pending` until a reviewed balance-transaction reconciliation path exists.
- `anon`, `authenticated`, `service_role`, community-role, and economic-operator behavior.
- Storage bucket visibility and policy drift.
- The hosted migration ledger versus repository filenames.

Do not replay the captured baseline. Reconcile unexplained differences first,
review each new forward migration against the inventory, and obtain explicit
approval before any hosted SQL application. Before economic activation, run
`npm run test:release` in an authorized environment with a usable rootless
Podman or user-scoped Docker runtime. Its disposable-database phase is an
external release gate; a passing `test:all` alone is not a substitute when the
current workstation or CI runner cannot provide either runtime.
