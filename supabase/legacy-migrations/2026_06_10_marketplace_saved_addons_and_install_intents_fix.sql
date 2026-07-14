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
