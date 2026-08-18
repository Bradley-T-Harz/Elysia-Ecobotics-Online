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

create policy "public approved addons readable" on addons for select using (status = 'approved');
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

insert into public.badge_definitions (badge_key, name, description, badge_type, icon_path, category, rarity) values
  ('free_member', 'Free Member', 'Default recognition for joining the public website commons.', 'member', '/images/badges/Free_Member.png', 'membership', 'common'),
  ('stewardship_supporter', 'Stewardship Supporter', 'Recognition for reviewed public-benefit stewardship support.', 'stewardship', '/images/badges/Stewardship_Supporter.png', 'stewardship', 'uncommon'),
  ('water_steward', 'Water Steward', 'Recognition connected to water access, watersheds, wetlands, or aquatic care.', 'stewardship', '/images/badges/Water_Steward.png', 'water', 'uncommon'),
  ('forest_steward', 'Forest Steward', 'Recognition connected to forests, restoration, and habitat care.', 'stewardship', '/images/badges/Forest_Steward.png', 'forest', 'uncommon'),
  ('reef_steward', 'Reef Steward', 'Recognition connected to reef and ocean stewardship.', 'stewardship', '/images/badges/Reef_Steward.png', 'reef', 'uncommon'),
  ('health_steward', 'Health Steward', 'Recognition connected to health, dignity, and public-benefit support.', 'stewardship', '/images/badges/Health_Steward.png', 'health', 'uncommon'),
  ('knowledge_commons_supporter', 'Knowledge Commons Supporter', 'Recognition for supporting public knowledge and open learning.', 'stewardship', '/images/badges/Knowledge_Commons_Supporter.png', 'knowledge', 'uncommon'),
  ('source_curator', 'Source Curator', 'Recognition for useful Living Library source suggestions and care.', 'contributor', '/images/badges/Source_Curator.png', 'living-library', 'rare'),
  ('troubleshooting_helper', 'Troubleshooting Helper', 'Recognition for helping others resolve issues safely.', 'contributor', '/images/badges/Troubleshooting_Helper.png', 'commune', 'rare'),
  ('developer_contributor', 'Developer Contributor', 'Recognition for add-on, tooling, or developer ecosystem contributions.', 'developer', '/images/badges/Developer_Contributor.png', 'developer', 'rare'),
  ('founding_steward', 'Founding Steward', 'Early project recognition manually assigned by an administrator.', 'founding', '/images/badges/Founding_Steward.png', 'membership', 'epic'),
  ('guardian_reviewer', 'Guardian / Reviewer', 'Recognition associated with trust and review work. Authority still requires roles assigned by administrators.', 'review', '/images/badges/Guardian_Reviewer.png', 'authority-linked', 'epic'),
  ('seed_sower', 'Seed Sower', 'Recognition for planting a first useful contribution in the public commons.', 'contributor', '/images/badges/Seed_Sower.png', 'contribution', 'common'),
  ('bridge_builder', 'Bridge Builder', 'Recognition for helping people, projects, ideas, and resources find each other.', 'community', '/images/badges/Bridge_Builder.png', 'community', 'uncommon'),
  ('archive_warden', 'Archive Warden', 'Recognition for preserving records, improving sources, checking links, and strengthening public memory.', 'archive', '/images/badges/Archive_Warden.png', 'archive', 'uncommon'),
  ('forge_tester', 'Forge Tester', 'Recognition for careful testing, bug reports, compatibility notes, and safe release feedback.', 'testing', '/images/badges/Forge_Tester.png', 'testing', 'rare'),
  ('field_witness', 'Field Witness', 'Recognition for public ecological observations, field evidence, maps, restoration notes, or environmental records.', 'ecology', '/images/badges/Field_Witness.png', 'fieldwork', 'rare'),
  ('radiant_scribe', 'Radiant Scribe', 'Recognition for clear writing, tutorials, research notes, guides, and public learning contributions.', 'writing', '/images/badges/Radiant_Scribe.png', 'writing', 'rare'),
  ('hearth_keeper', 'Hearth Keeper', 'Recognition for trusted moderation and care of the public Commune.', 'moderation', '/images/badges/Hearth_Keeper.png', 'authority-linked', 'epic'),
  ('ecobotics_forgewright', 'Ecobotics Forgewright', 'Recognition for robotics, hardware, ecological devices, and physical system contributions.', 'ecobotics', '/images/badges/Ecobotics_Forgewright.png', 'robotics', 'epic'),
  ('elysian_artwright', 'Elysian Artwright', 'Recognition for visual art, concept work, icons, and imagery that help give Elysia Ecobotics a living face.', 'art', '/images/badges/Elysian_Artwright.png', 'art', 'rare'),
  ('kindred_ally', 'Kindred Ally', 'Recognition for helping allied people, friends, collaborators, and associated projects with care and usefulness.', 'community', '/images/badges/Kindred_Ally.png', 'allied-service', 'uncommon'),
  ('open_pathmaker', 'Open Pathmaker', 'Recognition for making the Commons easier, clearer, and more accessible for more people.', 'accessibility', '/images/badges/Open_Pathmaker.png', 'accessibility', 'rare'),
  ('boundary_lantern', 'Boundary Lantern', 'Recognition for strengthening privacy, consent, safety, and ethical boundaries in the public commons.', 'safety', '/images/badges/Boundary_Lantern.png', 'privacy', 'rare')
on conflict (badge_key) do update set
  name = excluded.name,
  description = excluded.description,
  badge_type = excluded.badge_type,
  icon_path = excluded.icon_path,
  category = excluded.category,
  rarity = excluded.rarity,
  is_active = true;

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
  create type public.commune_post_type as enum ('media_garden','troubleshooting','code_sharing','repository_showcase','community_network','job_post','official_update','research_note','elysia_iteration_showcase','community_vote');
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
create policy "public reads published commune posts" on public.commune_posts for select using (((status = 'published' and visibility = 'public' and coalesce(visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked') and hidden_at is null and removed_at is null and archived_at is null)) or user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain));
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
-- Commons Circle badge credits and earned-only badge awards.
-- Badges are recognition, not authority. Credits are typed evidence, not currency.

create extension if not exists pgcrypto;

alter table public.badge_definitions
  add column if not exists sort_order integer,
  add column if not exists authority_linked boolean not null default false,
  add column if not exists award_mode text,
  add column if not exists rule_summary text,
  add column if not exists is_manual_only boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.badge_definitions drop constraint if exists badge_definitions_award_mode_check;
alter table public.badge_definitions
  add constraint badge_definitions_award_mode_check
  check (award_mode is null or award_mode in ('automatic','review_triggered','manual_admin','role_linked','project_lead'));

alter table public.user_badges
  add column if not exists award_source text,
  add column if not exists evidence_type text,
  add column if not exists evidence_id uuid,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id),
  add column if not exists revoked_reason text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.user_badges set visibility = 'private' where visibility = 'hidden';
alter table public.user_badges drop constraint if exists user_badges_visibility_check;
alter table public.user_badges
  add constraint user_badges_visibility_check check (visibility in ('public','private'));
alter table public.user_badges drop constraint if exists user_badges_user_id_badge_key_key;
create unique index if not exists user_badges_one_active_badge on public.user_badges(user_id, badge_key) where revoked_at is null;
create index if not exists user_badges_user_active_idx on public.user_badges(user_id, revoked_at, visibility);

create table if not exists public.badge_credit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_type text not null,
  credit_amount integer not null default 1,
  contribution_type text not null,
  contribution_id uuid,
  review_item_id uuid references public.review_items(id) on delete set null,
  awarded_by uuid references auth.users(id),
  awarded_at timestamptz not null default now(),
  is_major boolean not null default false,
  distinct_subject_key text,
  notes text,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revoked_reason text,
  check (credit_amount between 1 and 2),
  check (credit_type in (
    'account_membership',
    'stewardship_general',
    'stewardship_water',
    'stewardship_forest',
    'stewardship_reef',
    'stewardship_health',
    'knowledge_support',
    'source_curation',
    'troubleshooting_resolution',
    'developer_contribution',
    'bridge_building',
    'archive_maintenance',
    'testing_feedback',
    'field_observation',
    'writing_teaching',
    'art_contribution',
    'accessibility_improvement',
    'boundary_safety'
  ))
);

create index if not exists badge_credit_events_user_type_idx on public.badge_credit_events(user_id, credit_type, revoked_at);
create index if not exists badge_credit_events_review_idx on public.badge_credit_events(review_item_id);
create unique index if not exists badge_credit_events_one_active_contribution_credit
  on public.badge_credit_events(user_id, credit_type, contribution_type, contribution_id)
  where contribution_id is not null and revoked_at is null;

create table if not exists public.badge_rules (
  id uuid primary key default gen_random_uuid(),
  badge_slug text not null references public.badge_definitions(badge_key) on delete cascade,
  rule_type text not null,
  required_credit_type text,
  required_count integer,
  required_credit_sum integer,
  requires_major boolean not null default false,
  distinct_subject_min integer,
  eligible_credit_types text[] default '{}',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rule_type in ('profile_completed','credit_count','credit_sum','first_eligible_credit','manual_only','role_linked'))
);

create table if not exists public.badge_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  target_user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  badge_slug text references public.badge_definitions(badge_key),
  credit_event_id uuid references public.badge_credit_events(id) on delete set null,
  evidence_type text,
  evidence_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (action in ('credit_created','credit_revoked','badge_granted','badge_revoked','manual_grant','manual_revoke','free_member_granted','rule_evaluated'))
);

create index if not exists badge_audit_log_target_idx on public.badge_audit_log(target_user_id, created_at desc);
create index if not exists badge_audit_log_badge_idx on public.badge_audit_log(badge_slug, created_at desc);

insert into public.badge_definitions (badge_key, name, description, badge_type, icon_path, category, rarity, sort_order, authority_linked, award_mode, rule_summary, is_manual_only, is_active) values
  ('free_member', 'Free Member', 'Default recognition for joining the public website commons.', 'member', '/images/badges/Free_Member.png', 'membership', 'common', 1, false, 'automatic', 'Granted when a verified Website Account has a Commons Profile.', false, true),
  ('stewardship_supporter', 'Stewardship Supporter', 'Recognition for reviewed public-benefit stewardship support.', 'stewardship', '/images/badges/Stewardship_Supporter.png', 'stewardship', 'uncommon', 2, false, 'review_triggered', 'Granted after 1 approved stewardship support verification.', false, true),
  ('water_steward', 'Water Steward', 'Recognition connected to water access, watersheds, wetlands, or aquatic care.', 'stewardship', '/images/badges/Water_Steward.png', 'water', 'uncommon', 3, false, 'review_triggered', 'Granted after 3 approved water stewardship credits or 1 major water contribution.', false, true),
  ('forest_steward', 'Forest Steward', 'Recognition connected to forests, restoration, and habitat care.', 'stewardship', '/images/badges/Forest_Steward.png', 'forest', 'uncommon', 4, false, 'review_triggered', 'Granted after 3 approved forest stewardship credits or 1 major forest contribution.', false, true),
  ('reef_steward', 'Reef Steward', 'Recognition connected to reef and ocean stewardship.', 'stewardship', '/images/badges/Reef_Steward.png', 'reef', 'uncommon', 5, false, 'review_triggered', 'Granted after 3 approved reef/ocean stewardship credits or 1 major reef contribution.', false, true),
  ('health_steward', 'Health Steward', 'Recognition connected to health, dignity, and public-benefit support.', 'stewardship', '/images/badges/Health_Steward.png', 'health', 'uncommon', 6, false, 'review_triggered', 'Granted after 3 approved health stewardship credits or 1 major health/public-dignity contribution.', false, true),
  ('knowledge_commons_supporter', 'Knowledge Commons Supporter', 'Recognition for supporting public knowledge and open learning.', 'stewardship', '/images/badges/Knowledge_Commons_Supporter.png', 'knowledge', 'uncommon', 7, false, 'review_triggered', 'Granted after 2 approved knowledge support credits or 1 major knowledge contribution.', false, true),
  ('source_curator', 'Source Curator', 'Recognition for useful Living Library source suggestions and care.', 'contributor', '/images/badges/Source_Curator.png', 'living-library', 'rare', 8, false, 'review_triggered', 'Granted after 3 accepted Living Library sources or 1 major source pack/curated collection.', false, true),
  ('troubleshooting_helper', 'Troubleshooting Helper', 'Recognition for helping others resolve issues safely.', 'contributor', '/images/badges/Troubleshooting_Helper.png', 'commune', 'rare', 9, false, 'review_triggered', 'Granted after 3 reviewed helpful troubleshooting resolutions across at least 2 distinct users.', false, true),
  ('developer_contributor', 'Developer Contributor', 'Recognition for add-on, tooling, or developer ecosystem contributions.', 'developer', '/images/badges/Developer_Contributor.png', 'developer', 'rare', 10, false, 'review_triggered', 'Granted after 1 substantial developer contribution or 3 smaller approved developer contributions.', false, true),
  ('founding_steward', 'Founding Steward', 'Early project recognition manually assigned by an administrator.', 'founding', '/images/badges/Founding_Steward.png', 'membership', 'epic', 11, false, 'manual_admin', 'Manual founding-era recognition only; never automatic.', true, true),
  ('guardian_reviewer', 'Guardian / Reviewer', 'Recognition associated with trust and review work. Authority still requires roles assigned by administrators.', 'review', '/images/badges/Guardian_Reviewer.png', 'authority-linked', 'epic', 12, true, 'role_linked', 'Role-linked recognition only. The badge itself grants no permissions.', true, true),
  ('seed_sower', 'Seed Sower', 'Recognition for planting a first useful contribution in the public commons.', 'contributor', '/images/badges/Seed_Sower.png', 'contribution', 'common', 13, false, 'review_triggered', 'Granted after the first approved eligible contribution of any type.', false, true),
  ('bridge_builder', 'Bridge Builder', 'Recognition for helping people, projects, ideas, and resources find each other.', 'community', '/images/badges/Bridge_Builder.png', 'community', 'uncommon', 14, false, 'review_triggered', 'Granted after 5 reviewed bridge-building actions across at least 3 distinct users/projects.', false, true),
  ('archive_warden', 'Archive Warden', 'Recognition for preserving records, improving sources, checking links, and strengthening public memory.', 'archive', '/images/badges/Archive_Warden.png', 'archive', 'uncommon', 15, false, 'review_triggered', 'Granted after 5 archive/documentation maintenance contributions or 1 major archive project.', false, true),
  ('forge_tester', 'Forge Tester', 'Recognition for careful testing, bug reports, compatibility notes, and safe release feedback.', 'testing', '/images/badges/Forge_Tester.png', 'testing', 'rare', 16, false, 'review_triggered', 'Granted after 3 accepted test reports or 1 critical confirmed report that led to a fix.', false, true),
  ('field_witness', 'Field Witness', 'Recognition for public ecological observations, field evidence, maps, restoration notes, or environmental records.', 'ecology', '/images/badges/Field_Witness.png', 'fieldwork', 'rare', 17, false, 'review_triggered', 'Granted after 3 accepted field observations or 1 major field record.', false, true),
  ('radiant_scribe', 'Radiant Scribe', 'Recognition for clear writing, tutorials, research notes, guides, and public learning contributions.', 'writing', '/images/badges/Radiant_Scribe.png', 'writing', 'rare', 18, false, 'review_triggered', 'Granted after 2 substantial writing contributions, 5 smaller writing contributions, or 1 major guide/tutorial.', false, true),
  ('hearth_keeper', 'Hearth Keeper', 'Recognition for trusted moderation and care of the public Commune.', 'moderation', '/images/badges/Hearth_Keeper.png', 'authority-linked', 'epic', 19, true, 'role_linked', 'Role-linked community care recognition only. The badge itself grants no permissions.', true, true),
  ('ecobotics_forgewright', 'Ecobotics Forgewright', 'Recognition for robotics, hardware, ecological devices, and physical system contributions.', 'ecobotics', '/images/badges/Ecobotics_Forgewright.png', 'robotics', 'epic', 20, false, 'project_lead', 'Project-lead/manual recognition for meaningful robotics or physical-system contribution.', true, true),
  ('elysian_artwright', 'Elysian Artwright', 'Recognition for visual art, concept work, icons, and imagery that help give Elysia Ecobotics a living face.', 'art', '/images/badges/Elysian_Artwright.png', 'art', 'rare', 21, false, 'review_triggered', 'Granted after 1 substantial accepted art contribution or 3 smaller accepted art contributions.', false, true),
  ('kindred_ally', 'Kindred Ally', 'Recognition for helping allied people, friends, collaborators, and associated projects with care and usefulness.', 'community', '/images/badges/Kindred_Ally.png', 'allied-service', 'uncommon', 22, false, 'manual_admin', 'Manual allied-service recognition only; does not imply partnership, sponsorship, employment, endorsement, or authority.', true, true),
  ('open_pathmaker', 'Open Pathmaker', 'Recognition for making the Commons easier, clearer, and more accessible for more people.', 'accessibility', '/images/badges/Open_Pathmaker.png', 'accessibility', 'rare', 23, false, 'review_triggered', 'Granted after 3 accessibility/usability improvements or 1 major access improvement.', false, true),
  ('boundary_lantern', 'Boundary Lantern', 'Recognition for strengthening privacy, consent, safety, and ethical boundaries in the public commons.', 'safety', '/images/badges/Boundary_Lantern.png', 'privacy', 'rare', 24, false, 'review_triggered', 'Granted after 2 safety/privacy/boundary improvements or 1 major risk-prevention contribution.', false, true)
on conflict (badge_key) do update set
  name = excluded.name,
  description = excluded.description,
  badge_type = excluded.badge_type,
  icon_path = excluded.icon_path,
  category = excluded.category,
  rarity = excluded.rarity,
  sort_order = excluded.sort_order,
  authority_linked = excluded.authority_linked,
  award_mode = excluded.award_mode,
  rule_summary = excluded.rule_summary,
  is_manual_only = excluded.is_manual_only,
  is_active = true,
  updated_at = now();

delete from public.badge_rules where badge_slug in (
  'free_member','stewardship_supporter','water_steward','forest_steward','reef_steward','health_steward',
  'knowledge_commons_supporter','source_curator','troubleshooting_helper','developer_contributor','founding_steward',
  'guardian_reviewer','seed_sower','bridge_builder','archive_warden','forge_tester','field_witness','radiant_scribe',
  'hearth_keeper','ecobotics_forgewright','elysian_artwright','kindred_ally','open_pathmaker','boundary_lantern'
);

