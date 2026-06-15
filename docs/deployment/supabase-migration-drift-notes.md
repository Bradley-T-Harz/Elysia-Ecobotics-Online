# Supabase Migration Drift Notes

This repository contains many local migrations created during staged feature work. They are the source of intent for the website schema, but a passing frontend build does not prove the live Supabase project has applied every migration in order.

## Current readiness stance

- Do not claim fresh-project Supabase reset readiness until a clean reset has been tested in a disposable project.
- Do not claim live Supabase readiness until the verification checklist in `docs/deployment/supabase-final-verification.md` has been completed.
- Local migrations must be applied manually through the normal Supabase deployment process; this repo pass does not run remote migrations.
- Frontend pages should continue to show clean "backend table/policy not active yet" states when optional tables are unavailable.

## Drift risks to verify

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

## Fresh database review

Before using a brand-new Supabase project, run a local/disposable migration reset and verify:

- migrations apply in filename order without missing dependency errors
- every policy references existing tables, columns, functions, and enum/type names
- helper functions are created before policies that call them
- duplicate table-family migrations are compatible or reconciled
- `schema.sql` and `policies.sql` match the current migration intent

## Live project review

Before inviting beta users, verify the live project has:

- RLS enabled on user-generated, review, moderation, package, badge, report, role, and audit tables
- public policies limited to published/public records only
- private notes, private feedback, reports, package paths, drafts, hidden/removed records, and audit rows restricted to authorized roles
- storage buckets and storage policies aligned with the public/private asset boundary
- no frontend use of service-role credentials

## Manual repair policy

If the live project was manually repaired, add a new reconciliation migration instead of relying on undocumented dashboard changes. Prefer idempotent statements such as:

- `create table if not exists`
- `alter table ... add column if not exists`
- `drop policy if exists`
- `create policy`

Do not apply reconciliation migrations remotely until reviewed against a disposable database and the live table state.
