# Supabase schema and migration management

`supabase/migrations` is the only active ordered chain. It intentionally contains:

1. `20260714010000_remote_public_schema_baseline.sql`
2. `20260714015000_commune_reaction_counts_security_invoker.sql`
3. `20260714020000_repository_showcase_structured_metadata_repair.sql`
4. `20260714030000_sandbox_proxy_access_and_reservation.sql`

The baseline is a schema-only capture of production before the three repairs. It
may be executed against a fresh disposable Supabase Postgres database for tests,
but it must never be executed against the existing production project. At the
future production checkpoint it is marked applied in migration history only.

The invalidly versioned historical files are preserved byte-for-byte under
`supabase/legacy-migrations`; they are documentation, not an executable chain.
See its `MANIFEST.md` and `docs/deployment/supabase-migration-drift-notes.md`.

`schema.sql` and `policies.sql` remain synchronized reference snapshots. They
are not the production migration mechanism. `seed.sql` is optional development
data and is never part of the production repair sequence.

For a new non-production project, apply the four active migrations in filename
order, then optionally apply `seed.sql`. Configure `VITE_SUPABASE_URL` and the
publishable/anon key only in the intended frontend environment.

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