insert into public.badge_rules (badge_slug, rule_type, required_credit_type, required_count, required_credit_sum, requires_major, distinct_subject_min, eligible_credit_types, description, is_active) values
  ('free_member', 'profile_completed', 'account_membership', 1, null, false, null, '{}', 'Verified Website Account plus completed Commons Profile.', true),
  ('stewardship_supporter', 'credit_count', 'stewardship_general', 1, null, false, null, '{}', 'One approved stewardship support verification.', true),
  ('water_steward', 'credit_count', 'stewardship_water', 3, null, true, null, '{}', 'Three water credits or one major water contribution.', true),
  ('forest_steward', 'credit_count', 'stewardship_forest', 3, null, true, null, '{}', 'Three forest credits or one major forest contribution.', true),
  ('reef_steward', 'credit_count', 'stewardship_reef', 3, null, true, null, '{}', 'Three reef/ocean credits or one major reef contribution.', true),
  ('health_steward', 'credit_count', 'stewardship_health', 3, null, true, null, '{}', 'Three health credits or one major health/public-dignity contribution.', true),
  ('knowledge_commons_supporter', 'credit_count', 'knowledge_support', 2, null, true, null, '{}', 'Two knowledge support credits or one major knowledge contribution.', true),
  ('source_curator', 'credit_count', 'source_curation', 3, null, true, null, '{}', 'Three accepted sources or one major source pack/curated collection.', true),
  ('troubleshooting_helper', 'credit_count', 'troubleshooting_resolution', 3, null, false, 2, '{}', 'Three reviewed troubleshooting resolutions across at least two distinct users.', true),
  ('developer_contributor', 'credit_count', 'developer_contribution', 3, null, true, null, '{}', 'Three smaller approved developer contributions or one substantial developer contribution.', true),
  ('founding_steward', 'manual_only', null, null, null, false, null, '{}', 'Manual founding-era recognition only.', true),
  ('guardian_reviewer', 'role_linked', null, null, null, false, null, '{}', 'Role-linked trust/review recognition only; no badge-derived authority.', true),
  ('seed_sower', 'first_eligible_credit', null, 1, null, false, null, array['stewardship_general','stewardship_water','stewardship_forest','stewardship_reef','stewardship_health','knowledge_support','source_curation','troubleshooting_resolution','developer_contribution','bridge_building','archive_maintenance','testing_feedback','field_observation','writing_teaching','art_contribution','accessibility_improvement','boundary_safety'], 'First approved eligible contribution of any type.', true),
  ('bridge_builder', 'credit_count', 'bridge_building', 5, null, false, 3, '{}', 'Five bridge-building actions across at least three distinct users/projects.', true),
  ('archive_warden', 'credit_count', 'archive_maintenance', 5, null, true, null, '{}', 'Five archive/documentation contributions or one major archive project.', true),
  ('forge_tester', 'credit_count', 'testing_feedback', 3, null, true, null, '{}', 'Three accepted test reports or one critical confirmed report that led to a fix.', true),
  ('field_witness', 'credit_count', 'field_observation', 3, null, true, null, '{}', 'Three accepted field observations or one major field record.', true),
  ('radiant_scribe', 'credit_sum', 'writing_teaching', null, 4, true, null, '{}', 'Two substantial writing contributions, five smaller writing contributions, or one major guide/tutorial.', true),
  ('hearth_keeper', 'role_linked', null, null, null, false, null, '{}', 'Role-linked moderation care recognition only; no badge-derived authority.', true),
  ('ecobotics_forgewright', 'manual_only', null, null, null, false, null, '{}', 'Project-lead/manual robotics or physical-system recognition.', true),
  ('elysian_artwright', 'credit_sum', 'art_contribution', null, 3, true, null, '{}', 'One substantial accepted art contribution or three smaller accepted art contributions.', true),
  ('kindred_ally', 'manual_only', null, null, null, false, null, '{}', 'Manual allied-service recognition only.', true),
  ('open_pathmaker', 'credit_count', 'accessibility_improvement', 3, null, true, null, '{}', 'Three access improvements or one major access improvement.', true),
  ('boundary_lantern', 'credit_count', 'boundary_safety', 2, null, true, null, '{}', 'Two boundary/safety improvements or one major risk-prevention contribution.', true)
;

create unique index if not exists badge_rules_one_active_rule on public.badge_rules(badge_slug, rule_type, coalesce(required_credit_type, '')) where is_active = true;

create or replace function public.current_user_can_create_badge_credit()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_user_is_admin()
    or public.current_user_has_role('reviewer'::public.app_role)
    or public.current_user_has_role('guardian_reviewer'::public.app_role)
    or public.current_user_has_role('source_reviewer'::public.app_role)
    or public.current_user_has_role('marketplace_reviewer'::public.app_role)
    or public.current_user_has_role('moderator'::public.app_role)
    or public.current_user_has_role('commune_moderator'::public.app_role);
$$;

create or replace function public.award_badge_if_missing(
  p_target_user_id uuid,
  p_badge_key text,
  p_award_source text,
  p_award_reason text default null,
  p_evidence_type text default null,
  p_evidence_id uuid default null,
  p_actor_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.badge_definitions where badge_key = p_badge_key and is_active = true) then
    return;
  end if;

  insert into public.user_badges (user_id, badge_key, awarded_by, award_source, award_reason, evidence_type, evidence_id, visibility)
  select p_target_user_id, p_badge_key, p_actor_user_id, p_award_source, p_award_reason, p_evidence_type, p_evidence_id, 'public'
  where not exists (
    select 1 from public.user_badges ub
    where ub.user_id = p_target_user_id and ub.badge_key = p_badge_key and ub.revoked_at is null
  );

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, evidence_type, evidence_id, metadata)
  values (p_actor_user_id, p_target_user_id, 'badge_granted', p_badge_key, p_evidence_type, p_evidence_id, jsonb_build_object('award_source', p_award_source, 'award_reason', p_award_reason));
end;
$$;

create or replace function public.grant_free_member_for_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is not null and actor <> p_target_user_id and not public.current_user_is_admin() then
    raise exception 'Only the profile owner or an administrator can initialize Free Member recognition.';
  end if;

  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'Commons Profile is required before Free Member recognition.';
  end if;

  insert into public.badge_credit_events (user_id, credit_type, credit_amount, contribution_type, contribution_id, awarded_by, is_major, notes)
  select p_target_user_id, 'account_membership', 1, 'commons_profile', p_target_user_id, actor, false, 'Commons Profile completed.'
  where not exists (
    select 1 from public.badge_credit_events bce
    where bce.user_id = p_target_user_id
      and bce.credit_type = 'account_membership'
      and bce.contribution_type = 'commons_profile'
      and bce.contribution_id = p_target_user_id
      and bce.revoked_at is null
  );

  perform public.award_badge_if_missing(p_target_user_id, 'free_member', 'automatic', 'Commons Profile completed.', 'commons_profile', p_target_user_id, actor);
  insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, evidence_type, evidence_id)
  values (actor, p_target_user_id, 'free_member_granted', 'free_member', 'commons_profile', p_target_user_id);
end;
$$;

create or replace function public.evaluate_badges_for_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  credit record;
begin
  if actor is not null and actor <> p_target_user_id and not public.current_user_can_create_badge_credit() then
    raise exception 'Badge evaluation is limited to the profile owner or authorized reviewers.';
  end if;

  if exists (select 1 from public.profiles where id = p_target_user_id) then
    perform public.award_badge_if_missing(p_target_user_id, 'free_member', 'automatic', 'Commons Profile completed.', 'commons_profile', p_target_user_id, actor);
  end if;

  if exists (select 1 from public.badge_credit_events where user_id = p_target_user_id and revoked_at is null and credit_type <> 'account_membership') then
    perform public.award_badge_if_missing(p_target_user_id, 'seed_sower', 'credit_rule', 'First approved contribution recorded.', 'badge_rule', null, actor);
  end if;

  for credit in select * from (values
    ('stewardship_supporter','stewardship_general',1,null::integer,false,null::integer,'Approved stewardship support verification.'),
    ('water_steward','stewardship_water',3,null::integer,true,null::integer,'Approved water stewardship credits.'),
    ('forest_steward','stewardship_forest',3,null::integer,true,null::integer,'Approved forest stewardship credits.'),
    ('reef_steward','stewardship_reef',3,null::integer,true,null::integer,'Approved reef/ocean stewardship credits.'),
    ('health_steward','stewardship_health',3,null::integer,true,null::integer,'Approved health stewardship credits.'),
    ('knowledge_commons_supporter','knowledge_support',2,null::integer,true,null::integer,'Approved knowledge commons support credits.'),
    ('source_curator','source_curation',3,null::integer,true,null::integer,'Accepted Living Library source curation credits.'),
    ('troubleshooting_helper','troubleshooting_resolution',3,null::integer,false,2,'Reviewed helpful troubleshooting resolutions.'),
    ('developer_contributor','developer_contribution',3,null::integer,true,null::integer,'Approved developer contribution credits.'),
    ('bridge_builder','bridge_building',5,null::integer,false,3,'Reviewed bridge-building credits.'),
    ('archive_warden','archive_maintenance',5,null::integer,true,null::integer,'Approved archive and documentation maintenance credits.'),
    ('forge_tester','testing_feedback',3,null::integer,true,null::integer,'Accepted testing and release feedback credits.'),
    ('field_witness','field_observation',3,null::integer,true,null::integer,'Accepted field observation credits.'),
    ('radiant_scribe','writing_teaching',null::integer,4,true,null::integer,'Approved writing and teaching credits.'),
    ('elysian_artwright','art_contribution',null::integer,3,true,null::integer,'Accepted art contribution credits.'),
    ('open_pathmaker','accessibility_improvement',3,null::integer,true,null::integer,'Approved accessibility and usability improvement credits.'),
    ('boundary_lantern','boundary_safety',2,null::integer,true,null::integer,'Approved privacy, consent, safety, or boundary improvement credits.')
  ) as rule(badge_key, credit_type, required_count, required_sum, major_shortcut, distinct_min, reason) loop
    if (
      (credit.required_count is not null and (select count(*) from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and revoked_at is null) >= credit.required_count)
      or (credit.required_sum is not null and (select coalesce(sum(credit_amount), 0) from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and revoked_at is null) >= credit.required_sum)
      or (credit.major_shortcut and exists (select 1 from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and is_major = true and revoked_at is null))
    ) and (
      credit.distinct_min is null
      or (select count(distinct distinct_subject_key) from public.badge_credit_events where user_id = p_target_user_id and credit_type = credit.credit_type and revoked_at is null and distinct_subject_key is not null) >= credit.distinct_min
    ) then
      perform public.award_badge_if_missing(p_target_user_id, credit.badge_key, 'credit_rule', credit.reason, 'badge_rule', null, actor);
    end if;
  end loop;

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, metadata)
  values (actor, p_target_user_id, 'rule_evaluated', jsonb_build_object('source', 'evaluate_badges_for_user'));
end;
$$;

create or replace function public.create_badge_credit_event(
  p_target_user_id uuid,
  p_credit_type text,
  p_credit_amount integer,
  p_contribution_type text,
  p_contribution_id uuid default null,
  p_review_item_id uuid default null,
  p_is_major boolean default false,
  p_distinct_subject_key text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  created_id uuid;
begin
  if actor is null or not public.current_user_can_create_badge_credit() then
    raise exception 'Only authorized reviewers or administrators can create badge credits.';
  end if;
  if p_target_user_id = actor and not public.current_user_is_admin() then
    raise exception 'Reviewers cannot award badge credits to themselves.';
  end if;

  insert into public.badge_credit_events (user_id, credit_type, credit_amount, contribution_type, contribution_id, review_item_id, awarded_by, is_major, distinct_subject_key, notes)
  values (p_target_user_id, p_credit_type, greatest(1, least(coalesce(p_credit_amount, 1), 2)), p_contribution_type, p_contribution_id, p_review_item_id, actor, coalesce(p_is_major, false), p_distinct_subject_key, p_notes)
  returning id into created_id;

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, credit_event_id, evidence_type, evidence_id, metadata)
  values (actor, p_target_user_id, 'credit_created', created_id, p_contribution_type, p_contribution_id, jsonb_build_object('credit_type', p_credit_type, 'credit_amount', p_credit_amount, 'is_major', p_is_major));

  perform public.evaluate_badges_for_user(p_target_user_id);
  return created_id;
end;
$$;

create or replace function public.grant_user_badge(
  p_target_user_id uuid,
  p_badge_key text,
  p_award_reason text default null,
  p_evidence_type text default null,
  p_evidence_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can manually grant badges.';
  end if;
  if p_target_user_id = actor then
    raise exception 'Administrators should not manually grant badges to themselves through the public client.';
  end if;

  perform public.award_badge_if_missing(p_target_user_id, p_badge_key, 'manual_admin', p_award_reason, p_evidence_type, p_evidence_id, actor);
  insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, evidence_type, evidence_id, metadata)
  values (actor, p_target_user_id, 'manual_grant', p_badge_key, p_evidence_type, p_evidence_id, jsonb_build_object('award_reason', p_award_reason));
end;
$$;

create or replace function public.revoke_user_badge(
  p_target_user_id uuid,
  p_badge_key text,
  p_revoked_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can revoke badges.';
  end if;

  update public.user_badges
  set revoked_at = now(), revoked_by = actor, revoked_reason = p_revoked_reason, updated_at = now()
  where user_id = p_target_user_id and badge_key = p_badge_key and revoked_at is null;

  insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, metadata)
  values (actor, p_target_user_id, 'badge_revoked', p_badge_key, jsonb_build_object('revoked_reason', p_revoked_reason));
end;
$$;

