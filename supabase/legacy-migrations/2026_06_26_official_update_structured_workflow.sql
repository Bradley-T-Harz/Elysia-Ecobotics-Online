-- Official Update structured workflow, read-only official code, lifecycle events, and comment locks.
-- Idempotent and additive. Apply manually in Supabase SQL Editor after review.
-- Official Update is admin-only brand-authoritative public communication. Community users cannot
-- submit, self-assign, impersonate, propose edits, run sandbox checks, or open a public workbench.

insert into public.commune_rooms (slug, name, description, room_type)
values (
  'official-updates',
  'Official Update',
  'Official Elysia Ecobotics announcements, releases, roadmap notes, governance updates, security notices, maintenance notices, incidents, policy updates, Developer Forge notices, Marketplace notices, and official community notices.',
  'official_update'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  room_type = excluded.room_type;

create table if not exists public.commune_official_updates (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.commune_posts(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  brand_author_name text not null default 'Elysia Ecobotics Official',
  update_type text not null default 'official_statement',
  official_status text not null default 'published',
  severity text not null default 'info',
  audience text,
  summary text,
  effective_date date,
  release_version text,
  affected_systems text[] not null default '{}'::text[],
  related_room_slug text,
  related_repo_url text,
  related_migration text,
  related_links jsonb not null default '[]'::jsonb,
  known_limitations text,
  migration_required boolean not null default false,
  user_action_required text,
  pinned boolean not null default false,
  important boolean not null default false,
  comments_enabled boolean not null default true,
  correction_note text,
  correction_status text not null default 'none',
  supersedes_update_id uuid references public.commune_official_updates(id) on delete set null,
  superseded_by_update_id uuid references public.commune_official_updates(id) on delete set null,
  published_at timestamptz not null default now(),
  corrected_at timestamptz,
  retracted_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commune_official_updates
  add column if not exists post_id uuid references public.commune_posts(id) on delete cascade,
  add column if not exists admin_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists brand_author_name text not null default 'Elysia Ecobotics Official',
  add column if not exists update_type text not null default 'official_statement',
  add column if not exists official_status text not null default 'published',
  add column if not exists severity text not null default 'info',
  add column if not exists audience text,
  add column if not exists summary text,
  add column if not exists effective_date date,
  add column if not exists release_version text,
  add column if not exists affected_systems text[] not null default '{}'::text[],
  add column if not exists related_room_slug text,
  add column if not exists related_repo_url text,
  add column if not exists related_migration text,
  add column if not exists related_links jsonb not null default '[]'::jsonb,
  add column if not exists known_limitations text,
  add column if not exists migration_required boolean not null default false,
  add column if not exists user_action_required text,
  add column if not exists pinned boolean not null default false,
  add column if not exists important boolean not null default false,
  add column if not exists comments_enabled boolean not null default true,
  add column if not exists correction_note text,
  add column if not exists correction_status text not null default 'none',
  add column if not exists supersedes_update_id uuid references public.commune_official_updates(id) on delete set null,
  add column if not exists superseded_by_update_id uuid references public.commune_official_updates(id) on delete set null,
  add column if not exists published_at timestamptz not null default now(),
  add column if not exists corrected_at timestamptz,
  add column if not exists retracted_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_official_updates_post_unique'
      and conrelid = 'public.commune_official_updates'::regclass
  ) then
    alter table public.commune_official_updates
      add constraint commune_official_updates_post_unique unique (post_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_official_updates_type_check'
      and conrelid = 'public.commune_official_updates'::regclass
  ) then
    alter table public.commune_official_updates
      add constraint commune_official_updates_type_check
      check (update_type in ('release_note','roadmap_update','governance_update','security_notice','maintenance_notice','incident_update','community_notice','developer_notice','marketplace_notice','policy_update','migration_notice','official_statement')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_official_updates_status_check'
      and conrelid = 'public.commune_official_updates'::regclass
  ) then
    alter table public.commune_official_updates
      add constraint commune_official_updates_status_check
      check (official_status in ('draft','published','updated','corrected','retracted','archived','resolved','monitoring')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_official_updates_severity_check'
      and conrelid = 'public.commune_official_updates'::regclass
  ) then
    alter table public.commune_official_updates
      add constraint commune_official_updates_severity_check
      check (severity in ('info','notice','important','urgent','critical')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_official_updates_correction_status_check'
      and conrelid = 'public.commune_official_updates'::regclass
  ) then
    alter table public.commune_official_updates
      add constraint commune_official_updates_correction_status_check
      check (correction_status in ('none','corrected','retracted','superseded')) not valid;
  end if;

  begin
    alter table public.commune_official_updates validate constraint commune_official_updates_type_check;
    alter table public.commune_official_updates validate constraint commune_official_updates_status_check;
    alter table public.commune_official_updates validate constraint commune_official_updates_severity_check;
    alter table public.commune_official_updates validate constraint commune_official_updates_correction_status_check;
  exception when others then
    raise notice 'Official Update constraints left not validated: %', sqlerrm;
  end;
end $$;

create table if not exists public.commune_official_update_code_snippets (
  id uuid primary key default gen_random_uuid(),
  official_update_id uuid not null references public.commune_official_updates(id) on delete cascade,
  post_id uuid not null references public.commune_posts(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  language text not null default 'text',
  file_name text,
  code_text text not null,
  context_note text,
  correction_note text,
  sort_order integer not null default 0,
  public_visible boolean not null default true,
  edited_by uuid references auth.users(id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commune_official_update_code_snippets
  add column if not exists official_update_id uuid references public.commune_official_updates(id) on delete cascade,
  add column if not exists post_id uuid references public.commune_posts(id) on delete cascade,
  add column if not exists admin_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists language text not null default 'text',
  add column if not exists file_name text,
  add column if not exists code_text text,
  add column if not exists context_note text,
  add column if not exists correction_note text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists public_visible boolean not null default true,
  add column if not exists edited_by uuid references auth.users(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.commune_official_update_events (
  id uuid primary key default gen_random_uuid(),
  official_update_id uuid references public.commune_official_updates(id) on delete cascade,
  post_id uuid references public.commune_posts(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  public_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.commune_official_update_events
  add column if not exists official_update_id uuid references public.commune_official_updates(id) on delete cascade,
  add column if not exists post_id uuid references public.commune_posts(id) on delete cascade,
  add column if not exists actor_id uuid references auth.users(id) on delete set null,
  add column if not exists action text,
  add column if not exists reason text,
  add column if not exists public_note text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create index if not exists commune_official_updates_post_idx on public.commune_official_updates(post_id);
create index if not exists commune_official_updates_admin_status_idx on public.commune_official_updates(admin_user_id, official_status, updated_at desc);
create index if not exists commune_official_updates_priority_idx on public.commune_official_updates(pinned desc, important desc, severity, published_at desc);
create index if not exists commune_official_updates_type_status_idx on public.commune_official_updates(update_type, official_status, published_at desc);
create index if not exists commune_official_code_update_idx on public.commune_official_update_code_snippets(official_update_id, sort_order, created_at);
create index if not exists commune_official_code_post_idx on public.commune_official_update_code_snippets(post_id);
create index if not exists commune_official_events_update_idx on public.commune_official_update_events(official_update_id, created_at desc);
create index if not exists commune_official_events_post_idx on public.commune_official_update_events(post_id, created_at desc);

alter table public.commune_official_updates enable row level security;
alter table public.commune_official_update_code_snippets enable row level security;
alter table public.commune_official_update_events enable row level security;

drop policy if exists "public reads published official update metadata" on public.commune_official_updates;
create policy "public reads published official update metadata" on public.commune_official_updates
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.post_type = 'official_update'
        and p.status = 'published'
        and p.visibility = 'public'
    )
    or admin_user_id = auth.uid()
    or public.current_user_is_admin()
  );

drop policy if exists "admins manage official update metadata" on public.commune_official_updates;
create policy "admins manage official update metadata" on public.commune_official_updates
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "public reads visible official update code" on public.commune_official_update_code_snippets;
create policy "public reads visible official update code" on public.commune_official_update_code_snippets
  for select to anon, authenticated
  using (
    public_visible = true
    and exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.post_type = 'official_update'
        and p.status = 'published'
        and p.visibility = 'public'
    )
  );

drop policy if exists "admins manage official update code" on public.commune_official_update_code_snippets;
create policy "admins manage official update code" on public.commune_official_update_code_snippets
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "reviewers read official update events" on public.commune_official_update_events;
create policy "reviewers read official update events" on public.commune_official_update_events
  for select to authenticated
  using (public.current_user_is_admin() or public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "admins create official update events" on public.commune_official_update_events;
create policy "admins create official update events" on public.commune_official_update_events
  for insert to authenticated
  with check (public.current_user_is_admin() and (actor_id is null or actor_id = auth.uid()));

-- Keep normal community members from adding comments to locked Official Updates, even through generic comment APIs.
drop policy if exists "users create pending commune comments" on public.commune_comments;
drop policy if exists "users create own commune comments with thread approval" on public.commune_comments;
create policy "users create own commune comments with thread approval"
  on public.commune_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.current_user_can_review_domain('commune'::public.review_domain)
      or not exists (
        select 1
        from public.commune_official_updates ou
        where ou.post_id = commune_comments.post_id
          and ou.comments_enabled = false
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

grant select on table public.commune_official_updates to anon;
grant select on table public.commune_official_update_code_snippets to anon;
grant select, insert, update on table public.commune_official_updates to authenticated;
grant select, insert, update on table public.commune_official_update_code_snippets to authenticated;
grant select, insert on table public.commune_official_update_events to authenticated;

comment on table public.commune_official_updates is 'Structured Official Update metadata. Admin-only brand-authoritative public notices; community users cannot self-assign official authority.';
comment on column public.commune_official_updates.update_type is 'Official notice category: release, roadmap, governance, security, maintenance, incident, policy, developer, marketplace, community, migration, or official statement.';
comment on column public.commune_official_updates.comments_enabled is 'Controls whether non-reviewer community comments may be added to the official notice thread.';
comment on column public.commune_official_updates.correction_status is 'Correction/retraction/supersession state for audit-aware public notice lifecycle.';
comment on table public.commune_official_update_code_snippets is 'Read-only official code examples attached to Official Updates. No public workbench, sandbox run, proposal flow, install, or execution path.';
comment on table public.commune_official_update_events is 'Admin/reviewer-visible audit events for Official Update lifecycle changes, code edits, comment locks, corrections, retractions, and archives.';
