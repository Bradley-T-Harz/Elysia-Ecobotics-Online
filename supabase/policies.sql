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


-- Governance/review RLS policies. Keep aligned with migrations/2026_06_10_governance_review_system.sql.
-- Role policies
drop policy if exists "users read own active roles" on public.user_roles;
drop policy if exists "admins read all roles" on public.user_roles;
drop policy if exists "admins insert roles" on public.user_roles;
drop policy if exists "admins update roles" on public.user_roles;
create policy "users read own active roles" on public.user_roles for select to authenticated using (user_id = auth.uid() and revoked_at is null);
create policy "admins read all roles" on public.user_roles for select to authenticated using (public.current_user_is_admin());
create policy "admins insert roles" on public.user_roles for insert to authenticated with check (public.current_user_is_admin() and user_id <> auth.uid());
create policy "admins update roles" on public.user_roles for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

-- Review framework policies
drop policy if exists "submitters and reviewers read review items" on public.review_items;
drop policy if exists "submitters create review items" on public.review_items;
drop policy if exists "reviewers update review items" on public.review_items;
create policy "submitters and reviewers read review items" on public.review_items for select to authenticated using (submitted_by = auth.uid() or public.current_user_can_review_domain(domain));
create policy "submitters create review items" on public.review_items for insert to authenticated with check (submitted_by = auth.uid());
create policy "reviewers update review items" on public.review_items for update to authenticated using (public.current_user_can_review_domain(domain)) with check (public.current_user_can_review_domain(domain));

drop policy if exists "submitters and reviewers read review events" on public.review_events;
drop policy if exists "submitters create submitted events" on public.review_events;
drop policy if exists "reviewers create review events" on public.review_events;
create policy "submitters and reviewers read review events" on public.review_events for select to authenticated using (
  exists (select 1 from public.review_items ri where ri.id = review_item_id and (public.current_user_can_review_domain(ri.domain) or (ri.submitted_by = auth.uid() and coalesce(metadata->>'visibility','submitter_visible') <> 'internal')))
);
create policy "submitters create submitted events" on public.review_events for insert to authenticated with check (
  actor_id = auth.uid() and event_type = 'submitted' and exists (select 1 from public.review_items ri where ri.id = review_item_id and ri.submitted_by = auth.uid())
);
create policy "reviewers create review events" on public.review_events for insert to authenticated with check (
  actor_id = auth.uid() and exists (select 1 from public.review_items ri where ri.id = review_item_id and public.current_user_can_review_domain(ri.domain))
);

drop policy if exists "reviewers read comments" on public.review_comments;
drop policy if exists "submitters read visible comments" on public.review_comments;
drop policy if exists "reviewers create comments" on public.review_comments;
create policy "reviewers read comments" on public.review_comments for select to authenticated using (exists (select 1 from public.review_items ri where ri.id = review_item_id and public.current_user_can_review_domain(ri.domain)));
create policy "submitters read visible comments" on public.review_comments for select to authenticated using (visibility = 'submitter_visible' and exists (select 1 from public.review_items ri where ri.id = review_item_id and ri.submitted_by = auth.uid()));
create policy "reviewers create comments" on public.review_comments for insert to authenticated with check (actor_id = auth.uid() and exists (select 1 from public.review_items ri where ri.id = review_item_id and public.current_user_can_review_domain(ri.domain)));

-- Work With policies
drop policy if exists "users insert own work with requests" on public.work_with_requests;
drop policy if exists "users read own work with requests" on public.work_with_requests;
drop policy if exists "admins read all work with requests" on public.work_with_requests;
drop policy if exists "admins update work with requests" on public.work_with_requests;
drop policy if exists "reviewers read work with requests" on public.work_with_requests;
drop policy if exists "reviewers update work with requests" on public.work_with_requests;
create policy "users insert own work with requests" on public.work_with_requests for insert to authenticated with check (auth.uid() is not null and user_id = auth.uid());
create policy "users read own work with requests" on public.work_with_requests for select to authenticated using (user_id = auth.uid());
create policy "reviewers read work with requests" on public.work_with_requests for select to authenticated using (public.current_user_can_review_domain('work_with'::public.review_domain));
create policy "reviewers update work with requests" on public.work_with_requests for update to authenticated using (public.current_user_can_review_domain('work_with'::public.review_domain)) with check (public.current_user_can_review_domain('work_with'::public.review_domain));