create or replace function public.revoke_badge_credit_event(
  p_credit_event_id uuid,
  p_revoked_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target_id uuid;
begin
  if actor is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can revoke badge credits.';
  end if;

  update public.badge_credit_events
  set revoked_at = now(), revoked_by = actor, revoked_reason = p_revoked_reason
  where id = p_credit_event_id and revoked_at is null
  returning user_id into target_id;

  if target_id is not null then
    insert into public.badge_audit_log (actor_user_id, target_user_id, action, credit_event_id, metadata)
    values (actor, target_id, 'credit_revoked', p_credit_event_id, jsonb_build_object('revoked_reason', p_revoked_reason));
    perform public.evaluate_badges_for_user(target_id);
  end if;
end;
$$;

create or replace function public.backfill_free_member_badges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row record;
  granted_count integer := 0;
begin
  if auth.uid() is not null and not public.current_user_is_admin() then
    raise exception 'Only administrators can backfill Free Member badges.';
  end if;

  for profile_row in select id from public.profiles loop
    perform public.award_badge_if_missing(profile_row.id, 'free_member', 'automatic_backfill', 'Existing Commons Profile backfill.', 'commons_profile', profile_row.id, auth.uid());
    insert into public.badge_credit_events (user_id, credit_type, credit_amount, contribution_type, contribution_id, awarded_by, notes)
    select profile_row.id, 'account_membership', 1, 'commons_profile', profile_row.id, auth.uid(), 'Existing Commons Profile backfill.'
    where not exists (
      select 1 from public.badge_credit_events bce
      where bce.user_id = profile_row.id
        and bce.credit_type = 'account_membership'
        and bce.contribution_type = 'commons_profile'
        and bce.contribution_id = profile_row.id
        and bce.revoked_at is null
    );
    granted_count := granted_count + 1;
  end loop;
  return granted_count;
end;
$$;

select public.backfill_free_member_badges();

alter table public.badge_definitions enable row level security;
alter table public.user_badges enable row level security;
alter table public.badge_credit_events enable row level security;
alter table public.badge_rules enable row level security;
alter table public.badge_audit_log enable row level security;

drop policy if exists "public reads active badge definitions" on public.badge_definitions;
create policy "public reads active badge definitions" on public.badge_definitions for select using (is_active = true);
drop policy if exists "admins manage badge definitions" on public.badge_definitions;
create policy "admins manage badge definitions" on public.badge_definitions for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public reads visible user badges" on public.user_badges;
create policy "public reads visible user badges" on public.user_badges for select using (visibility = 'public' and revoked_at is null);
drop policy if exists "users read own badges" on public.user_badges;
create policy "users read own badges" on public.user_badges for select to authenticated using (user_id = auth.uid() and revoked_at is null);
drop policy if exists "users update own badge visibility" on public.user_badges;
create policy "users update own badge visibility" on public.user_badges for update to authenticated using (user_id = auth.uid() and revoked_at is null) with check (user_id = auth.uid() and revoked_at is null);
drop policy if exists "admins award badges" on public.user_badges;
drop policy if exists "admins manage badges" on public.user_badges;
create policy "admins read all user badges" on public.user_badges for select to authenticated using (public.current_user_is_admin() or public.current_user_can_create_badge_credit());

drop policy if exists "reviewers read badge credit events" on public.badge_credit_events;
create policy "reviewers read badge credit events" on public.badge_credit_events for select to authenticated using (public.current_user_is_admin() or public.current_user_can_create_badge_credit());
drop policy if exists "reviewers read badge rules" on public.badge_rules;
create policy "reviewers read badge rules" on public.badge_rules for select to authenticated using (public.current_user_is_admin() or public.current_user_can_create_badge_credit());
drop policy if exists "admins manage badge rules" on public.badge_rules;
create policy "admins manage badge rules" on public.badge_rules for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "reviewers read badge audit log" on public.badge_audit_log;
create policy "reviewers read badge audit log" on public.badge_audit_log for select to authenticated using (public.current_user_is_admin() or public.current_user_can_create_badge_credit());

revoke all on table public.user_badges from anon, authenticated;
grant select on table public.user_badges to anon, authenticated;
grant update(visibility, updated_at) on table public.user_badges to authenticated;
grant select on table public.badge_definitions to anon, authenticated;
grant select on table public.badge_credit_events to authenticated;
grant select on table public.badge_rules to authenticated;
grant select on table public.badge_audit_log to authenticated;

revoke all on function public.award_badge_if_missing(uuid, text, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.current_user_can_create_badge_credit() to authenticated;
grant execute on function public.evaluate_badges_for_user(uuid) to authenticated;
grant execute on function public.grant_free_member_for_user(uuid) to authenticated;
grant execute on function public.create_badge_credit_event(uuid, text, integer, text, uuid, uuid, boolean, text, text) to authenticated;
grant execute on function public.grant_user_badge(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.revoke_user_badge(uuid, text, text) to authenticated;
grant execute on function public.revoke_badge_credit_event(uuid, text) to authenticated;
grant execute on function public.backfill_free_member_badges() to authenticated;

-- Free Member badge repair/backfill.
-- This migration awards only Free Member recognition to existing website profiles and keeps badges separate from authority.

create extension if not exists pgcrypto;

insert into public.badge_definitions (badge_key, name, description, badge_type, icon_path, category, rarity, sort_order, authority_linked, award_mode, rule_summary, is_manual_only, is_active)
values ('free_member', 'Free Member', 'Default recognition for joining the public website commons.', 'member', '/images/badges/Free_Member.png', 'membership', 'common', 1, false, 'automatic', 'Granted when a Website Account has a Commons Profile.', false, true)
on conflict (badge_key) do update set
  name = excluded.name,
  description = excluded.description,
  badge_type = excluded.badge_type,
  icon_path = excluded.icon_path,
  category = excluded.category,
  rarity = excluded.rarity,
  sort_order = excluded.sort_order,
  authority_linked = excluded.authority_linked,
  award_mode = excluded.award_mode,
  rule_summary = excluded.rule_summary,
  is_manual_only = excluded.is_manual_only,
  is_active = true,
  updated_at = now();

create or replace function public.grant_free_member_for_user(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  inserted_badge_id uuid;
  inserted_credit_id uuid;
begin
  if actor is not null and actor <> p_target_user_id and not public.current_user_is_admin() then
    raise exception 'Only the profile owner or an administrator can initialize Free Member recognition.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = p_target_user_id
  ) then
    raise exception 'A Website Account with a Commons Profile is required before Free Member recognition.';
  end if;

  insert into public.badge_credit_events (user_id, credit_type, credit_amount, contribution_type, contribution_id, awarded_by, is_major, notes)
  select p_target_user_id, 'account_membership', 1, 'commons_profile', p_target_user_id, actor, false, 'Free membership recognition for a completed Commons profile.'
  where to_regclass('public.badge_credit_events') is not null
    and not exists (
      select 1
      from public.badge_credit_events bce
      where bce.user_id = p_target_user_id
        and bce.credit_type = 'account_membership'
        and bce.contribution_type = 'commons_profile'
        and bce.contribution_id = p_target_user_id
        and bce.revoked_at is null
    )
  returning id into inserted_credit_id;

  insert into public.user_badges (user_id, badge_key, awarded_by, awarded_at, award_source, award_reason, evidence_type, evidence_id, visibility)
  select p_target_user_id, 'free_member', actor, now(), 'automatic', 'Free membership recognition for a completed Commons profile.', 'commons_profile', p_target_user_id, 'public'
  where not exists (
    select 1
    from public.user_badges ub
    where ub.user_id = p_target_user_id
      and ub.badge_key = 'free_member'
      and ub.revoked_at is null
  )
  returning id into inserted_badge_id;

  if inserted_badge_id is not null and to_regclass('public.badge_audit_log') is not null then
    insert into public.badge_audit_log (actor_user_id, target_user_id, action, badge_slug, credit_event_id, evidence_type, evidence_id, metadata)
    values (actor, p_target_user_id, 'free_member_granted', 'free_member', inserted_credit_id, 'commons_profile', p_target_user_id, jsonb_build_object('award_source', 'automatic'));
  end if;
end;
$$;

create or replace function public.backfill_free_member_badges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row record;
  granted_count integer := 0;
  had_badge boolean;
begin
  if auth.uid() is not null and not public.current_user_is_admin() then
    raise exception 'Only administrators can backfill Free Member badges.';
  end if;

  for profile_row in
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
  loop
    select exists (
      select 1 from public.user_badges ub
      where ub.user_id = profile_row.id
        and ub.badge_key = 'free_member'
        and ub.revoked_at is null
    ) into had_badge;

    perform public.grant_free_member_for_user(profile_row.id);

    if not had_badge then
      granted_count := granted_count + 1;
    end if;
  end loop;

  return granted_count;
end;
$$;

select public.backfill_free_member_badges();

grant execute on function public.grant_free_member_for_user(uuid) to authenticated;
grant execute on function public.backfill_free_member_badges() to authenticated;

-- Developer Forge full safe foundation.
-- The Forge prepares add-ons for review. It does not install, execute, or publish add-ons.

create table if not exists public.developer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  developer_slug text unique,
  display_name text not null,
  bio text,
  website_url text,
  github_url text,
  support_url text,
  contact_email text,
  status text not null default 'draft',
  verified_at timestamptz,
  suspended_at timestamptz,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint developer_profiles_status_check check (status in ('draft','requested','active','trusted','suspended','revoked'))
);

create table if not exists public.addon_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  developer_profile_id uuid references public.developer_profiles(id) on delete set null,
  addon_slug text,
  addon_name text,
  short_summary text,
  long_description text,
  version text,
  license text,
  homepage_url text,
  source_url text,
  support_url text,
  category text,
  tags text[] default '{}',
  icon_path text,
  manifest_json jsonb not null default '{}'::jsonb,
  package_file_path text,
  compatibility_targets jsonb default '{}'::jsonb,
  permission_summary text,
  risk_level text not null default 'unknown',
  validation_status text not null default 'not_validated',
  package_status text not null default 'not_uploaded',
  submission_status text not null default 'draft',
  review_status text not null default 'not_submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  constraint addon_drafts_submission_status_check check (submission_status in ('draft','validating','ready_to_submit','submitted','changes_requested','approved','published','rejected','withdrawn','archived','security_hold')),
  constraint addon_drafts_validation_status_check check (validation_status in ('not_validated','valid','warnings','errors')),
  constraint addon_drafts_package_status_check check (package_status in ('not_uploaded','metadata_only','uploaded','scan_warning','scan_blocked')),
  constraint addon_drafts_review_status_check check (review_status in ('not_submitted','pending','changes_requested','approved','rejected','security_hold','withdrawn','published'))
);

create table if not exists public.addon_packages (
  id uuid primary key default gen_random_uuid(),
  addon_draft_id uuid not null references public.addon_drafts(id) on delete cascade,
  version text,
  storage_path text,
  file_name text,
  file_size bigint,
  sha256 text,
  package_format_version text default '0.1',
  scan_status text not null default 'not_scanned',
  signature_status text not null default 'unsigned',
  created_at timestamptz not null default now(),
  constraint addon_packages_scan_status_check check (scan_status in ('not_scanned','passed','warning','blocked')),
  constraint addon_packages_signature_status_check check (signature_status in ('unsigned','pending','signed','signature_failed'))
);

create table if not exists public.addon_validation_results (
  id uuid primary key default gen_random_uuid(),
  addon_draft_id uuid not null references public.addon_drafts(id) on delete cascade,
  severity text not null,
  code text not null,
  message text not null,
  field_path text,
  fix_suggestion text,
  created_at timestamptz not null default now(),
  constraint addon_validation_results_severity_check check (severity in ('error','warning','info'))
);

create table if not exists public.addon_permission_catalog (
  permission_key text primary key,
  title text not null,
  description text not null,
  risk_level text not null,
  requires_user_approval boolean not null default true,
  requires_reviewer_approval boolean not null default false,
  requires_local_runtime_gate boolean not null default true,
  allowed_scope_format text,
  examples text[] default '{}',
  blocked_examples text[] default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addon_permission_catalog_risk_check check (risk_level in ('low','medium','high','blocked'))
);

create table if not exists public.addon_draft_permissions (
  id uuid primary key default gen_random_uuid(),
  addon_draft_id uuid not null references public.addon_drafts(id) on delete cascade,
  permission_key text not null references public.addon_permission_catalog(permission_key),
  reason text,
  scope_json jsonb default '{}'::jsonb,
  risk_acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(addon_draft_id, permission_key)
);

create table if not exists public.addon_submissions (
  id uuid primary key default gen_random_uuid(),
  addon_draft_id uuid not null references public.addon_drafts(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  review_item_id uuid references public.review_items(id) on delete set null,
  review_summary text,
  reviewer_feedback text,
  updated_at timestamptz not null default now(),
  constraint addon_submissions_status_check check (status in ('pending','changes_requested','approved','rejected','security_hold','withdrawn','published'))
);

create table if not exists public.addon_compatibility_results (
  id uuid primary key default gen_random_uuid(),
  addon_draft_id uuid references public.addon_drafts(id) on delete cascade,
  addon_package_id uuid references public.addon_packages(id) on delete set null,
  elysia_version text,
  addon_api_version text,
  os text,
  status text not null,
  warnings text[] default '{}',
  errors text[] default '{}',
  created_at timestamptz not null default now(),
  constraint addon_compatibility_results_status_check check (status in ('compatible','warning','incompatible','unknown'))
);

create table if not exists public.addon_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_type text not null,
  target_id uuid,
  action text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists addon_drafts_owner_idx on public.addon_drafts(owner_user_id, updated_at desc);
create index if not exists addon_submissions_submitter_idx on public.addon_submissions(submitted_by, submitted_at desc);
create index if not exists addon_packages_draft_idx on public.addon_packages(addon_draft_id, created_at desc);
create index if not exists addon_validation_results_draft_idx on public.addon_validation_results(addon_draft_id, created_at desc);

insert into public.addon_permission_catalog (permission_key, title, description, risk_level, requires_user_approval, requires_reviewer_approval, requires_local_runtime_gate, allowed_scope_format, examples, blocked_examples) values
  ('theme_assets_read','Theme assets read','Read public theme or visual assets bundled with the add-on.','low',false,false,true,'bundled asset paths only',array['assets/theme.css','assets/icon.png'],array['/home/user/.ssh/id_rsa']),
  ('marketplace_metadata_read','Marketplace metadata read','Read public Marketplace catalog metadata.','low',false,false,true,'public catalog records',array['addon name','published version'],array['private draft package']),
  ('living_library_metadata_read','Living Library metadata read','Read public Living Library source metadata.','low',false,false,true,'public source records',array['source title','official URL'],array['private user collections']),
  ('public_docs_read','Public docs read','Read public Elysia Ecobotics documentation.','low',false,false,true,'public documentation paths',array['manifest reference'],array['private local logs']),
  ('network_declared_domains','Network to declared domains','Request network access only to explicitly declared domains.','medium',true,true,true,'array of HTTPS domains',array['https://api.example.org'],array['http://localhost:3000','*']),
  ('user_selected_file_read','Read user-selected file','Read a file the user explicitly picks in local Elysia.','medium',true,true,true,'local user picker grant',array['a selected CSV file'],array['silent home directory scan']),
  ('user_selected_file_write','Write user-selected file','Write only to a file/location the user explicitly picks in local Elysia.','medium',true,true,true,'local user picker grant',array['exported report.md'],array['overwrite arbitrary system file']),
  ('project_folder_read','Read approved project folder','Read a project folder after explicit local approval.','high',true,true,true,'local approved project folder',array['selected add-on project folder'],array['/home','C:\\Users']),
  ('project_folder_write','Write approved project folder','Write inside a project folder after explicit local approval.','high',true,true,true,'local approved project folder',array['selected project output folder'],array['system directories']),
  ('local_model_request','Local model request','Request local model inference through an approved local router.','high',true,true,true,'local model router scope',array['summarize selected text'],array['silent private memory access']),
  ('sandboxed_worker','Sandboxed worker','Run bounded work only inside a future reviewed local sandbox.','high',true,true,true,'reviewed sandbox profile',array['validation-only local worker'],array['shell without sandbox']),
  ('vault_access','Vault access','Blocked. Add-ons may not access private vaults.','blocked',true,true,true,'blocked',array[]::text[],array['read vault secrets']),
  ('credential_access','Credential access','Blocked. Add-ons may not access credentials or tokens.','blocked',true,true,true,'blocked',array[]::text[],array['read API keys']),
  ('private_memory_access','Private memory access','Blocked. Add-ons may not access private local Elysia memory by default.','blocked',true,true,true,'blocked',array[]::text[],array['read private memories']),
  ('silent_shell_execution','Silent shell execution','Blocked. Add-ons may not run shell commands silently.','blocked',true,true,true,'blocked',array[]::text[],array['postinstall shell script']),
  ('read_all_files','Read all files','Blocked. Broad filesystem access is not allowed.','blocked',true,true,true,'blocked',array[]::text[],array['read entire home directory']),
  ('write_arbitrary_files','Write arbitrary files','Blocked. Broad arbitrary writes are not allowed.','blocked',true,true,true,'blocked',array[]::text[],array['write to system paths']),
  ('silent_network_access','Silent network access','Blocked. Network access must be declared and locally approved.','blocked',true,true,true,'blocked',array[]::text[],array['send data to hidden endpoint']),
  ('silent_install','Silent install','Blocked. The website cannot install or enable add-ons.','blocked',true,true,true,'blocked',array[]::text[],array['install without local Elysia review'])
on conflict (permission_key) do update set
  title = excluded.title,
  description = excluded.description,
  risk_level = excluded.risk_level,
  requires_user_approval = excluded.requires_user_approval,
  requires_reviewer_approval = excluded.requires_reviewer_approval,
  requires_local_runtime_gate = excluded.requires_local_runtime_gate,
  allowed_scope_format = excluded.allowed_scope_format,
  examples = excluded.examples,
  blocked_examples = excluded.blocked_examples,
  is_active = true,
  updated_at = now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('addon-icons','addon-icons',true,5242880,array['image/png','image/jpeg','image/webp']),
  ('addon-listing-assets','addon-listing-assets',true,10485760,array['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/markdown']),
  ('addon-packages','addon-packages',false,52428800,array['application/octet-stream','application/zip','application/x-zip-compressed']),
  ('addon-review-attachments','addon-review-attachments',false,10485760,array['application/pdf','text/plain','text/markdown','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.developer_profiles enable row level security;
alter table public.addon_drafts enable row level security;
alter table public.addon_packages enable row level security;
alter table public.addon_validation_results enable row level security;
alter table public.addon_permission_catalog enable row level security;
alter table public.addon_draft_permissions enable row level security;
alter table public.addon_submissions enable row level security;
alter table public.addon_compatibility_results enable row level security;
alter table public.addon_audit_log enable row level security;

drop policy if exists "public reads active developer profiles" on public.developer_profiles;
create policy "public reads active developer profiles" on public.developer_profiles for select using (status in ('active','trusted'));
drop policy if exists "users create own developer profile" on public.developer_profiles;
create policy "users create own developer profile" on public.developer_profiles for insert to authenticated with check (user_id = auth.uid() and status in ('draft','requested'));
drop policy if exists "users read own developer profile" on public.developer_profiles;
create policy "users read own developer profile" on public.developer_profiles for select to authenticated using (user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain));
drop policy if exists "users update own safe developer profile" on public.developer_profiles;
create policy "users update own safe developer profile" on public.developer_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and status in ('draft','requested'));
drop policy if exists "reviewers manage developer profiles" on public.developer_profiles;
create policy "reviewers manage developer profiles" on public.developer_profiles for all to authenticated using (public.current_user_can_review_domain('marketplace'::public.review_domain)) with check (public.current_user_can_review_domain('marketplace'::public.review_domain));

drop policy if exists "public reads active permission catalog" on public.addon_permission_catalog;
create policy "public reads active permission catalog" on public.addon_permission_catalog for select using (is_active = true);
drop policy if exists "admins manage permission catalog" on public.addon_permission_catalog;
create policy "admins manage permission catalog" on public.addon_permission_catalog for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "users manage own addon drafts" on public.addon_drafts;
create policy "users manage own addon drafts" on public.addon_drafts for all to authenticated using (owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain)) with check (owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain));

drop policy if exists "users read own addon packages" on public.addon_packages;
create policy "users read own addon packages" on public.addon_packages for select to authenticated using (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and (d.owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain))));
drop policy if exists "users create own addon packages" on public.addon_packages;
create policy "users create own addon packages" on public.addon_packages for insert to authenticated with check (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));

drop policy if exists "users read own validation results" on public.addon_validation_results;
create policy "users read own validation results" on public.addon_validation_results for select to authenticated using (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and (d.owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain))));
drop policy if exists "users write own validation results" on public.addon_validation_results;
create policy "users write own validation results" on public.addon_validation_results for insert to authenticated with check (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));
drop policy if exists "users delete own validation results" on public.addon_validation_results;
create policy "users delete own validation results" on public.addon_validation_results for delete to authenticated using (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));

drop policy if exists "users manage own addon permissions" on public.addon_draft_permissions;
create policy "users manage own addon permissions" on public.addon_draft_permissions for all to authenticated using (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and (d.owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain)))) with check (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));

drop policy if exists "users read own submissions" on public.addon_submissions;
create policy "users read own submissions" on public.addon_submissions for select to authenticated using (submitted_by = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain));
drop policy if exists "users create own submissions" on public.addon_submissions;
create policy "users create own submissions" on public.addon_submissions for insert to authenticated with check (submitted_by = auth.uid() and exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));
drop policy if exists "reviewers update submissions" on public.addon_submissions;
create policy "reviewers update submissions" on public.addon_submissions for update to authenticated using (public.current_user_can_review_domain('marketplace'::public.review_domain)) with check (public.current_user_can_review_domain('marketplace'::public.review_domain));

drop policy if exists "users read own compatibility" on public.addon_compatibility_results;
create policy "users read own compatibility" on public.addon_compatibility_results for select to authenticated using (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and (d.owner_user_id = auth.uid() or public.current_user_can_review_domain('marketplace'::public.review_domain))));
drop policy if exists "users write own compatibility" on public.addon_compatibility_results;
create policy "users write own compatibility" on public.addon_compatibility_results for insert to authenticated with check (exists (select 1 from public.addon_drafts d where d.id = addon_draft_id and d.owner_user_id = auth.uid()));

drop policy if exists "reviewers read addon audit log" on public.addon_audit_log;
create policy "reviewers read addon audit log" on public.addon_audit_log for select to authenticated using (public.current_user_can_review_domain('marketplace'::public.review_domain));
drop policy if exists "users create own addon audit events" on public.addon_audit_log;
create policy "users create own addon audit events" on public.addon_audit_log for insert to authenticated with check (actor_user_id = auth.uid());

drop policy if exists "developers upload own addon packages" on storage.objects;
create policy "developers upload own addon packages" on storage.objects for insert to authenticated with check (bucket_id = 'addon-packages' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "developers read own addon packages" on storage.objects;
create policy "developers read own addon packages" on storage.objects for select to authenticated using (bucket_id = 'addon-packages' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "reviewers read addon packages" on storage.objects;
create policy "reviewers read addon packages" on storage.objects for select to authenticated using (bucket_id = 'addon-packages' and public.current_user_can_review_domain('marketplace'::public.review_domain));
drop policy if exists "developers upload own addon icons" on storage.objects;
create policy "developers upload own addon icons" on storage.objects for insert to authenticated with check (bucket_id in ('addon-icons','addon-listing-assets') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "public reads published addon assets" on storage.objects;
create policy "public reads published addon assets" on storage.objects for select using (bucket_id in ('addon-icons','addon-listing-assets'));

grant select, insert, update on table public.developer_profiles to authenticated;
grant select on table public.developer_profiles to anon;
grant select, insert, update on table public.addon_drafts to authenticated;
grant select, insert on table public.addon_packages to authenticated;
grant select, insert, delete on table public.addon_validation_results to authenticated;
grant select on table public.addon_permission_catalog to anon, authenticated;
grant insert, update, delete on table public.addon_permission_catalog to authenticated;
grant select, insert, update, delete on table public.addon_draft_permissions to authenticated;
grant select, insert, update on table public.addon_submissions to authenticated;
grant select, insert on table public.addon_compatibility_results to authenticated;
grant select, insert on table public.addon_audit_log to authenticated;


-- Admin moderation completion pass.
-- Adds safe, idempotent queue foundations for reports, library source review,
-- work/role review, and admin audit summaries.

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  target_type text not null,
  target_id text not null,
  reason text not null,
  details text,
  status text not null default 'submitted',
  assigned_to uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint content_reports_status_check check (status in ('submitted','under_review','action_taken','dismissed','archived'))
);

create index if not exists content_reports_status_created_idx on public.content_reports(status, created_at desc);
create index if not exists content_reports_target_idx on public.content_reports(target_type, target_id);
create index if not exists content_reports_reporter_idx on public.content_reports(reporter_user_id, created_at desc);

create table if not exists public.library_source_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id) on delete set null,
  title text not null,
  official_url text,
  category text,
  notes text,
  license_notes text,
  privacy_notes text,
  status text not null default 'submitted',
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint library_source_submissions_status_check check (status in ('draft','submitted','published','flagged','hidden','removed','archived','revoked'))
);

