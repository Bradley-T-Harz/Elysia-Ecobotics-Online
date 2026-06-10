-- Private Work With request attachments for administrator review.
-- This uses authenticated user-owned rows and a private Storage bucket.
-- Browser clients must use the anon key plus RLS; never a service-role key.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-with-attachments',
  'work-with-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.work_with_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  preferred_contact text,
  commons_username text,
  request_type text,
  availability text,
  areas_of_interest text[] not null default '{}'::text[],
  message text,
  skills_experience text,
  github_url text,
  gitlab_codeberg_url text,
  portfolio_url text,
  linkedin_url text,
  acknowledgements jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('pending_review','needs_redaction','approved','rejected','archived','withdrawn'))
);

create table if not exists public.work_with_request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.work_with_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null default 'work-with-attachments',
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  size_bytes bigint,
  file_role text not null default 'resume_cv',
  created_at timestamptz not null default now(),
  unique(bucket, storage_path),
  check (bucket = 'work-with-attachments'),
  check (file_role in ('resume_cv')),
  check (size_bytes is null or size_bytes <= 10485760)
);

alter table public.work_with_requests enable row level security;
alter table public.work_with_request_files enable row level security;

create or replace function public.can_review_work_with_requests()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "users insert own work with requests" on public.work_with_requests;
drop policy if exists "users read own work with requests" on public.work_with_requests;
drop policy if exists "admins read all work with requests" on public.work_with_requests;
drop policy if exists "admins update work with requests" on public.work_with_requests;

create policy "users insert own work with requests" on public.work_with_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users read own work with requests" on public.work_with_requests
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "admins read all work with requests" on public.work_with_requests
  for select
  to authenticated
  using (public.can_review_work_with_requests());

create policy "admins update work with requests" on public.work_with_requests
  for update
  to authenticated
  using (public.can_review_work_with_requests())
  with check (public.can_review_work_with_requests());

drop policy if exists "users insert own work with request files" on public.work_with_request_files;
drop policy if exists "users read own work with request files" on public.work_with_request_files;
drop policy if exists "admins read all work with request files" on public.work_with_request_files;

create policy "users insert own work with request files" on public.work_with_request_files
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and bucket = 'work-with-attachments'
    and exists (
      select 1 from public.work_with_requests
      where id = request_id and user_id = auth.uid()
    )
  );

create policy "users read own work with request files" on public.work_with_request_files
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "admins read all work with request files" on public.work_with_request_files
  for select
  to authenticated
  using (public.can_review_work_with_requests());

drop policy if exists "users upload own work with attachments" on storage.objects;
drop policy if exists "users read own work with attachments" on storage.objects;
drop policy if exists "admins read all work with attachments" on storage.objects;

create policy "users upload own work with attachments" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'work-with-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users read own work with attachments" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'work-with-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admins read all work with attachments" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'work-with-attachments'
    and public.can_review_work_with_requests()
  );

grant select, insert on table public.work_with_requests to authenticated;
grant update (status, updated_at) on table public.work_with_requests to authenticated;
grant select, insert on table public.work_with_request_files to authenticated;
