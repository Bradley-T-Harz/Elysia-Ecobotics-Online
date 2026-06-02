-- Saved add-ons permission fix for browser clients using Supabase anon/authenticated sessions.
-- This grants table privileges only; row ownership remains enforced by RLS.

alter table public.user_saved_addons enable row level security;

drop policy if exists "users manage own saved addons" on public.user_saved_addons;
create policy "users manage own saved addons" on public.user_saved_addons
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, delete on table public.user_saved_addons to authenticated;

-- user_saved_addons has a composite primary key and no sequence-backed id column,
-- so no sequence grants are required for this table.
