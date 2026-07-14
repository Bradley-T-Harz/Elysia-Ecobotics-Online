-- Commune community signal system.
-- Local migration only until applied to the live Supabase project.

create table if not exists public.commune_content_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reaction text not null check (reaction in ('helpful', 'caution')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index if not exists commune_content_reactions_target_idx
  on public.commune_content_reactions(target_type, target_id);

create index if not exists commune_content_reactions_reaction_idx
  on public.commune_content_reactions(reaction);

create or replace view public.commune_content_reaction_counts as
select
  target_type,
  target_id,
  count(*) filter (where reaction = 'helpful')::integer as helpful_count,
  count(*) filter (where reaction = 'caution')::integer as caution_count
from public.commune_content_reactions
group by target_type, target_id;

alter table public.commune_content_reactions enable row level security;

drop policy if exists "users read own commune reactions" on public.commune_content_reactions;
create policy "users read own commune reactions"
  on public.commune_content_reactions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "users create own commune reactions" on public.commune_content_reactions;
create policy "users create own commune reactions"
  on public.commune_content_reactions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users update own commune reactions" on public.commune_content_reactions;
create policy "users update own commune reactions"
  on public.commune_content_reactions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users delete own commune reactions" on public.commune_content_reactions;
create policy "users delete own commune reactions"
  on public.commune_content_reactions
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "moderators read commune reactions" on public.commune_content_reactions;
create policy "moderators read commune reactions"
  on public.commune_content_reactions
  for select
  to authenticated
  using (public.current_user_can_review_domain('commune'::public.review_domain));

grant select on public.commune_content_reaction_counts to anon, authenticated;
grant select, insert, update, delete on public.commune_content_reactions to authenticated;