create index if not exists library_source_submissions_status_idx on public.library_source_submissions(status, created_at desc);
create index if not exists library_source_submissions_submitter_idx on public.library_source_submissions(submitted_by, created_at desc);

create table if not exists public.work_role_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id) on delete set null,
  role_type text not null,
  display_name text,
  contact_email text,
  summary text,
  status text not null default 'submitted',
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint work_role_submissions_status_check check (status in ('draft','submitted','published','flagged','hidden','removed','archived','revoked'))
);

create index if not exists work_role_submissions_status_idx on public.work_role_submissions(status, created_at desc);
create index if not exists work_role_submissions_submitter_idx on public.work_role_submissions(submitted_by, created_at desc);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log(target_type, target_id);

alter table public.content_reports enable row level security;
alter table public.library_source_submissions enable row level security;
alter table public.work_role_submissions enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "public creates content reports" on public.content_reports;
create policy "public creates content reports" on public.content_reports for insert to anon, authenticated
with check (reporter_user_id is null or reporter_user_id = auth.uid());

drop policy if exists "reporters read own content reports" on public.content_reports;
create policy "reporters read own content reports" on public.content_reports for select to authenticated
using (reporter_user_id = auth.uid());

drop policy if exists "reviewers manage content reports" on public.content_reports;
create policy "reviewers manage content reports" on public.content_reports for all to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_role('reviewer')
  or public.current_user_has_role('moderator')
  or public.current_user_has_role('commune_moderator')
  or public.current_user_has_role('marketplace_reviewer')
  or public.current_user_has_role('source_reviewer')
  or public.current_user_has_role('guardian_reviewer')
)
with check (
  public.current_user_is_admin()
  or public.current_user_has_role('reviewer')
  or public.current_user_has_role('moderator')
  or public.current_user_has_role('commune_moderator')
  or public.current_user_has_role('marketplace_reviewer')
  or public.current_user_has_role('source_reviewer')
  or public.current_user_has_role('guardian_reviewer')
);

drop policy if exists "public reads published library source submissions" on public.library_source_submissions;
create policy "public reads published library source submissions" on public.library_source_submissions for select
using (status = 'published');

drop policy if exists "users manage own library source submissions" on public.library_source_submissions;
create policy "users manage own library source submissions" on public.library_source_submissions for all to authenticated
using (submitted_by = auth.uid())
with check (submitted_by = auth.uid() and status in ('draft','submitted'));

drop policy if exists "source reviewers manage library source submissions" on public.library_source_submissions;
create policy "source reviewers manage library source submissions" on public.library_source_submissions for all to authenticated
using (public.current_user_can_review_domain('living_library_source'::public.review_domain))
with check (public.current_user_can_review_domain('living_library_source'::public.review_domain));

drop policy if exists "users read own work role submissions" on public.work_role_submissions;
create policy "users read own work role submissions" on public.work_role_submissions for select to authenticated
using (submitted_by = auth.uid());

drop policy if exists "users create own work role submissions" on public.work_role_submissions;
create policy "users create own work role submissions" on public.work_role_submissions for insert to authenticated
with check (submitted_by = auth.uid() and status in ('draft','submitted'));

drop policy if exists "work reviewers manage work role submissions" on public.work_role_submissions;
create policy "work reviewers manage work role submissions" on public.work_role_submissions for all to authenticated
using (public.current_user_can_review_domain('work_with'::public.review_domain))
with check (public.current_user_can_review_domain('work_with'::public.review_domain));

drop policy if exists "reviewers read admin audit log" on public.admin_audit_log;
create policy "reviewers read admin audit log" on public.admin_audit_log for select to authenticated
using (
  public.current_user_is_admin()
  or public.current_user_has_role('reviewer')
  or public.current_user_has_role('moderator')
  or public.current_user_has_role('commune_moderator')
  or public.current_user_has_role('marketplace_reviewer')
  or public.current_user_has_role('source_reviewer')
  or public.current_user_has_role('guardian_reviewer')
);

drop policy if exists "reviewers create admin audit log" on public.admin_audit_log;
create policy "reviewers create admin audit log" on public.admin_audit_log for insert to authenticated
with check (
  actor_user_id = auth.uid()
  and (
    public.current_user_is_admin()
    or public.current_user_has_role('reviewer')
    or public.current_user_has_role('moderator')
    or public.current_user_has_role('commune_moderator')
    or public.current_user_has_role('marketplace_reviewer')
    or public.current_user_has_role('source_reviewer')
    or public.current_user_has_role('guardian_reviewer')
  )
);

grant select, insert, update on table public.content_reports to authenticated;
grant insert on table public.content_reports to anon;
grant select, insert, update on table public.library_source_submissions to authenticated;
grant select on table public.library_source_submissions to anon;
grant select, insert, update on table public.work_role_submissions to authenticated;
grant select, insert on table public.admin_audit_log to authenticated;


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


-- Policy snapshot append: marketplace publish/revoke pipeline (2026_06_13).
-- Marketplace publish/revoke pipeline for reviewed Developer Forge submissions.
-- Website publication remains a catalog/review action only. Local Elysia remains the
-- final installer/runtime/permission authority, and package inspection never
-- executes uploaded code.

create extension if not exists pgcrypto;

alter table public.addon_submissions
  add column if not exists reviewer_feedback text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  addon_id text unique not null,
  developer_profile_id uuid references public.developer_profiles(id) on delete set null,
  source_submission_id uuid references public.addon_submissions(id) on delete set null,
  name text not null,
  slug text unique not null,
  summary text,
  description text,
  category text,
  tags text[] default '{}',
  icon_url text,
  current_version text,
  listing_status text not null default 'draft',
  risk_level text default 'unknown',
  permission_summary text,
  compatibility_summary text,
  published_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_listings_status_check check (listing_status in ('draft','submitted','approved','published','hidden','removed','archived','revoked'))
);

create table if not exists public.marketplace_addon_versions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  version text not null,
  manifest_json jsonb not null default '{}'::jsonb,
  package_id uuid references public.addon_packages(id) on delete set null,
  package_sha256 text,
  package_size bigint,
  signature_status text not null default 'unsigned',
  compatibility_status text default 'unknown',
  review_status text default 'approved',
  published_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_addon_versions_signature_check check (signature_status in ('unsigned','pending','signed','signature_failed')),
  constraint marketplace_addon_versions_review_check check (review_status in ('pending','changes_requested','approved','rejected','security_hold','published','revoked'))
);

alter table public.marketplace_addon_versions
  add column if not exists listing_id uuid references public.marketplace_listings(id) on delete cascade,
  add column if not exists version text,
  add column if not exists manifest_json jsonb not null default '{}'::jsonb,
  add column if not exists package_id uuid references public.addon_packages(id) on delete set null,
  add column if not exists package_sha256 text,
  add column if not exists package_size bigint,
  add column if not exists signature_status text not null default 'unsigned',
  add column if not exists compatibility_status text default 'unknown',
  add column if not exists review_status text default 'approved',
  add column if not exists published_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists marketplace_addon_versions_listing_version_idx on public.marketplace_addon_versions(listing_id, version);
create index if not exists marketplace_listings_status_idx on public.marketplace_listings(listing_status, revoked_at);

create table if not exists public.marketplace_publication_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.marketplace_listings(id) on delete cascade,
  addon_version_id uuid references public.marketplace_addon_versions(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  note text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint marketplace_publication_events_action_check check (action in ('approved','published','revoked','hidden','removed','archived','restored','changes_requested','rejected','security_hold'))
);

alter table public.marketplace_revocations
  add column if not exists listing_id uuid references public.marketplace_listings(id) on delete cascade,
  add column if not exists marketplace_addon_version_id uuid references public.marketplace_addon_versions(id) on delete set null,
  add column if not exists revoked_by_user uuid references auth.users(id) on delete set null,
  add column if not exists public_notice text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz;

alter table public.marketplace_install_intents
  add column if not exists listing_id uuid references public.marketplace_listings(id) on delete set null,
  add column if not exists marketplace_addon_version_id uuid references public.marketplace_addon_versions(id) on delete set null;

alter table public.marketplace_listings enable row level security;
alter table public.marketplace_addon_versions enable row level security;
alter table public.marketplace_publication_events enable row level security;
alter table public.marketplace_revocations enable row level security;
alter table public.marketplace_install_intents enable row level security;

drop policy if exists "public reads published marketplace listings" on public.marketplace_listings;
create policy "public reads published marketplace listings" on public.marketplace_listings for select
  using (listing_status = 'published' and revoked_at is null);

drop policy if exists "developers read own marketplace listings" on public.marketplace_listings;
create policy "developers read own marketplace listings" on public.marketplace_listings for select to authenticated
  using (exists (select 1 from public.addon_submissions s where s.id = source_submission_id and s.submitted_by = auth.uid()));

drop policy if exists "marketplace reviewers manage marketplace listings" on public.marketplace_listings;
create policy "marketplace reviewers manage marketplace listings" on public.marketplace_listings for all to authenticated
  using (public.current_user_can_review_domain('marketplace'))
  with check (public.current_user_can_review_domain('marketplace'));

drop policy if exists "public reads published marketplace versions" on public.marketplace_addon_versions;
create policy "public reads published marketplace versions" on public.marketplace_addon_versions for select
  using (revoked_at is null and exists (select 1 from public.marketplace_listings ml where ml.id = listing_id and ml.listing_status = 'published' and ml.revoked_at is null));

drop policy if exists "developers read own marketplace versions" on public.marketplace_addon_versions;
create policy "developers read own marketplace versions" on public.marketplace_addon_versions for select to authenticated
  using (exists (select 1 from public.marketplace_listings ml join public.addon_submissions s on s.id = ml.source_submission_id where ml.id = listing_id and s.submitted_by = auth.uid()));

drop policy if exists "marketplace reviewers manage marketplace versions" on public.marketplace_addon_versions;
create policy "marketplace reviewers manage marketplace versions" on public.marketplace_addon_versions for all to authenticated
  using (public.current_user_can_review_domain('marketplace'))
  with check (public.current_user_can_review_domain('marketplace'));

drop policy if exists "marketplace reviewers read publication events" on public.marketplace_publication_events;
create policy "marketplace reviewers read publication events" on public.marketplace_publication_events for select to authenticated
  using (public.current_user_can_review_domain('marketplace'));

drop policy if exists "marketplace reviewers write publication events" on public.marketplace_publication_events;
create policy "marketplace reviewers write publication events" on public.marketplace_publication_events for insert to authenticated
  with check (public.current_user_can_review_domain('marketplace'));

drop policy if exists "public reads active marketplace revocations" on public.marketplace_revocations;
drop policy if exists "public revocations readable" on public.marketplace_revocations;
create policy "public reads active marketplace revocations" on public.marketplace_revocations for select
  using (is_active = true);

drop policy if exists "marketplace reviewers manage revocations" on public.marketplace_revocations;
create policy "marketplace reviewers manage revocations" on public.marketplace_revocations for all to authenticated
  using (public.current_user_can_review_domain('marketplace'))
  with check (public.current_user_can_review_domain('marketplace'));

drop policy if exists "users insert own install intents" on public.marketplace_install_intents;
drop policy if exists "users create own install intents" on public.marketplace_install_intents;
create policy "users insert own install intents" on public.marketplace_install_intents for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      listing_id is null
      or exists (select 1 from public.marketplace_listings ml where ml.id = listing_id and ml.listing_status = 'published' and ml.revoked_at is null)
    )
    and (
      marketplace_addon_version_id is null
      or exists (
        select 1 from public.marketplace_addon_versions mav
        join public.marketplace_listings ml on ml.id = mav.listing_id
        where mav.id = marketplace_addon_version_id
          and mav.revoked_at is null
          and ml.listing_status = 'published'
          and ml.revoked_at is null
      )
    )
  );

grant select on table public.marketplace_listings to anon, authenticated;
grant select on table public.marketplace_addon_versions to anon, authenticated;
grant select on table public.marketplace_revocations to anon, authenticated;
grant select, insert, update, delete on table public.marketplace_listings to authenticated;
grant select, insert, update, delete on table public.marketplace_addon_versions to authenticated;
grant select, insert on table public.marketplace_publication_events to authenticated;
grant select, insert, update on table public.marketplace_revocations to authenticated;
grant select, insert, update on table public.marketplace_install_intents to authenticated;


-- Policy snapshot append: add-on archive inspection metadata (2026_06_14).
-- Developer Forge archive inspection metadata.
-- Stores inert static/archive inspection summaries for reviewer display only.

alter table public.addon_packages
  add column if not exists archive_inspection_json jsonb not null default '{}'::jsonb,
  add column if not exists scan_summary text;
-- Pass 3: governed Commune realtime chat foundation.
-- Chat is plain text, signed-in for posting, reportable, and moderator controlled.

create table if not exists public.commune_realtime_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  visibility_state text not null default 'published',
  posting_mode text not null default 'open_signed_in',
  slow_mode_seconds integer not null default 15,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commune_realtime_rooms_visibility_check check (visibility_state in ('published','hidden','archived','removed')),
  constraint commune_realtime_rooms_posting_mode_check check (posting_mode in ('open_signed_in','members_only','read_only','moderated','disabled')),
  constraint commune_realtime_rooms_slow_mode_check check (slow_mode_seconds >= 0 and slow_mode_seconds <= 3600)
);

insert into public.commune_realtime_rooms (slug, title, description, posting_mode, slow_mode_seconds) values
  ('general', 'General Commune', 'Public community room for careful, moderated Elysia Ecobotics conversation.', 'open_signed_in', 15),
  ('developer-forge', 'Developer Forge', 'Add-on preparation, manifest, package, and review-status discussion. No code execution.', 'open_signed_in', 20),
  ('troubleshooting', 'Troubleshooting Grove', 'Plain-text troubleshooting help. Redact logs and never post tokens, credentials, or private local Elysia data.', 'open_signed_in', 20),
  ('stewardship', 'Stewardship Commons', 'Public-benefit and ecological stewardship discussion for safe-to-share community updates.', 'open_signed_in', 20),
  ('safety-and-boundaries', 'Safety and Boundaries', 'Privacy, consent, moderation, and boundary discussions. Plain text only.', 'open_signed_in', 30)
on conflict (slug) do nothing;

alter table public.commune_realtime_messages add column if not exists room_id uuid references public.commune_realtime_rooms(id) on delete cascade;
alter table public.commune_realtime_messages add column if not exists author_username text;
alter table public.commune_realtime_messages add column if not exists body_plain text;
alter table public.commune_realtime_messages add column if not exists report_count integer not null default 0;
alter table public.commune_realtime_messages add column if not exists edited_at timestamptz;
alter table public.commune_realtime_messages add column if not exists flagged_at timestamptz;
alter table public.commune_realtime_messages add column if not exists moderation_reason text;

update public.commune_realtime_messages message
set room_id = room.id
from public.commune_realtime_rooms room
where message.room_id is null and message.room_slug = room.slug;

update public.commune_realtime_messages
set body_plain = body
where body_plain is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'commune_realtime_message_body_check') then
    alter table public.commune_realtime_messages add constraint commune_realtime_message_body_check check (char_length(trim(body)) between 1 and 2000 and body !~* '<\s*/?\s*script' and body !~* '<\s*iframe' and body !~* 'javascript:');
  end if;
end $$;

create index if not exists commune_realtime_messages_room_id_idx on public.commune_realtime_messages(room_id, created_at desc);
create index if not exists commune_realtime_messages_visibility_idx on public.commune_realtime_messages(visibility_state, created_at desc);

create table if not exists public.commune_realtime_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.commune_realtime_messages(id) on delete cascade,
  room_id uuid references public.commune_realtime_rooms(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  detail text,
  report_status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text,
  constraint commune_realtime_reports_reason_check check (reason in ('spam','harassment','unsafe_code','secret_or_private_data','misinformation','copyright_or_license','malware_or_suspicious','privacy_violation','other')),
  constraint commune_realtime_reports_status_check check (report_status in ('open','under_review','action_taken','dismissed','archived'))
);

create index if not exists commune_realtime_reports_status_idx on public.commune_realtime_reports(report_status, created_at desc);
create index if not exists commune_realtime_reports_message_idx on public.commune_realtime_reports(message_id, created_at desc);

create table if not exists public.commune_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.commune_realtime_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(room_id, user_id),
  constraint commune_room_members_role_check check (member_role in ('member','moderator','owner'))
);

create table if not exists public.commune_room_moderation_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.commune_realtime_rooms(id) on delete set null,
  message_id uuid references public.commune_realtime_messages(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commune_room_moderation_events_action_check check (action in ('message_created','message_reported','message_flagged','message_hidden','message_removed','room_slow_mode_updated','room_posting_mode_updated','room_archived','room_restored'))
);

create index if not exists commune_room_moderation_events_room_idx on public.commune_room_moderation_events(room_id, created_at desc);
create index if not exists commune_room_moderation_events_message_idx on public.commune_room_moderation_events(message_id, created_at desc);

create or replace function public.can_post_commune_realtime_message(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.commune_realtime_rooms room
      where room.id = target_room_id
        and room.visibility_state = 'published'
        and (
          room.posting_mode = 'open_signed_in'
          or (
            room.posting_mode = 'members_only'
            and exists (select 1 from public.commune_room_members member where member.room_id = room.id and member.user_id = auth.uid())
          )
        )
        and not exists (
          select 1
          from public.commune_realtime_messages previous
          where previous.room_id = room.id
            and previous.author_user_id = auth.uid()
            and previous.created_at > now() - make_interval(secs => greatest(room.slow_mode_seconds, 0))
        )
    );
$$;

create or replace function public.bump_commune_realtime_report_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  update public.commune_realtime_messages
  set report_count = coalesce(report_count, 0) + 1,
      visibility_state = case when coalesce(report_count, 0) + 1 >= 3 and visibility_state = 'published' then 'flagged' else visibility_state end,
      flagged_at = case when coalesce(report_count, 0) + 1 >= 3 and flagged_at is null then now() else flagged_at end
  where id = new.message_id
  returning report_count into next_count;
  return new;