drop policy if exists "users insert own work with request files" on public.work_with_request_files;
drop policy if exists "users read own work with request files" on public.work_with_request_files;
drop policy if exists "admins read all work with request files" on public.work_with_request_files;
drop policy if exists "reviewers read work with request files" on public.work_with_request_files;
create policy "users insert own work with request files" on public.work_with_request_files for insert to authenticated with check (user_id = auth.uid() and bucket = 'work-with-attachments' and exists (select 1 from public.work_with_requests r where r.id = request_id and r.user_id = auth.uid()));
create policy "users read own work with request files" on public.work_with_request_files for select to authenticated using (user_id = auth.uid());
create policy "reviewers read work with request files" on public.work_with_request_files for select to authenticated using (public.current_user_can_review_domain('work_with'::public.review_domain));

-- Stewardship policies
drop policy if exists "public reads active stewardship organizations" on public.stewardship_organizations;
drop policy if exists "admins manage stewardship organizations" on public.stewardship_organizations;
create policy "public reads active stewardship organizations" on public.stewardship_organizations for select using (is_active = true or public.current_user_is_admin());
create policy "admins manage stewardship organizations" on public.stewardship_organizations for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "users insert own stewardship requests" on public.stewardship_recognition_requests;
drop policy if exists "users read own stewardship requests" on public.stewardship_recognition_requests;
drop policy if exists "reviewers read stewardship requests" on public.stewardship_recognition_requests;
drop policy if exists "reviewers update stewardship requests" on public.stewardship_recognition_requests;
create policy "users insert own stewardship requests" on public.stewardship_recognition_requests for insert to authenticated with check (user_id = auth.uid());
create policy "users read own stewardship requests" on public.stewardship_recognition_requests for select to authenticated using (user_id = auth.uid());
create policy "reviewers read stewardship requests" on public.stewardship_recognition_requests for select to authenticated using (public.current_user_can_review_domain('stewardship'::public.review_domain));
create policy "reviewers update stewardship requests" on public.stewardship_recognition_requests for update to authenticated using (public.current_user_can_review_domain('stewardship'::public.review_domain)) with check (public.current_user_can_review_domain('stewardship'::public.review_domain));

drop policy if exists "users insert own stewardship receipt files" on public.stewardship_receipt_files;
drop policy if exists "users read own stewardship receipt files" on public.stewardship_receipt_files;
drop policy if exists "reviewers read stewardship receipt files" on public.stewardship_receipt_files;
create policy "users insert own stewardship receipt files" on public.stewardship_receipt_files for insert to authenticated with check (user_id = auth.uid() and bucket = 'stewardship-receipts' and exists (select 1 from public.stewardship_recognition_requests r where r.id = request_id and r.user_id = auth.uid()));
create policy "users read own stewardship receipt files" on public.stewardship_receipt_files for select to authenticated using (user_id = auth.uid());
create policy "reviewers read stewardship receipt files" on public.stewardship_receipt_files for select to authenticated using (public.current_user_can_review_domain('stewardship'::public.review_domain));

-- Commune and Living Library policies
drop policy if exists "users insert own commune post requests" on public.commune_post_requests;
drop policy if exists "users read own commune post requests" on public.commune_post_requests;
drop policy if exists "moderators read commune post requests" on public.commune_post_requests;
drop policy if exists "moderators update commune post requests" on public.commune_post_requests;
create policy "users insert own commune post requests" on public.commune_post_requests for insert to authenticated with check (user_id = auth.uid());
create policy "users read own commune post requests" on public.commune_post_requests for select to authenticated using (user_id = auth.uid());
create policy "moderators read commune post requests" on public.commune_post_requests for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));
create policy "moderators update commune post requests" on public.commune_post_requests for update to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users insert source suggestions" on public.living_library_source_suggestions;
drop policy if exists "users read own source suggestions" on public.living_library_source_suggestions;
drop policy if exists "source reviewers read source suggestions" on public.living_library_source_suggestions;
drop policy if exists "source reviewers update source suggestions" on public.living_library_source_suggestions;
create policy "users insert source suggestions" on public.living_library_source_suggestions for insert to authenticated with check (auth.uid() is not null and (user_id = auth.uid() or user_id is null));
create policy "users read own source suggestions" on public.living_library_source_suggestions for select to authenticated using (user_id = auth.uid());
create policy "source reviewers read source suggestions" on public.living_library_source_suggestions for select to authenticated using (public.current_user_can_review_domain('living_library_source'::public.review_domain));
create policy "source reviewers update source suggestions" on public.living_library_source_suggestions for update to authenticated using (public.current_user_can_review_domain('living_library_source'::public.review_domain)) with check (public.current_user_can_review_domain('living_library_source'::public.review_domain));

