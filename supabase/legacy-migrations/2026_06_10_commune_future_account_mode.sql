-- Elysia Commune future account mode: moderated public community, comments, rooms, repository showcases, sandbox requests, uploads, abuse reports, and audit.
-- The website stores metadata/review queues only. It does not execute community code or expose private local Elysia data.

create extension if not exists pgcrypto;

do $$ begin
  create type public.commune_post_status as enum ('draft','pending_review','in_review','needs_information','approved','published','rejected','hidden','archived','deleted_by_user','removed_by_moderator');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.commune_post_type as enum ('media_garden','troubleshooting','code_sharing','repository_showcase','community_network','job_post','official_update','research_note','elysia_iteration_showcase');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.commune_visibility as enum ('public','unlisted','private_draft');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.abuse_report_status as enum ('pending_review','in_review','resolved_no_action','action_taken','dismissed','escalated');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.sandbox_review_status as enum ('requested','in_review','approved_for_local_sandbox','rejected','needs_information','archived');
exception when duplicate_object then null; end $$;

create table if not exists public.commune_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  room_type text not null default 'general',
  is_public boolean not null default true,
  requires_moderation boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commune_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_username text,
  post_type public.commune_post_type not null,
  title text not null,
  body text not null,
  excerpt text,
  tags text[] default '{}',
  links text[] default '{}',
  repository_url text,
  visibility public.commune_visibility not null default 'public',
  status public.commune_post_status not null default 'draft',
  moderation_status text default 'not_submitted',
  safety_acknowledgements jsonb default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  hidden_at timestamptz,
  hidden_by uuid references auth.users(id),
  moderation_reason text
);

alter table public.commune_post_requests
  add column if not exists post_id uuid references public.commune_posts(id) on delete set null,
  add column if not exists repository_url text,
  add column if not exists code_included boolean default false,
  add column if not exists upload_included boolean default false,
  add column if not exists sandbox_review_requested boolean default false;

create table if not exists public.commune_threads (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.commune_posts(id) on delete cascade,
  room_id uuid references public.commune_rooms(id) on delete set null,
  title text not null,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'open',
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_reply_at timestamptz,
  locked_at timestamptz,
  locked_by uuid references auth.users(id),
  lock_reason text
);

create table if not exists public.commune_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.commune_threads(id) on delete cascade,
  post_id uuid references public.commune_posts(id) on delete cascade,
  parent_comment_id uuid references public.commune_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_username text,
  body text not null,
  status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  hidden_at timestamptz,
  hidden_by uuid references auth.users(id),
  moderation_reason text,
  check (status in ('draft','pending_review','published','hidden','removed_by_moderator','deleted_by_user','archived'))
);

create table if not exists public.commune_repository_showcases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.commune_posts(id) on delete set null,
  repository_url text not null,
  repository_host text,
  project_name text,
  project_summary text,
  license text,
  language_tags text[] default '{}',
  safety_notes text,
  run_instructions text,
  sandbox_review_requested boolean not null default false,
  status public.review_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commune_sandbox_review_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.commune_posts(id) on delete set null,
  repository_showcase_id uuid references public.commune_repository_showcases(id) on delete set null,
  request_title text not null,
  repository_url text,
  package_url text,
  requested_review_scope text,
  risk_notes text,
  declared_permissions text[] default '{}',
  status public.sandbox_review_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commune_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.commune_posts(id) on delete cascade,
  comment_id uuid references public.commune_comments(id) on delete cascade,
  repository_showcase_id uuid references public.commune_repository_showcases(id) on delete cascade,
  bucket text not null default 'commune-uploads',
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  size_bytes bigint,
  upload_role text not null default 'attachment',
  status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  hidden_at timestamptz,
  hidden_by uuid references auth.users(id),
  moderation_reason text,
  check (bucket = 'commune-uploads'),
  check (status in ('pending_review','approved','published','hidden','removed_by_moderator','deleted_by_user','archived'))
);

create table if not exists public.commune_abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  post_id uuid references public.commune_posts(id) on delete cascade,
  comment_id uuid references public.commune_comments(id) on delete cascade,
  upload_id uuid references public.commune_uploads(id) on delete cascade,
  public_profile_username text,
  report_type text not null,
  report_reason text not null,
  status public.abuse_report_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  resolution_note text
);

create table if not exists public.commune_moderation_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  target_type text not null,
  target_id uuid,
  action text not null,
  from_status text,
  to_status text,
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_saved_commune_posts
  add column if not exists post_id uuid references public.commune_posts(id) on delete cascade;
alter table public.user_followed_commune_threads
  drop constraint if exists user_followed_commune_threads_thread_id_fkey;
alter table public.user_followed_commune_threads
  add constraint user_followed_commune_threads_thread_id_fkey foreign key (thread_id) references public.commune_threads(id) on delete cascade;
