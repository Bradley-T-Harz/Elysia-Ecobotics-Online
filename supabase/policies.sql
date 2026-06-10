alter table profiles enable row level security;
alter table publishers enable row level security;
alter table addons enable row level security;
alter table addon_versions enable row level security;
alter table addon_dependencies enable row level security;
alter table addon_actions enable row level security;
alter table user_saved_addons enable row level security;
alter table addon_reviews enable row level security;

create or replace function public.is_marketplace_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "public profiles are readable" on profiles;
drop policy if exists "users insert own profile" on profiles;
drop policy if exists "users update own non-admin profile" on profiles;
drop policy if exists "admins update profiles" on profiles;

create policy "public profiles are readable" on profiles for select using (true);
create policy "users insert own profile" on profiles for insert with check (auth.uid() = id and is_admin = false);
create policy "users update own profile without admin promotion" on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = public.is_marketplace_admin());
create policy "admins update profiles" on profiles for update
  using (public.is_marketplace_admin())
  with check (public.is_marketplace_admin());

drop policy if exists "public verified publishers readable" on publishers;
drop policy if exists "owners create publishers" on publishers;
drop policy if exists "owners update publishers" on publishers;

create policy "public verified publishers readable" on publishers for select using (verified = true or owner_id = auth.uid());
create policy "owners create publishers" on publishers for insert with check (owner_id = auth.uid());
create policy "owners update publishers" on publishers for update using (owner_id = auth.uid());

drop policy if exists "public approved addons readable" on addons;
drop policy if exists "publisher owners see drafts" on addons;
drop policy if exists "publisher owners insert addons" on addons;
drop policy if exists "publisher owners update addons" on addons;
drop policy if exists "admins manage addons" on addons;

create policy "public approved addons readable" on addons for select using (status in ('approved','deprecated'));
create policy "publisher owners see drafts" on addons for select using (publisher_id in (select id from publishers where owner_id = auth.uid()));
create policy "publisher owners insert addons" on addons for insert with check (publisher_id in (select id from publishers where owner_id = auth.uid()));
create policy "publisher owners update addons" on addons for update using (publisher_id in (select id from publishers where owner_id = auth.uid()));
create policy "admins manage addons" on addons for all using (public.is_marketplace_admin()) with check (public.is_marketplace_admin());

drop policy if exists "public approved versions readable" on addon_versions;
drop policy if exists "creators read own versions" on addon_versions;
drop policy if exists "creators insert versions" on addon_versions;
drop policy if exists "creators update draft versions" on addon_versions;
drop policy if exists "admins read review versions" on addon_versions;
drop policy if exists "admins update review versions" on addon_versions;

create policy "public approved versions readable" on addon_versions for select using (review_status = 'approved');
create policy "creators read own versions" on addon_versions for select using (created_by = auth.uid());
create policy "creators insert versions" on addon_versions for insert with check (created_by = auth.uid());
create policy "creators update draft versions" on addon_versions for update using (created_by = auth.uid() and review_status in ('draft','needs_changes'));
create policy "admins read review versions" on addon_versions for select using (public.is_marketplace_admin());
create policy "admins update review versions" on addon_versions for update using (public.is_marketplace_admin()) with check (public.is_marketplace_admin());

drop policy if exists "public dependency rows for approved versions" on addon_dependencies;
drop policy if exists "public action rows for approved versions" on addon_actions;

create policy "public dependency rows for approved versions" on addon_dependencies for select using (addon_version_id in (select id from addon_versions where review_status = 'approved'));
create policy "public action rows for approved versions" on addon_actions for select using (addon_version_id in (select id from addon_versions where review_status = 'approved'));

drop policy if exists "users manage own saved addons" on user_saved_addons;
create policy "users manage own saved addons" on user_saved_addons for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Saved add-ons store public catalog slugs, not local installation state.

-- Browser authenticated users may manage only their own saved add-on rows.
-- RLS above still enforces user_id = auth.uid(); these grants only allow PostgREST to attempt the operation.
grant select, insert, delete on table public.user_saved_addons to authenticated;

drop policy if exists "review rows visible to related creators" on addon_reviews;
drop policy if exists "admins manage reviews" on addon_reviews;

create policy "review rows visible to related creators" on addon_reviews for select using (addon_version_id in (select id from addon_versions where created_by = auth.uid()));
create policy "admins manage reviews" on addon_reviews for all using (public.is_marketplace_admin()) with check (public.is_marketplace_admin());

-- Bootstrap Bradley admin manually after account creation through SQL Editor.
-- Browser clients must never receive or use a service-role key.


-- Work With requests and private resume/CV attachment metadata.
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
