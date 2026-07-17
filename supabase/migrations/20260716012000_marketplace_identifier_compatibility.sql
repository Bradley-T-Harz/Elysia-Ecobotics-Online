-- Reconcile Marketplace account-storage identifiers without merging developer,
-- publisher, listing-review, commerce, or local-install authority.

begin;

alter table public.user_saved_addons
  add column if not exists addon_name text,
  add column if not exists notes text,
  add column if not exists addon_id uuid,
  add column if not exists addon_version_id uuid,
  add column if not exists marketplace_listing_id uuid,
  add column if not exists marketplace_addon_version_id uuid;

alter table public.user_saved_addons
  drop constraint if exists user_saved_addons_addon_slug_fkey;

do $saved_addon_foreign_keys$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'user_saved_addons_addon_id_fkey'
      and conrelid = 'public.user_saved_addons'::regclass
  ) then
    alter table public.user_saved_addons
      add constraint user_saved_addons_addon_id_fkey
      foreign key (addon_id) references public.addons(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'user_saved_addons_addon_version_id_fkey'
      and conrelid = 'public.user_saved_addons'::regclass
  ) then
    alter table public.user_saved_addons
      add constraint user_saved_addons_addon_version_id_fkey
      foreign key (addon_version_id) references public.addon_versions(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'user_saved_addons_marketplace_listing_id_fkey'
      and conrelid = 'public.user_saved_addons'::regclass
  ) then
    alter table public.user_saved_addons
      add constraint user_saved_addons_marketplace_listing_id_fkey
      foreign key (marketplace_listing_id)
      references public.marketplace_listings(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'user_saved_addons_marketplace_addon_version_id_fkey'
      and conrelid = 'public.user_saved_addons'::regclass
  ) then
    alter table public.user_saved_addons
      add constraint user_saved_addons_marketplace_addon_version_id_fkey
      foreign key (marketplace_addon_version_id)
      references public.marketplace_addon_versions(id) on delete set null;
  end if;
end
$saved_addon_foreign_keys$;

alter table public.user_saved_addons
  drop constraint if exists user_saved_addons_text_bounds_check;
alter table public.user_saved_addons
  add constraint user_saved_addons_text_bounds_check check (
    pg_catalog.char_length(addon_slug) between 1 and 200
    and pg_catalog.char_length(coalesce(addon_name, '')) <= 500
    and pg_catalog.char_length(coalesce(notes, '')) <= 2000
  ) not valid;
alter table public.user_saved_addons
  validate constraint user_saved_addons_text_bounds_check;

create index if not exists user_saved_addons_marketplace_listing_idx
  on public.user_saved_addons(marketplace_listing_id)
  where marketplace_listing_id is not null;

create or replace function public.resolve_user_saved_addon_identifiers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.marketplace_listings%rowtype;
  v_listing_was_resolved boolean := false;
begin
  if new.marketplace_listing_id is not null then
    select * into v_listing
    from public.marketplace_listings as listing
    where listing.id = new.marketplace_listing_id;
    if not found or v_listing.slug <> new.addon_slug then
      raise exception using errcode = '23514', message = 'saved_addon_listing_slug_mismatch';
    end if;
    new.addon_name := coalesce(new.addon_name, v_listing.name);
  else
    select * into v_listing
    from public.marketplace_listings as listing
    where listing.slug = new.addon_slug
      and listing.listing_status = 'published'
      and listing.revoked_at is null
    limit 1;
    if found then
      new.marketplace_listing_id := v_listing.id;
      new.addon_name := coalesce(new.addon_name, v_listing.name);
      v_listing_was_resolved := true;
    end if;
  end if;

  if new.marketplace_addon_version_id is not null then
    if new.marketplace_listing_id is null then
      select version.listing_id into new.marketplace_listing_id
      from public.marketplace_addon_versions as version
      where version.id = new.marketplace_addon_version_id;
      if not found then
        raise exception using errcode = '23503', message = 'saved_addon_marketplace_version_not_found';
      end if;
      if not exists (
        select 1 from public.marketplace_listings as listing
        where listing.id = new.marketplace_listing_id
          and listing.slug = new.addon_slug
      ) then
        raise exception using errcode = '23514', message = 'saved_addon_marketplace_version_slug_mismatch';
      end if;
    elsif not exists (
      select 1 from public.marketplace_addon_versions as version
      where version.id = new.marketplace_addon_version_id
        and version.listing_id = new.marketplace_listing_id
    ) then
      raise exception using errcode = '23514', message = 'saved_addon_marketplace_version_listing_mismatch';
    end if;
  end if;

  if new.marketplace_listing_id is not null
     and new.marketplace_addon_version_id is null
     and (tg_op = 'INSERT' or v_listing_was_resolved) then
    select version.id
    into new.marketplace_addon_version_id
    from public.marketplace_addon_versions as version
    where version.listing_id = new.marketplace_listing_id
      and version.revoked_at is null
      and version.review_status in ('approved', 'published')
    order by version.published_at desc nulls last, version.created_at desc
    limit 1;
  end if;

  if new.addon_id is null then
    select addon.id, coalesce(new.addon_name, addon.name)
    into new.addon_id, new.addon_name
    from public.addons as addon
    where addon.slug = new.addon_slug
    limit 1;
  end if;

  return new;
