-- Elysia Iteration Showcase structured metadata and selected-artifact review support.
-- Idempotent and additive. Apply manually in Supabase SQL Editor after review.
-- This room documents public progress/demos/build notes only; it does not certify official release,
-- Developer Forge approval, Marketplace readiness, security, installability, compatibility, or trust.

insert into public.commune_rooms (slug, name, description, room_type)
values (
  'elysia-iteration-showcase',
  'Elysia Iteration Showcase',
  'Demos, screenshots, version notes, UI updates, add-on previews, and design progress.',
  'iteration_showcase'
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  room_type = excluded.room_type;

create table if not exists public.commune_iteration_showcases (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.commune_posts(id) on delete set null,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  iteration_type text,
  version_build_label text,
  what_changed text,
  why_it_matters text,
  known_limitations text,
  next_step text,
  related_repo_url text,
  provider text,
  branch text,
  commit_sha text,
  release_tag text,
  pull_request_url text,
  developer_forge_link text,
  marketplace_link text,
  testing_status text not null default 'not_tested',
  compatibility_note text,
  sandbox_review_requested boolean not null default false,
  sandbox_review_status text not null default 'not_requested',
  sandbox_review_request_id uuid references public.commune_sandbox_review_requests(id) on delete set null,
  risk_flags text[] not null default '{}'::text[],
  import_source text not null default 'manual',
  imported_metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz,
  redaction_notes text,
  status public.review_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commune_iteration_showcases
  add column if not exists post_id uuid references public.commune_posts(id) on delete set null,
  add column if not exists author_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists iteration_type text,
  add column if not exists version_build_label text,
  add column if not exists what_changed text,
  add column if not exists why_it_matters text,
  add column if not exists known_limitations text,
  add column if not exists next_step text,
  add column if not exists related_repo_url text,
  add column if not exists provider text,
  add column if not exists branch text,
  add column if not exists commit_sha text,
  add column if not exists release_tag text,
  add column if not exists pull_request_url text,
  add column if not exists developer_forge_link text,
  add column if not exists marketplace_link text,
  add column if not exists testing_status text not null default 'not_tested',
  add column if not exists compatibility_note text,
  add column if not exists sandbox_review_requested boolean not null default false,
  add column if not exists sandbox_review_status text not null default 'not_requested',
  add column if not exists sandbox_review_request_id uuid references public.commune_sandbox_review_requests(id) on delete set null,
  add column if not exists risk_flags text[] not null default '{}'::text[],
  add column if not exists import_source text not null default 'manual',
  add column if not exists imported_metadata jsonb not null default '{}'::jsonb,
  add column if not exists imported_at timestamptz,
  add column if not exists redaction_notes text,
  add column if not exists status public.review_status not null default 'pending_review',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.commune_iteration_showcases
set
  sandbox_review_status = case
    when sandbox_review_status is not null and sandbox_review_status <> 'not_requested' then sandbox_review_status
    when sandbox_review_requested then 'requested'
    else 'not_requested'
  end,
  import_source = coalesce(import_source, 'manual'),
  imported_metadata = coalesce(imported_metadata, '{}'::jsonb),
  risk_flags = coalesce(risk_flags, '{}'::text[]),
  testing_status = coalesce(testing_status, 'not_tested'),
  updated_at = coalesce(updated_at, now())
where true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_iteration_showcases_sandbox_review_status_check'
      and conrelid = 'public.commune_iteration_showcases'::regclass
  ) then
    alter table public.commune_iteration_showcases
      add constraint commune_iteration_showcases_sandbox_review_status_check
      check (sandbox_review_status in ('not_requested','requested','queued','in_review','completed','failed','declined','needs_information','archived')) not valid;
  end if;

  begin
    alter table public.commune_iteration_showcases validate constraint commune_iteration_showcases_sandbox_review_status_check;
  exception when others then
    raise notice 'Elysia Iteration Showcase sandbox review status constraint left not validated: %', sqlerrm;
  end;
end $$;

create index if not exists commune_iteration_showcases_post_idx on public.commune_iteration_showcases(post_id);
create index if not exists commune_iteration_showcases_owner_status_idx on public.commune_iteration_showcases(author_user_id, status, updated_at desc);
create index if not exists commune_iteration_showcases_sandbox_review_idx on public.commune_iteration_showcases(sandbox_review_requested, sandbox_review_status, updated_at desc);
create index if not exists commune_iteration_showcases_sandbox_request_idx on public.commune_iteration_showcases(sandbox_review_request_id);
create index if not exists commune_iteration_showcases_related_repo_idx on public.commune_iteration_showcases(related_repo_url);

alter table public.commune_iteration_showcases enable row level security;

drop policy if exists "public reads published iteration showcase metadata" on public.commune_iteration_showcases;
create policy "public reads published iteration showcase metadata" on public.commune_iteration_showcases
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.post_type = 'elysia_iteration_showcase'
        and p.status = 'published'
        and p.visibility = 'public'
    )
    or author_user_id = auth.uid()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

drop policy if exists "users create own iteration showcase metadata" on public.commune_iteration_showcases;
create policy "users create own iteration showcase metadata" on public.commune_iteration_showcases
  for insert to authenticated
  with check (author_user_id = auth.uid() and status in ('draft','pending_review','approved'));

drop policy if exists "owners update own unpublished iteration showcase metadata" on public.commune_iteration_showcases;
create policy "owners update own unpublished iteration showcase metadata" on public.commune_iteration_showcases
  for update to authenticated
  using (author_user_id = auth.uid() and status in ('draft','pending_review','needs_information'))
  with check (author_user_id = auth.uid() and status in ('draft','pending_review','needs_information'));

drop policy if exists "moderators manage iteration showcase metadata" on public.commune_iteration_showcases;
create policy "moderators manage iteration showcase metadata" on public.commune_iteration_showcases
  for all to authenticated
  using (public.current_user_can_review_domain('commune'::public.review_domain))
  with check (public.current_user_can_review_domain('commune'::public.review_domain));

grant select on table public.commune_iteration_showcases to anon;
grant select, insert, update on table public.commune_iteration_showcases to authenticated;

comment on table public.commune_iteration_showcases is 'Elysia Iteration Showcase metadata. Public demos/progress/build notes only; not official release, trust, security, compatibility, Developer Forge, or Marketplace approval.';
comment on column public.commune_iteration_showcases.related_repo_url is 'Optional public related source URL. Metadata only; the website does not clone, build, install, or run repositories from this room.';
comment on column public.commune_iteration_showcases.sandbox_review_status is 'Selected-artifact sandbox review status only. This is evidence, not full-repository review, security approval, Marketplace readiness, or compatibility certification.';
comment on column public.commune_iteration_showcases.imported_metadata is 'Public GitHub/import manifest metadata after user review; must not include secrets, private repo data, local paths, prompts, logs, or sealed memory.';
