-- Community Voting Room: advisory public governance guidance.
-- Idempotent and additive. Apply manually in Supabase SQL Editor after the enum migration.
-- Community votes guide stewardship decisions. They do not automatically govern the site,
-- change policy, create safety/legal obligations, alter Marketplace or Developer Forge behavior,
-- change Elysia behavior, or publish Official Updates.

insert into public.commune_rooms (slug, name, description, room_type)
values (
  'community-vote',
  'Community Voting Room',
  'Admin-controlled public guidance votes for website updates, fixes, additions, removals, priorities, and direction-of-work questions. Votes guide stewardship and do not automatically change Elysia behavior, policy, legal/safety posture, Marketplace, Developer Forge, or Official Updates.',
  'community_vote'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  room_type = excluded.room_type;

create table if not exists public.commune_vote_posts (
  post_id uuid primary key references public.commune_posts(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  question text not null,
  context text,
  decision_type text not null default 'single_choice_guidance',
  vote_status text not null default 'draft',
  visibility text not null default 'public',
  opens_at timestamptz,
  closes_at timestamptz,
  results_visibility text not null default 'after_vote',
  allow_comments boolean not null default true,
  admin_outcome_summary text,
  official_update_post_id uuid references public.commune_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commune_vote_posts
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists question text,
  add column if not exists context text,
  add column if not exists decision_type text not null default 'single_choice_guidance',
  add column if not exists vote_status text not null default 'draft',
  add column if not exists visibility text not null default 'public',
  add column if not exists opens_at timestamptz,
  add column if not exists closes_at timestamptz,
  add column if not exists results_visibility text not null default 'after_vote',
  add column if not exists allow_comments boolean not null default true,
  add column if not exists admin_outcome_summary text,
  add column if not exists official_update_post_id uuid references public.commune_posts(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.commune_vote_options (
  id uuid primary key default gen_random_uuid(),
  vote_post_id uuid not null references public.commune_vote_posts(post_id) on delete cascade,
  option_label text not null,
  option_description text,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commune_vote_options
  add column if not exists vote_post_id uuid references public.commune_vote_posts(post_id) on delete cascade,
  add column if not exists option_label text,
  add column if not exists option_description text,
  add column if not exists display_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.commune_vote_ballots (
  id uuid primary key default gen_random_uuid(),
  vote_post_id uuid not null references public.commune_vote_posts(post_id) on delete cascade,
  option_id uuid not null,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commune_vote_ballots
  add column if not exists vote_post_id uuid references public.commune_vote_posts(post_id) on delete cascade,
  add column if not exists option_id uuid,
  add column if not exists voter_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.commune_vote_events (
  id uuid primary key default gen_random_uuid(),
  vote_post_id uuid not null references public.commune_vote_posts(post_id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_note text,
  event_visibility text not null default 'public',
  created_at timestamptz not null default now()
);

alter table public.commune_vote_events
  add column if not exists vote_post_id uuid references public.commune_vote_posts(post_id) on delete cascade,
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists event_type text,
  add column if not exists event_note text,
  add column if not exists event_visibility text not null default 'public',
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_vote_posts_decision_type_check'
      and conrelid = 'public.commune_vote_posts'::regclass
  ) then
    alter table public.commune_vote_posts
      add constraint commune_vote_posts_decision_type_check
      check (decision_type in ('single_choice_guidance')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_vote_posts_status_check'
      and conrelid = 'public.commune_vote_posts'::regclass
  ) then
    alter table public.commune_vote_posts
      add constraint commune_vote_posts_status_check
      check (vote_status in ('draft','scheduled','open','closed','accepted','declined','posted_to_official_update','archived')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_vote_posts_visibility_check'
      and conrelid = 'public.commune_vote_posts'::regclass
  ) then
    alter table public.commune_vote_posts
      add constraint commune_vote_posts_visibility_check
      check (visibility in ('public')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_vote_posts_results_visibility_check'
      and conrelid = 'public.commune_vote_posts'::regclass
  ) then
    alter table public.commune_vote_posts
      add constraint commune_vote_posts_results_visibility_check
      check (results_visibility in ('always','after_vote','after_close','staff_only')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_vote_posts_time_window_check'
      and conrelid = 'public.commune_vote_posts'::regclass
  ) then
    alter table public.commune_vote_posts
      add constraint commune_vote_posts_time_window_check
      check (closes_at is null or opens_at is null or closes_at > opens_at) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_vote_options_label_check'
      and conrelid = 'public.commune_vote_options'::regclass
  ) then
    alter table public.commune_vote_options
      add constraint commune_vote_options_label_check
      check (length(trim(option_label)) > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_vote_options_id_vote_unique'
      and conrelid = 'public.commune_vote_options'::regclass
  ) then
    alter table public.commune_vote_options
      add constraint commune_vote_options_id_vote_unique unique (id, vote_post_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_vote_ballots_vote_voter_unique'
      and conrelid = 'public.commune_vote_ballots'::regclass
  ) then
    alter table public.commune_vote_ballots
      add constraint commune_vote_ballots_vote_voter_unique unique (vote_post_id, voter_user_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_vote_ballots_option_same_vote_fk'
      and conrelid = 'public.commune_vote_ballots'::regclass
  ) then
    alter table public.commune_vote_ballots
      add constraint commune_vote_ballots_option_same_vote_fk
      foreign key (option_id, vote_post_id)
      references public.commune_vote_options(id, vote_post_id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_vote_events_type_check'
      and conrelid = 'public.commune_vote_events'::regclass
  ) then
    alter table public.commune_vote_events
      add constraint commune_vote_events_type_check
      check (event_type in ('created','scheduled','opened','closed','reopened','accepted','declined','posted_to_official_update','archived','outcome_updated','comments_enabled','comments_disabled')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_vote_events_visibility_check'
      and conrelid = 'public.commune_vote_events'::regclass
  ) then
    alter table public.commune_vote_events
      add constraint commune_vote_events_visibility_check
      check (event_visibility in ('public','staff')) not valid;
  end if;

  begin
    alter table public.commune_vote_posts validate constraint commune_vote_posts_decision_type_check;
    alter table public.commune_vote_posts validate constraint commune_vote_posts_status_check;
    alter table public.commune_vote_posts validate constraint commune_vote_posts_visibility_check;
    alter table public.commune_vote_posts validate constraint commune_vote_posts_results_visibility_check;
    alter table public.commune_vote_posts validate constraint commune_vote_posts_time_window_check;
    alter table public.commune_vote_options validate constraint commune_vote_options_label_check;
    alter table public.commune_vote_events validate constraint commune_vote_events_type_check;
    alter table public.commune_vote_events validate constraint commune_vote_events_visibility_check;
  exception when others then
    raise notice 'Community Voting Room constraints left not validated: %', sqlerrm;
  end;
end $$;

create index if not exists commune_vote_posts_status_window_idx on public.commune_vote_posts(vote_status, opens_at, closes_at);
create index if not exists commune_vote_posts_created_by_idx on public.commune_vote_posts(created_by, updated_at desc);
create index if not exists commune_vote_posts_official_update_idx on public.commune_vote_posts(official_update_post_id);
create index if not exists commune_vote_options_vote_idx on public.commune_vote_options(vote_post_id);
create index if not exists commune_vote_options_order_idx on public.commune_vote_options(vote_post_id, display_order);
create index if not exists commune_vote_ballots_vote_idx on public.commune_vote_ballots(vote_post_id);
create index if not exists commune_vote_ballots_option_idx on public.commune_vote_ballots(vote_post_id, option_id);
create index if not exists commune_vote_ballots_voter_idx on public.commune_vote_ballots(voter_user_id, updated_at desc);
create index if not exists commune_vote_events_vote_time_idx on public.commune_vote_events(vote_post_id, created_at desc);
create index if not exists commune_vote_events_visibility_idx on public.commune_vote_events(event_visibility, created_at desc);

alter table public.commune_vote_posts enable row level security;
alter table public.commune_vote_options enable row level security;
alter table public.commune_vote_ballots enable row level security;
alter table public.commune_vote_events enable row level security;

drop policy if exists "public reads published public vote metadata" on public.commune_vote_posts;
create policy "public reads published public vote metadata"
  on public.commune_vote_posts
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.post_type = 'community_vote'
        and p.status = 'published'
        and p.visibility = 'public'
    )
    or created_by = auth.uid()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

drop policy if exists "admins manage vote metadata" on public.commune_vote_posts;
create policy "admins manage vote metadata"
  on public.commune_vote_posts
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "public reads published vote options" on public.commune_vote_options;
create policy "public reads published vote options"
  on public.commune_vote_options
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_vote_posts v
      join public.commune_posts p on p.id = v.post_id
      where v.post_id = vote_post_id
        and p.post_type = 'community_vote'
        and p.status = 'published'
        and p.visibility = 'public'
    )
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

drop policy if exists "admins manage vote options" on public.commune_vote_options;
create policy "admins manage vote options"
  on public.commune_vote_options
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "users read own vote ballots" on public.commune_vote_ballots;
create policy "users read own vote ballots"
  on public.commune_vote_ballots
  for select to authenticated
  using (
    voter_user_id = auth.uid()
    or public.current_user_is_admin()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

drop policy if exists "users insert own open vote ballots" on public.commune_vote_ballots;
create policy "users insert own open vote ballots"
  on public.commune_vote_ballots
  for insert to authenticated
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
    )
  );

drop policy if exists "users update own open vote ballots" on public.commune_vote_ballots;
create policy "users update own open vote ballots"
  on public.commune_vote_ballots
  for update to authenticated
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
    )
  );