end;
$$;

drop trigger if exists commune_realtime_reports_bump_count on public.commune_realtime_reports;
create trigger commune_realtime_reports_bump_count
after insert on public.commune_realtime_reports
for each row execute function public.bump_commune_realtime_report_count();

alter table public.commune_realtime_rooms enable row level security;
alter table public.commune_realtime_messages enable row level security;
alter table public.commune_realtime_reports enable row level security;
alter table public.commune_room_members enable row level security;
alter table public.commune_room_moderation_events enable row level security;

drop policy if exists "public reads published realtime rooms" on public.commune_realtime_rooms;
create policy "public reads published realtime rooms" on public.commune_realtime_rooms for select using (visibility_state = 'published' or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "moderators manage realtime rooms" on public.commune_realtime_rooms;
create policy "moderators manage realtime rooms" on public.commune_realtime_rooms for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "public reads published commune realtime messages" on public.commune_realtime_messages;
create policy "public reads published commune realtime messages" on public.commune_realtime_messages for select using (
  visibility_state = 'published'
  and exists (select 1 from public.commune_realtime_rooms room where room.id = room_id and room.visibility_state = 'published')
);
drop policy if exists "signed in users create commune realtime messages" on public.commune_realtime_messages;
create policy "signed in users create commune realtime messages" on public.commune_realtime_messages for insert to authenticated with check (
  author_user_id = auth.uid()
  and visibility_state = 'published'
  and public.can_post_commune_realtime_message(room_id)
);
drop policy if exists "moderators manage commune realtime messages" on public.commune_realtime_messages;
create policy "moderators manage commune realtime messages" on public.commune_realtime_messages for update to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "moderators read all commune realtime messages" on public.commune_realtime_messages;
create policy "moderators read all commune realtime messages" on public.commune_realtime_messages for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users create realtime reports" on public.commune_realtime_reports;
create policy "users create realtime reports" on public.commune_realtime_reports for insert to authenticated with check (reporter_user_id = auth.uid());
drop policy if exists "users read own realtime reports" on public.commune_realtime_reports;
create policy "users read own realtime reports" on public.commune_realtime_reports for select to authenticated using (reporter_user_id = auth.uid());
drop policy if exists "moderators manage realtime reports" on public.commune_realtime_reports;
create policy "moderators manage realtime reports" on public.commune_realtime_reports for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users read own realtime room memberships" on public.commune_room_members;
create policy "users read own realtime room memberships" on public.commune_room_members for select to authenticated using (user_id = auth.uid());
drop policy if exists "moderators manage realtime room memberships" on public.commune_room_members;
create policy "moderators manage realtime room memberships" on public.commune_room_members for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "moderators read realtime moderation events" on public.commune_room_moderation_events;
create policy "moderators read realtime moderation events" on public.commune_room_moderation_events for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "users create own realtime message events" on public.commune_room_moderation_events;
create policy "users create own realtime message events" on public.commune_room_moderation_events for insert to authenticated with check (
  actor_user_id = auth.uid()
  and (
    action in ('message_created','message_reported')
    or public.current_user_can_review_domain('commune'::public.review_domain)
  )
);

grant select on table public.commune_realtime_rooms to anon, authenticated;
grant insert, update, delete on table public.commune_realtime_rooms to authenticated;
grant select on table public.commune_realtime_messages to anon, authenticated;
grant insert, update on table public.commune_realtime_messages to authenticated;
grant select, insert, update on table public.commune_realtime_reports to authenticated;
grant select, insert, update, delete on table public.commune_room_members to authenticated;
grant select, insert on table public.commune_room_moderation_events to authenticated;
grant execute on function public.can_post_commune_realtime_message(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.commune_realtime_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
-- Pass 4: collaborative code review foundation.
-- Documents are text for review only. The website does not execute code.

create table if not exists public.commune_code_documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text unique,
  language text not null default 'text',
  file_name text,
  current_text text not null default '',
  summary text,
  visibility_state text not null default 'draft',
  review_status text not null default 'draft',
  linked_commune_post_id uuid references public.commune_posts(id) on delete set null,
  linked_sandbox_request_id uuid references public.commune_sandbox_review_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  hidden_at timestamptz,
  removed_at timestamptz,
  moderation_reason text,
  constraint commune_code_documents_visibility_check check (visibility_state in ('draft','submitted','published','flagged','hidden','removed','archived')),
  constraint commune_code_documents_review_status_check check (review_status in ('draft','open_for_review','changes_requested','resolved','archived','security_hold')),
  constraint commune_code_documents_title_check check (char_length(trim(title)) > 0),
  constraint commune_code_documents_text_check check (char_length(current_text) <= 100000),
  constraint commune_code_documents_filename_check check (file_name is null or (file_name !~ '(\.\.|/|\\)' and file_name !~* '^[A-Z]:'))
);

create index if not exists commune_code_documents_owner_idx on public.commune_code_documents(owner_user_id, updated_at desc);
create index if not exists commune_code_documents_visibility_idx on public.commune_code_documents(visibility_state, updated_at desc);

create table if not exists public.commune_code_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.commune_code_documents(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  snapshot_text text not null,
  change_summary text,
  version_number integer not null default 1,
  created_at timestamptz not null default now(),
  constraint commune_code_document_versions_text_check check (char_length(snapshot_text) <= 100000),
  unique(document_id, version_number)
);

create index if not exists commune_code_document_versions_document_idx on public.commune_code_document_versions(document_id, version_number desc);

create table if not exists public.commune_code_annotations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.commune_code_documents(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  line_start integer not null,
  line_end integer not null,
  comment text not null,
  visibility_state text not null default 'published',
  annotation_status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  hidden_at timestamptz,
  removed_at timestamptz,
  moderation_reason text,
  constraint commune_code_annotations_visibility_check check (visibility_state in ('published','flagged','hidden','removed','archived')),
  constraint commune_code_annotations_status_check check (annotation_status in ('open','addressed','resolved','archived')),
  constraint commune_code_annotations_line_check check (line_start > 0 and line_end >= line_start),
  constraint commune_code_annotations_comment_check check (char_length(trim(comment)) between 1 and 2000)
);

create index if not exists commune_code_annotations_document_idx on public.commune_code_annotations(document_id, line_start, created_at);

create table if not exists public.commune_code_sessions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.commune_code_documents(id) on delete cascade,
  room_slug text,
  status text not null default 'open',
  active_editor_user_id uuid references auth.users(id) on delete set null,
  edit_lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commune_code_sessions_status_check check (status in ('open','locked','paused','closed','archived'))
);

create index if not exists commune_code_sessions_document_idx on public.commune_code_sessions(document_id, updated_at desc);

create table if not exists public.commune_code_reports (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.commune_code_documents(id) on delete cascade,
  annotation_id uuid references public.commune_code_annotations(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  detail text,
  report_status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text,
  constraint commune_code_reports_reason_check check (reason in ('spam','harassment','unsafe_code','secret_or_private_data','misinformation','copyright_or_license','malware_or_suspicious','privacy_violation','other')),
  constraint commune_code_reports_status_check check (report_status in ('open','under_review','action_taken','dismissed','archived')),
  constraint commune_code_reports_target_check check (document_id is not null or annotation_id is not null)
);

create index if not exists commune_code_reports_status_idx on public.commune_code_reports(report_status, created_at desc);

create table if not exists public.commune_code_moderation_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.commune_code_documents(id) on delete set null,
  annotation_id uuid references public.commune_code_annotations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commune_code_moderation_events_action_check check (action in ('document_created','document_updated','version_created','annotation_created','annotation_resolved','document_submitted','document_published','document_flagged','document_hidden','document_removed','document_archived','annotation_reported','document_reported','report_reviewed','edit_lock_acquired','edit_lock_released'))
);

create index if not exists commune_code_moderation_events_document_idx on public.commune_code_moderation_events(document_id, created_at desc);

alter table public.commune_code_documents enable row level security;
alter table public.commune_code_document_versions enable row level security;
alter table public.commune_code_annotations enable row level security;
alter table public.commune_code_sessions enable row level security;
alter table public.commune_code_reports enable row level security;
alter table public.commune_code_moderation_events enable row level security;

drop policy if exists "public reads published code documents" on public.commune_code_documents;
create policy "public reads published code documents" on public.commune_code_documents for select using (visibility_state = 'published' or owner_user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "users create own code documents" on public.commune_code_documents;
create policy "users create own code documents" on public.commune_code_documents for insert to authenticated with check (owner_user_id = auth.uid() and visibility_state = 'draft');
drop policy if exists "owners update own editable code documents" on public.commune_code_documents;
create policy "owners update own editable code documents" on public.commune_code_documents for update to authenticated using (owner_user_id = auth.uid() and visibility_state in ('draft','submitted','archived') and review_status <> 'security_hold') with check (owner_user_id = auth.uid() and visibility_state in ('draft','submitted','archived') and review_status <> 'security_hold');
drop policy if exists "moderators manage code documents" on public.commune_code_documents;
create policy "moderators manage code documents" on public.commune_code_documents for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "public reads published code versions" on public.commune_code_document_versions;
create policy "public reads published code versions" on public.commune_code_document_versions for select using (exists (select 1 from public.commune_code_documents doc where doc.id = document_id and (doc.visibility_state = 'published' or doc.owner_user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain))));
drop policy if exists "owners create code document versions" on public.commune_code_document_versions;
create policy "owners create code document versions" on public.commune_code_document_versions for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.owner_user_id = auth.uid() and doc.visibility_state in ('draft','submitted')));
drop policy if exists "moderators manage code document versions" on public.commune_code_document_versions;
create policy "moderators manage code document versions" on public.commune_code_document_versions for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "public reads published code annotations" on public.commune_code_annotations;
create policy "public reads published code annotations" on public.commune_code_annotations for select using (visibility_state = 'published' and exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.visibility_state = 'published'));
drop policy if exists "owners and authors read code annotations" on public.commune_code_annotations;
create policy "owners and authors read code annotations" on public.commune_code_annotations for select to authenticated using (author_user_id = auth.uid() or exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.owner_user_id = auth.uid()) or public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "users create code annotations" on public.commune_code_annotations;
create policy "users create code annotations" on public.commune_code_annotations for insert to authenticated with check (author_user_id = auth.uid() and exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.visibility_state in ('published','submitted') and doc.review_status in ('open_for_review','changes_requested','resolved','draft')));
drop policy if exists "authors resolve own code annotations" on public.commune_code_annotations;
create policy "authors resolve own code annotations" on public.commune_code_annotations for update to authenticated using (author_user_id = auth.uid() and visibility_state = 'published') with check (author_user_id = auth.uid() and visibility_state = 'published');
drop policy if exists "moderators manage code annotations" on public.commune_code_annotations;
create policy "moderators manage code annotations" on public.commune_code_annotations for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users read relevant code sessions" on public.commune_code_sessions;
create policy "users read relevant code sessions" on public.commune_code_sessions for select using (exists (select 1 from public.commune_code_documents doc where doc.id = document_id and (doc.visibility_state = 'published' or doc.owner_user_id = auth.uid() or public.current_user_can_review_domain('commune'::public.review_domain))));
drop policy if exists "owners create code sessions" on public.commune_code_sessions;
create policy "owners create code sessions" on public.commune_code_sessions for insert to authenticated with check (exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.owner_user_id = auth.uid()));
drop policy if exists "active editors update code sessions" on public.commune_code_sessions;
create policy "active editors update code sessions" on public.commune_code_sessions for update to authenticated using (active_editor_user_id = auth.uid() or exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.owner_user_id = auth.uid()) or public.current_user_can_review_domain('commune'::public.review_domain)) with check (active_editor_user_id = auth.uid() or exists (select 1 from public.commune_code_documents doc where doc.id = document_id and doc.owner_user_id = auth.uid()) or public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users create code reports" on public.commune_code_reports;
create policy "users create code reports" on public.commune_code_reports for insert to authenticated with check (reporter_user_id = auth.uid());
drop policy if exists "users read own code reports" on public.commune_code_reports;
create policy "users read own code reports" on public.commune_code_reports for select to authenticated using (reporter_user_id = auth.uid());
drop policy if exists "moderators manage code reports" on public.commune_code_reports;
create policy "moderators manage code reports" on public.commune_code_reports for all to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain)) with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "moderators read code moderation events" on public.commune_code_moderation_events;
create policy "moderators read code moderation events" on public.commune_code_moderation_events for select to authenticated using (public.current_user_can_review_domain('commune'::public.review_domain));
drop policy if exists "users create own code moderation events" on public.commune_code_moderation_events;
create policy "users create own code moderation events" on public.commune_code_moderation_events for insert to authenticated with check (actor_user_id = auth.uid() and (action in ('document_created','document_updated','version_created','annotation_created','annotation_resolved','document_submitted','document_reported','annotation_reported','edit_lock_acquired','edit_lock_released') or public.current_user_can_review_domain('commune'::public.review_domain)));

grant select on table public.commune_code_documents to anon, authenticated;
grant insert, update on table public.commune_code_documents to authenticated;
grant select on table public.commune_code_document_versions to anon, authenticated;
grant insert on table public.commune_code_document_versions to authenticated;
grant select on table public.commune_code_annotations to anon, authenticated;
grant insert, update on table public.commune_code_annotations to authenticated;
grant select, insert, update on table public.commune_code_sessions to authenticated;
grant select, insert, update on table public.commune_code_reports to authenticated;
grant select, insert on table public.commune_code_moderation_events to authenticated;

-- 2026_06_14_sandbox_request_local_handoff.sql
-- Sandbox request / Local Elysia handoff layer.
-- This stores metadata and review decisions only. The public website never runs,
-- installs, clones, or calls Local Elysia. Local Elysia must revalidate exported
-- bundles and ask explicit local approval before any future execution.

alter table public.commune_sandbox_review_requests add column if not exists submitted_by uuid references auth.users(id) on delete set null;
alter table public.commune_sandbox_review_requests add column if not exists source_type text not null default 'manual';
alter table public.commune_sandbox_review_requests add column if not exists source_id uuid;
alter table public.commune_sandbox_review_requests add column if not exists title text;
alter table public.commune_sandbox_review_requests add column if not exists summary text;
alter table public.commune_sandbox_review_requests add column if not exists language text;
alter table public.commune_sandbox_review_requests add column if not exists code_text text;
alter table public.commune_sandbox_review_requests add column if not exists package_id uuid;
alter table public.commune_sandbox_review_requests add column if not exists addon_submission_id uuid;
alter table public.commune_sandbox_review_requests add column if not exists code_document_id uuid references public.commune_code_documents(id) on delete set null;
alter table public.commune_sandbox_review_requests add column if not exists expected_command text;
alter table public.commune_sandbox_review_requests add column if not exists declared_dependencies text[] not null default '{}';
alter table public.commune_sandbox_review_requests add column if not exists declared_network_policy text not null default 'disabled';
alter table public.commune_sandbox_review_requests add column if not exists declared_network_domains text[] not null default '{}';
alter table public.commune_sandbox_review_requests add column if not exists declared_filesystem_policy text not null default 'none';
alter table public.commune_sandbox_review_requests add column if not exists declared_file_scopes text[] not null default '{}';
alter table public.commune_sandbox_review_requests add column if not exists requested_cpu_limit text;
alter table public.commune_sandbox_review_requests add column if not exists requested_memory_limit text;
alter table public.commune_sandbox_review_requests add column if not exists requested_timeout_seconds integer;
alter table public.commune_sandbox_review_requests add column if not exists user_acknowledged_no_execution boolean not null default false;
alter table public.commune_sandbox_review_requests add column if not exists user_acknowledged_no_secrets boolean not null default false;
alter table public.commune_sandbox_review_requests add column if not exists user_acknowledged_local_elysia_final_authority boolean not null default false;
alter table public.commune_sandbox_review_requests add column if not exists request_status text not null default 'draft';
alter table public.commune_sandbox_review_requests add column if not exists review_status text not null default 'not_submitted';
alter table public.commune_sandbox_review_requests add column if not exists handoff_status text not null default 'not_exported';
alter table public.commune_sandbox_review_requests add column if not exists handoff_bundle_json jsonb;
alter table public.commune_sandbox_review_requests add column if not exists handoff_exported_at timestamptz;
alter table public.commune_sandbox_review_requests add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.commune_sandbox_review_requests add column if not exists reviewed_at timestamptz;
alter table public.commune_sandbox_review_requests add column if not exists reviewer_public_feedback text;
alter table public.commune_sandbox_review_requests add column if not exists reviewer_private_note text;
alter table public.commune_sandbox_review_requests add column if not exists security_hold_reason text;

update public.commune_sandbox_review_requests
set submitted_by = coalesce(submitted_by, user_id),
    title = coalesce(title, request_title, 'Sandbox review request'),
    request_status = case status
      when 'requested' then 'submitted'
      when 'in_review' then 'submitted'
      when 'approved_for_local_sandbox' then 'approved_for_local_handoff'
      when 'needs_information' then 'changes_requested'
      when 'rejected' then 'rejected'
      when 'archived' then 'archived'
      else request_status
    end,
    review_status = case status
      when 'requested' then 'pending_review'
      when 'in_review' then 'pending_review'
      when 'approved_for_local_sandbox' then 'approved'
      when 'needs_information' then 'changes_requested'
      when 'rejected' then 'rejected'
      when 'archived' then 'rejected'
      else review_status
    end,
    handoff_status = case status when 'approved_for_local_sandbox' then 'export_ready' else handoff_status end
where title is null or submitted_by is null;

alter table public.commune_sandbox_review_requests alter column title set not null;