drop policy if exists "users insert broken link reports" on public.broken_link_reports;
drop policy if exists "users read own broken link reports" on public.broken_link_reports;
drop policy if exists "reviewers read broken link reports" on public.broken_link_reports;
drop policy if exists "reviewers update broken link reports" on public.broken_link_reports;
create policy "users insert broken link reports" on public.broken_link_reports for insert to authenticated with check (auth.uid() is not null and (user_id = auth.uid() or user_id is null));
create policy "users read own broken link reports" on public.broken_link_reports for select to authenticated using (user_id = auth.uid());
create policy "reviewers read broken link reports" on public.broken_link_reports for select to authenticated using (public.current_user_can_review_domain('living_library_broken_link'::public.review_domain));
create policy "reviewers update broken link reports" on public.broken_link_reports for update to authenticated using (public.current_user_can_review_domain('living_library_broken_link'::public.review_domain)) with check (public.current_user_can_review_domain('living_library_broken_link'::public.review_domain));

-- Storage policies for private review files
drop policy if exists "users upload own work with attachments" on storage.objects;
drop policy if exists "users read own work with attachments" on storage.objects;
drop policy if exists "admins read all work with attachments" on storage.objects;
drop policy if exists "reviewers read work with attachments" on storage.objects;
create policy "users upload own work with attachments" on storage.objects for insert to authenticated with check (bucket_id = 'work-with-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own work with attachments" on storage.objects for select to authenticated using (bucket_id = 'work-with-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reviewers read work with attachments" on storage.objects for select to authenticated using (bucket_id = 'work-with-attachments' and public.current_user_can_review_domain('work_with'::public.review_domain));

drop policy if exists "users upload own stewardship receipts" on storage.objects;
drop policy if exists "users read own stewardship receipts" on storage.objects;
drop policy if exists "reviewers read stewardship receipts" on storage.objects;
create policy "users upload own stewardship receipts" on storage.objects for insert to authenticated with check (bucket_id = 'stewardship-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own stewardship receipts" on storage.objects for select to authenticated using (bucket_id = 'stewardship-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "reviewers read stewardship receipts" on storage.objects for select to authenticated using (bucket_id = 'stewardship-receipts' and public.current_user_can_review_domain('stewardship'::public.review_domain));

grant select, insert, update on table public.user_roles to authenticated;
grant select, insert, update on table public.review_items to authenticated;
grant select, insert on table public.review_events to authenticated;
grant select, insert on table public.review_comments to authenticated;
grant select, insert, update on table public.work_with_requests to authenticated;
grant select, insert on table public.work_with_request_files to authenticated;
grant select on table public.stewardship_organizations to anon, authenticated;
grant insert, update on table public.stewardship_organizations to authenticated;
grant select, insert, update on table public.stewardship_recognition_requests to authenticated;
grant select, insert on table public.stewardship_receipt_files to authenticated;
grant select, insert, update on table public.commune_post_requests to authenticated;
grant select, insert, update on table public.living_library_source_suggestions to authenticated;
grant select, insert, update on table public.broken_link_reports to authenticated;

-- Marketplace local install machinery: website intent/trust surface only.
-- Local Elysia remains the final installer authority; no frontend service-role key is used.

alter table public.addon_versions
  add column if not exists addon_api_version text,
  add column if not exists min_elysia_version text,
  add column if not exists max_elysia_version text,
  add column if not exists manifest_hash text,
  add column if not exists package_hash text,
  add column if not exists package_size_bytes bigint,
  add column if not exists package_storage_path text,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz;

alter table public.user_saved_addons
  add column if not exists addon_version_id uuid references public.addon_versions(id) on delete set null,
  add column if not exists notes text;

create table if not exists public.marketplace_addon_permissions (
  id uuid primary key default gen_random_uuid(),
  addon_version_id uuid not null references public.addon_versions(id) on delete cascade,
  permission_key text not null,
  risk_level text not null,
  reason text,
  required boolean not null default false,
  created_at timestamptz not null default now(),
  check (risk_level in ('low','medium','high','critical','unknown','moderate'))
);

create table if not exists public.marketplace_install_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  addon_id uuid not null references public.addons(id) on delete cascade,
  addon_version_id uuid not null references public.addon_versions(id) on delete cascade,
  nonce_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  local_device_id uuid,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  check (status in ('created','opened_by_local_elysia','validated_locally','installed_locally','failed','expired','cancelled'))
);

create table if not exists public.user_linked_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_seen_at timestamptz
);

