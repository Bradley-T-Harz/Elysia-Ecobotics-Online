-- Job Post structured public opportunity workflow.
-- Idempotent and additive. Apply manually in Supabase SQL Editor after review.
-- Job Post is a public, admin-approved opportunity board. Work With Elysia
-- Ecobotics remains the private application/intake path for resumes, CVs, and
-- private contact materials.

insert into public.commune_rooms (slug, name, description, room_type)
values (
  'job-post',
  'Job Post',
  'Public EcoSyneva, Elysia, and community opportunity listings, volunteer calls, paid roles, research roles, contributor needs, and project recruitment. Normal-user Job Posts require admin approval before publication.',
  'job_post'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  room_type = excluded.room_type;

create table if not exists public.commune_job_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.commune_posts(id) on delete cascade,
  thread_id uuid references public.commune_threads(id) on delete set null,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  role_title text,
  organization_project text,
  role_type text not null default 'other',
  paid_volunteer_status text not null default 'must_clarify',
  location_mode text not null default 'unspecified',
  location_text text,
  time_commitment text,
  deadline text,
  compensation_clarity text,
  contact_path text,
  requirements_skills text,
  safety_notes text,
  role_summary text,
  application_status text not null default 'open',
  anti_scam_review_status text not null default 'not_reviewed',
  work_with_link_enabled boolean not null default true,
  private_application_note text,
  public_correction_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  filled_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commune_job_posts
  add column if not exists post_id uuid references public.commune_posts(id) on delete cascade,
  add column if not exists thread_id uuid references public.commune_threads(id) on delete set null,
  add column if not exists author_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists role_title text,
  add column if not exists organization_project text,
  add column if not exists role_type text not null default 'other',
  add column if not exists paid_volunteer_status text not null default 'must_clarify',
  add column if not exists location_mode text not null default 'unspecified',
  add column if not exists location_text text,
  add column if not exists time_commitment text,
  add column if not exists deadline text,
  add column if not exists compensation_clarity text,
  add column if not exists contact_path text,
  add column if not exists requirements_skills text,
  add column if not exists safety_notes text,
  add column if not exists role_summary text,
  add column if not exists application_status text not null default 'open',
  add column if not exists anti_scam_review_status text not null default 'not_reviewed',
  add column if not exists work_with_link_enabled boolean not null default true,
  add column if not exists private_application_note text,
  add column if not exists public_correction_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists filled_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_job_posts_post_unique'
      and conrelid = 'public.commune_job_posts'::regclass
  ) then
    alter table public.commune_job_posts
      add constraint commune_job_posts_post_unique unique (post_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_job_posts_role_type_check'
      and conrelid = 'public.commune_job_posts'::regclass
  ) then
    alter table public.commune_job_posts
      add constraint commune_job_posts_role_type_check
      check (role_type in ('paid_role','volunteer_call','stipend_role','contract','internship','research_role','collaboration_role','contributor_call','reviewer_moderator_need','other')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_job_posts_paid_volunteer_status_check'
      and conrelid = 'public.commune_job_posts'::regclass
  ) then
    alter table public.commune_job_posts
      add constraint commune_job_posts_paid_volunteer_status_check
      check (paid_volunteer_status in ('paid','volunteer','stipend','unpaid','mixed','must_clarify')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_job_posts_location_mode_check'
      and conrelid = 'public.commune_job_posts'::regclass
  ) then
    alter table public.commune_job_posts
      add constraint commune_job_posts_location_mode_check
      check (location_mode in ('remote','hybrid','local','field_based','unspecified')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_job_posts_application_status_check'
      and conrelid = 'public.commune_job_posts'::regclass
  ) then
    alter table public.commune_job_posts
      add constraint commune_job_posts_application_status_check
      check (application_status in ('open','reviewing','filled','closed','archived','needs_clarification')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_job_posts_anti_scam_review_status_check'
      and conrelid = 'public.commune_job_posts'::regclass
  ) then
    alter table public.commune_job_posts
      add constraint commune_job_posts_anti_scam_review_status_check
      check (anti_scam_review_status in ('not_reviewed','reviewed_clear','needs_pay_clarification','needs_contact_clarification','needs_location_clarification','suspicious','removed')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_job_posts_public_text_length_check'
      and conrelid = 'public.commune_job_posts'::regclass
  ) then
    alter table public.commune_job_posts
      add constraint commune_job_posts_public_text_length_check
      check (
        char_length(coalesce(role_title, '')) <= 500
        and char_length(coalesce(organization_project, '')) <= 500
        and char_length(coalesce(location_text, '')) <= 1000
        and char_length(coalesce(time_commitment, '')) <= 1000
        and char_length(coalesce(deadline, '')) <= 250
        and char_length(coalesce(compensation_clarity, '')) <= 4000
        and char_length(coalesce(contact_path, '')) <= 2000
        and char_length(coalesce(requirements_skills, '')) <= 8000
        and char_length(coalesce(safety_notes, '')) <= 4000
        and char_length(coalesce(role_summary, '')) <= 12000
        and char_length(coalesce(private_application_note, '')) <= 2000
        and char_length(coalesce(public_correction_note, '')) <= 4000
      ) not valid;
  end if;

  begin
    alter table public.commune_job_posts validate constraint commune_job_posts_role_type_check;
    alter table public.commune_job_posts validate constraint commune_job_posts_paid_volunteer_status_check;
    alter table public.commune_job_posts validate constraint commune_job_posts_location_mode_check;
    alter table public.commune_job_posts validate constraint commune_job_posts_application_status_check;
    alter table public.commune_job_posts validate constraint commune_job_posts_anti_scam_review_status_check;
    alter table public.commune_job_posts validate constraint commune_job_posts_public_text_length_check;
  exception when others then
    raise notice 'Job Post constraints left not validated: %', sqlerrm;
  end;
