# Supabase Setup

1. Create a Supabase project.
2. Run `schema.sql`.
3. Run `policies.sql`.
4. Optionally run `seed.sql`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Cloudflare Pages or `.env.local`.

Never expose a Supabase service role key in this frontend project.

RLS is mandatory because the frontend talks to Supabase with the public anon key. Public users should see only approved add-ons. Developers should see their own drafts. Admin review should be limited to manually approved admin identities.


## Saved add-ons profile bootstrap

If authenticated users can load the catalog but saving an add-on fails with a missing `profiles` foreign key, run:

- `supabase/migrations/2026_06_02_saved_addons_permissions.sql`
- `supabase/migrations/2026_06_02_profile_bootstrap_for_saved_addons.sql`

The bootstrap migration creates minimal Marketplace profile rows from `auth.users` and installs a future-user trigger. It does not grant admin/developer status and does not receive local Elysia passwords, files, memory, request traces, dependency inventory, or local paths.
