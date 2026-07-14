-- Community Voting Room moderation-delete visibility hardening.
-- This does not delete vote ballots/events. It keeps normal public/user-facing
-- reads parent-filtered after Admin Moderation removes the commune_posts row
-- from active public surfaces.

alter table public.commune_posts enable row level security;
alter table public.commune_vote_posts enable row level security;
alter table public.commune_vote_options enable row level security;
alter table public.commune_vote_ballots enable row level security;
alter table public.commune_vote_events enable row level security;

drop policy if exists "public reads published commune posts" on public.commune_posts;
create policy "public reads published commune posts"
on public.commune_posts
for select
using (
  (
    status = 'published'
    and visibility = 'public'
    and coalesce(visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
    and hidden_at is null
    and removed_at is null
    and archived_at is null
  )
  or user_id = auth.uid()
  or public.current_user_can_review_domain('commune'::public.review_domain)
);

drop policy if exists "public reads published public vote metadata" on public.commune_vote_posts;
create policy "public reads published public vote metadata"
on public.commune_vote_posts
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.commune_posts p
    where p.id = post_id
      and p.post_type = 'community_vote'
      and p.status = 'published'
      and p.visibility = 'public'
      and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
      and p.hidden_at is null
      and p.removed_at is null
      and p.archived_at is null
  )
  or created_by = auth.uid()
  or public.current_user_can_review_domain('commune'::public.review_domain)
);

drop policy if exists "public reads published vote options" on public.commune_vote_options;
create policy "public reads published vote options"
on public.commune_vote_options
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.commune_vote_posts v
    join public.commune_posts p on p.id = v.post_id
    where v.post_id = vote_post_id
      and p.post_type = 'community_vote'
      and p.status = 'published'
      and p.visibility = 'public'
      and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
      and p.hidden_at is null
      and p.removed_at is null
      and p.archived_at is null
  )
  or public.current_user_can_review_domain('commune'::public.review_domain)
);

drop policy if exists "users read own vote ballots" on public.commune_vote_ballots;
create policy "users read own vote ballots"
on public.commune_vote_ballots
for select
to authenticated
using (
  (
    voter_user_id = auth.uid()
    and exists (
      select 1
      from public.commune_vote_posts v
      join public.commune_posts p on p.id = v.post_id
      where v.post_id = commune_vote_ballots.vote_post_id
        and p.post_type = 'community_vote'
        and p.status = 'published'
        and p.visibility = 'public'
        and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
        and p.hidden_at is null
        and p.removed_at is null
        and p.archived_at is null
    )
  )
  or public.current_user_is_admin()
  or public.current_user_can_review_domain('commune'::public.review_domain)
);

drop policy if exists "users insert own open vote ballots" on public.commune_vote_ballots;
create policy "users insert own open vote ballots"
on public.commune_vote_ballots
for insert
to authenticated
with check (
  voter_user_id = auth.uid()
  and exists (
    select 1
    from public.commune_vote_posts v
    join public.commune_posts p on p.id = v.post_id
    join public.commune_vote_options o on o.vote_post_id = v.post_id and o.id = commune_vote_ballots.option_id
    where v.post_id = commune_vote_ballots.vote_post_id
      and v.vote_status = 'open'
      and (v.opens_at is null or now() >= v.opens_at)
      and (v.closes_at is null or now() <= v.closes_at)
      and p.post_type = 'community_vote'
      and p.status = 'published'
      and p.visibility = 'public'
      and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
      and p.hidden_at is null
      and p.removed_at is null
      and p.archived_at is null
  )
);

drop policy if exists "users update own open vote ballots" on public.commune_vote_ballots;
create policy "users update own open vote ballots"
on public.commune_vote_ballots
for update
to authenticated
using (voter_user_id = auth.uid())
with check (
  voter_user_id = auth.uid()
  and exists (
    select 1
    from public.commune_vote_posts v
    join public.commune_posts p on p.id = v.post_id
    join public.commune_vote_options o on o.vote_post_id = v.post_id and o.id = commune_vote_ballots.option_id
    where v.post_id = commune_vote_ballots.vote_post_id
      and v.vote_status = 'open'
      and (v.opens_at is null or now() >= v.opens_at)
      and (v.closes_at is null or now() <= v.closes_at)
      and p.post_type = 'community_vote'
      and p.status = 'published'
      and p.visibility = 'public'
      and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
      and p.hidden_at is null
      and p.removed_at is null
      and p.archived_at is null
  )
);

drop policy if exists "public reads public vote events" on public.commune_vote_events;
create policy "public reads public vote events"
on public.commune_vote_events
for select
to anon, authenticated
using (
  (
    event_visibility = 'public'
    and exists (
      select 1
      from public.commune_vote_posts v
      join public.commune_posts p on p.id = v.post_id
      where v.post_id = vote_post_id
        and p.post_type = 'community_vote'
        and p.status = 'published'
        and p.visibility = 'public'
        and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
        and p.hidden_at is null
        and p.removed_at is null
        and p.archived_at is null
    )
  )
  or public.current_user_is_admin()
  or public.current_user_can_review_domain('commune'::public.review_domain)
);

create or replace function public.commune_vote_result_summary(target_vote_post_ids uuid[] default null)
returns table (vote_post_id uuid, option_id uuid, ballot_count bigint, total_ballots bigint, percentage numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with visible_options as (
    select o.vote_post_id, o.id as option_id
    from public.commune_vote_options o
    join public.commune_vote_posts v on v.post_id = o.vote_post_id
    join public.commune_posts p on p.id = v.post_id
    where (target_vote_post_ids is null or o.vote_post_id = any(target_vote_post_ids))
      and p.post_type = 'community_vote'
      and p.status = 'published'
      and p.visibility = 'public'
      and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked')
      and p.hidden_at is null
      and p.removed_at is null
      and p.archived_at is null
      and (
        public.current_user_is_admin()
        or public.current_user_can_review_domain('commune'::public.review_domain)
        or v.results_visibility = 'always'
        or (v.results_visibility = 'after_close' and v.vote_status in ('closed','accepted','declined','posted_to_official_update','archived'))
        or (v.results_visibility = 'after_vote' and (v.vote_status in ('closed','accepted','declined','posted_to_official_update','archived') or exists (select 1 from public.commune_vote_ballots own_ballot where own_ballot.vote_post_id = v.post_id and own_ballot.voter_user_id = auth.uid())))
      )
  ),
  counts as (
    select vo.vote_post_id, vo.option_id, count(b.id)::bigint as ballot_count
    from visible_options vo
    left join public.commune_vote_ballots b on b.vote_post_id = vo.vote_post_id and b.option_id = vo.option_id
    group by vo.vote_post_id, vo.option_id
  )
  select c.vote_post_id, c.option_id, c.ballot_count, sum(c.ballot_count) over (partition by c.vote_post_id)::bigint as total_ballots,
    case when sum(c.ballot_count) over (partition by c.vote_post_id) = 0 then 0 else round((c.ballot_count::numeric / sum(c.ballot_count) over (partition by c.vote_post_id)::numeric) * 100, 2) end as percentage
  from counts c
  order by c.vote_post_id, c.option_id;
$$;
