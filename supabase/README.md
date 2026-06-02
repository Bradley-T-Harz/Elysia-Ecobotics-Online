# Supabase Setup

1. Create a Supabase project.
2. Run `schema.sql`.
3. Run `policies.sql`.
4. Optionally run `seed.sql`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Cloudflare Pages or `.env.local`.

Never expose a Supabase service role key in this frontend project.

RLS is mandatory because the frontend talks to Supabase with the public anon key. Public users should see only approved add-ons. Developers should see their own drafts. Admin review should be limited to manually approved admin identities.