drop policy if exists "admins manage vote ballots" on public.commune_vote_ballots;
create policy "admins manage vote ballots"
  on public.commune_vote_ballots
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "public reads public vote events" on public.commune_vote_events;
create policy "public reads public vote events"
  on public.commune_vote_events
  for select to anon, authenticated
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
      )
    )
    or public.current_user_is_admin()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

drop policy if exists "admins create vote events" on public.commune_vote_events;
create policy "admins create vote events"
  on public.commune_vote_events
  for insert to authenticated
  with check (public.current_user_is_admin() and (actor_user_id is null or actor_user_id = auth.uid()));

drop policy if exists "admins update vote events" on public.commune_vote_events;
create policy "admins update vote events"
  on public.commune_vote_events
  for update to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.commune_vote_result_summary(target_vote_post_ids uuid[] default null)
returns table (
  vote_post_id uuid,
  option_id uuid,
  ballot_count bigint,
  total_ballots bigint,
  percentage numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with visible_options as (
    select
      o.vote_post_id,
      o.id as option_id
    from public.commune_vote_options o
    join public.commune_vote_posts v on v.post_id = o.vote_post_id
    join public.commune_posts p on p.id = v.post_id
    where
      (target_vote_post_ids is null or o.vote_post_id = any(target_vote_post_ids))
      and p.post_type = 'community_vote'
      and p.status = 'published'
      and p.visibility = 'public'
      and (
        public.current_user_is_admin()
        or public.current_user_can_review_domain('commune'::public.review_domain)
        or v.results_visibility = 'always'
        or (
          v.results_visibility = 'after_close'
          and v.vote_status in ('closed','accepted','declined','posted_to_official_update','archived')
        )
        or (
          v.results_visibility = 'after_vote'
          and (
            v.vote_status in ('closed','accepted','declined','posted_to_official_update','archived')
            or exists (
              select 1
              from public.commune_vote_ballots own_ballot
              where own_ballot.vote_post_id = v.post_id
                and own_ballot.voter_user_id = auth.uid()
            )
          )
        )
      )
  ),
  counts as (
    select
      vo.vote_post_id,
      vo.option_id,
      count(b.id)::bigint as ballot_count
    from visible_options vo
    left join public.commune_vote_ballots b
      on b.vote_post_id = vo.vote_post_id
     and b.option_id = vo.option_id
    group by vo.vote_post_id, vo.option_id
  )
  select
    c.vote_post_id,
    c.option_id,
    c.ballot_count,
    sum(c.ballot_count) over (partition by c.vote_post_id)::bigint as total_ballots,
    case
      when sum(c.ballot_count) over (partition by c.vote_post_id) = 0 then 0
      else round((c.ballot_count::numeric / sum(c.ballot_count) over (partition by c.vote_post_id)::numeric) * 100, 2)
    end as percentage
  from counts c
  order by c.vote_post_id, c.option_id;
$$;

-- Keep normal community members from adding comments to vote threads when admins disable comments.
drop policy if exists "users create pending commune comments" on public.commune_comments;
drop policy if exists "users create own commune comments with thread approval" on public.commune_comments;
create policy "users create own commune comments with thread approval"
  on public.commune_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.current_user_can_review_domain('commune'::public.review_domain)
      or (
        not exists (
          select 1
          from public.commune_official_updates ou
          where ou.post_id = commune_comments.post_id
            and ou.comments_enabled = false
        )
        and not exists (
          select 1
          from public.commune_vote_posts vp
          where vp.post_id = commune_comments.post_id
            and vp.allow_comments = false
        )
      )
    )
    and (
      status in ('draft','pending_review')
      or (
        status = 'published'
        and (
          public.current_user_can_review_domain('commune'::public.review_domain)
          or exists (
            select 1
            from public.commune_thread_participant_approvals approval
            where approval.thread_id = commune_comments.thread_id
              and approval.user_id = auth.uid()
              and approval.status = 'approved'
              and approval.revoked_at is null
          )
          or exists (
            select 1
            from public.commune_posts p
            where p.id = commune_comments.post_id
              and p.user_id = auth.uid()
              and p.status = 'published'
              and p.visibility = 'public'
          )
        )
      )
    )
  );