end $$;

create index if not exists commune_job_posts_post_idx on public.commune_job_posts(post_id);
create index if not exists commune_job_posts_author_status_idx on public.commune_job_posts(author_user_id, application_status, updated_at desc);
create index if not exists commune_job_posts_review_idx on public.commune_job_posts(anti_scam_review_status, updated_at desc);
create index if not exists commune_job_posts_role_idx on public.commune_job_posts(role_type, paid_volunteer_status, location_mode);
create index if not exists commune_job_posts_deadline_idx on public.commune_job_posts(deadline);

alter table public.commune_job_posts enable row level security;

drop policy if exists "public reads published job post metadata" on public.commune_job_posts;
create policy "public reads published job post metadata"
  on public.commune_job_posts
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.post_type = 'job_post'
        and p.status = 'published'
        and p.visibility = 'public'
    )
    or author_user_id = auth.uid()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

drop policy if exists "signed users create own job post metadata" on public.commune_job_posts;
create policy "signed users create own job post metadata"
  on public.commune_job_posts
  for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.user_id = auth.uid()
        and p.post_type = 'job_post'
        and p.status in ('pending_review','published')
        and (p.status <> 'published' or public.current_user_is_admin())
    )
  );

drop policy if exists "reviewers manage job post metadata" on public.commune_job_posts;
create policy "reviewers manage job post metadata"
  on public.commune_job_posts
  for all
  to authenticated
  using (public.current_user_can_review_domain('commune'::public.review_domain))
  with check (public.current_user_can_review_domain('commune'::public.review_domain));

create or replace function public.update_own_commune_job_post_application_status(
  p_job_post_id uuid default null,
  p_post_id uuid default null,
  p_application_status text default 'open',
  p_public_correction_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row record;
  v_status text := lower(regexp_replace(coalesce(p_application_status, 'open'), '[\s/-]+', '_', 'g'));
  v_now timestamptz := now();
begin
  if v_actor is null then
    raise exception 'Authentication required to update a Job Post listing status.';
  end if;

  if v_status not in ('open','reviewing','filled','closed','archived','needs_clarification') then
    raise exception 'Unsupported Job Post listing status: %', p_application_status;
  end if;

  select *
  into v_row
  from public.commune_job_posts
  where (p_job_post_id is not null and id = p_job_post_id)
     or (p_job_post_id is null and p_post_id is not null and post_id = p_post_id)
  limit 1;

  if not found or v_row.author_user_id <> v_actor then
    raise exception 'Only the Job Post author can update this listing status.';
  end if;

  update public.commune_job_posts
  set
    application_status = v_status,
    public_correction_note = p_public_correction_note,
    filled_at = case when v_status = 'filled' then v_now else filled_at end,
    closed_at = case when v_status = 'closed' then v_now else closed_at end,
    archived_at = case when v_status = 'archived' then v_now else archived_at end,
    updated_at = v_now
  where id = v_row.id;
end;
$$;

revoke all on function public.update_own_commune_job_post_application_status(uuid, uuid, text, text) from public;
grant execute on function public.update_own_commune_job_post_application_status(uuid, uuid, text, text) to authenticated;

create or replace function public.touch_commune_job_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_commune_job_posts_updated_at on public.commune_job_posts;
create trigger touch_commune_job_posts_updated_at
before update on public.commune_job_posts
for each row execute function public.touch_commune_job_posts_updated_at();

comment on table public.commune_job_posts is
  'Structured Job Post metadata for public opportunity listings. Normal-user rows remain pending until admin approval through the linked commune_posts row.';
comment on column public.commune_job_posts.anti_scam_review_status is
  'Reviewer/admin anti-scam state. Public users must not self-assign reviewed_clear or trust/safety claims.';
comment on column public.commune_job_posts.work_with_link_enabled is
  'Public bridge flag to Work With Elysia Ecobotics. Work With remains private intake; Job Post remains public listing discussion.';
comment on function public.update_own_commune_job_post_application_status(uuid, uuid, text, text) is
  'Author-only status RPC for Job Post lifecycle fields. It does not update anti-scam review state or hidden reviewer notes.';
grant select on public.commune_job_posts to anon, authenticated;
grant insert, update on public.commune_job_posts to authenticated;
