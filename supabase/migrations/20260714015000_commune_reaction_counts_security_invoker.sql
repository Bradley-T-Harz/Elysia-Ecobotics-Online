-- Resolve the Supabase Security Advisor security-definer-view finding without
-- exposing reaction identities or changing the existing reaction mutation API.
--
-- The public view becomes SECURITY INVOKER and reads a userless aggregate table.
-- RLS on that table delegates visibility to the existing parent post/comment
-- policies, so anonymous readers, members, authors, reviewers, and admins see
-- counts only for content they can already select.

begin;

create table public.commune_content_reaction_totals (
  target_type text not null
    constraint commune_content_reaction_totals_target_type_check
    check (target_type in ('post', 'comment')),
  target_id uuid not null,
  helpful_count integer not null default 0
    constraint commune_content_reaction_totals_helpful_count_check
    check (helpful_count >= 0),
  caution_count integer not null default 0
    constraint commune_content_reaction_totals_caution_count_check
    check (caution_count >= 0),
  updated_at timestamptz not null default now(),
  constraint commune_content_reaction_totals_pkey
    primary key (target_type, target_id)
);

alter table public.commune_content_reaction_totals owner to postgres;
alter table public.commune_content_reaction_totals enable row level security;

revoke all privileges on table public.commune_content_reaction_totals
  from public, anon, authenticated, service_role;

create policy "visible content reaction totals are readable"
  on public.commune_content_reaction_totals
  for select
  to anon, authenticated
  using (
    (
      target_type = 'post'
      and exists (
        select 1
        from public.commune_posts as post
        where post.id = commune_content_reaction_totals.target_id
      )
    )
    or
    (
      target_type = 'comment'
      and exists (
        select 1
        from public.commune_comments as comment
        where comment.id = commune_content_reaction_totals.target_id
      )
    )
  );

grant select on table public.commune_content_reaction_totals
  to anon, authenticated;

create or replace function public.sync_commune_content_reaction_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    update public.commune_content_reaction_totals
       set helpful_count = greatest(
             0,
             helpful_count - case when old.reaction = 'helpful' then 1 else 0 end
           ),
           caution_count = greatest(
             0,
             caution_count - case when old.reaction = 'caution' then 1 else 0 end
           ),
           updated_at = pg_catalog.now()
     where target_type = old.target_type
       and target_id = old.target_id;

    delete from public.commune_content_reaction_totals
     where target_type = old.target_type
       and target_id = old.target_id
       and helpful_count = 0
       and caution_count = 0;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.commune_content_reaction_totals (
      target_type,
      target_id,
      helpful_count,
      caution_count,
      updated_at
    ) values (
      new.target_type,
      new.target_id,
      case when new.reaction = 'helpful' then 1 else 0 end,
      case when new.reaction = 'caution' then 1 else 0 end,
      pg_catalog.now()
    )
    on conflict (target_type, target_id) do update
       set helpful_count = public.commune_content_reaction_totals.helpful_count
             + excluded.helpful_count,
           caution_count = public.commune_content_reaction_totals.caution_count
             + excluded.caution_count,
           updated_at = pg_catalog.now();
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

alter function public.sync_commune_content_reaction_totals() owner to postgres;
revoke all privileges on function public.sync_commune_content_reaction_totals()
  from public, anon, authenticated, service_role;

drop trigger if exists sync_commune_content_reaction_totals
  on public.commune_content_reactions;
create trigger sync_commune_content_reaction_totals
after insert or update of target_type, target_id, reaction or delete
on public.commune_content_reactions
for each row execute function public.sync_commune_content_reaction_totals();

-- This is an intentional derived-data backfill. It copies no user identifiers,
-- submitted content, private notes, or reaction row IDs.
insert into public.commune_content_reaction_totals (
  target_type,
  target_id,
  helpful_count,
  caution_count,
  updated_at
)
select
  reaction.target_type,
  reaction.target_id,
  count(*) filter (where reaction.reaction = 'helpful')::integer,
  count(*) filter (where reaction.reaction = 'caution')::integer,
  pg_catalog.now()
from public.commune_content_reactions as reaction
group by reaction.target_type, reaction.target_id;

create or replace view public.commune_content_reaction_counts
with (security_invoker = true, security_barrier = true)
as
select
  total.target_type,
  total.target_id,
  total.helpful_count,
  total.caution_count
from public.commune_content_reaction_totals as total;

alter view public.commune_content_reaction_counts owner to postgres;
revoke all privileges on table public.commune_content_reaction_counts
  from public, anon, authenticated, service_role;
grant select on table public.commune_content_reaction_counts
  to anon, authenticated;

comment on table public.commune_content_reaction_totals is
  'Userless reaction aggregates maintained by a locked trigger and filtered through parent-content RLS.';
comment on function public.sync_commune_content_reaction_totals is
  'Maintains userless reaction aggregates. Trigger-only; direct execution is revoked from API roles.';
comment on view public.commune_content_reaction_counts is
  'SECURITY INVOKER reaction counts; parent-content visibility is enforced by RLS on the aggregate table.';

commit;
