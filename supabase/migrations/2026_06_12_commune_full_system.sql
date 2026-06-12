-- Elysia Commune full-system completion foundation.
-- Extends existing Commune account mode without replacing current tables.

create table if not exists public.commune_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.commune_categories (slug, title, description, sort_order) values
  ('general', 'General', 'Public community discussion and updates.', 10),
  ('troubleshooting', 'Troubleshooting', 'Redacted help requests and solved notes.', 20),
  ('repositories', 'Repositories', 'Repository showcases and metadata-only project notes.', 30),
  ('living-library', 'Living Library', 'Source, citation, and public knowledge discussions.', 40),
  ('developer-forge', 'Developer Forge', 'Add-on development questions and review preparation.', 50),
  ('marketplace-addons', 'Marketplace Add-ons', 'Add-on ideas, trust labels, and local-install boundaries.', 60),
  ('field-notes', 'Field Notes', 'Ecological observations safe for public sharing.', 70),
  ('announcements', 'Announcements', 'Official or reviewed public updates.', 80),
  ('questions', 'Questions', 'General questions for the public commons.', 90),
  ('safety-and-boundaries', 'Safety and Boundaries', 'Privacy, moderation, and consent discussions.', 100)
on conflict (slug) do update set title = excluded.title, description = excluded.description, sort_order = excluded.sort_order, updated_at = now();

alter table public.commune_posts add column if not exists category_id uuid references public.commune_categories(id) on delete set null;
alter table public.commune_posts add column if not exists slug text;
alter table public.commune_posts add column if not exists summary text;
alter table public.commune_posts add column if not exists body_format text default 'markdown';
alter table public.commune_posts add column if not exists visibility_state text default 'draft';
alter table public.commune_posts add column if not exists repo_showcase_id uuid;
alter table public.commune_posts add column if not exists media_policy_acknowledged boolean default false;
alter table public.commune_posts add column if not exists secret_warning_acknowledged boolean default false;
alter table public.commune_posts add column if not exists sandbox_warning_acknowledged boolean default false;
alter table public.commune_posts add column if not exists allow_comments boolean default true;
alter table public.commune_posts add column if not exists comment_count integer default 0;
alter table public.commune_posts add column if not exists saved_count integer default 0;
alter table public.commune_posts add column if not exists report_count integer default 0;
alter table public.commune_posts add column if not exists flagged_at timestamptz;
alter table public.commune_posts add column if not exists removed_at timestamptz;
alter table public.commune_posts add column if not exists archived_at timestamptz;
alter table public.commune_posts add column if not exists revoked_at timestamptz;
create index if not exists commune_posts_category_status_idx on public.commune_posts(category_id, status, published_at desc);
create index if not exists commune_posts_visibility_state_idx on public.commune_posts(visibility_state, updated_at desc);

alter table public.commune_comments add column if not exists body_format text default 'markdown';
alter table public.commune_comments add column if not exists visibility_state text default 'published';
alter table public.commune_comments add column if not exists report_count integer default 0;
alter table public.commune_comments add column if not exists removed_at timestamptz;
alter table public.commune_comments add column if not exists archived_at timestamptz;
create index if not exists commune_comments_visibility_post_idx on public.commune_comments(post_id, visibility_state, created_at);