create or replace function public.touch_commune_vote_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_commune_vote_posts_updated_at on public.commune_vote_posts;
create trigger touch_commune_vote_posts_updated_at
before update on public.commune_vote_posts
for each row execute function public.touch_commune_vote_posts_updated_at();

create or replace function public.touch_commune_vote_options_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_commune_vote_options_updated_at on public.commune_vote_options;
create trigger touch_commune_vote_options_updated_at
before update on public.commune_vote_options
for each row execute function public.touch_commune_vote_options_updated_at();

create or replace function public.touch_commune_vote_ballots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_commune_vote_ballots_updated_at on public.commune_vote_ballots;
create trigger touch_commune_vote_ballots_updated_at
before update on public.commune_vote_ballots
for each row execute function public.touch_commune_vote_ballots_updated_at();

revoke all on function public.commune_vote_result_summary(uuid[]) from public;
grant select on table public.commune_vote_posts to anon, authenticated;
grant select on table public.commune_vote_options to anon, authenticated;
grant select on table public.commune_vote_events to anon, authenticated;
grant select, insert, update on table public.commune_vote_posts to authenticated;
grant select, insert, update on table public.commune_vote_options to authenticated;
grant select, insert, update on table public.commune_vote_ballots to authenticated;
grant select, insert, update on table public.commune_vote_events to authenticated;
grant execute on function public.commune_vote_result_summary(uuid[]) to anon, authenticated;

comment on table public.commune_vote_posts is
  'Community Voting Room sidecar metadata. Votes guide stewardship decisions and do not automatically change Elysia behavior, policy, legal/safety posture, Marketplace, Developer Forge, or Official Updates.';
comment on table public.commune_vote_options is
  'Single-choice advisory vote options. Composite constraints keep ballots tied to options from the same vote.';
comment on table public.commune_vote_ballots is
  'Authenticated member ballots. Public result paths must use aggregate counts only and never expose voter_user_id.';
comment on table public.commune_vote_events is
  'Community Voting Room lifecycle/audit events. Public events are safe summaries; staff events are admin/reviewer visible.';
comment on function public.commune_vote_result_summary(uuid[]) is
  'Aggregate-only Community Voting Room result summary. Returns counts and percentages without voter identities.';