create unique index if not exists user_saved_commune_posts_user_post_unique on public.user_saved_commune_posts(user_id, post_id) where post_id is not null;

create or replace function public.notify_commune_published_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.user_notifications (user_id, notification_type, source_type, source_id, title, body, action_url)
    select distinct target_user_id, 'commune_thread_reply', 'commune_comment', new.id, 'New published Commune reply', 'A followed Commune thread has a newly published reply.', '/commune/posts/' || coalesce(new.post_id::text, '')
    from (
      select user_id as target_user_id from public.user_followed_commune_threads where thread_id = new.thread_id and user_id <> new.user_id and muted = false
      union
      select p.user_id as target_user_id from public.commune_posts p where p.id = new.post_id and p.user_id <> new.user_id
    ) targets
    where target_user_id is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists commune_notify_published_comment on public.commune_comments;
create trigger commune_notify_published_comment
after insert or update of status on public.commune_comments
for each row execute function public.notify_commune_published_comment();

insert into public.commune_rooms (slug, name, description, room_type) values
  ('general-commune','General Commune','General public community gathering space.','general'),
  ('troubleshooting-grove','Troubleshooting Grove','Moderated troubleshooting, bug reports, and safe help threads.','troubleshooting'),
  ('code-sharing','Code Sharing','Code and snippet discussion without website execution.','code'),
  ('repository-showcase','Repository Showcase','Repository metadata and showcase review requests.','repository'),
  ('living-library-help','Living Library Help','Source, citation, and research commons support.','living_library'),
  ('marketplace-addons-help','Marketplace/Add-ons Help','Marketplace and add-on review/support discussion.','marketplace'),
  ('elysia-installation-help','Elysia Installation Help','Release, archive, and installation help when public releases exist.','installation')
