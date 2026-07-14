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