create table if not exists public.marketplace_revocations (
  id uuid primary key default gen_random_uuid(),
  addon_id uuid references public.addons(id) on delete cascade,
  addon_version_id uuid references public.addon_versions(id) on delete cascade,
  package_hash text,
  severity text not null default 'warning',
  reason text not null,
  recommended_action text not null default 'review_locally',
  revoked_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id),
  check (severity in ('info','warning','high','critical'))
);

alter table public.marketplace_addon_permissions enable row level security;
alter table public.marketplace_install_intents enable row level security;
alter table public.user_linked_devices enable row level security;
alter table public.marketplace_revocations enable row level security;

drop policy if exists "public approved addon permissions readable" on public.marketplace_addon_permissions;
create policy "public approved addon permissions readable" on public.marketplace_addon_permissions for select using (
  exists (select 1 from public.addon_versions av where av.id = addon_version_id and av.review_status = 'approved')
);

drop policy if exists "marketplace reviewers manage addon permissions" on public.marketplace_addon_permissions;
create policy "marketplace reviewers manage addon permissions" on public.marketplace_addon_permissions for all to authenticated
  using (public.current_user_has_role('marketplace_reviewer') or public.current_user_has_role('guardian_reviewer') or public.current_user_is_admin())
  with check (public.current_user_has_role('marketplace_reviewer') or public.current_user_has_role('guardian_reviewer') or public.current_user_is_admin());

drop policy if exists "users create own install intents" on public.marketplace_install_intents;
create policy "users create own install intents" on public.marketplace_install_intents for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users read own install intents" on public.marketplace_install_intents;
create policy "users read own install intents" on public.marketplace_install_intents for select to authenticated
  using (user_id = auth.uid() or public.current_user_has_role('marketplace_reviewer') or public.current_user_has_role('guardian_reviewer') or public.current_user_is_admin());

drop policy if exists "users update own install intent state" on public.marketplace_install_intents;
create policy "users update own install intent state" on public.marketplace_install_intents for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status in ('created','opened_by_local_elysia','cancelled','expired','failed'));

drop policy if exists "users manage own linked devices" on public.user_linked_devices;
create policy "users manage own linked devices" on public.user_linked_devices for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "public revocations readable" on public.marketplace_revocations;
create policy "public revocations readable" on public.marketplace_revocations for select using (true);

drop policy if exists "marketplace reviewers manage revocations" on public.marketplace_revocations;
create policy "marketplace reviewers manage revocations" on public.marketplace_revocations for all to authenticated
  using (public.current_user_has_role('marketplace_reviewer') or public.current_user_has_role('guardian_reviewer') or public.current_user_is_admin())
  with check (public.current_user_has_role('marketplace_reviewer') or public.current_user_has_role('guardian_reviewer') or public.current_user_is_admin());

grant select on table public.marketplace_addon_permissions to anon, authenticated;
grant select, insert, update on table public.marketplace_install_intents to authenticated;
grant select, insert, update, delete on table public.user_linked_devices to authenticated;
grant select on table public.marketplace_revocations to anon, authenticated;

-- Commons Circle homebase and public profile system.
-- Private saved/request material remains private by default. Badges are recognition, not authority.

create extension if not exists pgcrypto;

alter table public.user_saved_addons
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists addon_id uuid references public.addons(id) on delete set null,
  add column if not exists addon_version_id uuid references public.addon_versions(id) on delete set null,
  add column if not exists addon_name text,
  add column if not exists notes text;

create table if not exists public.user_saved_living_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null,
  source_name text not null,
  source_url text,
  category text,
  saved_at timestamptz not null default now(),
  notes text,
  unique(user_id, source_id)
);

create table if not exists public.user_saved_citations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id text not null,
  citation_text text not null,
  citation_format text default 'plain',
  saved_at timestamptz not null default now()
);

create table if not exists public.user_source_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility in ('private','public','unlisted'))
);

create table if not exists public.user_source_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.user_source_collections(id) on delete cascade,
  source_id text not null,
  added_at timestamptz not null default now(),
  unique(collection_id, source_id)
);

create table if not exists public.user_saved_commune_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid,
  draft_id uuid,
  saved_at timestamptz not null default now(),
  last_read_at timestamptz,
  notes text
);