on conflict (slug) do update set name = excluded.name, description = excluded.description, room_type = excluded.room_type;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('commune-uploads','commune-uploads', false, 10485760, array['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/markdown','text/csv','application/json'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.commune_rooms enable row level security;
alter table public.commune_posts enable row level security;
alter table public.commune_post_requests enable row level security;
alter table public.commune_threads enable row level security;
alter table public.commune_comments enable row level security;
alter table public.commune_repository_showcases enable row level security;
alter table public.commune_sandbox_review_requests enable row level security;
alter table public.commune_uploads enable row level security;
alter table public.commune_abuse_reports enable row level security;
alter table public.commune_moderation_events enable row level security;
alter table public.user_saved_commune_posts enable row level security;
alter table public.user_followed_commune_threads enable row level security;

drop policy if exists "commune reviewers create review notifications" on public.user_notifications;
create policy "commune reviewers create review notifications" on public.user_notifications for insert to authenticated with check (
  notification_type like 'commune_%' and public.current_user_can_review_domain('commune'::public.review_domain)
);

-- Public read: only published public content.
drop policy if exists "public reads public commune rooms" on public.commune_rooms;
create policy "public reads public commune rooms" on public.commune_rooms for select using (is_public = true or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "public reads published commune posts" on public.commune_posts;
create policy "public reads published commune posts" on public.commune_posts for select using ((status = 'published' and visibility = 'public') or user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "users create own commune drafts" on public.commune_posts;
create policy "users create own commune drafts" on public.commune_posts for insert to authenticated with check (user_id = auth.uid() and status in ('draft','pending_review') and post_type <> 'official_update');
drop policy if exists "users update own unpublished commune posts" on public.commune_posts;
create policy "users update own unpublished commune posts" on public.commune_posts for update to authenticated using (user_id = auth.uid() and status in ('draft','pending_review','needs_information')) with check (user_id = auth.uid() and status in ('draft','pending_review','needs_information'));
drop policy if exists "moderators manage commune posts" on public.commune_posts;
create policy "moderators manage commune posts" on public.commune_posts for update to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "public reads public commune threads" on public.commune_threads;
create policy "public reads public commune threads" on public.commune_threads for select using (
  visibility = 'public' and (post_id is null or exists (select 1 from public.commune_posts p where p.id = post_id and p.status = 'published' and p.visibility = 'public'))
  or created_by = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain)
);
drop policy if exists "users create own commune threads" on public.commune_threads;
create policy "users create own commune threads" on public.commune_threads for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "moderators manage commune threads" on public.commune_threads;
create policy "moderators manage commune threads" on public.commune_threads for update to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "public reads published commune comments" on public.commune_comments;
create policy "public reads published commune comments" on public.commune_comments for select using (
  status = 'published' and exists (select 1 from public.commune_threads t left join public.commune_posts p on p.id = t.post_id where t.id = thread_id and t.visibility = 'public' and (p.id is null or (p.status = 'published' and p.visibility = 'public')))
  or user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain)
);
drop policy if exists "users create pending commune comments" on public.commune_comments;
create policy "users create pending commune comments" on public.commune_comments for insert to authenticated with check (user_id = auth.uid() and status in ('draft','pending_review'));
drop policy if exists "users update own unpublished commune comments" on public.commune_comments;
create policy "users update own unpublished commune comments" on public.commune_comments for update to authenticated using (user_id = auth.uid() and status in ('draft','pending_review')) with check (user_id = auth.uid() and status in ('draft','pending_review','deleted_by_user'));
drop policy if exists "moderators manage commune comments" on public.commune_comments;
create policy "moderators manage commune comments" on public.commune_comments for update to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

-- Requests/repo/sandbox/upload/report queues.
drop policy if exists "users insert own commune post requests" on public.commune_post_requests;
create policy "users insert own commune post requests" on public.commune_post_requests for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users read own commune post requests" on public.commune_post_requests;
create policy "users read own commune post requests" on public.commune_post_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists "moderators read commune post requests" on public.commune_post_requests;
create policy "moderators read commune post requests" on public.commune_post_requests for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "moderators update commune post requests" on public.commune_post_requests;
create policy "moderators update commune post requests" on public.commune_post_requests for update to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users manage own repo showcases" on public.commune_repository_showcases;
create policy "users manage own repo showcases" on public.commune_repository_showcases for all to authenticated using (user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain)) with check (user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "users manage own sandbox review requests" on public.commune_sandbox_review_requests;
create policy "users manage own sandbox review requests" on public.commune_sandbox_review_requests for all to authenticated using (user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain)) with check (user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users read own commune uploads" on public.commune_uploads;
create policy "users read own commune uploads" on public.commune_uploads for select to authenticated using (user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "users insert own commune uploads" on public.commune_uploads;
create policy "users insert own commune uploads" on public.commune_uploads for insert to authenticated with check (user_id = auth.uid() and bucket = 'commune-uploads');
drop policy if exists "moderators update commune uploads" on public.commune_uploads;
create policy "moderators update commune uploads" on public.commune_uploads for update to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users create commune abuse reports" on public.commune_abuse_reports;
create policy "users create commune abuse reports" on public.commune_abuse_reports for insert to authenticated with check (reporter_user_id = auth.uid() or reporter_user_id is null);
drop policy if exists "users read own commune abuse reports" on public.commune_abuse_reports;
create policy "users read own commune abuse reports" on public.commune_abuse_reports for select to authenticated using (reporter_user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "moderators update commune abuse reports" on public.commune_abuse_reports;
create policy "moderators update commune abuse reports" on public.commune_abuse_reports for update to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "moderators read commune moderation events" on public.commune_moderation_events;
create policy "moderators read commune moderation events" on public.commune_moderation_events for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "moderators create commune moderation events" on public.commune_moderation_events;
create policy "moderators create commune moderation events" on public.commune_moderation_events for insert to authenticated with check (actor_id = auth.uid() and public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users manage own saved commune posts" on public.user_saved_commune_posts;
create policy "users manage own saved commune posts" on public.user_saved_commune_posts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own followed commune threads" on public.user_followed_commune_threads;
create policy "users manage own followed commune threads" on public.user_followed_commune_threads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private upload bucket: no public URLs for pending/private uploads.
drop policy if exists "users upload own commune files" on storage.objects;
create policy "users upload own commune files" on storage.objects for insert to authenticated with check (bucket_id = 'commune-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users read own commune files" on storage.objects;
create policy "users read own commune files" on storage.objects for select to authenticated using (bucket_id = 'commune-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "moderators read commune files" on storage.objects;
create policy "moderators read commune files" on storage.objects for select to authenticated using (bucket_id = 'commune-uploads' and public.current_user_can_review_domain('commune'::public.review_domain));

grant select on table public.commune_rooms to anon, authenticated;
grant select, insert, update on table public.commune_posts to authenticated;
grant select on table public.commune_posts to anon;
grant select, insert, update on table public.commune_post_requests to authenticated;
grant select, insert, update on table public.commune_threads to authenticated;
grant select on table public.commune_threads to anon;
grant select, insert, update on table public.commune_comments to authenticated;
grant select on table public.commune_comments to anon;
grant select, insert, update on table public.commune_repository_showcases to authenticated;
grant select, insert, update on table public.commune_sandbox_review_requests to authenticated;
grant select, insert, update on table public.commune_uploads to authenticated;
grant select, insert, update on table public.commune_abuse_reports to authenticated;
grant select, insert on table public.commune_moderation_events to authenticated;
grant select, insert, update, delete on table public.user_saved_commune_posts to authenticated;
grant select, insert, update, delete on table public.user_followed_commune_threads to authenticated;