do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_source_type_check check (source_type in ('commune_post','commune_code_document','developer_forge_addon','marketplace_addon_version','manual','other'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_request_status_check check (request_status in ('draft','submitted','changes_requested','approved_for_local_handoff','rejected','security_hold','archived','revoked'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_review_status_check check (review_status in ('not_submitted','pending_review','changes_requested','approved','rejected','security_hold'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_status_check check (handoff_status in ('not_exported','export_ready','exported','revoked','expired'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_network_policy_check check (declared_network_policy in ('disabled','declared_domains_only','future_review_required'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_sandbox_review_requests add constraint commune_sandbox_handoff_filesystem_policy_check check (declared_filesystem_policy in ('none','temporary_workspace_only','declared_read_only_inputs','future_review_required'));
exception when duplicate_object then null; end $$;

create index if not exists commune_sandbox_handoff_owner_idx on public.commune_sandbox_review_requests(coalesce(submitted_by, user_id), created_at desc);
create index if not exists commune_sandbox_handoff_review_idx on public.commune_sandbox_review_requests(request_status, review_status, created_at desc);
create index if not exists commune_sandbox_handoff_code_document_idx on public.commune_sandbox_review_requests(code_document_id) where code_document_id is not null;

create table if not exists public.sandbox_handoff_events (
  id uuid primary key default gen_random_uuid(),
  sandbox_request_id uuid not null references public.commune_sandbox_review_requests(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sandbox_handoff_events_action_check check (action in ('draft_created','request_submitted','changes_requested','approved_for_local_handoff','rejected','security_hold','handoff_exported','handoff_revoked','archived'))
);

create index if not exists sandbox_handoff_events_request_idx on public.sandbox_handoff_events(sandbox_request_id, created_at desc);
alter table public.sandbox_handoff_events enable row level security;

drop policy if exists "users manage own sandbox handoff requests" on public.commune_sandbox_review_requests;
create policy "users manage own sandbox handoff requests" on public.commune_sandbox_review_requests for all to authenticated
using (coalesce(submitted_by, user_id) = auth.uid())
with check (coalesce(submitted_by, user_id) = auth.uid() and request_status in ('draft','submitted','changes_requested','approved_for_local_handoff'));

drop policy if exists "reviewers manage sandbox handoff requests" on public.commune_sandbox_review_requests;
create policy "reviewers manage sandbox handoff requests" on public.commune_sandbox_review_requests for all to authenticated
using (public.current_user_can_review_domain('commune'::public.review_domain))
with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users read own sandbox handoff events" on public.sandbox_handoff_events;
create policy "users read own sandbox handoff events" on public.sandbox_handoff_events for select to authenticated
using (exists (select 1 from public.commune_sandbox_review_requests r where r.id = sandbox_request_id and coalesce(r.submitted_by, r.user_id) = auth.uid()));

drop policy if exists "reviewers manage sandbox handoff events" on public.sandbox_handoff_events;
create policy "reviewers manage sandbox handoff events" on public.sandbox_handoff_events for all to authenticated
using (public.current_user_can_review_domain('commune'::public.review_domain))
with check (public.current_user_can_review_domain('commune'::public.review_domain));

drop policy if exists "users create own sandbox handoff events" on public.sandbox_handoff_events;
create policy "users create own sandbox handoff events" on public.sandbox_handoff_events for insert to authenticated
with check (actor_user_id = auth.uid() and exists (select 1 from public.commune_sandbox_review_requests r where r.id = sandbox_request_id and coalesce(r.submitted_by, r.user_id) = auth.uid()));

grant select, insert, update on table public.commune_sandbox_review_requests to authenticated;
grant select, insert, update on table public.sandbox_handoff_events to authenticated;

-- Official Update admin-only structured workflow policies.
-- Canonical repair migration: supabase/legacy-migrations/2026_06_26_official_update_structured_workflow.sql
alter table public.commune_official_updates enable row level security;
alter table public.commune_official_update_code_snippets enable row level security;
alter table public.commune_official_update_events enable row level security;

drop policy if exists "public reads published official update metadata" on public.commune_official_updates;
create policy "public reads published official update metadata" on public.commune_official_updates
  for select to anon, authenticated
  using (exists (select 1 from public.commune_posts p where p.id = post_id and p.post_type = 'official_update' and p.status = 'published' and p.visibility = 'public') or admin_user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "admins manage official update metadata" on public.commune_official_updates;
create policy "admins manage official update metadata" on public.commune_official_updates
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "public reads visible official update code" on public.commune_official_update_code_snippets;
create policy "public reads visible official update code" on public.commune_official_update_code_snippets
  for select to anon, authenticated
  using (public_visible = true and exists (select 1 from public.commune_posts p where p.id = post_id and p.post_type = 'official_update' and p.status = 'published' and p.visibility = 'public'));

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

drop policy if exists "users create pending commune comments" on public.commune_comments;
drop policy if exists "users create own commune comments with thread approval" on public.commune_comments;
create policy "users create own commune comments with thread approval" on public.commune_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.current_user_can_review_domain('commune'::public.review_domain)
      or not exists (select 1 from public.commune_official_updates ou where ou.post_id = commune_comments.post_id and ou.comments_enabled = false)
    )
    and (
      status in ('draft','pending_review')
      or (
        status = 'published'
        and (
          public.current_user_can_review_domain('commune'::public.review_domain)
          or exists (select 1 from public.commune_thread_participant_approvals approval where approval.thread_id = commune_comments.thread_id and approval.user_id = auth.uid() and approval.status = 'approved' and approval.revoked_at is null)
          or exists (select 1 from public.commune_posts p where p.id = commune_comments.post_id and p.user_id = auth.uid() and p.status = 'published' and p.visibility = 'public')
        )
      )
    )
  );

-- Research Notes structured workflow policies.
-- Canonical repair migration: supabase/legacy-migrations/2026_06_26_research_notes_structured_workflow.sql
alter table public.commune_research_notes enable row level security;

drop policy if exists "public reads published research notes metadata" on public.commune_research_notes;
create policy "public reads published research notes metadata" on public.commune_research_notes
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.post_type = 'research_note'
        and p.status = 'published'
        and p.visibility = 'public'
    )
    or author_user_id = auth.uid()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

drop policy if exists "signed users create own research notes metadata" on public.commune_research_notes;
create policy "signed users create own research notes metadata" on public.commune_research_notes
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.user_id = auth.uid()
        and p.post_type = 'research_note'
    )
  );

drop policy if exists "authors maintain own unpublished research notes metadata" on public.commune_research_notes;
create policy "authors maintain own unpublished research notes metadata" on public.commune_research_notes
  for update to authenticated
  using (author_user_id = auth.uid() and review_status in ('submitted','needs_citation','needs_clarification','source_issue','overclaiming_evidence','corrected'))
  with check (author_user_id = auth.uid() and review_status in ('submitted','needs_citation','needs_clarification','source_issue','overclaiming_evidence','corrected'));

drop policy if exists "reviewers manage research notes metadata" on public.commune_research_notes;
create policy "reviewers manage research notes metadata" on public.commune_research_notes
  for all to authenticated
  using (public.current_user_can_review_domain('commune'::public.review_domain))
  with check (public.current_user_can_review_domain('commune'::public.review_domain));

grant select on table public.commune_research_notes to anon;
grant select, insert, update on table public.commune_research_notes to authenticated;

-- Job Post structured workflow policies.
-- Canonical repair migration: supabase/legacy-migrations/2026_06_26_job_post_structured_workflow.sql
alter table public.commune_job_posts enable row level security;

drop policy if exists "public reads published job post metadata" on public.commune_job_posts;
create policy "public reads published job post metadata" on public.commune_job_posts
  for select to anon, authenticated
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
create policy "signed users create own job post metadata" on public.commune_job_posts
  for insert to authenticated
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
create policy "reviewers manage job post metadata" on public.commune_job_posts
  for all to authenticated
  using (public.current_user_can_review_domain('commune'::public.review_domain))
  with check (public.current_user_can_review_domain('commune'::public.review_domain));

revoke all on function public.update_own_commune_job_post_application_status(uuid, uuid, text, text) from public, anon;
grant execute on function public.update_own_commune_job_post_application_status(uuid, uuid, text, text) to authenticated;

revoke select on table public.commune_job_posts from public, anon, authenticated;
grant select (
  id, post_id, thread_id, author_user_id, role_title, organization_project,
  role_type, paid_volunteer_status, location_mode, location_text,
  time_commitment, deadline, compensation_clarity, contact_path,
  requirements_skills, safety_notes, role_summary, application_status,
  anti_scam_review_status, work_with_link_enabled, public_correction_note,
  reviewed_at, filled_at, closed_at, archived_at, created_at,
  updated_at
) on table public.commune_job_posts to anon, authenticated;
grant insert, update on table public.commune_job_posts to authenticated;

-- Community Voting Room snapshot. Canonical repair migrations:
-- supabase/legacy-migrations/2026_07_05_01_commune_community_voting_room_enum.sql
-- supabase/legacy-migrations/2026_07_05_02_commune_community_voting_room.sql
insert into public.commune_rooms (slug, name, description, room_type)
values (
  'community-vote',
  'Community Voting Room',
  'Admin-controlled public guidance votes for website updates, fixes, additions, removals, priorities, and direction-of-work questions. Votes guide stewardship and do not automatically change Elysia behavior, policy, legal/safety posture, Marketplace, Developer Forge, or Official Updates.',
  'community_vote'
)
on conflict (slug) do update set name = excluded.name, description = excluded.description, room_type = excluded.room_type;

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
  updated_at timestamptz not null default now(),
  constraint commune_vote_posts_decision_type_check check (decision_type in ('single_choice_guidance')),
  constraint commune_vote_posts_status_check check (vote_status in ('draft','scheduled','open','closed','accepted','declined','posted_to_official_update','archived')),
  constraint commune_vote_posts_visibility_check check (visibility in ('public')),
  constraint commune_vote_posts_results_visibility_check check (results_visibility in ('always','after_vote','after_close','staff_only')),
  constraint commune_vote_posts_time_window_check check (closes_at is null or opens_at is null or closes_at > opens_at)
);

create table if not exists public.commune_vote_options (
  id uuid primary key default gen_random_uuid(),
  vote_post_id uuid not null references public.commune_vote_posts(post_id) on delete cascade,
  option_label text not null,
  option_description text,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commune_vote_options_label_check check (length(trim(option_label)) > 0),
  constraint commune_vote_options_id_vote_unique unique (id, vote_post_id)
);

create table if not exists public.commune_vote_ballots (
  id uuid primary key default gen_random_uuid(),
  vote_post_id uuid not null references public.commune_vote_posts(post_id) on delete cascade,
  option_id uuid not null,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commune_vote_ballots_vote_voter_unique unique (vote_post_id, voter_user_id),
  constraint commune_vote_ballots_option_same_vote_fk foreign key (option_id, vote_post_id) references public.commune_vote_options(id, vote_post_id) on delete cascade
);

create table if not exists public.commune_vote_events (
  id uuid primary key default gen_random_uuid(),
  vote_post_id uuid not null references public.commune_vote_posts(post_id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_note text,
  event_visibility text not null default 'public',
  created_at timestamptz not null default now(),
  constraint commune_vote_events_type_check check (event_type in ('created','scheduled','opened','closed','reopened','accepted','declined','posted_to_official_update','archived','outcome_updated','comments_enabled','comments_disabled')),
  constraint commune_vote_events_visibility_check check (event_visibility in ('public','staff'))
);

alter table public.commune_vote_posts enable row level security;
alter table public.commune_vote_options enable row level security;
alter table public.commune_vote_ballots enable row level security;
alter table public.commune_vote_events enable row level security;

drop policy if exists "public reads published public vote metadata" on public.commune_vote_posts;
create policy "public reads published public vote metadata" on public.commune_vote_posts for select to anon, authenticated using (
  exists (select 1 from public.commune_posts p where p.id = post_id and p.post_type = 'community_vote' and p.status = 'published' and p.visibility = 'public' and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked') and p.hidden_at is null and p.removed_at is null and p.archived_at is null)
  or created_by = auth.uid()
  or public.current_user_can_review_domain('commune'::public.review_domain)
);
drop policy if exists "admins manage vote metadata" on public.commune_vote_posts;
create policy "admins manage vote metadata" on public.commune_vote_posts for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public reads published vote options" on public.commune_vote_options;
create policy "public reads published vote options" on public.commune_vote_options for select to anon, authenticated using (
  exists (
    select 1
    from public.commune_vote_posts v
    join public.commune_posts p on p.id = v.post_id
    where v.post_id = vote_post_id and p.post_type = 'community_vote' and p.status = 'published' and p.visibility = 'public' and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked') and p.hidden_at is null and p.removed_at is null and p.archived_at is null
  )
  or public.current_user_can_review_domain('commune'::public.review_domain)
);
drop policy if exists "admins manage vote options" on public.commune_vote_options;
create policy "admins manage vote options" on public.commune_vote_options for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "users read own vote ballots" on public.commune_vote_ballots;
create policy "users read own vote ballots" on public.commune_vote_ballots for select to authenticated using (
  (voter_user_id = auth.uid() and exists (
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
  ))
  or public.current_user_is_admin()
  or public.current_user_can_review_domain('commune'::public.review_domain)
);
drop policy if exists "users insert own open vote ballots" on public.commune_vote_ballots;
create policy "users insert own open vote ballots" on public.commune_vote_ballots for insert to authenticated with check (
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
create policy "users update own open vote ballots" on public.commune_vote_ballots for update to authenticated using (voter_user_id = auth.uid()) with check (
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
drop policy if exists "admins manage vote ballots" on public.commune_vote_ballots;
create policy "admins manage vote ballots" on public.commune_vote_ballots for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public reads public vote events" on public.commune_vote_events;
create policy "public reads public vote events" on public.commune_vote_events for select to anon, authenticated using (
  (event_visibility = 'public' and exists (
    select 1
    from public.commune_vote_posts v
    join public.commune_posts p on p.id = v.post_id
    where v.post_id = vote_post_id and p.post_type = 'community_vote' and p.status = 'published' and p.visibility = 'public' and coalesce(p.visibility_state, 'published') not in ('flagged', 'hidden', 'removed', 'archived', 'revoked') and p.hidden_at is null and p.removed_at is null and p.archived_at is null
  ))
  or public.current_user_is_admin()
  or public.current_user_can_review_domain('commune'::public.review_domain)
);
drop policy if exists "admins create vote events" on public.commune_vote_events;
create policy "admins create vote events" on public.commune_vote_events for insert to authenticated with check (public.current_user_is_admin() and (actor_user_id is null or actor_user_id = auth.uid()));
drop policy if exists "admins update vote events" on public.commune_vote_events;
create policy "admins update vote events" on public.commune_vote_events for update to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

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

drop policy if exists "users create pending commune comments" on public.commune_comments;
drop policy if exists "users create own commune comments with thread approval" on public.commune_comments;
create policy "users create own commune comments with thread approval" on public.commune_comments for insert to authenticated with check (
  user_id = auth.uid()
  and (
    public.current_user_can_review_domain('commune'::public.review_domain)
    or (
      not exists (select 1 from public.commune_official_updates ou where ou.post_id = commune_comments.post_id and ou.comments_enabled = false)
      and not exists (select 1 from public.commune_vote_posts vp where vp.post_id = commune_comments.post_id and vp.allow_comments = false)
    )
  )
  and (
    status in ('draft','pending_review')
    or (
      status = 'published'
      and (
        public.current_user_can_review_domain('commune'::public.review_domain)
        or exists (select 1 from public.commune_thread_participant_approvals approval where approval.thread_id = commune_comments.thread_id and approval.user_id = auth.uid() and approval.status = 'approved' and approval.revoked_at is null)
        or exists (select 1 from public.commune_posts p where p.id = commune_comments.post_id and p.user_id = auth.uid() and p.status = 'published' and p.visibility = 'public')
      )
    )
  )
);

revoke all on function public.commune_vote_result_summary(uuid[]) from public;
grant select on table public.commune_vote_posts to anon, authenticated;
grant select on table public.commune_vote_options to anon, authenticated;
grant select on table public.commune_vote_events to anon, authenticated;
grant select, insert, update on table public.commune_vote_posts to authenticated;
grant select, insert, update on table public.commune_vote_options to authenticated;
grant select, insert, update on table public.commune_vote_ballots to authenticated;
grant select, insert, update on table public.commune_vote_events to authenticated;
grant execute on function public.commune_vote_result_summary(uuid[]) to anon, authenticated;

-- Governed sandbox policy snapshot. Canonical additive migration:
-- migrations/2026_07_13_sandbox_proxy_access_and_reservation.sql

alter table public.commune_sandbox_runs enable row level security;
alter table public.commune_code_diagnostics enable row level security;
alter table public.commune_language_policies enable row level security;
alter table public.commune_sandbox_policies enable row level security;

drop policy if exists "users read own coding cornucopia sandbox runs" on public.commune_sandbox_runs;
create policy "users read own coding cornucopia sandbox runs"
  on public.commune_sandbox_runs for select to authenticated
  using (
    requester_user_id = auth.uid()
    or public.current_user_is_admin()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

drop policy if exists "users create own coding cornucopia sandbox run requests" on public.commune_sandbox_runs;
drop policy if exists "reviewers update coding cornucopia sandbox runs" on public.commune_sandbox_runs;

drop policy if exists "users read own coding cornucopia diagnostics" on public.commune_code_diagnostics;
create policy "users read own coding cornucopia diagnostics"
  on public.commune_code_diagnostics for select to authenticated
  using (
    public_visibility = 'public_summary'
    or public.current_user_is_admin()
    or public.current_user_can_review_domain('commune'::public.review_domain)
    or exists (
      select 1 from public.commune_sandbox_runs run
      where run.id = commune_code_diagnostics.run_id
        and run.requester_user_id = auth.uid()
    )
  );

drop policy if exists "reviewers write coding cornucopia diagnostics" on public.commune_code_diagnostics;

drop policy if exists "public reads coding cornucopia language policies" on public.commune_language_policies;
create policy "public reads coding cornucopia language policies"
  on public.commune_language_policies for select to anon, authenticated
  using (true);

drop policy if exists "public reads coding cornucopia sandbox policies" on public.commune_sandbox_policies;
create policy "public reads coding cornucopia sandbox policies"
  on public.commune_sandbox_policies for select to anon, authenticated
  using (true);

revoke all on schema private from public, anon, authenticated;
revoke all on table private.sandbox_proxy_secrets from public, anon, authenticated;

revoke insert, update, delete on table public.commune_sandbox_runs from public, anon, authenticated;
revoke insert, update, delete on table public.commune_code_diagnostics from public, anon, authenticated;
grant select on table public.commune_sandbox_runs to authenticated;
grant select on table public.commune_code_diagnostics to authenticated;
grant select on table public.commune_language_policies to anon, authenticated;
grant select on table public.commune_sandbox_policies to anon, authenticated;

revoke execute on function public.record_commune_sandbox_run_result(
  text, text, text, uuid, uuid, uuid, text, text, text, jsonb, jsonb,
  text, text, integer, integer, jsonb
) from public, anon, authenticated;

revoke execute on function public.current_user_sandbox_access()
  from public, anon, authenticated;
grant execute on function public.current_user_sandbox_access() to authenticated;

revoke execute on function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) to authenticated;

revoke execute on function public.start_commune_sandbox_run(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.start_commune_sandbox_run(uuid, uuid, text)
  to authenticated;

revoke execute on function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb
) to authenticated;

revoke execute on function public.reconcile_stale_commune_sandbox_runs()
  from public, anon, authenticated;
grant execute on function public.reconcile_stale_commune_sandbox_runs()
  to authenticated;

revoke execute on function private.sandbox_finalizer_token_is_valid(text)
  from public, anon, authenticated;
revoke execute on function private.sandbox_source_is_authorized(uuid, text, text, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function private.enforce_sandbox_run_status_transition()
  from public, anon, authenticated;

-- Active migration repair snapshot (2026-07-14).

-- Generated from the three additive migrations that follow the remote baseline.

-- Canonical source: supabase/migrations/20260714015000_commune_reaction_counts_security_invoker.sql

-- Resolve the Supabase Security Advisor security-definer-view finding without
-- exposing reaction identities or changing the existing reaction mutation API.
--
-- The public view becomes SECURITY INVOKER and reads a userless aggregate table.
-- RLS on that table delegates visibility to the existing parent post/comment
-- policies, so anonymous readers, members, authors, reviewers, and admins see
-- counts only for content they can already select.

begin;

create table public.commune_content_reaction_totals (
  target_type text not null
    constraint commune_content_reaction_totals_target_type_check
    check (target_type in ('post', 'comment')),
  target_id uuid not null,
  helpful_count integer not null default 0
    constraint commune_content_reaction_totals_helpful_count_check
    check (helpful_count >= 0),
  caution_count integer not null default 0
    constraint commune_content_reaction_totals_caution_count_check
    check (caution_count >= 0),
  updated_at timestamptz not null default now(),
  constraint commune_content_reaction_totals_pkey
    primary key (target_type, target_id)
);

alter table public.commune_content_reaction_totals owner to postgres;
alter table public.commune_content_reaction_totals enable row level security;

revoke all privileges on table public.commune_content_reaction_totals
  from public, anon, authenticated, service_role;

create policy "visible content reaction totals are readable"
  on public.commune_content_reaction_totals
  for select
  to anon, authenticated
  using (
    (
      target_type = 'post'
      and exists (
        select 1
        from public.commune_posts as post
        where post.id = commune_content_reaction_totals.target_id
      )
    )
    or
    (
      target_type = 'comment'
      and exists (
        select 1
        from public.commune_comments as comment
        where comment.id = commune_content_reaction_totals.target_id
      )
    )
  );

grant select on table public.commune_content_reaction_totals
  to anon, authenticated;

create or replace function public.sync_commune_content_reaction_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'UPDATE') then
    update public.commune_content_reaction_totals
       set helpful_count = greatest(
             0,
             helpful_count - case when old.reaction = 'helpful' then 1 else 0 end
           ),
           caution_count = greatest(
             0,
             caution_count - case when old.reaction = 'caution' then 1 else 0 end
           ),
           updated_at = pg_catalog.now()
     where target_type = old.target_type
       and target_id = old.target_id;

    delete from public.commune_content_reaction_totals
     where target_type = old.target_type
       and target_id = old.target_id
       and helpful_count = 0
       and caution_count = 0;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.commune_content_reaction_totals (
      target_type,
      target_id,
      helpful_count,
      caution_count,
      updated_at
    ) values (
      new.target_type,
      new.target_id,
      case when new.reaction = 'helpful' then 1 else 0 end,
      case when new.reaction = 'caution' then 1 else 0 end,
      pg_catalog.now()
    )
    on conflict (target_type, target_id) do update
       set helpful_count = public.commune_content_reaction_totals.helpful_count
             + excluded.helpful_count,
           caution_count = public.commune_content_reaction_totals.caution_count
             + excluded.caution_count,
           updated_at = pg_catalog.now();
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

alter function public.sync_commune_content_reaction_totals() owner to postgres;
revoke all privileges on function public.sync_commune_content_reaction_totals()
  from public, anon, authenticated, service_role;

drop trigger if exists sync_commune_content_reaction_totals
  on public.commune_content_reactions;
create trigger sync_commune_content_reaction_totals
after insert or update of target_type, target_id, reaction or delete
on public.commune_content_reactions
for each row execute function public.sync_commune_content_reaction_totals();

-- This is an intentional derived-data backfill. It copies no user identifiers,
-- submitted content, private notes, or reaction row IDs.
insert into public.commune_content_reaction_totals (
  target_type,
  target_id,
  helpful_count,
  caution_count,
  updated_at
)
select
  reaction.target_type,
  reaction.target_id,
  count(*) filter (where reaction.reaction = 'helpful')::integer,
  count(*) filter (where reaction.reaction = 'caution')::integer,
  pg_catalog.now()
from public.commune_content_reactions as reaction
group by reaction.target_type, reaction.target_id;

create or replace view public.commune_content_reaction_counts
with (security_invoker = true, security_barrier = true)
as
select
  total.target_type,
  total.target_id,
  total.helpful_count,
  total.caution_count
from public.commune_content_reaction_totals as total;

alter view public.commune_content_reaction_counts owner to postgres;
revoke all privileges on table public.commune_content_reaction_counts
  from public, anon, authenticated, service_role;
grant select on table public.commune_content_reaction_counts
  to anon, authenticated;

comment on table public.commune_content_reaction_totals is
  'Userless reaction aggregates maintained by a locked trigger and filtered through parent-content RLS.';
comment on function public.sync_commune_content_reaction_totals is
  'Maintains userless reaction aggregates. Trigger-only; direct execution is revoked from API roles.';
comment on view public.commune_content_reaction_counts is
  'SECURITY INVOKER reaction counts; parent-content visibility is enforced by RLS on the aggregate table.';

commit;

-- Canonical source: supabase/migrations/20260714020000_repository_showcase_structured_metadata_repair.sql

-- Repository Showcase structured metadata and public detail read-policy repair.
-- Idempotent and additive. Apply only after the baseline history checkpoint.
-- This does not clone, install, build, run, trust, or approve repositories.

begin;

alter table public.commune_repository_showcases
  add column if not exists provider text,
  add column if not exists default_branch text,
  add column if not exists commit_sha text,
  add column if not exists manifest_status text not null default 'No manifest checked',
  add column if not exists elysia_compatibility text not null default 'Unknown',
  add column if not exists short_description text,
  add column if not exists readme_preview text,
  add column if not exists file_tree_preview text,
  add column if not exists screenshot_notes_or_urls text,
  add column if not exists risk_flags text[] not null default '{}'::text[],
  add column if not exists sandbox_review_status text not null default 'not_requested',
  add column if not exists sandbox_review_request_id uuid references public.commune_sandbox_review_requests(id) on delete set null,
  add column if not exists import_source text not null default 'manual',
  add column if not exists imported_metadata jsonb not null default '{}'::jsonb,
  add column if not exists imported_at timestamptz,
  add column if not exists redaction_notes text;

update public.commune_repository_showcases
set
  provider = coalesce(provider, repository_host),
  short_description = coalesce(short_description, project_summary),
  risk_flags = case
    when coalesce(array_length(risk_flags, 1), 0) > 0 then risk_flags
    when safety_notes is not null and btrim(safety_notes) <> '' then regexp_split_to_array(safety_notes, '\s*,\s*')
    else risk_flags
  end,
  sandbox_review_status = case
    when sandbox_review_status is not null and sandbox_review_status <> 'not_requested' then sandbox_review_status
    when sandbox_review_requested then 'requested'
    else 'not_requested'
  end
where (provider is null and repository_host is not null)
   or (short_description is null and project_summary is not null)
   or (
     coalesce(array_length(risk_flags, 1), 0) = 0
     and safety_notes is not null
     and btrim(safety_notes) <> ''
   )
   or (
     sandbox_review_status = 'not_requested'
     and sandbox_review_requested
   );

do $repository_repair$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'commune_repository_showcases_sandbox_review_status_check'
      and conrelid = 'public.commune_repository_showcases'::regclass
  ) then
    alter table public.commune_repository_showcases
      add constraint commune_repository_showcases_sandbox_review_status_check
      check (sandbox_review_status in ('not_requested','requested','queued','in_review','approved_for_selected_artifact','rejected','needs_information','archived')) not valid;
  end if;

  alter table public.commune_repository_showcases
    validate constraint commune_repository_showcases_sandbox_review_status_check;
end
$repository_repair$;

create index if not exists commune_repository_showcases_post_idx on public.commune_repository_showcases(post_id);
create index if not exists commune_repository_showcases_owner_status_idx on public.commune_repository_showcases(user_id, status, updated_at desc);
create index if not exists commune_repository_showcases_sandbox_review_idx on public.commune_repository_showcases(sandbox_review_requested, sandbox_review_status, updated_at desc);
create index if not exists commune_repository_showcases_sandbox_request_idx on public.commune_repository_showcases(sandbox_review_request_id);

drop policy if exists "public reads published repository showcase metadata" on public.commune_repository_showcases;
create policy "public reads published repository showcase metadata" on public.commune_repository_showcases
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_posts p
      where p.id = post_id
        and p.post_type = 'repository_showcase'
        and p.status = 'published'
        and p.visibility = 'public'
    )
    or user_id = auth.uid()
    or public.current_user_can_review_domain('commune'::public.review_domain)
  );

revoke all privileges on table public.commune_repository_showcases
  from public, anon, authenticated;
grant select on table public.commune_repository_showcases to anon;
grant select, insert, update on table public.commune_repository_showcases to authenticated;

comment on table public.commune_repository_showcases is 'Repository Showcase metadata. Metadata-only public room; does not clone, install, build, run, approve, or trust repositories.';
comment on column public.commune_repository_showcases.readme_preview is 'User-reviewed public README excerpt/import preview. The website does not clone/build/run repositories.';
comment on column public.commune_repository_showcases.file_tree_preview is 'User-reviewed public file tree summary/import preview. Metadata only.';
comment on column public.commune_repository_showcases.sandbox_review_status is 'Selected-artifact sandbox review status only. This is not whole-repository trust, Marketplace approval, or installability.';
comment on column public.commune_repository_showcases.imported_metadata is 'Public import metadata/manual manifest details after user review; must not include private repo credentials or secrets.';

commit;

-- Canonical source: supabase/migrations/20260714030000_sandbox_proxy_access_and_reservation.sql

-- Governed Coding Cornucopia sandbox proxy access, reservations, and finalization.
-- Additive only. Review and apply at the explicit production checkpoint.
-- No secret value belongs in this migration: private.sandbox_proxy_secrets is
-- provisioned with a NULL hash and must be initialized directly by an operator.

begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
alter schema private owner to postgres;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.sandbox_proxy_secrets (
  secret_name text primary key,
  secret_hash_hex char(64),
  rotated_at timestamptz,
  constraint sandbox_proxy_secret_hash_check check (
    secret_hash_hex is null or secret_hash_hex ~ '^[0-9a-f]{64}$'
  )
);
alter table private.sandbox_proxy_secrets owner to postgres;

revoke all on table private.sandbox_proxy_secrets from public, anon, authenticated;

insert into private.sandbox_proxy_secrets(secret_name, secret_hash_hex)
values ('sandbox_db_finalizer', null)
on conflict (secret_name) do nothing;

alter table public.commune_sandbox_runs
  add column if not exists client_request_id uuid,
  add column if not exists code_sha256 char(64),
  add column if not exists code_bytes integer,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists finalized_at timestamptz,
  add column if not exists attempt_count integer not null default 1,
  add column if not exists output_truncated boolean not null default false;

update public.commune_sandbox_runs
set client_request_id = gen_random_uuid()
where client_request_id is null;

alter table public.commune_sandbox_runs
  alter column client_request_id set default gen_random_uuid(),
  alter column client_request_id set not null;

alter table public.commune_sandbox_runs
  drop constraint if exists commune_sandbox_runs_status_check;

alter table public.commune_sandbox_runs
  add constraint commune_sandbox_runs_status_check check (
    status in (
      'draft', 'requested', 'queued', 'running', 'completed', 'failed',
      'denied', 'policy_blocked', 'sandbox_unavailable'
    )
  );

alter table public.commune_sandbox_runs
  drop constraint if exists commune_sandbox_runs_code_hash_check;

alter table public.commune_sandbox_runs
  add constraint commune_sandbox_runs_code_hash_check check (
    code_sha256 is null or code_sha256 ~ '^[0-9a-f]{64}$'
  );

alter table public.commune_sandbox_runs
  drop constraint if exists commune_sandbox_runs_code_bytes_check;

alter table public.commune_sandbox_runs
  add constraint commune_sandbox_runs_code_bytes_check check (
    code_bytes is null or code_bytes between 0 and 65536
  );

create unique index if not exists commune_sandbox_runs_idempotency_idx
  on public.commune_sandbox_runs(requester_user_id, client_request_id)
  where requester_user_id is not null;

create index if not exists commune_sandbox_runs_active_lease_idx
  on public.commune_sandbox_runs(requester_user_id, reservation_expires_at)
  where status in ('queued', 'running');

insert into public.commune_sandbox_policies(policy_key, policy_value, notes)
values
  (
    'v1_resource_limits',
    '{"cpus":"0.5","memory":"256m","timeout_seconds":5,"pids_limit":32,"max_output_bytes":65536,"hard_output_bytes":98304,"max_concurrent_runs":1,"queue":false}'::jsonb,
    'Production V1 is one rootless Podman execution at a time with no in-process queue.'
  ),
  (
    'v1_request_quota',
    '{"member":{"per_hour":10,"per_day":30},"reviewer":{"per_hour":20,"per_day":60},"admin":{"per_hour":30,"per_day":100},"reservation_lease_seconds":60,"busy_retry_after_seconds":4}'::jsonb,
    'Atomic per-user reservation limits derived from server-side roles. Every tier has identical container isolation.'
  )
on conflict (policy_key) do update set
  policy_value = excluded.policy_value,
  notes = excluded.notes,
  updated_at = now();

-- The former browser-callable function accepted arbitrary success results.
-- Keep the historical migration intact, but remove every API role's ability to
-- execute that exact overload.
revoke execute on function public.record_commune_sandbox_run_result(
  text, text, text, uuid, uuid, uuid, text, text, text, jsonb, jsonb,
  text, text, integer, integer, jsonb
) from public, anon, authenticated, service_role;

revoke all privileges on table public.commune_sandbox_runs from public, anon, authenticated;
revoke all privileges on table public.commune_code_diagnostics from public, anon, authenticated;
grant select on table public.commune_sandbox_runs to authenticated;
grant select on table public.commune_code_diagnostics to authenticated;

drop policy if exists "users create own coding cornucopia sandbox run requests" on public.commune_sandbox_runs;
drop policy if exists "reviewers update coding cornucopia sandbox runs" on public.commune_sandbox_runs;
drop policy if exists "reviewers write coding cornucopia diagnostics" on public.commune_code_diagnostics;

create or replace function private.enforce_sandbox_run_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status = 'requested')
    or (old.status = 'requested' and new.status in ('queued', 'denied', 'policy_blocked', 'sandbox_unavailable'))
    or (old.status = 'queued' and new.status in ('running', 'denied', 'policy_blocked', 'sandbox_unavailable'))
    or (old.status = 'running' and new.status in ('completed', 'failed', 'denied', 'policy_blocked', 'sandbox_unavailable'))
  ) then
    raise exception using errcode = '55000', message = 'sandbox_transition_invalid';
  end if;

  return new;
end;
$$;

alter function private.enforce_sandbox_run_status_transition() owner to postgres;

revoke execute on function private.enforce_sandbox_run_status_transition()
  from public, anon, authenticated, service_role;

drop trigger if exists enforce_sandbox_run_status_transition on public.commune_sandbox_runs;
create trigger enforce_sandbox_run_status_transition
before update of status on public.commune_sandbox_runs
for each row execute function private.enforce_sandbox_run_status_transition();

create or replace function private.sandbox_finalizer_token_is_valid(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.sandbox_proxy_secrets as secret
    where secret.secret_name = 'sandbox_db_finalizer'
      and secret.secret_hash_hex is not null
      and length(coalesce(p_token, '')) between 32 and 512
      and secret.secret_hash_hex = encode(extensions.digest(p_token, 'sha256'), 'hex')
  );
$$;

alter function private.sandbox_finalizer_token_is_valid(text) owner to postgres;

revoke execute on function private.sandbox_finalizer_token_is_valid(text)
  from public, anon, authenticated, service_role;

create or replace function private.sandbox_actor_is_active(p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as account
    join public.profiles as profile on profile.id = account.id
    where account.id = p_actor
      and account.deleted_at is null
      and account.is_anonymous is false
      and (account.banned_until is null or account.banned_until <= pg_catalog.now())
  );
$$;

alter function private.sandbox_actor_is_active(uuid) owner to postgres;

revoke execute on function private.sandbox_actor_is_active(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.current_user_sandbox_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then
      jsonb_build_object('authorized', false, 'reason', 'authentication_required')
    when not exists (select 1 from public.profiles where id = auth.uid()) then
      jsonb_build_object('authorized', false, 'reason', 'profile_required')
    when not private.sandbox_actor_is_active(auth.uid()) then
      jsonb_build_object('authorized', false, 'reason', 'account_disabled')
    else
      jsonb_build_object(
        'authorized', true,
        'reason', 'authorized',
        'tier', case
          when public.current_user_is_admin() then 'admin'
          when public.current_user_can_review_domain('commune'::public.review_domain) then 'reviewer'
          else 'member'
        end,
        'limits', case
          when public.current_user_is_admin() then jsonb_build_object('perHour', 30, 'perDay', 100)
          when public.current_user_can_review_domain('commune'::public.review_domain) then jsonb_build_object('perHour', 20, 'perDay', 60)
          else jsonb_build_object('perHour', 10, 'perDay', 30)
        end,
        'reviewer', (
          public.current_user_is_admin()
          or public.current_user_can_review_domain('commune'::public.review_domain)
        )
      )
  end;
$$;

alter function public.current_user_sandbox_access() owner to postgres;

revoke execute on function public.current_user_sandbox_access()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_sandbox_access() to authenticated;

drop policy if exists "public reads published commune code snippets" on public.commune_code_snippets;
create policy "public reads published commune code snippets" on public.commune_code_snippets
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.commune_posts as post
      where post.id = public.commune_code_snippets.post_id
        and post.status = 'published'
        and post.visibility = 'public'
    )
  );

create or replace function private.sandbox_source_is_authorized(
  p_actor uuid,
  p_source_type text,
  p_source_id text,
  p_post_id uuid,
  p_code_document_id uuid,
  p_code_version_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_reviewer boolean;
begin
  if p_source_type = 'manual_snapshot' then
    return nullif(trim(coalesce(p_source_id, '')), '') is null
      and p_post_id is null
      and p_code_document_id is null
      and p_code_version_id is null;
  end if;

  if coalesce(p_source_id, '') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  v_source_id := p_source_id::uuid;
  v_reviewer := public.current_user_is_admin()
    or public.current_user_can_review_domain('commune'::public.review_domain);

  if p_source_type = 'commune_post_snippet' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_code_snippets as snippet
        join public.commune_posts as post on post.id = snippet.post_id
        where snippet.id = v_source_id
          and snippet.post_id = p_post_id
          and (
            (post.status = 'published' and post.visibility = 'public')
            or snippet.author_user_id = p_actor
            or v_reviewer
          )
      );
  elsif p_source_type = 'commune_code_document' then
    return p_post_id is null
      and p_code_version_id is null
      and p_code_document_id = v_source_id
      and exists (
        select 1
        from public.commune_code_documents as document
        where document.id = v_source_id
          and (document.visibility_state = 'published' or document.owner_user_id = p_actor or v_reviewer)
      );
  elsif p_source_type = 'commune_code_version' then
    return p_post_id is null
      and p_code_version_id = v_source_id
      and exists (
        select 1
        from public.commune_code_document_versions as version
        join public.commune_code_documents as document on document.id = version.document_id
        where version.id = v_source_id
          and version.document_id = p_code_document_id
          and (document.visibility_state = 'published' or document.owner_user_id = p_actor or v_reviewer)
      );
  elsif p_source_type = 'commune_code_revision_proposal' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_code_revision_proposals as proposal
        where proposal.id = v_source_id
          and proposal.post_id = p_post_id
          and (proposal.proposer_user_id = p_actor or proposal.original_author_user_id = p_actor or v_reviewer)
      );
  elsif p_source_type = 'repository_showcase_artifact' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_repository_showcases as showcase
        join public.commune_posts as post on post.id = showcase.post_id
        where showcase.id = v_source_id
          and showcase.post_id = p_post_id
          and (
            (post.post_type = 'repository_showcase' and post.status = 'published' and post.visibility = 'public')
            or showcase.user_id = p_actor
            or v_reviewer
          )
      );
  elsif p_source_type = 'iteration_showcase_artifact' then
    return p_code_document_id is null
      and p_code_version_id is null
      and exists (
        select 1
        from public.commune_iteration_showcases as showcase
        join public.commune_posts as post on post.id = showcase.post_id
        where showcase.id = v_source_id
          and showcase.post_id = p_post_id
          and (
            (post.post_type = 'elysia_iteration_showcase' and post.status = 'published' and post.visibility = 'public')
            or showcase.author_user_id = p_actor
            or v_reviewer
          )
      );
  end if;

  return false;
end;
$$;

alter function private.sandbox_source_is_authorized(uuid, text, text, uuid, uuid, uuid)
  owner to postgres;

revoke execute on function private.sandbox_source_is_authorized(uuid, text, text, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.reserve_commune_sandbox_run(
  p_client_request_id uuid,
  p_snapshot_id text,
  p_source_type text,
  p_source_id text,
  p_post_id uuid,
  p_code_document_id uuid,
  p_code_version_id uuid,
  p_language text,
  p_file_name text,
  p_code_sha256 text,
  p_code_bytes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_existing public.commune_sandbox_runs%rowtype;
  v_run public.commune_sandbox_runs%rowtype;
  v_hour_count integer;
  v_day_count integer;
  v_hour_limit integer;
  v_day_limit integer;
  v_source_type text := trim(coalesce(p_source_type, ''));
  v_language text := lower(trim(coalesce(p_language, '')));
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'sandbox_authentication_required';
  end if;

  if not exists (select 1 from public.profiles where id = v_actor) then
    raise exception using errcode = '42501', message = 'sandbox_profile_required';
  end if;

  if not private.sandbox_actor_is_active(v_actor) then
    raise exception using errcode = '42501', message = 'sandbox_account_disabled';
  end if;

  if public.current_user_is_admin() then
    v_hour_limit := 30;
    v_day_limit := 100;
  elsif public.current_user_can_review_domain('commune'::public.review_domain) then
    v_hour_limit := 20;
    v_day_limit := 60;
  else
    v_hour_limit := 10;
    v_day_limit := 30;
  end if;

  if p_client_request_id is null then
    raise exception using errcode = '22023', message = 'sandbox_client_request_id_required';
  end if;

  if length(trim(coalesce(p_snapshot_id, ''))) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'sandbox_snapshot_id_invalid';
  end if;

  if v_source_type not in (
    'commune_post_snippet',
    'commune_code_document',
    'commune_code_version',
    'commune_code_revision_proposal',
    'repository_showcase_artifact',
    'iteration_showcase_artifact',
    'manual_snapshot'
  ) then
    raise exception using errcode = '22023', message = 'sandbox_source_type_invalid';
  end if;

  if v_source_type <> 'manual_snapshot' and coalesce(p_source_id, '') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception using errcode = '22023', message = 'sandbox_source_id_invalid';
  end if;

  if not private.sandbox_source_is_authorized(
    v_actor, v_source_type, p_source_id, p_post_id, p_code_document_id, p_code_version_id
  ) then
    raise exception using errcode = '42501', message = 'sandbox_source_unauthorized';
  end if;

  if v_language not in ('python', 'javascript', 'typescript', 'json', 'yaml', 'markdown', 'html', 'css') then
    raise exception using errcode = '22023', message = 'sandbox_language_invalid';
  end if;

  if coalesce(p_code_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'sandbox_code_hash_invalid';
  end if;

  if p_code_bytes is null or p_code_bytes not between 1 and 65536 then
    raise exception using errcode = '22023', message = 'sandbox_code_size_invalid';
  end if;

  -- Serialize reservations per user so active-run and quota checks cannot race.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text, 0));

  update public.commune_sandbox_runs
  set
    status = 'sandbox_unavailable',
    result_summary = jsonb_build_object(
      'ok', false,
      'message', 'The reservation expired before finalization.',
      'reason', 'reservation_expired',
      'diagnostics', '[]'::jsonb
    ),
    completed_at = now(),
    finalized_at = now(),
    reservation_expires_at = null,
    updated_at = now()
  where requester_user_id = v_actor
    and status in ('queued', 'running')
    and reservation_expires_at < now();

  select * into v_existing
  from public.commune_sandbox_runs
  where requester_user_id = v_actor
    and client_request_id = p_client_request_id;

  if found then
    if v_existing.code_sha256 is distinct from p_code_sha256
       or v_existing.source_type is distinct from v_source_type
       or v_existing.source_id is distinct from nullif(trim(coalesce(p_source_id, '')), '')
       or v_existing.snapshot_id is distinct from trim(p_snapshot_id)
       or v_existing.language is distinct from v_language
       or v_existing.file_name is distinct from nullif(left(trim(coalesce(p_file_name, '')), 160), '')
       or v_existing.post_id is distinct from p_post_id
       or v_existing.code_document_id is distinct from p_code_document_id
       or v_existing.code_version_id is distinct from p_code_version_id
       or v_existing.code_bytes is distinct from p_code_bytes
    then
      raise exception using errcode = '23505', message = 'sandbox_idempotency_conflict';
    end if;

    update public.commune_sandbox_runs
    set attempt_count = attempt_count + 1,
        updated_at = now()
    where id = v_existing.id
    returning * into v_existing;

    return jsonb_build_object(
      'accepted', true,
      'idempotentReplay', true,
      'runId', v_existing.id,
      'status', v_existing.status,
      'leaseExpiresAt', v_existing.reservation_expires_at,
      'result', case when v_existing.status in ('completed','failed','denied','policy_blocked','sandbox_unavailable')
        then jsonb_build_object(
          'ok', coalesce((v_existing.result_summary ->> 'ok')::boolean, false),
          'status', v_existing.status,
          'language', v_existing.language,
          'file', v_existing.file_name,
          'snapshotId', v_existing.snapshot_id,
          'stdout', coalesce(v_existing.stdout_preview, ''),
          'stderr', coalesce(v_existing.stderr_preview, ''),
          'exitCode', v_existing.exit_code,
          'durationMs', v_existing.duration_ms,
          'outputTruncated', v_existing.output_truncated,
          'diagnostics', coalesce(v_existing.result_summary -> 'diagnostics', '[]'::jsonb),
          'message', coalesce(v_existing.result_summary ->> 'message', 'Sandbox run finalized.')
        ) else null end
    );
  end if;

  if exists (
    select 1 from public.commune_sandbox_runs
    where requester_user_id = v_actor
      and status in ('queued', 'running')
      and reservation_expires_at >= now()
  ) then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'active_reservation',
      'retryAfter', 4
    );
  end if;

  select count(*) into v_hour_count
  from public.commune_sandbox_runs
  where requester_user_id = v_actor
    and client_request_id is not null
    and code_sha256 is not null
    and created_at >= now() - interval '1 hour';

  select count(*) into v_day_count
  from public.commune_sandbox_runs
  where requester_user_id = v_actor
    and client_request_id is not null
    and code_sha256 is not null
    and created_at >= now() - interval '24 hours';

  if v_hour_count >= v_hour_limit or v_day_count >= v_day_limit then
    return jsonb_build_object(
      'accepted', false,
      'reason', 'quota_exceeded',
      'retryAfter', case when v_hour_count >= v_hour_limit then 3600 else 86400 end
    );
  end if;

  insert into public.commune_sandbox_runs (
    requester_user_id,
    post_id,
    code_document_id,
    code_version_id,
    source_type,
    source_id,
    snapshot_id,
    language,
    file_name,
    status,
    request_payload,
    result_summary,
    public_visibility,
    client_request_id,
    code_sha256,
    code_bytes,
    reservation_expires_at
  ) values (
    v_actor,
    p_post_id,
    p_code_document_id,
    p_code_version_id,
    v_source_type,
    nullif(trim(coalesce(p_source_id, '')), ''),
    trim(p_snapshot_id),
    v_language,
    nullif(left(trim(coalesce(p_file_name, '')), 160), ''),
    'queued',
    jsonb_build_object(
      'client_request_id', p_client_request_id,
      'source_type', v_source_type,
      'source_id', nullif(trim(coalesce(p_source_id, '')), ''),
      'snapshot_id', trim(p_snapshot_id),
      'language', v_language,
      'file_name', nullif(left(trim(coalesce(p_file_name, '')), 160), ''),
      'code_sha256', p_code_sha256,
      'code_bytes', p_code_bytes,
      'network_policy', 'disabled',
      'filesystem_policy', 'temporary_workspace_only'
    ),
    '{}'::jsonb,
    'private',
    p_client_request_id,
    p_code_sha256,
    p_code_bytes,
    now() + interval '60 seconds'
  ) returning * into v_run;

  return jsonb_build_object(
    'accepted', true,
    'idempotentReplay', false,
    'runId', v_run.id,
    'status', v_run.status,
    'leaseExpiresAt', v_run.reservation_expires_at
  );
end;
$$;

alter function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) owner to postgres;

revoke execute on function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.reserve_commune_sandbox_run(
  uuid, text, text, text, uuid, uuid, uuid, text, text, text, integer
) to authenticated;

create or replace function public.start_commune_sandbox_run(
  p_run_id uuid,
  p_client_request_id uuid,
  p_finalizer_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_run public.commune_sandbox_runs%rowtype;
begin
  if v_actor is null or not private.sandbox_finalizer_token_is_valid(p_finalizer_token) then
    raise exception using errcode = '42501', message = 'sandbox_finalizer_denied';
  end if;

  update public.commune_sandbox_runs
  set
    status = 'running',
    started_at = coalesce(started_at, now()),
    reservation_expires_at = now() + interval '60 seconds',
    updated_at = now()
  where id = p_run_id
    and requester_user_id = v_actor
    and client_request_id = p_client_request_id
    and status = 'queued'
    and reservation_expires_at >= now()
  returning * into v_run;

  if not found then
    raise exception using errcode = '55000', message = 'sandbox_reservation_not_startable';
  end if;

  return jsonb_build_object(
    'runId', v_run.id,
    'status', v_run.status,
    'leaseExpiresAt', v_run.reservation_expires_at
  );
end;
$$;

alter function public.start_commune_sandbox_run(uuid, uuid, text) owner to postgres;

revoke execute on function public.start_commune_sandbox_run(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.start_commune_sandbox_run(uuid, uuid, text) to authenticated;

create or replace function public.finalize_commune_sandbox_run(
  p_run_id uuid,
  p_client_request_id uuid,
  p_finalizer_token text,
  p_status text,
  p_ok boolean,
  p_message text,
  p_stdout_preview text,
  p_stderr_preview text,
  p_exit_code integer,
  p_duration_ms integer,
  p_output_truncated boolean,
  p_diagnostics jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_run public.commune_sandbox_runs%rowtype;
  v_diag jsonb;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_severity text;
  v_phase text;
  v_category text;
  v_line integer;
  v_column integer;
  v_diagnostics jsonb := '[]'::jsonb;
begin
  if v_actor is null or not private.sandbox_finalizer_token_is_valid(p_finalizer_token) then
    raise exception using errcode = '42501', message = 'sandbox_finalizer_denied';
  end if;

  if v_status not in ('completed', 'failed', 'denied', 'policy_blocked', 'sandbox_unavailable') then
    raise exception using errcode = '22023', message = 'sandbox_final_status_invalid';
  end if;

  if coalesce(p_ok, false) is distinct from (v_status = 'completed') then
    raise exception using errcode = '22023', message = 'sandbox_final_result_inconsistent';
  end if;

  select * into v_run
  from public.commune_sandbox_runs
  where id = p_run_id
    and requester_user_id = v_actor
    and client_request_id = p_client_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'sandbox_reservation_not_found';
  end if;

  if v_run.status in ('completed', 'failed', 'denied', 'policy_blocked', 'sandbox_unavailable') then
    return jsonb_build_object('runId', v_run.id, 'status', v_run.status, 'alreadyFinalized', true);
  end if;

  if v_run.status not in ('queued', 'running') then
    raise exception using errcode = '55000', message = 'sandbox_transition_invalid';
  end if;

  if v_run.status = 'queued' and v_status not in ('denied', 'policy_blocked', 'sandbox_unavailable') then
    raise exception using errcode = '55000', message = 'sandbox_transition_invalid';
  end if;

  if jsonb_typeof(coalesce(p_diagnostics, '[]'::jsonb)) = 'array' then
    for v_diag in select value from jsonb_array_elements(p_diagnostics) limit 40 loop
      v_severity := coalesce(v_diag ->> 'severity', 'info');
      if v_severity not in ('info', 'warning', 'error') then v_severity := 'info'; end if;
      v_phase := coalesce(v_diag ->> 'phase', 'sandbox');
      if v_phase not in ('static', 'policy', 'runtime', 'sandbox', 'security') then v_phase := 'sandbox'; end if;
      v_category := coalesce(v_diag ->> 'category', 'sandbox_internal_failure');
      if v_category not in (
        'syntax_error', 'type_error', 'compile_error', 'runtime_error', 'test_failure',
        'lint_warning', 'dependency_blocked', 'network_denied', 'filesystem_denied',
        'timeout', 'memory_exceeded', 'output_truncated', 'forbidden_operation',
        'secret_scan_warning', 'unsupported_language', 'sandbox_internal_failure', 'policy_info'
      ) then v_category := 'sandbox_internal_failure'; end if;
      v_line := case when coalesce(v_diag ->> 'line', '') ~ '^[0-9]{1,7}$' then (v_diag ->> 'line')::integer else null end;
      v_column := case when coalesce(v_diag ->> 'column', '') ~ '^[0-9]{1,7}$' then (v_diag ->> 'column')::integer else null end;

      v_diagnostics := v_diagnostics || jsonb_build_array(jsonb_build_object(
        'severity', v_severity,
        'phase', v_phase,
        'category', v_category,
        'language', v_run.language,
        'file', v_run.file_name,
        'line', v_line,
        'column', v_column,
        'message', left(coalesce(v_diag ->> 'message', 'Sandbox diagnostic.'), 1000),
        'source', 'Coding Cornucopia sandbox'
      ));
    end loop;
  end if;

  update public.commune_sandbox_runs
  set
    status = v_status,
    result_summary = jsonb_build_object(
      'ok', coalesce(p_ok, false),
      'message', left(coalesce(p_message, 'Sandbox run finalized.'), 500),
      'diagnostics', v_diagnostics
    ),
    stdout_preview = left(coalesce(p_stdout_preview, ''), 32768),
    stderr_preview = left(coalesce(p_stderr_preview, ''), 32768),
    exit_code = case when p_exit_code between -1 and 255 then p_exit_code else null end,
    duration_ms = case when p_duration_ms between 0 and 15000 then p_duration_ms else null end,
    output_truncated = coalesce(p_output_truncated, false),
    completed_at = now(),
    finalized_at = now(),
    reservation_expires_at = null,
    updated_at = now()
  where id = v_run.id;

  delete from public.commune_code_diagnostics where run_id = v_run.id;

  for v_diag in select value from jsonb_array_elements(v_diagnostics) loop
    insert into public.commune_code_diagnostics (
      run_id, post_id, code_document_id, code_version_id,
      severity, phase, category, language, file_name,
      line_number, column_number, message, source, public_visibility
    ) values (
      v_run.id, v_run.post_id, v_run.code_document_id, v_run.code_version_id,
      v_diag ->> 'severity', v_diag ->> 'phase', v_diag ->> 'category',
      v_run.language, v_run.file_name,
      case when jsonb_typeof(v_diag -> 'line') = 'number' then (v_diag ->> 'line')::integer else null end,
      case when jsonb_typeof(v_diag -> 'column') = 'number' then (v_diag ->> 'column')::integer else null end,
      v_diag ->> 'message', v_diag ->> 'source', 'private'
    );
  end loop;

  return jsonb_build_object('runId', v_run.id, 'status', v_status, 'alreadyFinalized', false);
end;
$$;

alter function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb
) owner to postgres;

revoke execute on function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.finalize_commune_sandbox_run(
  uuid, uuid, text, text, boolean, text, text, text, integer, integer, boolean, jsonb
) to authenticated;

create or replace function public.reconcile_stale_commune_sandbox_runs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception using errcode = '42501', message = 'sandbox_reconciliation_denied';
  end if;

  update public.commune_sandbox_runs
  set
    status = 'sandbox_unavailable',
    result_summary = jsonb_build_object(
      'ok', false,
      'message', 'The reservation expired before finalization.',
      'reason', 'reservation_expired',
      'diagnostics', '[]'::jsonb
    ),
    completed_at = now(),
    finalized_at = now(),
    reservation_expires_at = null,
    updated_at = now()
  where status in ('queued', 'running')
    and reservation_expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter function public.reconcile_stale_commune_sandbox_runs() owner to postgres;

revoke execute on function public.reconcile_stale_commune_sandbox_runs()
  from public, anon, authenticated, service_role;
grant execute on function public.reconcile_stale_commune_sandbox_runs()
  to authenticated;

comment on table private.sandbox_proxy_secrets is
  'Private hashes for narrowly scoped proxy credentials. Never store a plaintext token here.';
comment on function public.reserve_commune_sandbox_run is
  'Atomically reserves one governed sandbox run per authenticated user with idempotency, quota, and stale-lease recovery.';
comment on function public.finalize_commune_sandbox_run is
  'Finalizes a reserved run only when the caller JWT, user, idempotency key, run, lifecycle, and private proxy finalizer token all match.';
comment on function public.reconcile_stale_commune_sandbox_runs is
  'Allows an authenticated administrator to finalize genuinely stale sandbox leases without changing completed evidence.';

commit;
