# Supabase Migration Drift Notes

The former migration directory contained 47 filenames that all parsed as the
same Supabase version, `2026`. A read-only linked inspection on 2026-07-14 also
found that production had no Supabase migration-history schema/table. Production
objects existed, but file-level application history could not be proven.

Those historical files are now immutable records under
`supabase/legacy-migrations`. The first four active-directory files are one
production public-schema baseline followed by three additive repairs. That is
the completed pre-economic 2026-07-14 checkpoint, not the whole current
repository chain. The later `20260716...` economic migrations are forward
repository declarations whose presence does not prove hosted application. See
the legacy manifest for the original filename, purpose, first repository commit,
and known exception.

## Historical installed checkpoint (2026-07-14)

- The active baseline and all three repairs must apply with `ON_ERROR_STOP=1` in a disposable Supabase Postgres database.
- On 2026-07-14, the operator completed the baseline history reconciliation and applied each of the three additive repairs separately, with the documented read-only verification gate between them.
- `supabase migration list --linked` then showed all four versions aligned locally/remotely. Do not reapply them or repeat the history repair.
- The database layer being installed does not enable execution: the finalizer hash remains NULL and the Pages/runner kill switches remain off.
- Frontend pages should continue to show clean "backend table/policy not active yet" states when optional tables are unavailable.

## Pre-economic reconciliation order

1. `20260714010000_remote_public_schema_baseline.sql`
2. `20260714015000_commune_reaction_counts_security_invoker.sql`
3. `20260714020000_repository_showcase_structured_metadata_repair.sql`
4. `20260714030000_sandbox_proxy_access_and_reservation.sql`

The baseline represents production immediately before the repairs. It contains
project-owned `public` schema/ACL metadata only, with no rows, credentials, or
recreation of Supabase-managed `auth`/`storage` internals. It is executable only
for disposable validation.

The final pre-reconciliation read-only inspection on 2026-07-14 showed the
active versions locally and a blank remote column for each. That evidence is
retained as the historical starting point. Later on 2026-07-14, the operator
completed the controlled history repair and three separately verified repair
installations; all four versions then aligned. The active baseline SHA-256 is
`8986352533e6b37fe5cf0a533367f87f3149deda6e87117c7b05d66ceca94503`.

## Completed production sequence — do not repeat

The completed order was:

1. Re-run read-only migration/catalog inspection.
2. Mark baseline version `20260714010000` applied in migration history. Never execute its SQL against existing production.
3. Apply only the reaction-count security repair.
4. Verify the count view is `security_invoker`, its userless aggregate table has RLS, private targets remain hidden, public counts and reaction mutations work, and the trigger helper is not executable by API roles.
5. Record reaction-count version `20260714015000` as applied.
6. Apply only the Repository Showcase repair.
7. Verify its 16 fields, constraint, indexes, comments, grants, RLS, and published-plus-public behavior.
8. Record Repository Showcase version `20260714020000` as applied.
9. Apply only the governed-sandbox repair.
10. Verify exact RPC signatures/owners/search paths/grants, table grants/RLS, account/source denial paths, idempotency, leases, quotas, lifecycle, and finalizer hash slot.
11. Record sandbox version `20260714030000` as applied.

Manual SQL Editor application and each migration-history repair were production
mutations performed by the operator outside the repository-side implementation
pass. Future corrections must be new additive migrations; the completed files
and history entries are not to be changed or replayed.

## Drift risks to keep verifying

The most likely drift areas are:

- badge backfills and the `free_member` award function
- Commons profile customization/media tables and storage policies
- Developer Forge package/submission/review tables
- Marketplace publication/revocation/install-intent tables
- Commune duplicate historical table families versus current canonical table paths
- realtime chat rooms/messages/reports
- collaborative code review documents/versions/annotations
- sandbox handoff request/review/event tables
- admin audit/review helper functions and role policies

## Disposable database regression

Before using a brand-new Supabase project, apply the complete current active
chain to a disposable database and verify:

- migrations apply in filename order without missing dependency errors
- every policy references existing tables, columns, functions, and enum/type names
- helper functions are created before policies that call them
- the archived duplicate table-family files are not treated as active migrations
- `schema.sql` and `policies.sql` contain the complete pre-economic 2026-07-14
  repair checkpoint, end at the sandbox repair, and intentionally omit the
  `20260716...` forward economic state

## Live project activation review

Before inviting beta users, verify the live project has:

- RLS enabled on user-generated, review, moderation, package, badge, report, role, and audit tables
- public policies limited to published/public records only
- private notes, private feedback, reports, package paths, drafts, hidden/removed records, and audit rows restricted to authorized roles
- storage buckets and storage policies aligned with the public/private asset boundary
- no frontend use of service-role credentials

## Manual repair policy

If the live project is manually repaired, record the reviewed version in migration
history and add any further correction as a new uniquely timestamped migration
instead of editing the baseline or archived files. Prefer idempotent statements such as:

- `create table if not exists`
- `alter table ... add column if not exists`
- `drop policy if exists`
- `create policy`

Do not reapply the completed reconciliation migrations. Review any future additive migration against a disposable database and the live table state before its own controlled checkpoint.