create table if not exists public.commune_saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.commune_posts(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

create table if not exists public.commune_repo_showcases (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  repo_url text not null,
  source_host text,
  summary text,
  license text,
  primary_language text,
  tags text[] default '{}',
  safety_notes text,
  install_or_run_warning text,
  visibility_state text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz,
  hidden_at timestamptz,
  removed_at timestamptz,
  archived_at timestamptz,
  constraint commune_repo_showcases_visibility_check check (visibility_state in ('draft','submitted','published','flagged','hidden','removed','archived','revoked'))
);

create index if not exists commune_repo_showcases_owner_idx on public.commune_repo_showcases(owner_user_id, created_at desc);
create index if not exists commune_repo_showcases_visibility_idx on public.commune_repo_showcases(visibility_state, created_at desc);

create table if not exists public.commune_media (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.commune_posts(id) on delete cascade,
  comment_id uuid references public.commune_comments(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  media_kind text,
  visibility_state text default 'submitted',
  scan_status text default 'not_scanned',
  warning_acknowledged boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint commune_media_kind_check check (media_kind in ('image','document','archive','code_text','other')),
  constraint commune_media_visibility_check check (visibility_state in ('submitted','published','flagged','hidden','removed','archived','revoked'))
);

create index if not exists commune_media_owner_idx on public.commune_media(owner_user_id, created_at desc);
create index if not exists commune_media_post_idx on public.commune_media(post_id, visibility_state);

create table if not exists public.commune_code_snippets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.commune_posts(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  language text,
  file_name text,
  code_text text not null,
  secret_scan_status text default 'not_scanned',
  sandbox_warning_acknowledged boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists commune_code_snippets_post_idx on public.commune_code_snippets(post_id, created_at);

create table if not exists public.commune_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status text default 'submitted',
  assigned_to uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  resolved_at timestamptz,
  constraint commune_reports_status_check check (status in ('submitted','under_review','action_taken','dismissed','archived'))
);

create index if not exists commune_reports_status_idx on public.commune_reports(status, created_at desc);
create index if not exists commune_reports_target_idx on public.commune_reports(target_type, target_id);

create table if not exists public.commune_realtime_messages (
  id uuid primary key default gen_random_uuid(),
  room_slug text not null,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  visibility_state text default 'published',
  created_at timestamptz default now(),
  hidden_at timestamptz,
  removed_at timestamptz,
  constraint commune_realtime_messages_visibility_check check (visibility_state in ('published','flagged','hidden','removed','archived'))
);

create index if not exists commune_realtime_room_idx on public.commune_realtime_messages(room_slug, created_at desc);

create table if not exists public.commune_sandbox_reviews (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id) on delete set null,
  title text not null,
  summary text,
  code_snippet_id uuid references public.commune_code_snippets(id) on delete set null,
  repo_showcase_id uuid references public.commune_repo_showcases(id) on delete set null,
  status text default 'draft',
  risk_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint commune_sandbox_reviews_status_check check (status in ('draft','submitted','under_review','approved_for_local_testing','rejected','archived'))
);

create index if not exists commune_sandbox_reviews_status_idx on public.commune_sandbox_reviews(status, created_at desc);
create index if not exists commune_sandbox_reviews_submitter_idx on public.commune_sandbox_reviews(submitted_by, created_at desc);

create table if not exists public.commune_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists commune_audit_log_created_idx on public.commune_audit_log(created_at desc);
create index if not exists commune_audit_log_target_idx on public.commune_audit_log(target_type, target_id);

insert into storage.buckets (id, name, public)
values ('commune-media', 'commune-media', false)
on conflict (id) do update set public = false;

alter table public.commune_categories enable row level security;
alter table public.commune_saved_posts enable row level security;
alter table public.commune_repo_showcases enable row level security;
alter table public.commune_media enable row level security;
alter table public.commune_code_snippets enable row level security;
alter table public.commune_reports enable row level security;
alter table public.commune_realtime_messages enable row level security;
alter table public.commune_sandbox_reviews enable row level security;
alter table public.commune_audit_log enable row level security;

drop policy if exists "public reads active commune categories" on public.commune_categories;
create policy "public reads active commune categories" on public.commune_categories for select using (is_active = true or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "admins manage commune categories" on public.commune_categories;
create policy "admins manage commune categories" on public.commune_categories for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "users manage own commune saved posts" on public.commune_saved_posts;
create policy "users manage own commune saved posts" on public.commune_saved_posts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "public reads published commune repo showcases" on public.commune_repo_showcases;
create policy "public reads published commune repo showcases" on public.commune_repo_showcases for select using (visibility_state = 'published');
drop policy if exists "users manage own commune repo showcases" on public.commune_repo_showcases;
create policy "users manage own commune repo showcases" on public.commune_repo_showcases for all to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid() and visibility_state in ('draft','submitted'));
drop policy if exists "moderators manage commune repo showcases" on public.commune_repo_showcases;
create policy "moderators manage commune repo showcases" on public.commune_repo_showcases for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "owners read own commune media" on public.commune_media;
create policy "owners read own commune media" on public.commune_media for select to authenticated using (owner_user_id = auth.uid());
drop policy if exists "public reads published commune media metadata" on public.commune_media;
create policy "public reads published commune media metadata" on public.commune_media for select using (visibility_state = 'published' and media_kind in ('image','code_text','document') and exists (select 1 from public.commune_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "users insert own commune media metadata" on public.commune_media;
create policy "users insert own commune media metadata" on public.commune_media for insert to authenticated with check (owner_user_id = auth.uid() and visibility_state in ('submitted','flagged'));
drop policy if exists "moderators manage commune media metadata" on public.commune_media;
create policy "moderators manage commune media metadata" on public.commune_media for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "public reads published commune code snippets" on public.commune_code_snippets;
create policy "public reads published commune code snippets" on public.commune_code_snippets for select using (exists (select 1 from public.commune_posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "users manage own commune code snippets" on public.commune_code_snippets;
create policy "users manage own commune code snippets" on public.commune_code_snippets for all to authenticated using (author_user_id = auth.uid()) with check (author_user_id = auth.uid());
drop policy if exists "moderators read commune code snippets" on public.commune_code_snippets;
create policy "moderators read commune code snippets" on public.commune_code_snippets for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users create commune reports" on public.commune_reports;
create policy "users create commune reports" on public.commune_reports for insert to anon, authenticated with check (reporter_user_id is null or reporter_user_id = auth.uid());
drop policy if exists "reporters read own commune reports" on public.commune_reports;
create policy "reporters read own commune reports" on public.commune_reports for select to authenticated using (reporter_user_id = auth.uid());
drop policy if exists "moderators manage commune reports" on public.commune_reports;
create policy "moderators manage commune reports" on public.commune_reports for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "public reads published commune realtime messages" on public.commune_realtime_messages;
create policy "public reads published commune realtime messages" on public.commune_realtime_messages for select using (visibility_state = 'published');
drop policy if exists "signed in users create commune realtime messages" on public.commune_realtime_messages;
create policy "signed in users create commune realtime messages" on public.commune_realtime_messages for insert to authenticated with check (author_user_id = auth.uid() and visibility_state = 'published');
drop policy if exists "moderators manage commune realtime messages" on public.commune_realtime_messages;
create policy "moderators manage commune realtime messages" on public.commune_realtime_messages for update to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users manage own commune sandbox reviews" on public.commune_sandbox_reviews;
create policy "users manage own commune sandbox reviews" on public.commune_sandbox_reviews for all to authenticated using (submitted_by = auth.uid()) with check (submitted_by = auth.uid() and status in ('draft','submitted'));
drop policy if exists "moderators manage commune sandbox reviews" on public.commune_sandbox_reviews;
create policy "moderators manage commune sandbox reviews" on public.commune_sandbox_reviews for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "moderators read commune audit log" on public.commune_audit_log;
create policy "moderators read commune audit log" on public.commune_audit_log for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "moderators create commune audit log" on public.commune_audit_log;
create policy "moderators create commune audit log" on public.commune_audit_log for insert to authenticated with check (actor_user_id = auth.uid() and public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users upload own commune media files" on storage.objects;
create policy "users upload own commune media files" on storage.objects for insert to authenticated with check (bucket_id = 'commune-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users read own commune media files" on storage.objects;
create policy "users read own commune media files" on storage.objects for select to authenticated using (bucket_id = 'commune-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "moderators read commune media files" on storage.objects;
create policy "moderators read commune media files" on storage.objects for select to authenticated using (bucket_id = 'commune-media' and public.current_user_can_review_domain('commune'::public.review_domain));

grant select on table public.commune_categories to anon, authenticated;
grant select, insert, update on table public.commune_categories to authenticated;
grant select, insert, update, delete on table public.commune_saved_posts to authenticated;
grant select, insert, update on table public.commune_repo_showcases to authenticated;
grant select on table public.commune_repo_showcases to anon;
grant select, insert, update on table public.commune_media to authenticated;
grant select on table public.commune_media to anon;
grant select, insert, update on table public.commune_code_snippets to authenticated;
grant select on table public.commune_code_snippets to anon;
grant select, insert, update on table public.commune_reports to authenticated;
grant insert on table public.commune_reports to anon;
grant select, insert, update on table public.commune_realtime_messages to authenticated;
grant select on table public.commune_realtime_messages to anon;
grant select, insert, update on table public.commune_sandbox_reviews to authenticated;
grant select, insert on table public.commune_audit_log to authenticated;