create table if not exists public.user_followed_commune_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  followed_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  unique(user_id, thread_id)
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  source_type text,
  source_id uuid,
  title text not null,
  body text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  commune_replies boolean not null default true,
  followed_threads boolean not null default true,
  marketplace_updates boolean not null default true,
  living_library_updates boolean not null default true,
  review_status_updates boolean not null default true,
  admin_queue_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_visibility_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_display_name boolean not null default true,
  show_bio boolean not null default true,
  show_interests boolean not null default true,
  show_website boolean not null default true,
  show_github boolean not null default true,
  show_badges boolean not null default true,
  show_stewardship_recognition boolean not null default true,
  show_saved_addons boolean not null default false,
  show_saved_sources boolean not null default false,
  show_source_collections boolean not null default true,
  show_commune_posts boolean not null default true,
  show_work_with_status boolean not null default false,
  show_developer_status boolean not null default true,
  show_member_tier boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_customization (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_mode text not null default 'starlit_archive',
  accent_color text default '#8ee8dc',
  background_style text default 'soft_cyber_garden',
  banner_media_id uuid,
  avatar_media_id uuid,
  decal_set text default 'none',
  selected_decals text[] default '{}',
  profile_layout text default 'classic_homebase',
  updated_at timestamptz not null default now(),
  check (theme_mode in ('deep_grove','starlit_archive','solar_meadow','moonlit_reef','aether_blue','high_contrast'))
);

create table if not exists public.profile_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null,
  bucket text not null,
  storage_path text not null,
  public_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(bucket, storage_path),
  check (media_type in ('avatar','banner')),
  check (bucket in ('profile-avatars','profile-banners')),
  check (status in ('active','hidden','removed'))
);

create table if not exists public.profile_decals (
  id uuid primary key default gen_random_uuid(),
  decal_key text unique not null,
  name text not null,
  image_path text,
  category text,
  unlock_condition text,
  is_active boolean not null default true
);

create table if not exists public.user_profile_decals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  decal_key text not null references public.profile_decals(decal_key),
  placement text not null default 'profile_card_corner',
  created_at timestamptz not null default now()
);

create table if not exists public.badge_definitions (
  id uuid primary key default gen_random_uuid(),
  badge_key text unique not null,
  name text not null,
  description text not null,
  badge_type text not null,
  icon_path text,
  category text,
  rarity text not null default 'common',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null references public.badge_definitions(badge_key),
  awarded_by uuid references auth.users(id),
  awarded_at timestamptz not null default now(),
  award_reason text,
  visibility text not null default 'public',
  unique(user_id, badge_key),
  check (visibility in ('public','private','hidden'))
);

insert into public.profile_decals (decal_key, name, category, unlock_condition) values
  ('leaf_glyph', 'Leaf Glyph', 'stewardship', 'Available by default'),
  ('water_ripple', 'Water Ripple', 'stewardship', 'Available by default'),
  ('star_map', 'Star Map', 'aether', 'Available by default'),
  ('mushroom_badge', 'Mushroom Badge', 'ecology', 'Available by default'),
  ('circuit_vine', 'Circuit Vine', 'developer', 'Available by default'),
  ('pollinator', 'Pollinator', 'ecology', 'Available by default'),
  ('wetland_reed', 'Wetland Reed', 'water', 'Available by default'),
  ('moon_crest', 'Moon Crest', 'archive', 'Available by default'),
  ('robotic_seed', 'Robotic Seed', 'ecobotics', 'Available by default')
on conflict (decal_key) do nothing;

insert into public.badge_definitions (badge_key, name, description, badge_type, category, rarity) values
  ('free_member', 'Free Member', 'Default recognition for joining the public website commons.', 'member', 'membership', 'common'),
  ('stewardship_supporter', 'Stewardship Supporter', 'Recognition for reviewed public-benefit stewardship support.', 'stewardship', 'stewardship', 'uncommon'),
  ('water_steward', 'Water Steward', 'Recognition connected to water access, watersheds, wetlands, or aquatic care.', 'stewardship', 'water', 'uncommon'),
  ('forest_steward', 'Forest Steward', 'Recognition connected to forests, restoration, and habitat care.', 'stewardship', 'forest', 'uncommon'),
  ('reef_steward', 'Reef Steward', 'Recognition connected to reef and ocean stewardship.', 'stewardship', 'reef', 'uncommon'),
  ('health_steward', 'Health Steward', 'Recognition connected to health, dignity, and public-benefit support.', 'stewardship', 'health', 'uncommon'),
  ('knowledge_commons_supporter', 'Knowledge Commons Supporter', 'Recognition for supporting public knowledge and open learning.', 'stewardship', 'knowledge', 'uncommon'),
  ('source_curator', 'Source Curator', 'Recognition for useful Living Library source suggestions and care.', 'contributor', 'living_library', 'rare'),
  ('troubleshooting_helper', 'Troubleshooting Helper', 'Recognition for helping others resolve issues safely.', 'contributor', 'commune', 'rare'),
  ('developer_contributor', 'Developer Contributor', 'Recognition for add-on, tooling, or developer ecosystem contributions.', 'developer', 'developer', 'rare'),
  ('founding_steward', 'Founding Steward', 'Early project recognition manually assigned by an administrator.', 'founding', 'membership', 'founding'),
  ('guardian_reviewer', 'Guardian / Reviewer', 'Recognition associated with trust and review work. Authority still requires user_roles.', 'review', 'authority-linked', 'epic')