end;
$$;

alter function public.resolve_user_saved_addon_identifiers() owner to postgres;
revoke all privileges on function public.resolve_user_saved_addon_identifiers()
  from public, anon, authenticated, service_role;

drop trigger if exists resolve_user_saved_addon_identifiers
  on public.user_saved_addons;
create trigger resolve_user_saved_addon_identifiers
before insert or update of addon_slug, addon_id, addon_version_id,
  marketplace_listing_id, marketplace_addon_version_id, addon_name
on public.user_saved_addons
for each row execute function public.resolve_user_saved_addon_identifiers();

alter table public.marketplace_install_intents
  add column if not exists marketplace_addon_version_id uuid,
  add column if not exists legacy_addon_id uuid,
  add column if not exists legacy_addon_version_id uuid,
  add column if not exists addon_slug text,
  add column if not exists addon_name text,
  add column if not exists nonce_hash text,
  add column if not exists expires_at timestamptz,
  add column if not exists consumed_at timestamptz,
  add column if not exists local_device_id uuid,
  add column if not exists status text;

do $install_intent_foreign_keys$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'marketplace_install_intents_marketplace_addon_version_id_fkey'
      and conrelid = 'public.marketplace_install_intents'::regclass
  ) then
    alter table public.marketplace_install_intents
      add constraint marketplace_install_intents_marketplace_addon_version_id_fkey
      foreign key (marketplace_addon_version_id)
      references public.marketplace_addon_versions(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'marketplace_install_intents_legacy_addon_id_fkey'
      and conrelid = 'public.marketplace_install_intents'::regclass
  ) then
    alter table public.marketplace_install_intents
      add constraint marketplace_install_intents_legacy_addon_id_fkey
      foreign key (legacy_addon_id) references public.addons(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'marketplace_install_intents_legacy_addon_version_id_fkey'
      and conrelid = 'public.marketplace_install_intents'::regclass
  ) then
    alter table public.marketplace_install_intents
      add constraint marketplace_install_intents_legacy_addon_version_id_fkey
      foreign key (legacy_addon_version_id)
      references public.addon_versions(id) on delete set null;
  end if;
end
$install_intent_foreign_keys$;

update public.marketplace_install_intents
set
  marketplace_addon_version_id = coalesce(marketplace_addon_version_id, addon_version_id),
  status = coalesce(status, intent_status),
  expires_at = coalesce(expires_at, created_at + interval '10 minutes')
where marketplace_addon_version_id is null
   or status is null
   or expires_at is null;

alter table public.marketplace_install_intents
  drop constraint if exists marketplace_install_intents_lifecycle_check;
alter table public.marketplace_install_intents
  add constraint marketplace_install_intents_lifecycle_check check (
    intent_status in (
      'created', 'opened_by_local_elysia', 'validated_locally',
      'installed_locally', 'failed', 'expired', 'cancelled'
    )
    and status = intent_status
    and pg_catalog.char_length(coalesce(addon_slug, '')) <= 200
    and pg_catalog.char_length(coalesce(addon_name, '')) <= 500
    and (nonce_hash is null or nonce_hash ~ '^[0-9a-f]{64}$')
    and (expires_at is null or expires_at > created_at)
  ) not valid;
alter table public.marketplace_install_intents
  validate constraint marketplace_install_intents_lifecycle_check;

create index if not exists marketplace_install_intents_expiry_idx
  on public.marketplace_install_intents(intent_status, expires_at)
  where intent_status in ('created', 'opened_by_local_elysia');

create or replace function public.normalize_marketplace_install_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The active baseline's addon_version_id is the canonical Marketplace version.
  -- Capture an older catalog version separately when the current client submits
  -- both lineages, then overwrite the ambiguous field with the Marketplace ID.
  if new.marketplace_addon_version_id is not null then
    if new.addon_version_id is not null
       and new.addon_version_id <> new.marketplace_addon_version_id
       and exists (
         select 1 from public.addon_versions as legacy
         where legacy.id = new.addon_version_id
       ) then
      new.legacy_addon_version_id := coalesce(
        new.legacy_addon_version_id, new.addon_version_id
      );
    end if;
    new.addon_version_id := new.marketplace_addon_version_id;
  elsif new.addon_version_id is not null
        and not exists (
          select 1 from public.marketplace_addon_versions as current_version
          where current_version.id = new.addon_version_id
        ) then
    new.legacy_addon_version_id := coalesce(
      new.legacy_addon_version_id, new.addon_version_id
    );
    new.addon_version_id := null;
  else
    new.marketplace_addon_version_id := new.addon_version_id;
  end if;

  if new.legacy_addon_id is null and new.addon_slug is not null then
    select addon.id
    into new.legacy_addon_id
    from public.addons as addon
    where addon.slug = new.addon_slug
    limit 1;
  end if;

  if tg_op = 'INSERT' then
    new.intent_status := coalesce(nullif(new.status, ''), new.intent_status, 'created');
  elsif new.status is distinct from old.status then
    new.intent_status := new.status;
  elsif new.intent_status is distinct from old.intent_status then
    new.status := new.intent_status;
  end if;
  new.status := new.intent_status;

  if new.expires_at is null then
    new.expires_at := pg_catalog.now() + interval '10 minutes';
  end if;

  if tg_op = 'INSERT' and (
    new.nonce_hash is null or new.nonce_hash !~ '^[0-9a-f]{64}$'
  ) then
    raise exception using errcode = '22023', message = 'marketplace_install_nonce_invalid';
  end if;

  return new;