on conflict (badge_key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('profile-avatars', 'profile-avatars', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('profile-banners', 'profile-banners', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.user_saved_living_sources enable row level security;
alter table public.user_saved_citations enable row level security;
alter table public.user_source_collections enable row level security;
alter table public.user_source_collection_items enable row level security;
alter table public.user_saved_commune_posts enable row level security;
alter table public.user_followed_commune_threads enable row level security;
alter table public.user_notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.profile_visibility_settings enable row level security;
alter table public.profile_customization enable row level security;
alter table public.profile_media enable row level security;
alter table public.profile_decals enable row level security;
alter table public.user_profile_decals enable row level security;
alter table public.badge_definitions enable row level security;
alter table public.user_badges enable row level security;

-- Private saved shelves: owner only.
drop policy if exists "users manage own saved living sources" on public.user_saved_living_sources;
create policy "users manage own saved living sources" on public.user_saved_living_sources for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own saved citations" on public.user_saved_citations;
create policy "users manage own saved citations" on public.user_saved_citations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own saved commune posts" on public.user_saved_commune_posts;
create policy "users manage own saved commune posts" on public.user_saved_commune_posts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own followed commune threads" on public.user_followed_commune_threads;
create policy "users manage own followed commune threads" on public.user_followed_commune_threads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Collections: owner manages; public can read public collection summaries/items.
drop policy if exists "users manage own source collections" on public.user_source_collections;
create policy "users manage own source collections" on public.user_source_collections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public reads public source collections" on public.user_source_collections;
create policy "public reads public source collections" on public.user_source_collections for select using (visibility = 'public');
drop policy if exists "users manage own source collection items" on public.user_source_collection_items;
create policy "users manage own source collection items" on public.user_source_collection_items for all to authenticated using (exists (select 1 from public.user_source_collections c where c.id = collection_id and c.user_id = auth.uid())) with check (exists (select 1 from public.user_source_collections c where c.id = collection_id and c.user_id = auth.uid()));
drop policy if exists "public reads public source collection items" on public.user_source_collection_items;
create policy "public reads public source collection items" on public.user_source_collection_items for select using (exists (select 1 from public.user_source_collections c where c.id = collection_id and c.visibility = 'public'));

-- Notifications and preferences are private owner data.
drop policy if exists "users manage own notifications" on public.user_notifications;
create policy "users manage own notifications" on public.user_notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own notification preferences" on public.notification_preferences;
create policy "users manage own notification preferences" on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Visibility/customization: owner manages, public reads the presentation controls only.
drop policy if exists "users manage own visibility settings" on public.profile_visibility_settings;
create policy "users manage own visibility settings" on public.profile_visibility_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public reads visibility settings" on public.profile_visibility_settings;
create policy "public reads visibility settings" on public.profile_visibility_settings for select using (true);
drop policy if exists "users manage own profile customization" on public.profile_customization;
create policy "users manage own profile customization" on public.profile_customization for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public reads profile customization" on public.profile_customization;
create policy "public reads profile customization" on public.profile_customization for select using (true);

-- Public profile media is only avatar/banner. Never use these buckets for resumes or receipts.
drop policy if exists "users manage own profile media" on public.profile_media;
create policy "users manage own profile media" on public.profile_media for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and bucket in ('profile-avatars','profile-banners'));
drop policy if exists "public reads active profile media" on public.profile_media;
create policy "public reads active profile media" on public.profile_media for select using (status = 'active' and bucket in ('profile-avatars','profile-banners'));
drop policy if exists "users upload own profile avatars" on storage.objects;
create policy "users upload own profile avatars" on storage.objects for insert to authenticated with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users update own profile avatars" on storage.objects;
create policy "users update own profile avatars" on storage.objects for update to authenticated using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users delete own profile avatars" on storage.objects;
create policy "users delete own profile avatars" on storage.objects for delete to authenticated using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "public reads profile avatars" on storage.objects;
create policy "public reads profile avatars" on storage.objects for select using (bucket_id = 'profile-avatars');
drop policy if exists "users upload own profile banners" on storage.objects;
create policy "users upload own profile banners" on storage.objects for insert to authenticated with check (bucket_id = 'profile-banners' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users update own profile banners" on storage.objects;
create policy "users update own profile banners" on storage.objects for update to authenticated using (bucket_id = 'profile-banners' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'profile-banners' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "users delete own profile banners" on storage.objects;
create policy "users delete own profile banners" on storage.objects for delete to authenticated using (bucket_id = 'profile-banners' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "public reads profile banners" on storage.objects;
create policy "public reads profile banners" on storage.objects for select using (bucket_id = 'profile-banners');

-- Decals are curated. Users choose from active decals only.
drop policy if exists "public reads active profile decals" on public.profile_decals;
create policy "public reads active profile decals" on public.profile_decals for select using (is_active = true);
drop policy if exists "users manage own profile decals" on public.user_profile_decals;
create policy "users manage own profile decals" on public.user_profile_decals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public reads user public profile decals" on public.user_profile_decals;
create policy "public reads user public profile decals" on public.user_profile_decals for select using (true);

-- Badges are recognition, not authority. Users cannot award official badges to themselves.
drop policy if exists "public reads active badge definitions" on public.badge_definitions;
create policy "public reads active badge definitions" on public.badge_definitions for select using (is_active = true);
drop policy if exists "public reads visible user badges" on public.user_badges;
create policy "public reads visible user badges" on public.user_badges for select using (visibility = 'public');
drop policy if exists "users read own badges" on public.user_badges;
create policy "users read own badges" on public.user_badges for select to authenticated using (user_id = auth.uid());
drop policy if exists "users update own badge visibility" on public.user_badges;
create policy "users update own badge visibility" on public.user_badges for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admins award badges" on public.user_badges;
create policy "admins award badges" on public.user_badges for insert to authenticated with check (public.current_user_is_admin() and user_id <> auth.uid());
drop policy if exists "admins manage badges" on public.user_badges;
create policy "admins manage badges" on public.user_badges for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

grant select, insert, update, delete on table public.user_saved_living_sources to authenticated;
grant select, insert, update, delete on table public.user_saved_citations to authenticated;
grant select, insert, update, delete on table public.user_source_collections to authenticated;
grant select, insert, update, delete on table public.user_source_collection_items to authenticated;
grant select on table public.user_source_collections to anon;
grant select on table public.user_source_collection_items to anon;
grant select, insert, update, delete on table public.user_saved_commune_posts to authenticated;
grant select, insert, update, delete on table public.user_followed_commune_threads to authenticated;
grant select, insert, update, delete on table public.user_notifications to authenticated;
grant select, insert, update, delete on table public.notification_preferences to authenticated;
grant select, insert, update, delete on table public.profile_visibility_settings to authenticated;
grant select on table public.profile_visibility_settings to anon;
grant select, insert, update, delete on table public.profile_customization to authenticated;
grant select on table public.profile_customization to anon;
grant select, insert, update, delete on table public.profile_media to authenticated;
grant select on table public.profile_media to anon;
grant select on table public.profile_decals to anon, authenticated;
grant select, insert, update, delete on table public.user_profile_decals to authenticated;
grant select on table public.user_profile_decals to anon;
grant select on table public.badge_definitions to anon, authenticated;
grant select, update on table public.user_badges to authenticated;
grant select on table public.user_badges to anon;

-- Repair Marketplace saved add-ons and local install intents.
-- Website account storage only. The website still cannot install, enable, disable, or execute local add-ons.

create extension if not exists pgcrypto;

create table if not exists public.user_saved_addons (
  id uuid default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  addon_slug text not null,
  saved_at timestamptz not null default now()
);

alter table public.user_saved_addons
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists addon_id uuid,
  add column if not exists addon_version_id uuid,
  add column if not exists addon_name text,
  add column if not exists notes text;

update public.user_saved_addons set id = gen_random_uuid() where id is null;
alter table public.user_saved_addons alter column id set not null;

alter table public.user_saved_addons drop constraint if exists user_saved_addons_pkey;
alter table public.user_saved_addons add constraint user_saved_addons_pkey primary key (id);
alter table public.user_saved_addons drop constraint if exists user_saved_addons_user_id_addon_slug_key;
alter table public.user_saved_addons add constraint user_saved_addons_user_id_addon_slug_key unique (user_id, addon_slug);

alter table public.user_saved_addons drop constraint if exists user_saved_addons_user_id_fkey;
alter table public.user_saved_addons add constraint user_saved_addons_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.user_saved_addons drop constraint if exists user_saved_addons_addon_slug_fkey;
alter table public.user_saved_addons drop constraint if exists user_saved_addons_addon_id_fkey;
alter table public.user_saved_addons add constraint user_saved_addons_addon_id_fkey foreign key (addon_id) references public.addons(id) on delete set null;
alter table public.user_saved_addons drop constraint if exists user_saved_addons_addon_version_id_fkey;
alter table public.user_saved_addons add constraint user_saved_addons_addon_version_id_fkey foreign key (addon_version_id) references public.addon_versions(id) on delete set null;

create table if not exists public.marketplace_install_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  addon_id uuid,
  addon_version_id uuid,
  addon_slug text,
  addon_name text,
  nonce_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  local_device_id uuid,
  status text not null default 'created',
  created_at timestamptz not null default now()
);

alter table public.marketplace_install_intents
  add column if not exists addon_id uuid,
  add column if not exists addon_version_id uuid,
  add column if not exists addon_slug text,
  add column if not exists addon_name text,
  add column if not exists consumed_at timestamptz,
  add column if not exists local_device_id uuid,
  add column if not exists status text not null default 'created',
  add column if not exists created_at timestamptz not null default now();

alter table public.marketplace_install_intents alter column addon_id drop not null;
alter table public.marketplace_install_intents alter column addon_version_id drop not null;
alter table public.marketplace_install_intents drop constraint if exists marketplace_install_intents_addon_id_fkey;
alter table public.marketplace_install_intents add constraint marketplace_install_intents_addon_id_fkey foreign key (addon_id) references public.addons(id) on delete set null;
alter table public.marketplace_install_intents drop constraint if exists marketplace_install_intents_addon_version_id_fkey;
alter table public.marketplace_install_intents add constraint marketplace_install_intents_addon_version_id_fkey foreign key (addon_version_id) references public.addon_versions(id) on delete set null;
alter table public.marketplace_install_intents drop constraint if exists marketplace_install_intents_status_check;
alter table public.marketplace_install_intents add constraint marketplace_install_intents_status_check check (status in ('created','opened_by_local_elysia','validated_locally','installed_locally','failed','expired','cancelled'));

alter table public.user_saved_addons enable row level security;
alter table public.marketplace_install_intents enable row level security;

drop policy if exists "users manage own saved addons" on public.user_saved_addons;
drop policy if exists "users select own saved add-ons" on public.user_saved_addons;
drop policy if exists "users insert own saved add-ons" on public.user_saved_addons;
drop policy if exists "users update own saved add-ons" on public.user_saved_addons;
drop policy if exists "users delete own saved add-ons" on public.user_saved_addons;
create policy "users select own saved add-ons" on public.user_saved_addons for select to authenticated using (user_id = auth.uid());
create policy "users insert own saved add-ons" on public.user_saved_addons for insert to authenticated with check (user_id = auth.uid());
create policy "users update own saved add-ons" on public.user_saved_addons for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own saved add-ons" on public.user_saved_addons for delete to authenticated using (user_id = auth.uid());

drop policy if exists "users create own install intents" on public.marketplace_install_intents;
drop policy if exists "users read own install intents" on public.marketplace_install_intents;
drop policy if exists "users update own install intent state" on public.marketplace_install_intents;
drop policy if exists "users insert own install intents" on public.marketplace_install_intents;
drop policy if exists "users select own install intents" on public.marketplace_install_intents;
drop policy if exists "users update own install intents" on public.marketplace_install_intents;
create policy "users insert own install intents" on public.marketplace_install_intents for insert to authenticated with check (user_id = auth.uid());
create policy "users select own install intents" on public.marketplace_install_intents for select to authenticated using (user_id = auth.uid());
create policy "users update own install intents" on public.marketplace_install_intents for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and status in ('created','opened_by_local_elysia','cancelled','expired','failed'));

grant select, insert, update, delete on table public.user_saved_addons to authenticated;
grant select, insert, update on table public.marketplace_install_intents to authenticated;
revoke all on table public.user_saved_addons from anon;
revoke all on table public.marketplace_install_intents from anon;

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