end;
$$;

alter function public.normalize_marketplace_install_intent() owner to postgres;
revoke all privileges on function public.normalize_marketplace_install_intent()
  from public, anon, authenticated, service_role;

drop trigger if exists normalize_marketplace_install_intent
  on public.marketplace_install_intents;
create trigger normalize_marketplace_install_intent
before insert or update on public.marketplace_install_intents
for each row execute function public.normalize_marketplace_install_intent();

drop policy if exists "users manage own saved addons" on public.user_saved_addons;
drop policy if exists "users select own saved add-ons" on public.user_saved_addons;
drop policy if exists "users insert own saved add-ons" on public.user_saved_addons;
drop policy if exists "users update own saved add-ons" on public.user_saved_addons;
drop policy if exists "users delete own saved add-ons" on public.user_saved_addons;
create policy "users select own saved add-ons"
  on public.user_saved_addons for select to authenticated
  using (user_id = auth.uid());
create policy "users insert own saved add-ons"
  on public.user_saved_addons for insert to authenticated
  with check (user_id = auth.uid());
create policy "users update own saved add-ons"
  on public.user_saved_addons for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own saved add-ons"
  on public.user_saved_addons for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "users_read_own_install_intents" on public.marketplace_install_intents;
drop policy if exists "users create own install intents" on public.marketplace_install_intents;
drop policy if exists "users read own install intents" on public.marketplace_install_intents;
drop policy if exists "users update own install intent state" on public.marketplace_install_intents;
drop policy if exists "users insert own install intents" on public.marketplace_install_intents;
drop policy if exists "users select own install intents" on public.marketplace_install_intents;
drop policy if exists "users update own install intents" on public.marketplace_install_intents;

create policy "users insert governed install intents"
  on public.marketplace_install_intents for insert to authenticated
  with check (
    user_id = auth.uid()
    and intent_status = 'created'
    and nonce_hash ~ '^[0-9a-f]{64}$'
    and expires_at > pg_catalog.now()
    and expires_at <= pg_catalog.now() + interval '15 minutes'
    and (
      (
        listing_id is not null
        and addon_version_id is not null
        and exists (
          select 1
          from public.marketplace_listings as listing
          join public.marketplace_addon_versions as version
            on version.listing_id = listing.id
          where listing.id = marketplace_install_intents.listing_id
            and version.id = marketplace_install_intents.addon_version_id
            and listing.listing_status = 'published'
            and listing.revoked_at is null
            and version.review_status in ('approved', 'published')
            and version.revoked_at is null
        )
      )
      or (
        listing_id is null
        and legacy_addon_id is not null
        and legacy_addon_version_id is not null
        and exists (
          select 1
          from public.addon_versions as legacy_version
          where legacy_version.id = marketplace_install_intents.legacy_addon_version_id
            and legacy_version.addon_id = marketplace_install_intents.legacy_addon_id
            and legacy_version.review_status = 'approved'
        )
      )
    )
  );

create policy "users select own install intents"
  on public.marketplace_install_intents for select to authenticated
  using (user_id = auth.uid());
create policy "users update own install intent lifecycle"
  on public.marketplace_install_intents for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and intent_status in (
      'created', 'opened_by_local_elysia', 'failed', 'expired', 'cancelled'
    )
  );

revoke all privileges on table public.user_saved_addons
  from public, anon, authenticated;
grant select, insert, update, delete on table public.user_saved_addons
  to authenticated;

revoke all privileges on table public.marketplace_install_intents
  from public, anon, authenticated;
grant select, insert on table public.marketplace_install_intents to authenticated;
grant update (intent_status, status, consumed_at, local_device_id)
  on public.marketplace_install_intents to authenticated;

comment on column public.marketplace_install_intents.addon_version_id is
  'Canonical marketplace_addon_versions identifier from the active baseline.';
comment on column public.marketplace_install_intents.marketplace_addon_version_id is
  'Compatibility projection of addon_version_id for older website payloads.';
comment on column public.marketplace_install_intents.legacy_addon_version_id is
  'Optional legacy addon_versions lineage; never confers current publication or install approval.';
comment on table public.marketplace_install_intents is
  'Short-lived handoff intent only. The website cannot install, enable, trust, or authorize an add-on locally.';

commit;
